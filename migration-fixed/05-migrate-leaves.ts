// migration/05-migrate-leaves.ts
// Old `leaves` table -> new `Leave` model.
// Requires migration/.data/employees.json and users.json
// (run 01-migrate-users.ts first).
import { PrismaClient } from '@prisma/client'
import { queryOld, closeOldDb } from './db'
import { IdMap } from './idmap'
import {
  LEAVE_TYPE_MAP,
  DEFAULT_LEAVE_TYPE,
  LEAVE_DURATION_MAP,
  LEAVE_STATUS_MAP,
} from './maps'

const prisma = new PrismaClient()
const employeeIdMap = new IdMap('employees') // old users.id -> new Employee.id
const userIdMap = new IdMap('users') // old users.id -> new User.id (for approvedBy)
const leaveIdMap = new IdMap('leaves') // old leaves.id -> new Leave.id

interface OldLeave {
  id: number
  user_id: number
  leave_type_id: number
  duration: 'single_day' | 'multiple_days' | 'short_hourly'
  date: string | null
  short_date: string | null
  start_date: string | null
  end_date: string | null
  hours: string | null
  start_time: string | null
  end_time: string | null
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  approved_by: number | null
  created_at: string | null
  updated_at: string | null
}

function daysBetweenInclusive(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return Math.max(1, Math.round(ms / 86400000) + 1)
}

async function main() {
  console.log('🌴 Phase 5: migrating leaves...\n')

  const leaveTypes = await queryOld<{ id: number; name: string }>(
    'SELECT id, name FROM leave_types'
  )
  const leaveTypeNameById = new Map(leaveTypes.map((t) => [t.id, t.name]))

  // Guard against a stale migration/.data cache (e.g. after the target DB
  // was reset/recreated) — only trust ids that actually exist.
  const validEmployeeIds = new Set<string>(
    (await prisma.employee.findMany({ select: { id: true } })).map((e: { id: string }) => e.id)
  )

  const oldLeaves = await queryOld<OldLeave>('SELECT * FROM leaves')
  console.log(`Found ${oldLeaves.length} leave rows in old DB`)

  let created = 0
  let skipped = 0
  let skippedNoEmployee = 0
  let errors = 0

  for (const l of oldLeaves) {
    if (leaveIdMap.has(l.id)) {
      skipped++
      continue
    }

    const employeeId = employeeIdMap.get(l.user_id)
    if (!employeeId || !validEmployeeIds.has(employeeId)) {
      skippedNoEmployee++
      continue
    }

    let startDate: string | null = null
    let endDate: string | null = null
    let days = 1

    if (l.duration === 'single_day' && l.date) {
      startDate = endDate = l.date
      days = 1
    } else if (l.duration === 'short_hourly' && l.short_date) {
      startDate = endDate = l.short_date
      days = l.hours ? parseFloat(l.hours) / 8 : 0.5
    } else if (l.duration === 'multiple_days' && l.start_date && l.end_date) {
      startDate = l.start_date
      endDate = l.end_date
      days = daysBetweenInclusive(l.start_date, l.end_date)
    }

    if (!startDate || !endDate) {
      console.warn(`⚠️  Skipping old leave id=${l.id} — missing date fields`)
      continue
    }

    const typeName = leaveTypeNameById.get(l.leave_type_id)

    try {
      const leave = await prisma.leave.create({
        data: {
          employeeId,
          leaveType: (typeName && LEAVE_TYPE_MAP[typeName]) || DEFAULT_LEAVE_TYPE,
          duration: LEAVE_DURATION_MAP[l.duration] || 'SINGLE_DAY',
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          days,
          hourlyStart: l.start_time || null,
          hourlyEnd: l.end_time || null,
          hourlyHours: l.hours ? parseFloat(l.hours) : null,
          reason: l.reason || 'N/A',
          status: LEAVE_STATUS_MAP[l.status] || 'PENDING',
          approvedBy: l.approved_by ? userIdMap.get(l.approved_by) ?? null : null,
          createdAt: l.created_at ? new Date(l.created_at) : undefined,
          updatedAt: l.updated_at ? new Date(l.updated_at) : undefined,
        },
      })

      leaveIdMap.set(l.id, leave.id)
      created++
    } catch (err: any) {
      errors++
      console.warn(
        `⚠️  Leave id=${l.id} (old user_id=${l.user_id}, mapped employeeId=${employeeId}) failed: ${err.message}`
      )
    }
  }

  console.log(
    `\n✅ Phase 5 done. Created: ${created}, already-migrated skipped: ${skipped}, skipped (no employee match): ${skippedNoEmployee}, errors: ${errors}\n`
  )
}

main()
  .catch((e) => {
    console.error('❌ Phase 5 failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await closeOldDb()
  })
