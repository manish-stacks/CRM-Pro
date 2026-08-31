// src/app/api/chat/groups/[id]/route.ts
// "Delete" a chat = leave it. We only ever remove *your own* membership
// (isActive=false, leftAt=now) — messages and the group stay intact for
// every other member, so the other side is never affected by your delete.
// The group/messages are only hard-deleted once nobody is left in it.
// Pass ?forEveryone=1 to actually wipe the chat for all members — only the
// chat's own ADMIN or an app ADMIN/SUPER_ADMIN can do that, and it's meant
// for moderation, not routine "delete chat" use.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const forEveryone = searchParams.get('forEveryone') === '1'

  const group = await prisma.chatGroup.findUnique({
    where: { id },
    include: { members: { where: { isActive: true } } },
  })
  if (!group) return errorResponse('Chat not found', 404)

  const myMembership = group.members.find(m => m.userId === session.userId)
  if (!myMembership) return errorResponse('Not a member of this chat', 403)

  const isAppAdmin = hasMinRole(session.role, 'ADMIN')
  const isChatAdmin = myMembership.role === 'ADMIN'

  if (forEveryone) {
    if (!isAppAdmin && !isChatAdmin) {
      return errorResponse('Only the group admin can delete this chat for everyone', 403)
    }
    await prisma.$transaction([
      prisma.message.deleteMany({ where: { chatGroupId: id } }),
      prisma.chatMember.deleteMany({ where: { chatGroupId: id } }),
      prisma.chatGroup.delete({ where: { id } }),
    ])
    await logFromRequest(req, {
      userId: session.userId, action: 'DELETE', entityType: 'ChatGroup', entityId: id,
      metadata: { type: group.type, forEveryone: true },
    })
    return successResponse({ deleted: true, forEveryone: true })
  }

  // Delete for me only — leave the chat. Everyone else keeps it as-is.
  await prisma.chatMember.update({
    where: { id: myMembership.id },
    data: { isActive: false, leftAt: new Date() },
  })

  // If a chat-admin left a GROUP with other members still active, hand
  // admin to the longest-standing remaining member so it's never orphaned.
  const remaining = await prisma.chatMember.findMany({
    where: { chatGroupId: id, isActive: true },
    orderBy: { joinedAt: 'asc' },
  })
  if (remaining.length === 0) {
    // Nobody left at all — safe to fully clean up.
    await prisma.$transaction([
      prisma.message.deleteMany({ where: { chatGroupId: id } }),
      prisma.chatMember.deleteMany({ where: { chatGroupId: id } }),
      prisma.chatGroup.delete({ where: { id } }),
    ])
  } else if (isChatAdmin && !remaining.some(m => m.role === 'ADMIN')) {
    await prisma.chatMember.update({ where: { id: remaining[0].id }, data: { role: 'ADMIN' } })
  }

  await logFromRequest(req, {
    userId: session.userId, action: 'UPDATE', entityType: 'ChatGroup', entityId: id,
    metadata: { type: group.type, leftChat: true },
  })

  return successResponse({ deleted: true, forEveryone: false })
}
