// src/app/api/tracking/route-history/route.ts
// Admin/Manager: full location breadcrumb trail for one user on one date.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api'
import { dateOnly, todayDateOnly } from '@/lib/attendanceDate'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, 'MANAGER')
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const date = searchParams.get('date') // YYYY-MM-DD
  if (!userId) return errorResponse('userId required')

  const day = date ? dateOnly(date) : todayDateOnly()
  const next = new Date(day); next.setUTCDate(next.getUTCDate() + 1)

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
