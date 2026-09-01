// src/app/api/chat/search/route.ts
// Search message text across every chat the current user is a member of
// (only chats/messages they can actually see — respects "delete for me").
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const groupId = searchParams.get('groupId') || undefined // optional: scope to one chat
  if (q.length < 2) return errorResponse('Type at least 2 characters')

  const myGroupIds = (await prisma.chatMember.findMany({
    where: { userId: session.userId, isActive: true, ...(groupId ? { chatGroupId: groupId } : {}) },
    select: { chatGroupId: true },
  })).map(m => m.chatGroupId)
  if (!myGroupIds.length) return successResponse([], 0)

  const results = await prisma.message.findMany({
    where: {
      chatGroupId: { in: myGroupIds },
      isDeleted: false,
      deletions: { none: { userId: session.userId } },
      content: { contains: q },
    },
    include: {
      sender: { select: { id: true, name: true } },
      chatGroup: { select: { id: true, name: true, type: true, members: { where: { isActive: true }, include: { user: { select: { id: true, name: true } } } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const formatted = results.map(m => {
    const g = m.chatGroup!
    const other = g.type === 'DIRECT' ? g.members.find(mem => mem.userId !== session.userId)?.user : null
    return {
      id: m.id,
      content: m.content,
      createdAt: m.createdAt,
      sender: m.sender,
      groupId: g.id,
      groupName: g.type === 'DIRECT' ? (other?.name || 'Direct message') : (g.name || 'Group'),
      groupType: g.type,
    }
  })

  return successResponse(formatted, formatted.length)
}
