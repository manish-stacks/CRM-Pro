// src/app/api/mobile/attendance/check-in/route.ts
// Marketing person checks in → starts the day's attendance + enables tracking.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { deviceFromRequest } from '@/lib/device'
import { logFromRequest } from '@/lib/audit'
import { todayDateOnly } from '@/lib/attendanceDate'

export async function POST(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session, employee } = res as any
  if (!employee) return fail('Employee profile not found', 404)

  let body: any = {}
  try { body = await req.json() } catch {}
  const { latitude, longitude, address } = body

  const today = todayDateOnly()
  const dev = deviceFromRequest(req)

  const existing = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date: today } },
  })
  if (existing?.punchIn && !existing.punchOut) {
    return ok(existing, { message: 'Already checked in', alreadyIn: true })
  }
  if (existing?.punchIn && existing.punchOut) {
    return fail('You already completed attendance for today')
  }

  const record = await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId: employee.id, date: today } },
    update: {
      punchIn: new Date(),
      workMode: 'FIELD',
      status: 'PRESENT',
      punchInLat: latitude ?? null,
      punchInLng: longitude ?? null,
      punchInAddress: address ?? null,
      punchInIp: dev.ip,
      punchInDevice: dev.device,
      punchInOs: dev.os,
    },
    create: {
      employeeId: employee.id,
      date: today,
      punchIn: new Date(),
      workMode: 'FIELD',
      status: 'PRESENT',
      punchInLat: latitude ?? null,
      punchInLng: longitude ?? null,
      punchInAddress: address ?? null,
      punchInIp: dev.ip,
      punchInDevice: dev.device,
      punchInOs: dev.os,
    },
  })

  await logFromRequest(req, {
    userId: session.userId, action: 'PUNCH_IN', entityType: 'Attendance', entityId: record.id,
    metadata: { via: 'mobile', lat: latitude, lng: longitude },
  })

  return ok({
    attendanceId: record.id,
    punchIn: record.punchIn,
    trackingEnabled: true,
  }, { message: 'Checked in — tracking started' })
}