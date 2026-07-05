import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, unauthorizedResponse } from '@/lib/api'

export async function PUT(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()
  await prisma.notification.updateMany({ where: { userId: session.userId, isRead: false }, data: { isRead: true } })
  return successResponse({ ok: true })
}
