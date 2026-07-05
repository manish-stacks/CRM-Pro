// src/app/api/mobile/attendance/status/route.ts
// Returns today's check-in status so the app knows whether to run tracking.
import { NextRequest } from 'next/server'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { prisma } from '@/lib/prisma'
import { todayDateOnly } from '@/lib/attendanceDate'

export async function GET(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { employee } = res as any
  if (!employee) return fail('Employee profile not found', 404)

  const today = todayDateOnly()

  const record = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date: today } },
  })

  const isCheckedIn = !!(record?.punchIn && !record?.punchOut)

  return ok({
    isCheckedIn,
    attendanceId: record?.id || null,
    punchIn: record?.punchIn || null,
    punchOut: record?.punchOut || null,
    hoursWorked: record?.hoursWorked || null,
    trackingEnabled: isCheckedIn,
  })
}