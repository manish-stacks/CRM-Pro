// src/app/api/attendance/[id]/route.ts
// Admin-only edit / delete of an attendance record.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse, unauthorizedResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { computeLate } from '@/lib/attendanceDate'
import { Settings } from '@/lib/settings'

function hoursBetween(inAt: Date | null, outAt: Date | null): number | null {
  if (!inAt || !outAt) return null
  const ms = outAt.getTime() - inAt.getTime()
  if (ms <= 0) return 0
  return Math.round((ms / 3600000) * 100) / 100
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()
  if (!hasMinRole(session.role, 'ADMIN')) return errorResponse('Only admin can edit attendance', 403)

  const existing = await prisma.attendance.findUnique({ where: { id } })
  if (!existing) return notFoundResponse('Attendance')

  const body = await req.json()
  const data: Record<string, any> = {}

  const punchIn = 'punchIn' in body ? (body.punchIn ? new Date(body.punchIn) : null) : existing.punchIn
  const punchOut = 'punchOut' in body ? (body.punchOut ? new Date(body.punchOut) : null) : existing.punchOut
  if ('punchIn' in body) data.punchIn = punchIn
  if ('punchOut' in body) data.punchOut = punchOut
  if ('workMode' in body) data.workMode = body.workMode
  if ('status' in body) data.status = body.status
  if ('notes' in body) data.notes = body.notes || null

  // Recompute hours + late whenever punch times change
  if ('punchIn' in body || 'punchOut' in body) {
    data.hoursWorked = hoursBetween(punchIn, punchOut)
    if (punchIn) {
      const [officeStart, grace] = await Promise.all([Settings.officeStartTime(), Settings.lateGraceMinutes()])
      const late = computeLate(punchIn, officeStart || '10:00', grace ?? 10)
      data.isLate = late.isLate
      data.lateBy = late.lateBy
    } else {
      data.isLate = false
      data.lateBy = null
    }

    // The edit form always sends the currently-displayed status back, so we
    // can't tell "admin deliberately kept PRESENT" apart from "admin never
    // touched the dropdown". If it's still an auto-computed status (PRESENT/
    // HALF_DAY) and the new hours cross the half-day threshold differently,
    // re-derive it — mirrors the punch-out logic so edited records don't get
    // stuck with a stale status. Manual statuses (LEAVE/ABSENT/HOLIDAY) are
    // never touched here.
    const incomingStatus = 'status' in body ? body.status : existing.status
    if (['PRESENT', 'HALF_DAY'].includes(incomingStatus) && data.hoursWorked != null) {
      const halfDayThreshold = await Settings.halfDayThresholdHours()
      data.status = data.hoursWorked < (halfDayThreshold ?? 4) ? 'HALF_DAY' : 'PRESENT'
    }
  }
  // Allow manual late override
  if ('isLate' in body) data.isLate = !!body.isLate
  if ('lateBy' in body) data.lateBy = body.lateBy ?? null

  const updated = await prisma.attendance.update({ where: { id }, data })

  await logFromRequest(req, {
    userId: session.userId, action: 'UPDATE', entityType: 'Attendance', entityId: id,
    metadata: { edited: Object.keys(data) },
  })

  return successResponse(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()
  if (!hasMinRole(session.role, 'ADMIN')) return errorResponse('Only admin can delete attendance', 403)

  const existing = await prisma.attendance.findUnique({ where: { id } })
  if (!existing) return notFoundResponse('Attendance')

  await prisma.attendance.delete({ where: { id } })
  await logFromRequest(req, {
    userId: session.userId, action: 'DELETE', entityType: 'Attendance', entityId: id,
    metadata: { employeeId: existing.employeeId, date: existing.date },
  })
  return successResponse({ deleted: true })
}