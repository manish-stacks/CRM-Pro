// src/app/api/announcements/active/route.ts
// Any logged-in user — returns the current announcement they should be
// shown right now (active window + not already dismissed by them), or
// null. Polled by the popup component so it also catches an announcement
// that goes live while the user is already logged in.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse } from '@/lib/api'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const now = new Date()
  const announcement = await prisma.scheduledAnnouncement.findFirst({
    where: {
      isActive: true,
      scheduledAt: { lte: now },
      expiresAt: { gte: now },
      views: { none: { userId: session.userId } },
    },
    orderBy: { scheduledAt: 'asc' },
  })

  return successResponse(announcement)
}
