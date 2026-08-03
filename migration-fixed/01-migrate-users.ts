// migration/01-migrate-users.ts
// Old `users` table -> new `User` + `Employee` models.
// Run FIRST — every other phase depends on migration/.data/users.json
import { PrismaClient } from '@prisma/client'
import { queryOld, closeOldDb } from './db'
import { IdMap } from './idmap'
import { DEPARTMENT_SLUG_MAP, mapUserRole } from './maps'

const prisma = new PrismaClient()
const userIdMap = new IdMap('users') // old users.id -> new User.id
const employeeIdMap = new IdMap('employees') // old users.id -> new Employee.id

interface OldUser {
  id: number
  employee_id: string | null
  department_id: number | null
  joining_date: string | null
  name: string | null
  gender: string | null
  email: string
  password: string
  isadmin: number
  image: string | null
  dob: string | null
  salary: string | null
  father_name: string | null
  mother_name: string | null
  status: number
  job_title: string | null
  disable_login: number
  address: string | null
  phone: string | null
  alternative_phone: string | null
  account_holder_name: string | null
  bank_name: string | null
  account_number: string | null
  ifsc_code: string | null
  branch: string | null
  pan_number: string | null
  aadhaar_front: string | null
  aadhaar_back: string | null
  created_at: string | null
  updated_at: string | null
}

async function getDepartmentIdBySlug(slug: string | undefined): Promise<string | null> {
  if (!slug) return null
  const dept = await prisma.department.findUnique({ where: { slug } })
  return dept?.id ?? null
}

async function main() {
  console.log('👥 Phase 1: migrating users + employees...\n')

  const oldUsers = await queryOld<OldUser>('SELECT * FROM users')
  console.log(`Found ${oldUsers.length} users in old DB`)

  // Cache department lookups so we don't hit the DB per row
  const deptCache = new Map<string, string | null>()

  let created = 0
  let skipped = 0

  for (const u of oldUsers) {
    if (userIdMap.has(u.id)) {
      skipped++
      continue // already migrated in a previous run
    }

    if (!u.email) {
      console.warn(`⚠️  Skipping old user id=${u.id} — no email`)
      continue
    }

    const slug = u.department_id ? DEPARTMENT_SLUG_MAP[u.department_id] : undefined
    if (slug && !deptCache.has(slug)) {
      deptCache.set(slug, await getDepartmentIdBySlug(slug))
    }
    const departmentId = slug ? deptCache.get(slug) ?? null : null

    const isActive = u.status === 1 && u.disable_login !== 1

    // upsert on email so re-runs / pre-existing seed users don't duplicate
    const user = await prisma.user.upsert({
      where: { email: u.email.trim().toLowerCase() },
      update: {},
      create: {
        email: u.email.trim().toLowerCase(),
        password: u.password, // bcrypt hash copied as-is, verify login works
        name: u.name?.trim() || u.email,
        role: mapUserRole(u.isadmin, u.id),
        avatar: u.image || null,
        phone: u.phone || null,
        altPhone: u.alternative_phone || null,
        dateOfBirth: u.dob && u.dob !== '0000-00-00' ? new Date(u.dob) : null,
        isActive,
      },
    })

    userIdMap.set(u.id, user.id)

    if (u.employee_id) {
      const employee = await prisma.employee.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          employeeId: u.employee_id,
          departmentId,
          position: u.job_title || null,
          salary: u.salary ? parseFloat(u.salary) : 0,
          joiningDate:
            u.joining_date && u.joining_date !== '0000-00-00'
              ? new Date(u.joining_date)
              : null,
          dateOfBirth: u.dob && u.dob !== '0000-00-00' ? new Date(u.dob) : null,
          gender: u.gender || null,
          fatherName: u.father_name || null,
          motherName: u.mother_name || null,
          address: u.address || null,
          panNumber: u.pan_number || null,
          aadharFrontUrl: u.aadhaar_front || null,
          aadharBackUrl: u.aadhaar_back || null,
          bankName: u.bank_name || null,
          accountNumber: u.account_number || null,
          ifscCode: u.ifsc_code || null,
          accountHolderName: u.account_holder_name || null,
        },
      })
      employeeIdMap.set(u.id, employee.id)
    }

    created++
    if (created % 20 === 0) console.log(`  ...${created} users migrated`)
  }

  console.log(`\n✅ Phase 1 done. Created/updated: ${created}, already-migrated skipped: ${skipped}\n`)
}

main()
  .catch((e) => {
    console.error('❌ Phase 1 failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await closeOldDb()
  })
