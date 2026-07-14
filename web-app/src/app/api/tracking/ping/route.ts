// src/app/api/tracking/ping/route.ts
// Web (session-based) location ping. Mirrors /api/mobile/location but uses the
// httpOnly-cookie session instead of a Bearer token. Only records pings while the
// user is actively checked in (office time) so the route trail = office hours only.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { todayDateOnly } from '@/lib/attendanceDate'

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  // Tracking is only for marketing executives
  if (session.role !== 'MARKETING_EXECUTIVE') {
    return successResponse({ accepted: 0, trackingEnabled: false })
  }

  const employee = await prisma.employee.findFirst({
    where: { userId: session.userId },
    select: { id: true },
  })
  if (!employee) return errorResponse('Employee profile not found', 404)

  // Use the SAME date normalization as attendance (UTC date-only) to avoid the
  // IST local-midnight mismatch that silently rejected pings.
  const today = todayDateOnly()
  const attendance = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date: today } },
  })
  if (!attendance?.punchIn || attendance.punchOut) {
    // Not checked in / already checked out → tell client to stop tracking
    return successResponse({ accepted: 0, trackingEnabled: false })
  }

  let body: any = {}
  try { body = await req.json() } catch { return errorResponse('Invalid body') }

  const pings = Array.isArray(body.pings) ? body.pings : [body]
  const valid = pings.filter(
    (p: any) => typeof p.latitude === 'number' && typeof p.longitude === 'number'
  )
  if (valid.length === 0) return errorResponse('No valid pings')

  await prisma.locationPing.createMany({
    data: valid.map((p: any) => ({
      userId: session.userId,
      attendanceId: attendance.id,
      latitude: p.latitude,
      longitude: p.longitude,
      accuracy: p.accuracy ?? null,
      speed: p.speed ?? null,
      heading: p.heading ?? null,
      altitude: p.altitude ?? null,
      address: p.address ?? null,
      battery: p.battery ?? null,
      isMoving: p.isMoving ?? false,
      source: p.source === 'background' ? 'background' : 'foreground',
      recordedAt: p.recordedAt ? new Date(p.recordedAt) : new Date(),
    })),
  })

  return successResponse({ accepted: valid.length, trackingEnabled: true })
}