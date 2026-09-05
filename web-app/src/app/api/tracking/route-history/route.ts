// src/app/api/tracking/route-history/route.ts
// Admin/Manager: full location breadcrumb trail for one user on one date.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api'

import { istDayRange } from '@/lib/attendanceDate'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, 'MANAGER')
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const date = searchParams.get('date') // YYYY-MM-DD
  if (!userId) return errorResponse('userId required')

  // NOTE: recordedAt/checkInAt are real timestamp (DateTime) columns, so the
  // day boundary must be the true UTC instants bounding the IST calendar
  // day — not UTC midnight (which was cutting the range ~5:30h early and
  // silently dropping early-morning pings/visits, or bleeding in the next
  // day's, depending on time of the ping).
  const { start: day, end: dayEnd } = istDayRange(date)
  const next = new Date(dayEnd.getTime() + 1)

  const [pings, visits, user] = await Promise.all([
    prisma.locationPing.findMany({
      where: { userId, recordedAt: { gte: day, lt: next } },
      orderBy: { recordedAt: 'asc' },
      select: {
        latitude: true, longitude: true, accuracy: true, speed: true,
        battery: true, isMoving: true, source: true, recordedAt: true, address: true,
      },
    }),
    prisma.clientVisit.findMany({
      where: {
        userId,
        OR: [
          { checkInAt: { gte: day, lt: next } },
          { checkOutAt: { gte: day, lt: next } },
          { scheduledDate: { gte: day, lt: next } },
        ],
      },
      orderBy: { checkInAt: 'asc' },
      select: {
        id: true, clientName: true, status: true, purpose: true,
        checkInAt: true, checkInLat: true, checkInLng: true, checkInAddress: true,
        checkOutAt: true, durationMins: true,
      },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, avatar: true, phone: true } }),
  ])

  return successResponse({
    user,
    date: day.toISOString().slice(0, 10),
    pings,
    visits,
    pingCount: pings.length,
  })
}
