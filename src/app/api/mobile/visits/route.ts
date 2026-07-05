// src/app/api/mobile/visits/route.ts
// List + create client visits for the marketing person.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { logFromRequest } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  const visits = await prisma.clientVisit.findMany({
    where: { userId: session.userId },
    orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }],
    take: 100,
    include: { client: { select: { clientName: true, phone: true } } },
  })

  return ok(visits.map(v => ({
    id: v.id,
    client_id: v.clientId,
    client_name: v.clientName || v.client?.clientName || 'Client',
    purpose: v.purpose,
    notes: v.notes,
    status: v.status.toLowerCase(),
    visit_date: v.scheduledDate ? v.scheduledDate.toISOString().slice(0, 10) : null,
    visit_time: v.scheduledTime,
    location: v.checkInAddress,
    check_in_at: v.checkInAt,
    check_out_at: v.checkOutAt,
    duration_mins: v.durationMins,
  })))
}

export async function POST(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  let body: any = {}
  try { body = await req.json() } catch { return fail('Invalid body') }
  const { client_id, client_name, visit_date, visit_time, purpose, location } = body

  if (!client_name?.trim()) return fail('Client name is required')
  if (!visit_date?.trim()) return fail('Visit date is required')

  const visit = await prisma.clientVisit.create({
    data: {
      userId: session.userId,
      clientId: client_id || null,
      clientName: client_name.trim(),
      purpose: purpose?.trim() || null,
      scheduledDate: new Date(visit_date),
      scheduledTime: visit_time?.trim() || null,
      checkInAddress: location?.trim() || null,
      status: 'PENDING',
    },
  })

  await logFromRequest(req, {
    userId: session.userId, action: 'CREATE', entityType: 'ClientVisit', entityId: visit.id,
    metadata: { via: 'mobile', clientName: visit.clientName },
  })

  return ok({ id: visit.id, status: visit.status })
}
