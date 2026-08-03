// migration/02-migrate-clients.ts
// Old `clients` table -> new `Client` model.
// Requires migration/.data/users.json (run 01-migrate-users.ts first).
import { PrismaClient } from '@prisma/client'
import { queryOld, closeOldDb } from './db'
import { IdMap } from './idmap'
import { firstIdFromList, padNumber } from './maps'

const prisma = new PrismaClient()
const userIdMap = new IdMap('users')
const clientIdMap = new IdMap('clients')

interface OldClient {
  id: number
  company_name: string | null
  client_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  onboarding_date: string | null
  sales_person_id: number | null
  telesales_id: number | null
  status: string | null
  image: string | null
  gst_no: string | null
  gst_applicable: 'Yes' | 'No' | null
  state: string | null
  city: string | null
  reporting_person_id: string | null
  created_by: number | null
  created_at: string | null
}

function resolveUser(oldId: number | null, validUserIds: Set<string>): string | null {
  if (!oldId) return null
  const id = userIdMap.get(oldId)
  return id && validUserIds.has(id) ? id : null
}

async function main() {
  console.log('🏢 Phase 2: migrating clients...\n')

  // Guard against a stale migration/.data cache (e.g. after the target DB
  // was reset/recreated) — only trust ids that actually exist.
  const validUserIds = new Set<string>(
    (await prisma.user.findMany({ select: { id: true } })).map((u: { id: string }) => u.id)
  )

  const oldClients = await queryOld<OldClient>('SELECT * FROM clients')
  console.log(`Found ${oldClients.length} clients in old DB`)

  let created = 0
  let skipped = 0
  let errors = 0

  for (const c of oldClients) {
    if (clientIdMap.has(c.id)) {
      skipped++
      continue
    }

    const reportingOldId = firstIdFromList(c.reporting_person_id)

    try {
      const client = await prisma.client.upsert({
        where: { clientCode: `CLT-${padNumber(c.id, 6)}` },
        update: {},
        create: {
          clientCode: `CLT-${padNumber(c.id, 6)}`,
          companyName: c.company_name || c.client_name || 'Unknown',
          clientName: c.client_name || 'Unknown',
          phone: c.phone || '',
          email: c.email || null,
          address: c.address || null,
          state: c.state || null,
          city: c.city || null,
          gstApplicable: c.gst_applicable === 'Yes',
          gstNo: c.gst_no || null,
          onboardingDate:
            c.onboarding_date && c.onboarding_date !== '0000-00-00'
              ? new Date(c.onboarding_date)
              : null,
          status: c.status === '1' ? 'ACTIVE' : 'INACTIVE',
          image: c.image || null,
          telecallerId: resolveUser(c.telesales_id, validUserIds),
          assignedToId: resolveUser(c.sales_person_id, validUserIds),
          reportingPersonId: resolveUser(reportingOldId, validUserIds),
          createdById: resolveUser(c.created_by, validUserIds),
        },
      })

      clientIdMap.set(c.id, client.id)
      created++
    } catch (err: any) {
      errors++
      console.warn(`⚠️  Client id=${c.id} failed: ${err.message}`)
    }
  }

  console.log(
    `\n✅ Phase 2 done. Created/updated: ${created}, already-migrated skipped: ${skipped}, errors: ${errors}\n`
  )
}

main()
  .catch((e) => {
    console.error('❌ Phase 2 failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await closeOldDb()
  })
