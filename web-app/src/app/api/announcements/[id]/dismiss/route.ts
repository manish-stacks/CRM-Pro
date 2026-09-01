// src/app/api/announcements/[id]/dismiss/route.ts
// Any logged-in user — records that they've seen this announcement, so it
// won't be returned by /api/announcements/active for them again.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse } from '@/lib/api'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session
  const { id } = await params

  await prisma.announcementView.upsert({
    where: { announcementId_userId: { announcementId: id, userId: session.userId } },
    update: {},
    create: { announcementId: id, userId: session.userId },
  })

  return successResponse({ dismissed: true })
}
