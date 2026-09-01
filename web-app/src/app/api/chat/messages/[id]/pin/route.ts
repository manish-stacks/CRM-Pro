// src/app/api/chat/messages/[id]/pin/route.ts
// Toggle pin on a message. In a GROUP chat only the chat-admin/app-admin
// can pin (keeps the pinned list meaningful); in a DIRECT chat either
// participant can.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const message = await prisma.message.findUnique({ where: { id } })
  if (!message || message.isDeleted || !message.chatGroupId) return errorResponse('Message not found', 404)

  const group = await prisma.chatGroup.findUnique({ where: { id: message.chatGroupId } })
  const membership = await prisma.chatMember.findFirst({
    where: { chatGroupId: message.chatGroupId, userId: session.userId, isActive: true },
  })
  if (!group || !membership) return errorResponse('Not a member of this chat', 403)

  if (group.type === 'GROUP') {
    const canPin = hasMinRole(session.role, 'ADMIN') || membership.role === 'ADMIN'
    if (!canPin) return errorResponse('Only the group admin can pin messages', 403)
  }

  const nowPinned = !message.isPinned
  // Cap pinned messages so the list stays useful.
  if (nowPinned) {
    const count = await prisma.message.count({ where: { chatGroupId: message.chatGroupId, isPinned: true } })
    if (count >= 20) return errorResponse('Unpin something first — max 20 pinned messages per chat')
  }

  const updated = await prisma.message.update({
    where: { id },
    data: nowPinned
      ? { isPinned: true, pinnedAt: new Date(), pinnedById: session.userId }
      : { isPinned: false, pinnedAt: null, pinnedById: null },
  })

  return successResponse(updated)
}
