// migration/04-migrate-attendance.ts
// Old `attendances` table (~17k rows) -> new `Attendance` model.
// Requires migration/.data/employees.json (run 01-migrate-users.ts first).
import { PrismaClient, Prisma } from '@prisma/client'
import { queryOld, closeOldDb } from './db'
import { IdMap } from './idmap'
import { ATTENDANCE_STATUS_MAP, WORKMODE_MAP, combineDateTime, toDateOnly } from './maps'

const prisma = new PrismaClient()
const employeeIdMap = new IdMap('employees') // old users.id -> new Employee.id
const BATCH_SIZE = 500

interface OldAttendance {
  id: number
  user_id: number
  date: string | Date | null
  in_time: string | null
  out_time: string | null
  late_minutes: number | null
  is_late: number
  workmode: 'WFH' | 'Office'
  note: string | null
  status: string
}

async function upsertMergedAttendance(
  employeeId: string,
  date: Date,
  values: {
    punchIn: Date | null
    punchOut: Date | null
    workMode: string
    status: string
    isLate: boolean
    lateBy: number | null
    notes: string | null
  }
) {
  // Explicit find-then-create/update instead of prisma's `upsert`.
  // Old data has multiple attendance rows for the same employee+date
  // (multiple punches/corrections in a day) which made `upsert` collide
  // on the unique(employeeId, date) constraint. Here we merge duplicates:
  // earliest punch-in, latest punch-out, notes concatenated.
  const existing = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date } },
  })

  if (!existing) {
    try {
      return await prisma.attendance.create({ data: { employeeId, date, ...values } })
    } catch (err) {
      // Safety net: if another row for this exact employee+date slipped
      // through (e.g. a date value that normalizes to the same DB day but
      // wasn't caught by findUnique above), don't drop the data — fetch the
      // row that now exists and merge into it instead of failing the row.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const nowExisting = await prisma.attendance.findUnique({
          where: { employeeId_date: { employeeId, date } },
        })
        if (nowExisting) {
          return mergeInto(nowExisting, values)
        }
      }
      throw err
    }
  }

  return mergeInto(existing, values)
}

function mergeInto(
  existing: { id: string; punchIn: Date | null; punchOut: Date | null; isLate: boolean; lateBy: number | null; status: string; workMode: string; notes: string | null },
  values: {
    punchIn: Date | null
    punchOut: Date | null
    workMode: string
    status: string
    isLate: boolean
    lateBy: number | null
    notes: string | null
  }
) {
  const punchIn =
    existing.punchIn && values.punchIn
      ? existing.punchIn < values.punchIn
        ? existing.punchIn
        : values.punchIn
      : existing.punchIn || values.punchIn

  const punchOut =
    existing.punchOut && values.punchOut
      ? existing.punchOut > values.punchOut
        ? existing.punchOut
        : values.punchOut
      : existing.punchOut || values.punchOut

  return prisma.attendance.update({
    where: { id: existing.id },
    data: {
      punchIn,
      punchOut,
      isLate: existing.isLate || values.isLate,
      lateBy: values.lateBy ?? existing.lateBy,
      status: values.status || existing.status,
      workMode: values.workMode || existing.workMode,
      notes: [existing.notes, values.notes].filter(Boolean).join(' | ') || null,
    },
  })
}

async function main() {
  console.log('🕒 Phase 4: migrating attendance...\n')

  // Guard against a stale migration/.data/employees.json cache (e.g. after
  // the target DB was reset/recreated) — only trust ids that actually exist.
  const validEmployeeIds = new Set<string>(
    (await prisma.employee.findMany({ select: { id: true } })).map((e: { id: string }) => e.id)
  )

  const [{ total }] = await queryOld<{ total: number }>(
    'SELECT COUNT(*) as total FROM attendances'
  )
  console.log(`Found ${total} attendance rows in old DB`)

  let migrated = 0
  let skippedNoEmployee = 0
  let skippedNoDate = 0
  let errors = 0

  for (let offset = 0; offset < total; offset += BATCH_SIZE) {
    const rows = await queryOld<OldAttendance>(
      'SELECT * FROM attendances ORDER BY id LIMIT ? OFFSET ?',
      [BATCH_SIZE, offset]
    )

    for (const a of rows) {
      const employeeId = employeeIdMap.get(a.user_id)
      if (!employeeId || !validEmployeeIds.has(employeeId)) {
        skippedNoEmployee++
        continue
      }
      if (!a.date) {
        skippedNoDate++
        continue
      }

      // Canonical UTC-midnight date, built the same way every time
      // regardless of whether mysql2 handed us a string or a Date object.
      // This is the fix for the earlier timezone-driven day-shift bug.
      const date = toDateOnly(a.date)

      try {
        await upsertMergedAttendance(employeeId, date, {
          punchIn: combineDateTime(a.date, a.in_time),
          punchOut: combineDateTime(a.date, a.out_time),
          workMode: WORKMODE_MAP[a.workmode] || 'WFO',
          status: ATTENDANCE_STATUS_MAP[a.status] || 'ABSENT',
          isLate: !!a.is_late,
          lateBy: a.late_minutes ?? null,
          notes: a.note || null,
        })
        migrated++
      } catch (err: any) {
        errors++
        console.warn(`⚠️  Row id=${a.id} (user_id=${a.user_id}, date=${a.date}) failed: ${err.message}`)
      }
    }

    console.log(`  ...processed ${Math.min(offset + BATCH_SIZE, total)}/${total} (migrated so far: ${migrated})`)
  }

  console.log(
    `\n✅ Phase 4 done. Migrated: ${migrated}, skipped (no matching employee): ${skippedNoEmployee}, skipped (no date): ${skippedNoDate}, errors: ${errors}\n`
  )
  if (skippedNoEmployee > 0) {
    console.log(
      `ℹ️  If skipped-no-employee count looks too high, your migration/.data cache\n` +
        `   may be stale (e.g. DB was reset). Delete the .data folder and re-run\n` +
        `   seed + migrate:users + migrate:clients before retrying this phase.\n`
    )
  }
}

main()
  .catch((e) => {
    console.error('❌ Phase 4 failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await closeOldDb()
  })