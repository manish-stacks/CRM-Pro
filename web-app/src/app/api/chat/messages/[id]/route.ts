// src/app/api/chat/messages/[id]/route.ts
// Delete a single message.
// - "for me" (default): hides it on your side only via a MessageDeletion
//   row. Everyone else in the chat still sees it, untouched.
// - "for everyone" (?forEveryone=1): only the original sender can do this,
//   within a short window; it wipes the content for the whole chat.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { emitToGroup } from '@/lib/socketServer'

const FOR_EVERYONE_WINDOW_MS = 24 * 60 * 60 * 1000 // 24h, adjust as needed

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const forEveryone = searchParams.get('forEveryone') === '1'

  const message = await prisma.message.findUnique({ where: { id } })
  if (!message || message.isDeleted) return errorResponse('Message not found', 404)

  if (!message.chatGroupId) return errorResponse('Cannot delete this message', 400)
  const membership = await prisma.chatMember.findFirst({
    where: { chatGroupId: message.chatGroupId, userId: session.userId, isActive: true },
  })
  if (!membership) return errorResponse('Not a member of this chat', 403)

  if (forEveryone) {
    if (message.senderId !== session.userId) {
      return errorResponse('You can only delete your own messages for everyone', 403)
    }
    if (Date.now() - new Date(message.createdAt).getTime() > FOR_EVERYONE_WINDOW_MS) {
      return errorResponse('Too late to delete this for everyone — you can still delete it for yourself', 403)
    }
    await prisma.message.update({
      where: { id },
      data: { isDeleted: true, content: '' },
    })
    emitToGroup(message.chatGroupId, 'chat:messageDeleted', { id, chatGroupId: message.chatGroupId })
    return successResponse({ deleted: true, forEveryone: true })
  }

  await prisma.messageDeletion.upsert({
    where: { messageId_userId: { messageId: id, userId: session.userId } },
    update: {},
    create: { messageId: id, userId: session.userId },
  })

  return successResponse({ deleted: true, forEveryone: false })
}
