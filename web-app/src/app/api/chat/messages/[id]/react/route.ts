// src/app/api/chat/messages/[id]/react/route.ts
// Add/replace or remove your reaction on a message. One reaction per user
// per message — picking a new emoji replaces the old one.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { emitToGroup } from '@/lib/socketServer'

async function assertCanSeeMessage(messageId: string, userId: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId } })
  if (!message || message.isDeleted || !message.chatGroupId) return null
  const membership = await prisma.chatMember.findFirst({
    where: { chatGroupId: message.chatGroupId, userId, isActive: true },
  })
  return membership ? message : null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { emoji } = await req.json()
  if (!emoji || typeof emoji !== 'string' || emoji.length > 8) return errorResponse('A valid emoji is required')

  const message = await assertCanSeeMessage(id, session.userId)
  if (!message) return errorResponse('Message not found', 404)

  const reaction = await prisma.messageReaction.upsert({
    where: { messageId_userId: { messageId: id, userId: session.userId } },
    update: { emoji },
    create: { messageId: id, userId: session.userId, emoji },
  })

  emitToGroup(message.chatGroupId!, 'chat:reaction', { messageId: id, chatGroupId: message.chatGroupId })

  return successResponse(reaction)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const message = await assertCanSeeMessage(id, session.userId)
  if (!message) return errorResponse('Message not found', 404)

  await prisma.messageReaction.deleteMany({ where: { messageId: id, userId: session.userId } })
  emitToGroup(message.chatGroupId!, 'chat:reaction', { messageId: id, chatGroupId: message.chatGroupId })
  return successResponse({ removed: true })
}
