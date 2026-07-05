// src/app/api/auth/login-activities/route.ts
// List login history — user sees own, admin sees anyone
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, unauthorizedResponse, getPaginationParams } from '@/lib/api'

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const { skip, limit } = getPaginationParams(searchParams)
  const targetUserId = searchParams.get('userId')

  const canSeeOthers = hasMinRole(session.role, 'ADMIN')
  const userId = canSeeOthers && targetUserId ? targetUserId : session.userId

  const [activities, total] = await Promise.all([
    prisma.loginActivity.findMany({
      where: { userId },
      skip, take: limit,
      orderBy: { loginAt: 'desc' },
      include: canSeeOthers ? { user: { select: { name: true, email: true } } } : undefined,
    }),
    prisma.loginActivity.count({ where: { userId } }),
  ])
  return successResponse(activities, total)
}
