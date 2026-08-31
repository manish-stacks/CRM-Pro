// src/app/api/marketing/schedule/route.ts
// "My day, slot by slot" for a marketing executive on the web.
// Admins/TLs can pass ?userId= to look at someone else's day.
import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api'
import { buildSchedule } from '@/lib/marketingSchedule'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const days = Math.min(7, Math.max(1, Number(searchParams.get('days') || 1)))
  const userId = searchParams.get('userId')

  const canAny = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)
  const target = userId && canAny ? userId : session.userId
  if (userId && !canAny && userId !== session.userId) return errorResponse('Forbidden', 403)

  const result = await buildSchedule(target, date, days)
  return successResponse({ ...result, userId: target })
}
