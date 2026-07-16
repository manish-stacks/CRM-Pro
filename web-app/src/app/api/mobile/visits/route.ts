// src/app/api/mobile/visits/route.ts
// List + create client visits for the marketing person.
// GET supports filters used by the app's Visits screen:
//   ?range=today|upcoming|overdue|week|month   ?status=pending|in_progress|completed|cancelled
//   ?date=YYYY-MM-DD   ?dateFrom=&dateTo=   ?search=
// Response also carries `counts` so the app can show badge numbers on the tabs.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { logFromRequest } from '@/lib/audit'

function dayRange(d: Date) {
  const start = new Date(d); start.setHours(0, 0, 0, 0)
  const end = new Date(d); end.setHours(23, 59, 59, 999)
  return { start, end }
}

const shape = (v: any) => ({
  id: v.id,
  client_id: v.clientId,
  lead_id: v.leadId,
  client_name: v.clientName || v.client?.clientName || 'Client',
  purpose: v.purpose,
  notes: v.notes,
  status: v.status.toLowerCase(),
  source: v.source,
  outcome: v.outcome,
  visit_date: v.scheduledDate ? v.scheduledDate.toISOString().slice(0, 10) : null,
  visit_time: v.scheduledTime,
  location: v.checkInAddress,
  client_phone: v.client?.phone || null,
  check_in_at: v.checkInAt,
  check_out_at: v.checkOutAt,
  duration_mins: v.durationMins,
  created_at: v.createdAt,
})

export async function GET(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  const { searchParams } = new URL(req.url)
  const range = searchParams.get('range')
  const status = searchParams.get('status')
  const date = searchParams.get('date')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const search = searchParams.get('search')

  const where: any = { userId: session.userId }
  if (status && status !== 'all') where.status = status.toUpperCase()
  if (search) {
    where.OR = [{ clientName: { contains: search } }, { purpose: { contains: search } }]
  }

  const now = new Date()
  const today = dayRange(now)

  if (date) {
    const d = dayRange(new Date(date))
    where.scheduledDate = { gte: d.start, lte: d.end }
  } else if (range === 'today') {
    where.scheduledDate = { gte: today.start, lte: today.end }
  } else if (range === 'upcoming') {
    where.scheduledDate = { gt: today.end }
    if (!where.status) where.status = { in: ['PENDING', 'IN_PROGRESS'] }
  } else if (range === 'overdue') {
    where.scheduledDate = { lt: today.start }
    if (!where.status) where.status = { in: ['PENDING', 'IN_PROGRESS'] }
  } else if (range === 'week') {
    const start = new Date(today.start); start.setDate(start.getDate() - start.getDay())
    const end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999)
    where.scheduledDate = { gte: start, lte: end }
  } else if (range === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    where.scheduledDate = { gte: start, lte: end }
  } else if (dateFrom || dateTo) {
    where.scheduledDate = {}
    if (dateFrom) where.scheduledDate.gte = new Date(dateFrom)
    if (dateTo) where.scheduledDate.lte = new Date(dateTo + 'T23:59:59')
  }

  const base = { userId: session.userId }
  const [visits, counts] = await Promise.all([
    prisma.clientVisit.findMany({
      where,
      orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
      include: { client: { select: { clientName: true, phone: true } } },
    }),
    (async () => {
      const [all, todayC, pending, completed, upcoming, overdue] = await Promise.all([
        prisma.clientVisit.count({ where: base }),
        prisma.clientVisit.count({ where: { ...base, scheduledDate: { gte: today.start, lte: today.end } } }),
        prisma.clientVisit.count({ where: { ...base, status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
        prisma.clientVisit.count({ where: { ...base, status: 'COMPLETED' } }),
        prisma.clientVisit.count({ where: { ...base, status: { in: ['PENDING', 'IN_PROGRESS'] }, scheduledDate: { gt: today.end } } }),
        prisma.clientVisit.count({ where: { ...base, status: { in: ['PENDING', 'IN_PROGRESS'] }, scheduledDate: { lt: today.start } } }),
      ])
      return { all, today: todayC, pending, completed, upcoming, overdue }
    })(),
  ])

  return ok(visits.map(shape), { counts })
}

export async function POST(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  let body: any = {}
  try { body = await req.json() } catch { return fail('Invalid body') }
  const { client_id, client_name, visit_date, visit_time, purpose, notes, location } = body

  if (!client_name?.trim()) return fail('Client name is required')
  if (!visit_date?.trim()) return fail('Visit date is required')

  const sd = new Date(visit_date)
  if (isNaN(sd.getTime())) return fail('Invalid visit date')

  const visit = await prisma.clientVisit.create({
    data: {
      userId: session.userId,
      clientId: client_id || null,
      createdById: session.userId,
      clientName: client_name.trim(),
      purpose: purpose?.trim() || null,
      notes: notes?.trim() || null,
      scheduledDate: sd,
      scheduledTime: visit_time?.trim() || null,
      checkInAddress: location?.trim() || null,
      status: 'PENDING',
      source: 'MANUAL',
    },
    include: { client: { select: { clientName: true, phone: true } } },
  })

  await logFromRequest(req, {
    userId: session.userId, action: 'CREATE', entityType: 'ClientVisit', entityId: visit.id,
    metadata: { via: 'mobile', clientName: visit.clientName },
  })

  return ok(shape(visit))
}
