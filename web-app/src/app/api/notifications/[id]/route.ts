// src/app/api/notifications/[id]/route.ts
// Mark one notification read / delete
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, notFoundResponse, unauthorizedResponse } from '@/lib/api'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const n = await prisma.notification.findFirst({ where: { id, userId: session.userId } })
  if (!n) return notFoundResponse('Notification')

  await prisma.notification.update({ where: { id }, data: { isRead: true } })
  return successResponse({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const n = await prisma.notification.findFirst({ where: { id, userId: session.userId } })
  if (!n) return notFoundResponse('Notification')

  await prisma.notification.delete({ where: { id } })
  return successResponse({ ok: true })
}
