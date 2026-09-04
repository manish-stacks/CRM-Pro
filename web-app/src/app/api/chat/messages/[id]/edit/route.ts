// src/app/api/chat/messages/[id]/edit/route.ts
// Edit your own message's text. Attachments/reactions/replies untouched;
// just updates content and flags isEdited so the UI can show "(edited)".
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { emitToGroup } from '@/lib/socketServer'

const EDIT_WINDOW_MS = 15 * 60 * 1000 // matches the UI — WhatsApp-style edit window

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { content } = await req.json()
  if (!content?.trim()) return errorResponse('Content required')

  const message = await prisma.message.findUnique({ where: { id } })
  if (!message || message.isDeleted) return errorResponse('Message not found', 404)
  if (message.senderId !== session.userId) return errorResponse('You can only edit your own messages', 403)
  if (Date.now() - new Date(message.createdAt).getTime() > EDIT_WINDOW_MS) {
    return errorResponse('This message is too old to edit')
  }
  if (message.attachmentUrl && !message.content) {
    // Editing an attachment-only message just adds a caption — fine either way.
  }

  const updated = await prisma.message.update({
    where: { id },
    data: { content: content.trim(), isEdited: true, editedAt: new Date() },
    include: {
      sender: { select: { id: true, name: true, avatar: true } },
      mentions: { include: { user: { select: { id: true, name: true } } } },
      reactions: { include: { user: { select: { id: true, name: true } } } },
      replyTo: { select: { id: true, content: true, isDeleted: true, attachmentName: true, sender: { select: { id: true, name: true } } } },
    },
  })

  if (updated.chatGroupId) {
    emitToGroup(updated.chatGroupId, 'chat:messageEdited', updated)
  }


  return successResponse(updated)
}
