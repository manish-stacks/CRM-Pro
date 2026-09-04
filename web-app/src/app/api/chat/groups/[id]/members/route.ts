// src/app/api/chat/groups/[id]/members/route.ts
// Manage a GROUP chat's membership — add, remove, and promote/demote admins.
// Only the chat's own ADMIN (or an app ADMIN/SUPER_ADMIN) can do these;
// anyone can remove *themselves* (that's just "leave group").
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { notify } from '@/lib/notify'
import { emitToGroup } from '@/lib/socketServer'

async function loadGroupAndCheckAdmin(id: string, userId: string, role: string) {
  const group = await prisma.chatGroup.findUnique({
    where: { id },
    include: { members: { where: { isActive: true } } },
  })
  if (!group) return { error: errorResponse('Chat not found', 404) } as const
  if (group.type !== 'GROUP') return { error: errorResponse('Only group chats have manageable members', 400) } as const

  const myMembership = group.members.find(m => m.userId === userId)
  if (!myMembership) return { error: errorResponse('Not a member of this chat', 403) } as const

  const isAppAdmin = hasMinRole(role, 'ADMIN')
  const isChatAdmin = myMembership.role === 'ADMIN'
  return { group, myMembership, canManage: isAppAdmin || isChatAdmin } as const
}

// Add member(s) to a group
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const result = await loadGroupAndCheckAdmin(id, session.userId, session.role)
  if ('error' in result) return result.error
  const { group, canManage } = result
  if (!canManage) return errorResponse('Only the group admin can add members', 403)

  const { memberIds } = await req.json()
  if (!Array.isArray(memberIds) || memberIds.length === 0) return errorResponse('memberIds required')

  const activeIds = new Set(group.members.map(m => m.userId))
  const toAdd = memberIds.filter((uid: string) => !activeIds.has(uid))
  if (!toAdd.length) return errorResponse('These users are already in the chat')

  // A previously-removed member has a row with isActive=false — reactivate
  // it instead of inserting a duplicate (chatGroupId+userId is unique).
  const existingInactive = await prisma.chatMember.findMany({
    where: { chatGroupId: id, userId: { in: toAdd }, isActive: false },
  })
  const reactivateIds = existingInactive.map(m => m.userId)
  const freshIds = toAdd.filter((uid: string) => !reactivateIds.includes(uid))

  await prisma.$transaction([
    ...(reactivateIds.length ? [prisma.chatMember.updateMany({
      where: { chatGroupId: id, userId: { in: reactivateIds } },
      data: { isActive: true, leftAt: null, role: 'MEMBER', joinedAt: new Date() },
    })] : []),
    ...(freshIds.length ? [prisma.chatMember.createMany({
      data: freshIds.map((uid: string) => ({ chatGroupId: id, userId: uid, role: 'MEMBER' })),
    })] : []),
  ])

  await notify({
    userIds: toAdd,
    title: group.name || 'Group chat',
    message: 'You were added to the group',
    type: 'chat',
    link: `/chat?group=${id}`,
  })

  await logFromRequest(req, {
    userId: session.userId, action: 'UPDATE', entityType: 'ChatGroup', entityId: id,
    metadata: { addedMembers: toAdd },
  })

  const updated = await prisma.chatMember.findMany({
    where: { chatGroupId: id, isActive: true },
    include: { user: { select: { id: true, name: true, avatar: true, role: true } } },
  })
  emitToGroup(id, 'chat:groupUpdated', { chatGroupId: id })
  return successResponse(updated)
}

// Remove a member — self-removal ("leave") is always allowed; removing
// someone else needs group-admin/app-admin.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { userId } = await req.json()
  if (!userId) return errorResponse('userId required')

  const result = await loadGroupAndCheckAdmin(id, session.userId, session.role)
  if ('error' in result) return result.error
  const { group, canManage } = result

  const isSelf = userId === session.userId
  if (!isSelf && !canManage) return errorResponse('Only the group admin can remove members', 403)

  const target = group.members.find(m => m.userId === userId)
  if (!target) return errorResponse('That user is not in this chat', 404)

  await prisma.chatMember.update({
    where: { id: target.id },
    data: { isActive: false, leftAt: new Date() },
  })

  // Keep the group from ending up adminless.
  const remaining = await prisma.chatMember.findMany({
    where: { chatGroupId: id, isActive: true },
    orderBy: { joinedAt: 'asc' },
  })
  if (target.role === 'ADMIN' && remaining.length && !remaining.some(m => m.role === 'ADMIN')) {
    await prisma.chatMember.update({ where: { id: remaining[0].id }, data: { role: 'ADMIN' } })
  }

  if (!isSelf) {
    await notify({
      userIds: [userId],
      title: group.name || 'Group chat',
      message: 'You were removed from the group',
      type: 'chat',
      link: `/chat`,
    })
  }

  await logFromRequest(req, {
    userId: session.userId, action: 'UPDATE', entityType: 'ChatGroup', entityId: id,
    metadata: { removedMember: userId, self: isSelf },
  })

  emitToGroup(id, 'chat:groupUpdated', { chatGroupId: id })
  return successResponse({ removed: true })
}

// Promote/demote a member (transfer or grant group-admin rights)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { userId, role } = await req.json()
  if (!userId || !['ADMIN', 'MEMBER'].includes(role)) return errorResponse('userId and a valid role (ADMIN/MEMBER) required')

  const result = await loadGroupAndCheckAdmin(id, session.userId, session.role)
  if ('error' in result) return result.error
  const { group, canManage } = result
  if (!canManage) return errorResponse('Only the group admin can change roles', 403)

  const target = group.members.find(m => m.userId === userId)
  if (!target) return errorResponse('That user is not in this chat', 404)

  // Don't allow demoting the last remaining admin — someone has to be able
  // to manage the group.
  if (target.role === 'ADMIN' && role === 'MEMBER') {
    const otherAdmins = group.members.filter(m => m.role === 'ADMIN' && m.userId !== userId)
    if (!otherAdmins.length) return errorResponse('Assign another admin first — a group needs at least one')
  }

  await prisma.chatMember.update({ where: { id: target.id }, data: { role } })

  await notify({
    userIds: [userId],
    title: group.name || 'Group chat',
    message: role === 'ADMIN' ? 'You are now a group admin' : 'You are no longer a group admin',
    type: 'chat',
    link: `/chat?group=${id}`,
  })

  await logFromRequest(req, {
    userId: session.userId, action: 'UPDATE', entityType: 'ChatGroup', entityId: id,
    metadata: { roleChange: { userId, role } },
  })

  emitToGroup(id, 'chat:groupUpdated', { chatGroupId: id })
  return successResponse({ updated: true })
}
