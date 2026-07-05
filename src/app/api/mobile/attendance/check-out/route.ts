// src/app/api/mobile/attendance/check-out/route.ts
// Marketing person checks out → ends attendance + stops tracking.
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
  if (!existing?.punchIn) return fail('No check-in found for today')
  if (existing.punchOut) return fail('Already checked out today')

  const punchOut = new Date()
  const hoursWorked = (punchOut.getTime() - existing.punchIn.getTime()) / 3600000

  const record = await prisma.attendance.update({
    where: { id: existing.id },
    data: {
      punchOut,
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      punchOutLat: latitude ?? null,
      punchOutLng: longitude ?? null,
      punchOutAddress: address ?? null,
      punchOutIp: dev.ip,
      punchOutDevice: dev.device,
      punchOutOs: dev.os,
    },
  })

  await logFromRequest(req, {
    userId: session.userId, action: 'PUNCH_OUT', entityType: 'Attendance', entityId: record.id,
    metadata: { via: 'mobile', hoursWorked: record.hoursWorked },
  })

  return ok({
    attendanceId: record.id,
    punchOut: record.punchOut,
    hoursWorked: record.hoursWorked,
    trackingEnabled: false,
  }, { message: 'Checked out — tracking stopped' })
}