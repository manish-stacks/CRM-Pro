// src/app/api/attendance/recompute-status/route.ts
// One-off/admin utility: re-derive PRESENT/HALF_DAY status for existing
// records using the current half-day-threshold setting.
//
// Why this exists: the mobile check-out endpoint used to skip status
// calculation entirely (always left it as "PRESENT"), so every attendance
// row completed via the app before that fix has a stale/wrong status.
// Fixing the endpoint only changes *future* punch-outs — this route lets an
// admin correct the historical rows in one click instead of editing each
// one by hand.
//
// Only touches rows that are still in an auto-computed state (PRESENT or
// HALF_DAY) and have both punch times — it never touches LEAVE/ABSENT/HOLIDAY
// rows, since those are deliberate manual statuses, not attendance-derived ones.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()
  if (!hasMinRole(session.role, 'ADMIN')) return errorResponse('Only admin can do this', 403)

  const thresholdRow = await prisma.setting.findUnique({ where: { key: 'half_day_threshold_hours' } })
  const halfDayThreshold = parseFloat(thresholdRow?.value || '4')

  const candidates = await prisma.attendance.findMany({
    where: {
      status: { in: ['PRESENT', 'HALF_DAY'] },
      punchIn: { not: null },
      punchOut: { not: null },
    },
    select: { id: true, punchIn: true, punchOut: true, hoursWorked: true, status: true },
  })

  let updated = 0
  for (const rec of candidates) {
    const hours = rec.hoursWorked ?? (
      rec.punchIn && rec.punchOut
        ? Math.round(((rec.punchOut.getTime() - rec.punchIn.getTime()) / 3600000) * 100) / 100
        : null
    )
    if (hours == null) continue
    const correctStatus = hours < halfDayThreshold ? 'HALF_DAY' : 'PRESENT'
    if (correctStatus !== rec.status) {
      await prisma.attendance.update({
        where: { id: rec.id },
        data: { status: correctStatus, hoursWorked: hours },
      })
      updated++
    }
  }

  await logFromRequest(req, {
    userId: session.userId,
    action: 'UPDATE',
    entityType: 'Attendance',
    entityId: 'bulk',
    metadata: { action: 'recompute-status', scanned: candidates.length, updated, halfDayThreshold },
  })

  return successResponse({ scanned: candidates.length, updated, halfDayThreshold })
}
