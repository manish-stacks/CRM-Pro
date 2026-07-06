// migration/03-migrate-leads.ts
// Old `leads` table (~1.3 lakh rows) -> new `Lead` model.
// Requires migration/.data/users.json (run 01-migrate-users.ts first).
//
// NOTE: this table is huge, so we page through it in batches and use
// `createMany({ skipDuplicates: true })` keyed on the unique `leadNumber`
// (built from the old numeric id) instead of per-row upserts — this keeps
// re-runs safe without doing 129k individual round-trips.
import { PrismaClient } from '@prisma/client'
import { queryOld, closeOldDb } from './db'
import { IdMap } from './idmap'
import {
  LEAD_STATUS_MAP,
  DEFAULT_LEAD_STATUS,
  LEAD_SOURCE_MAP,
  DEFAULT_LEAD_SOURCE,
  padNumber,
} from './maps'

const prisma = new PrismaClient()
const userIdMap = new IdMap('users')
const BATCH_SIZE = 1000

interface OldLead {
  id: number
  company_name: string | null
  client_name: string | null
  client_phone: string | null
  client_email: string | null
  address: string | null
  status_id: number | null
  source_id: number | null
  assigned_to: number | null
  product_pitched: string | null
  price: string | null
  link: string | null
  service: string | null
  created_at: string | null
  updated_at: string | null
}

async function main() {
  console.log('🎯 Phase 3: migrating leads...\n')

  const [statuses, sources] = await Promise.all([
    queryOld<{ id: number; name: string }>('SELECT id, name FROM lead_statuses'),
    queryOld<{ id: number; name: string }>('SELECT id, name FROM lead_sources'),
  ])
  const statusNameById = new Map(statuses.map((s) => [s.id, s.name]))
  const sourceNameById = new Map(sources.map((s) => [s.id, s.name]))

  const fallbackAdmin = await prisma.user.findUnique({ where: { email: 'admin@hbs.com' } })
  if (!fallbackAdmin) {
    throw new Error('Super admin (admin@hbs.com) not found — run prisma/seed.ts first.')
  }

  // Guard against a stale migration/.data cache (e.g. after the target DB
  // was reset/recreated) — only trust ids that actually exist.
  const validUserIds = new Set<string>(
    (await prisma.user.findMany({ select: { id: true } })).map((u: { id: string }) => u.id)
  )

  const [{ total }] = await queryOld<{ total: number }>('SELECT COUNT(*) as total FROM leads')
  console.log(`Found ${total} leads in old DB — migrating in batches of ${BATCH_SIZE}`)

  let migrated = 0

  for (let offset = 0; offset < total; offset += BATCH_SIZE) {
    const rows = await queryOld<OldLead>(
      'SELECT * FROM leads ORDER BY id LIMIT ? OFFSET ?',
      [BATCH_SIZE, offset]
    )

    const data = rows.map((l) => {
      const statusName = l.status_id ? statusNameById.get(l.status_id) : undefined
      const sourceName = l.source_id ? sourceNameById.get(l.source_id) : undefined
      const mappedAssignee = l.assigned_to ? userIdMap.get(l.assigned_to) : undefined
      const assignedToId = mappedAssignee && validUserIds.has(mappedAssignee) ? mappedAssignee : null

      return {
        leadNumber: `LEAD-${padNumber(l.id, 6)}`,
        companyName: l.company_name || null,
        clientName: l.client_name || 'Unknown',
        clientPhone: l.client_phone || '',
        clientEmail: l.client_email || null,
        link: l.link || null,
        address: l.address || null,
        source: (sourceName && LEAD_SOURCE_MAP[sourceName]) || DEFAULT_LEAD_SOURCE,
        service: l.service || null,
        productPitched: l.product_pitched || null,
        price: l.price ? parseFloat(l.price) : null,
        status: (statusName && LEAD_STATUS_MAP[statusName]) || DEFAULT_LEAD_STATUS,
        assignedToId,
        // old `leads` table has no `created_by` column — fall back to the
        // assignee, else the super admin, so the required field is satisfied
        createdById: assignedToId || fallbackAdmin.id,
        createdAt: l.created_at ? new Date(l.created_at) : undefined,
        updatedAt: l.updated_at ? new Date(l.updated_at) : undefined,
      }
    })

    try {
      const result = await prisma.lead.createMany({ data, skipDuplicates: true })
      migrated += result.count
    } catch (err: any) {
      // A bad row can fail the whole batch — fall back to per-row inserts
      // so we can isolate and skip just the problematic one(s).
      console.warn(`⚠️  Batch at offset ${offset} failed as a whole (${err.message}), retrying row-by-row...`)
      for (const row of data) {
        try {
          await prisma.lead.create({ data: row })
          migrated++
        } catch (rowErr: any) {
          console.warn(`⚠️  Lead ${row.leadNumber} failed: ${rowErr.message}`)
        }
      }
    }
    console.log(`  ...processed ${Math.min(offset + BATCH_SIZE, total)}/${total} (inserted so far: ${migrated})`)
  }

  console.log(`\n✅ Phase 3 done. Total leads inserted: ${migrated}\n`)
}

main()
  .catch((e) => {
    console.error('❌ Phase 3 failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await closeOldDb()
  })
