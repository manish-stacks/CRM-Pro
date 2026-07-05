// src/app/api/mobile/visits/[id]/complete/route.ts
// Marketing person leaves the meeting → records check-out + duration.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { logFromRequest } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  let body: any = {}
  try { body = await req.json() } catch {}
  const { latitude, longitude, notes } = body

  const visit = await prisma.clientVisit.findFirst({ where: { id, userId: session.userId } })
  if (!visit) return fail('Visit not found', 404)

  const checkOut = new Date()
  const durationMins = visit.checkInAt
    ? Math.round((checkOut.getTime() - visit.checkInAt.getTime()) / 60000)
    : null

  const updated = await prisma.clientVisit.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      checkOutAt: checkOut,
      checkOutLat: latitude ?? null,
      checkOutLng: longitude ?? null,
      durationMins,
      notes: notes?.trim() || visit.notes,
    },
  })

  await logFromRequest(req, {
    userId: session.userId, action: 'UPDATE', entityType: 'ClientVisit', entityId: id,
    metadata: { via: 'mobile', event: 'complete', durationMins },
  })

  return ok({ id: updated.id, status: updated.status, durationMins })
}
