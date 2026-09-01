// src/app/api/chat/messages/[id]/forward/route.ts
// Forward a message's content/attachment into one or more other chats you're
// a member of. Creates a fresh message in each target (marked isForwarded),
// it is not linked back to the original as a reply.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { notify } from '@/lib/notify'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { groupIds } = await req.json()
  if (!Array.isArray(groupIds) || groupIds.length === 0) return errorResponse('Pick at least one chat to forward to')

  const original = await prisma.message.findUnique({ where: { id } })
  if (!original || original.isDeleted) return errorResponse('Message not found', 404)

  // Only forward into chats you're actually a member of.
  const myGroups = await prisma.chatMember.findMany({
    where: { userId: session.userId, isActive: true, chatGroupId: { in: groupIds } },
    select: { chatGroupId: true },
  })
  const validGroupIds = myGroups.map(m => m.chatGroupId)
  if (!validGroupIds.length) return errorResponse('None of the selected chats are valid', 400)

  const created = await Promise.all(validGroupIds.map(async (gid) => {
    const message = await prisma.message.create({
      data: {
        chatGroupId: gid,
        senderId: session.userId,
        content: original.content || '',
        attachmentUrl: original.attachmentUrl,
        attachmentType: original.attachmentType,
        attachmentName: original.attachmentName,
        isForwarded: true,
      },
      include: { sender: { select: { name: true } } },
    })
    await prisma.chatGroup.update({ where: { id: gid }, data: { updatedAt: new Date() } })

    const otherMembers = await prisma.chatMember.findMany({
      where: { chatGroupId: gid, isActive: true, userId: { not: session.userId } },
      select: { userId: true },
    })
    if (otherMembers.length) {
      const preview = message.content?.trim().slice(0, 80) || (message.attachmentName ? `📎 ${message.attachmentName}` : 'Sent an attachment')
      await notify({
        userIds: otherMembers.map(o => o.userId),
        title: message.sender.name,
        message: `${message.sender.name} (forwarded): ${preview}`,
        type: 'chat',
        link: `/chat?group=${gid}`,
      })
    }
    return message
  }))

  return successResponse({ forwarded: created.length })
}
