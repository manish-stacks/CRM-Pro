// src/app/api/notifications/route.ts
// User's notifications + mark read
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, unauthorizedResponse, getPaginationParams } from '@/lib/api'

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const { skip, limit } = getPaginationParams(searchParams)
  const unreadOnly = searchParams.get('unread') === 'true'

  const where: any = { userId: session.userId }
  if (unreadOnly) where.isRead = false

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where, skip, take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: session.userId, isRead: false } }),
  ])

  return successResponse({ items, total, unreadCount })
}

export async function POST(req: NextRequest) {
  // Mark all as read
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { markAllRead } = await req.json()
  if (markAllRead) {
    await prisma.notification.updateMany({
      where: { userId: session.userId, isRead: false },
      data: { isRead: true },
    })
  }
  return successResponse({ ok: true })
}
