// src/app/api/mobile/location/route.ts
// Receives location pings from the app (single or batched).
// ONLY records pings while the user is checked in (office time).
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { todayDateOnly } from '@/lib/attendanceDate'

export async function POST(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session, employee } = res as any
  if (!employee) return fail('Employee profile not found', 404)

  // Tracking is only for marketing executives
  if (session.role !== 'MARKETING_EXECUTIVE') {
    return ok({ accepted: 0, trackingEnabled: false }, { message: 'Tracking not enabled for this role' })
  }

  // Guard: only accept pings during an active (checked-in) session
  const today = todayDateOnly()
  const attendance = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date: today } },
  })
  if (!attendance?.punchIn || attendance.punchOut) {
    // Not checked in (or already checked out) → reject silently so app can stop tracking
    return ok({ accepted: 0, trackingEnabled: false }, { message: 'Not in an active session' })
  }

  let body: any = {}
  try { body = await req.json() } catch { return fail('Invalid body') }

  // Accept either { pings: [...] } or a single ping object
  const pings = Array.isArray(body.pings) ? body.pings : [body]
  const valid = pings.filter((p: any) =>
    typeof p.latitude === 'number' && typeof p.longitude === 'number'
  )
  if (valid.length === 0) return fail('No valid pings')

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

  return ok({ accepted: valid.length, trackingEnabled: true })
}