// src/app/api/announcements/current/route.ts
// Any logged-in user — announcements that are live right now AND were
// scheduled to start today. Used by the dashboard banner, which stays
// visible for the whole active window (unlike the once-per-user popup at
// /api/announcements/active).
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse } from '@/lib/api'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  const items = await prisma.scheduledAnnouncement.findMany({
    where: {
      isActive: true,
      scheduledAt: { gte: todayStart, lte: now }, // started, and started today
      expiresAt: { gte: now }, // hasn't ended yet
    },
    orderBy: { scheduledAt: 'asc' },
    take: 3,
    select: { id: true, title: true, message: true, soundUrl: true, expiresAt: true },
  })

  return successResponse(items)
}
