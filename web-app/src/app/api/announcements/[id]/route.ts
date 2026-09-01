// src/app/api/announcements/[id]/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

// PATCH /api/announcements/[id]  { isActive?: boolean, ...editable fields }
// Used both for editing an upcoming announcement and for cancelling one
// early (isActive: false) without losing its history/view records.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session
  const { id } = await params

  const existing = await prisma.scheduledAnnouncement.findUnique({ where: { id } })
  if (!existing) return notFoundResponse('Announcement')

  const body = await req.json().catch(() => ({}))
  const data: Record<string, any> = {}
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim()
  if (typeof body.message === 'string' && body.message.trim()) data.message = body.message.trim()
  if (typeof body.soundUrl === 'string' || body.soundUrl === null) data.soundUrl = body.soundUrl
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive
  if (body.scheduledAt) data.scheduledAt = new Date(body.scheduledAt)
  if (body.expiresAt) data.expiresAt = new Date(body.expiresAt)

  const updated = await prisma.scheduledAnnouncement.update({ where: { id }, data })

  await logFromRequest(req, {
    userId: session.userId,
    action: 'UPDATE',
    entityType: 'ScheduledAnnouncement',
    entityId: id,
    metadata: data,
  })

  return successResponse(updated)
}

// DELETE /api/announcements/[id] — permanently removes it (and its view records)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session
  const { id } = await params

  const existing = await prisma.scheduledAnnouncement.findUnique({ where: { id }, select: { id: true, title: true } })
  if (!existing) return notFoundResponse('Announcement')

  await prisma.scheduledAnnouncement.delete({ where: { id } })

  await logFromRequest(req, {
    userId: session.userId,
    action: 'DELETE',
    entityType: 'ScheduledAnnouncement',
    entityId: id,
    metadata: { title: existing.title },
  })

  return successResponse({ deleted: true })
}
