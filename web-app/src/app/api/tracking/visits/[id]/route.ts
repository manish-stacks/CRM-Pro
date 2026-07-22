// src/app/api/tracking/visits/[id]/route.ts
// Admin/Manager: edit or delete a scheduled visit.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { Notifications } from '@/lib/notify'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'MANAGER')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const existing = await prisma.clientVisit.findUnique({ where: { id } })
  if (!existing) return notFoundResponse('Visit')

  const body = await req.json().catch(() => ({}))
  const { userId, clientId, clientName, purpose, notes, scheduledDate, scheduledTime, location, status } = body

  const data: any = {}
  if (userId && userId !== existing.userId) {
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true } })
    if (!target) return errorResponse('User not found', 404)
    if (!target.isActive) return errorResponse('Cannot assign a visit to a disabled user')
    if (!['MARKETING_EXECUTIVE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(target.role)) {
      return errorResponse('Visits can only be assigned to a MARKETING_EXECUTIVE (or higher)')
    }
    data.userId = userId
  }
  if (clientId !== undefined) data.clientId = clientId || null
  if (clientName?.trim()) data.clientName = clientName.trim()
  if (purpose !== undefined) data.purpose = purpose?.trim() || null
  if (notes !== undefined) data.notes = notes?.trim() || null
  if (scheduledTime !== undefined) data.scheduledTime = scheduledTime?.trim() || null
  if (location !== undefined) data.checkInAddress = location?.trim() || null
  if (scheduledDate) {
    const sd = new Date(scheduledDate)
    if (isNaN(sd.getTime())) return errorResponse('Invalid visit date')
    data.scheduledDate = sd
  }
  if (status) {
    const st = String(status).toUpperCase()
    if (!['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(st)) return errorResponse('Invalid status')
    data.status = st
  }

  const visit = await prisma.clientVisit.update({
    where: { id },
    data,
    include: { user: { select: { id: true, name: true, avatar: true } } },
  })

  const notifyUser = data.userId || existing.userId
  if (notifyUser !== session.userId) {
    const when = visit.scheduledDate ? visit.scheduledDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'TBD'
    await Notifications.visitUpdated(notifyUser, visit.clientName, when, visit.id).catch(() => {})
  }

  await logFromRequest(req, {
    userId: session.userId, action: 'UPDATE', entityType: 'ClientVisit', entityId: id,
    changes: data,
  })

  return successResponse(visit)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const existing = await prisma.clientVisit.findUnique({ where: { id } })
  if (!existing) return notFoundResponse('Visit')

  await prisma.clientVisit.delete({ where: { id } })

  await logFromRequest(req, {
    userId: session.userId, action: 'DELETE', entityType: 'ClientVisit', entityId: id,
    metadata: { clientName: existing.clientName },
  })

  return successResponse({ id })
}
