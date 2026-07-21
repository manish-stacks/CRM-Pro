// src/app/api/tracker/checkin/route.ts
// Desktop app calls this on "Check In". Creates a TrackerSession and hands
// back the *current* admin-controlled tracker settings, so the desktop app
// doesn't need a separate settings call and always behaves the way admin
// has configured it right now (idle threshold, office-hours window).
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api'
import { Settings } from '@/lib/settings'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const employee = await prisma.employee.findUnique({ where: { userId: session.userId } })
  if (!employee) return errorResponse('No employee record for this account', 404)

  const [
    trackerEnabled, idleThresholdSec,
    officeStart, officeEnd, timezone,
  ] = await Promise.all([
    Settings.trackerEnabled(), Settings.trackerIdleThresholdSec(),
    Settings.officeStartTime(), Settings.officeEndTime(), Settings.timezone(),
  ])

  // Global off-switch or this specific employee exempted by admin — let the
  // desktop app check in for time purposes but don't run background tracking.
  if (!trackerEnabled || employee.trackerExempt) {
    return successResponse({
      tracking: false,
      reason: !trackerEnabled ? 'DISABLED_BY_ADMIN' : 'EMPLOYEE_EXEMPT',
    })
  }

  const trackerSession = await prisma.trackerSession.create({
    data: { employeeId: employee.id, status: 'ACTIVE' },
  })

  return successResponse({
    tracking: true,
    session: { id: trackerSession.id },
    settings: {
      idleThresholdSeconds: idleThresholdSec,
      officeStart,   // "HH:mm" 24h
      officeEnd,     // "HH:mm" 24h
      timezone,
    },
  })
}
