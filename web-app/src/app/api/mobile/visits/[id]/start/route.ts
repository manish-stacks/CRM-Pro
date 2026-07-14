// src/app/api/mobile/visits/[id]/start/route.ts
// Marketing person arrives → records check-in location + timestamp.
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
  const { latitude, longitude, address } = body

  const visit = await prisma.clientVisit.findFirst({ where: { id, userId: session.userId } })
  if (!visit) return fail('Visit not found', 404)

  const updated = await prisma.clientVisit.update({
    where: { id },
    data: {
      status: 'IN_PROGRESS',
      checkInAt: new Date(),
      checkInLat: latitude ?? null,
      checkInLng: longitude ?? null,
      checkInAddress: address ?? visit.checkInAddress,
    },
  })

  await logFromRequest(req, {
    userId: session.userId, action: 'UPDATE', entityType: 'ClientVisit', entityId: id,
    metadata: { via: 'mobile', event: 'check_in', lat: latitude, lng: longitude },
  })

  return ok({ id: updated.id, status: updated.status, checkInAt: updated.checkInAt })
}
