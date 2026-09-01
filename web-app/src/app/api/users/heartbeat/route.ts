// src/app/api/users/heartbeat/route.ts
// Ping this every ~20s while the app is open (chat page does this). Powers
// "online now" / "last seen" — a user counts as online if lastActiveAt is
// within the last 60s.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, unauthorizedResponse } from '@/lib/api'

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()
  await prisma.user.update({ where: { id: session.userId }, data: { lastActiveAt: new Date() } })
  return successResponse({ ok: true })
}
