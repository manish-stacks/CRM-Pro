// src/app/api/chat/groups/[id]/messages/route.ts
// List messages + send new message. Also marks last-read.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, successStatusResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { notify } from '@/lib/notify'
import { emitToGroup } from '@/lib/socketServer'

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

  const where: any = { chatGroupId: id, isDeleted: false, deletions: { none: { userId: session.userId } } }
  if (before) where.createdAt = { lt: new Date(before) }

  const messages = await prisma.message.findMany({
    where, take: limit,
    include: {
      sender: { select: { id: true, name: true, avatar: true, role: true } },
      mentions: { include: { user: { select: { id: true, name: true } } } },
      reactions: { include: { user: { select: { id: true, name: true } } } },
      replyTo: {
        select: {
          id: true, content: true, isDeleted: true, attachmentName: true,
          sender: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Who's currently typing in this chat (pinged within the last 6s), for
  // the "X is typing…" indicator. Excludes yourself.
  const typingCutoff = new Date(Date.now() - 6000)
  const typingMembers = await prisma.chatMember.findMany({
    where: { chatGroupId: id, isActive: true, userId: { not: session.userId }, typingAt: { gte: typingCutoff } },
    include: { user: { select: { id: true, name: true } } },
  })

  // Pinned messages for this chat (small list shown at the top).
  const pinned = await prisma.message.findMany({
    where: { chatGroupId: id, isPinned: true, isDeleted: false },
    include: { sender: { select: { id: true, name: true } } },
    orderBy: { pinnedAt: 'desc' },
    take: 20,
  })

  // Mark last-read
  await prisma.chatMember.update({
    where: { id: membership.id },
    data: { lastReadAt: new Date() },
  })

  return successResponse({
    messages: messages.reverse(),
    typingUsers: typingMembers.map(m => ({ id: m.user.id, name: m.user.name })),
    pinned,
  }, messages.length)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const membership = await assertMember(id, session.userId)
  if (!membership) return errorResponse('Not a member of this chat', 403)

  const { content, attachmentUrl, attachmentType, attachmentName, replyToId, mentionUserIds } = await req.json()
  if (!content?.trim() && !attachmentUrl) return errorResponse('Content or attachment required')

  // Active members of this group, for validating/auto-detecting @mentions.
  const groupMembers = await prisma.chatMember.findMany({
    where: { chatGroupId: id, isActive: true },
    include: { user: { select: { id: true, name: true } } },
  })

  // Prefer explicit mentionUserIds from the client (from an @-picker). Fall
  // back to scanning the text for "@Full Name" against actual members.
  let mentionedIds: string[] = Array.isArray(mentionUserIds)
    ? mentionUserIds.filter((uid: string) => groupMembers.some(m => m.userId === uid))
    : []
  if (!mentionedIds.length && content) {
    mentionedIds = groupMembers
      .filter(m => m.userId !== session.userId && content.includes(`@${m.user.name}`))
      .map(m => m.userId)
  }
  mentionedIds = Array.from(new Set(mentionedIds)).filter(uid => uid !== session.userId)

  // Sending a message means you've stopped typing.
  await prisma.chatMember.update({ where: { id: membership.id }, data: { typingAt: null } })

  const message = await prisma.message.create({
    data: {
      chatGroupId: id,
      senderId: session.userId,
      content: content || '',
      attachmentUrl: attachmentUrl || null,
      attachmentType: attachmentType || null,
      attachmentName: attachmentName || null,
      replyToId: replyToId || null,
      mentions: mentionedIds.length ? { create: mentionedIds.map(uid => ({ userId: uid })) } : undefined,
    },
    include: {
      sender: { select: { id: true, name: true, avatar: true }, },
      mentions: { include: { user: { select: { id: true, name: true } } } },
      replyTo: {
        select: {
          id: true, content: true, isDeleted: true, attachmentName: true,
          sender: { select: { id: true, name: true } },
        },
      },
    },
  })

  // Bump group updatedAt
  const group = await prisma.chatGroup.update({ where: { id }, data: { updatedAt: new Date() } })

  // Real-time push — everyone with this chat open sees it land instantly.
  // Anyone whose socket isn't connected (or the socket layer isn't even
  // running) still gets it via the existing polling, unaffected.
  emitToGroup(id, 'chat:message', message)

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

  // Extra ping for anyone specifically @mentioned, on top of the general
  // new-message notification above.
  if (mentionedIds.length) {
    await notify({
      userIds: mentionedIds,
      title: group.type === 'DIRECT' ? message.sender.name : (group.name || message.sender.name),
      message: `${message.sender.name} mentioned you: ${message.content?.trim().slice(0, 80) || ''}`,
      type: 'chat',
      link: `/chat?group=${id}`,
      metadata: { screen: 'Chat', groupId: id, senderName: message.sender.name, mention: true },
    })
  }

  return successStatusResponse(message, 201)
}
