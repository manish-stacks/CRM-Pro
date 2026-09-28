// src/app/api/chat/unread/route.ts
// Lightweight total unread count for the sidebar / tab badge (avoids loading full group list).
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, unauthorizedResponse } from '@/lib/api'

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const memberships = await prisma.chatMember.findMany({
    where: { userId: session.userId, isActive: true },
    select: { chatGroupId: true, lastReadAt: true },
  })
  const counts = await Promise.all(memberships.map(m =>
    prisma.message.count({
      where: {
        chatGroupId: m.chatGroupId,
        senderId: { not: session.userId },
        isDeleted: false,
        deletions: { none: { userId: session.userId } },
        createdAt: { gt: m.lastReadAt || new Date(0) },
      },
    })
  ))
  return successResponse({ total: counts.reduce((a, b) => a + b, 0) })
}
