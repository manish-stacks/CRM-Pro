// src/app/api/announcements/route.ts
// Admin-only: schedule a celebratory login popup (e.g. "Townhall party
// today!") with an optional sound, and list ones already scheduled.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, successStatusResponse, errorResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

// GET /api/announcements — admin-only list, most recent first, with a
// seen-count so the admin can tell how many people the popup has reached.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth

  const items = await prisma.scheduledAnnouncement.findMany({
    orderBy: { scheduledAt: 'desc' },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { views: true } },
    },
  })
  return successResponse(items)
}

// POST /api/announcements  { title, message, soundUrl?, scheduledAt, expiresAt }
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const body = await req.json().catch(() => null)
  if (!body) return errorResponse('Invalid request body')

  const title = String(body.title || '').trim()
  const message = String(body.message || '').trim()
  const soundUrl = body.soundUrl ? String(body.soundUrl).trim() : null
  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null

  if (!title) return errorResponse('Title is required')
  if (!message) return errorResponse('Message is required')
  if (!scheduledAt || isNaN(scheduledAt.getTime())) return errorResponse('Valid scheduledAt is required')
  if (!expiresAt || isNaN(expiresAt.getTime())) return errorResponse('Valid expiresAt is required')
  if (expiresAt <= scheduledAt) return errorResponse('expiresAt must be after scheduledAt')

  const created = await prisma.scheduledAnnouncement.create({
    data: { title, message, soundUrl, scheduledAt, expiresAt, createdById: session.userId },
  })

  await logFromRequest(req, {
    userId: session.userId,
    action: 'CREATE',
    entityType: 'ScheduledAnnouncement',
    entityId: created.id,
    metadata: { title, scheduledAt, expiresAt },
  })

  return successStatusResponse(created, 201)
}
