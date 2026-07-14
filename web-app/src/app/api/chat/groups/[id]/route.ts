// src/app/api/chat/groups/[id]/route.ts
// Delete a chat/group. Allowed for: the group's chat-admin, an app ADMIN/SUPER_ADMIN,
// or (for DIRECT chats) either participant. Hard-deletes messages + members + group.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const group = await prisma.chatGroup.findUnique({
    where: { id },
    include: { members: { where: { isActive: true } } },
  })
  if (!group) return errorResponse('Chat not found', 404)

  const myMembership = group.members.find(m => m.userId === session.userId)
  if (!myMembership) return errorResponse('Not a member of this chat', 403)

  const isAppAdmin = hasMinRole(session.role, 'ADMIN')
  const isChatAdmin = myMembership.role === 'ADMIN'
  const isDirect = group.type === 'DIRECT'

  if (!isAppAdmin && !isChatAdmin && !isDirect) {
    return errorResponse('Only the group admin can delete this chat', 403)
  }

  await prisma.$transaction([
    prisma.message.deleteMany({ where: { chatGroupId: id } }),
    prisma.chatMember.deleteMany({ where: { chatGroupId: id } }),
    prisma.chatGroup.delete({ where: { id } }),
  ])

  await logFromRequest(req, {
    userId: session.userId,
    action: 'DELETE',
    entityType: 'ChatGroup',
    entityId: id,
    metadata: { type: group.type },
  })

  return successResponse({ deleted: true })
}
