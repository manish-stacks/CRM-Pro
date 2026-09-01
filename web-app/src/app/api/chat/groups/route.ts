// src/app/api/chat/groups/route.ts
// List user's chat groups + create new groups (Direct / Group)
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, successStatusResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const memberships = await prisma.chatMember.findMany({
    where: { userId: session.userId, isActive: true },
    include: {
      chatGroup: {
        include: {
          members: {
            where: { isActive: true },
            include: { user: { select: { id: true, name: true, avatar: true, role: true, lastActiveAt: true } } },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: { sender: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: { chatGroup: { updatedAt: 'desc' } },
  })

  // Format for UI
  const groups = await Promise.all(memberships.map(async (m) => {
    const g = m.chatGroup
    const otherMembers = g.members.filter(mem => mem.userId !== session.userId)
    // For DIRECT: name comes from the other party
    let displayName = g.name
    let displayAvatar = g.avatar
    if (g.type === 'DIRECT' && otherMembers.length === 1) {
      displayName = otherMembers[0].user.name
      displayAvatar = otherMembers[0].user.avatar
    }
    // Unread count = messages from others, after my lastReadAt, that I
    // haven't hidden with "delete for me".
    const unreadCount = await prisma.message.count({
      where: {
        chatGroupId: g.id,
        senderId: { not: session.userId },
        isDeleted: false,
        deletions: { none: { userId: session.userId } },
        createdAt: { gt: m.lastReadAt || new Date(0) },
      },
    })
    return {
      id: g.id,
      name: displayName,
      type: g.type,
      avatar: displayAvatar,
      memberCount: g.members.length,
      lastMessage: g.messages[0] || null,
      lastReadAt: m.lastReadAt,
      unreadCount,
      updatedAt: g.updatedAt,
      members: g.members.map(mem => ({
        id: mem.user.id, name: mem.user.name, avatar: mem.user.avatar, role: mem.user.role,
        chatRole: mem.role, lastReadAt: mem.lastReadAt, lastActiveAt: mem.user.lastActiveAt,
      })),
    }
  }))

  return successResponse(groups, groups.length)
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { name, type = 'GROUP', memberIds = [], departmentId } = await req.json()
  if (!Array.isArray(memberIds) || memberIds.length === 0) return errorResponse('memberIds required')

  const allMembers = Array.from(new Set([session.userId, ...memberIds]))

  // For DIRECT: check if a 1-1 chat already exists
  if (type === 'DIRECT' && memberIds.length === 1) {
    const existing = await prisma.chatGroup.findFirst({
      where: {
        type: 'DIRECT',
        members: {
          every: { userId: { in: allMembers } },
          some: { userId: session.userId },
        },
      },
      include: { members: true },
    })
    if (existing && existing.members.length === 2) {
      return successResponse(existing)
    }
  }

  const g = await prisma.chatGroup.create({
    data: {
      name: type === 'DIRECT' ? null : (name || 'New Group'),
      type,
      departmentId: departmentId || null,
      createdById: session.userId,
      members: {
        create: allMembers.map(uid => ({
          userId: uid,
          role: uid === session.userId ? 'ADMIN' : 'MEMBER',
        })),
      },
    },
    include: {
      members: { include: { user: { select: { name: true, avatar: true } } } },
    },
  })

  await logFromRequest(req, {
    userId: session.userId,
    action: 'CREATE',
    entityType: 'ChatGroup',
    entityId: g.id,
    metadata: { type, memberCount: allMembers.length },
  })
  return successStatusResponse(g, 201)
}
