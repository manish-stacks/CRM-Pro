// src/app/api/chat/groups/[id]/messages/route.ts
// List messages + send new message. Also marks last-read.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, successStatusResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { notify } from '@/lib/notify'

async function assertMember(groupId: string, userId: string) {
  return prisma.chatMember.findFirst({
    where: { chatGroupId: groupId, userId, isActive: true },
  })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const membership = await assertMember(id, session.userId)
  if (!membership) return errorResponse('Not a member of this chat', 403)

  const { searchParams } = new URL(req.url)
  const before = searchParams.get('before')  // pagination cursor
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

  const where: any = { chatGroupId: id, isDeleted: false }
  if (before) where.createdAt = { lt: new Date(before) }

  const messages = await prisma.message.findMany({
    where, take: limit,
    include: {
      sender: { select: { id: true, name: true, avatar: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Mark last-read
  await prisma.chatMember.update({
    where: { id: membership.id },
    data: { lastReadAt: new Date() },
  })

  return successResponse(messages.reverse(), messages.length)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const membership = await assertMember(id, session.userId)
  if (!membership) return errorResponse('Not a member of this chat', 403)

  const { content, attachmentUrl, attachmentType, attachmentName, replyToId } = await req.json()
  if (!content?.trim() && !attachmentUrl) return errorResponse('Content or attachment required')

  const message = await prisma.message.create({
    data: {
      chatGroupId: id,
      senderId: session.userId,
      content: content || '',
      attachmentUrl: attachmentUrl || null,
      attachmentType: attachmentType || null,
      attachmentName: attachmentName || null,
      replyToId: replyToId || null,
    },
    include: { sender: { select: { name: true, avatar: true } } },
  })

  // Bump group updatedAt
  const group = await prisma.chatGroup.update({ where: { id }, data: { updatedAt: new Date() } })

  // Notify every other active member — this is what powers the bell + the
  // floating popup, so people get told about a reply even if they're not on
  // the /chat page right now.
  const otherMembers = await prisma.chatMember.findMany({
    where: { chatGroupId: id, isActive: true, userId: { not: session.userId } },
    select: { userId: true },
  })
  if (otherMembers.length) {
    const preview = message.content?.trim()
      ? (message.content.length > 80 ? message.content.slice(0, 80) + '…' : message.content)
      : (message.attachmentName ? `📎 ${message.attachmentName}` : 'Sent an attachment')
    await notify({
      userIds: otherMembers.map(m => m.userId),
      title: group.type === 'DIRECT' ? message.sender.name : (group.name || message.sender.name),
      message: group.type === 'DIRECT' ? preview : `${message.sender.name}: ${preview}`,
      type: 'chat',
      link: `/chat?group=${id}`,
      metadata: { screen: 'Chat', groupId: id, senderName: message.sender.name, senderAvatar: message.sender.avatar || null },
    })
  }

  return successStatusResponse(message, 201)
}
