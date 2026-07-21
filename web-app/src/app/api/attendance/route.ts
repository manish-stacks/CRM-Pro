// src/app/api/attendance/route.ts
// Phase 2: Punch in/out saves geolocation + device + IP.
// GET filters: date, month, department, username, status.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hasMinRole } from '@/lib/auth'
import { successResponse, errorResponse, getPaginationParams } from '@/lib/api'
import { deviceFromRequest } from '@/lib/device'
import { logFromRequest } from '@/lib/audit'
import { todayDateOnly, dateOnly, computeLate } from '@/lib/attendanceDate'
import { Settings } from '@/lib/settings'
import { getTeamScope } from '@/lib/teamScope'
import { getProfileCompletion, PROFILE_COMPLETION_THRESHOLD } from '@/lib/profileCompletion'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { searchParams } = new URL(req.url)
  const { skip, limit } = getPaginationParams(searchParams)
  const departmentId = searchParams.get('departmentId')
  const status = searchParams.get('status')
  const month = searchParams.get('month')         // YYYY-MM
  const date = searchParams.get('date')           // YYYY-MM-DD
  const dateFrom = searchParams.get('dateFrom')   // YYYY-MM-DD
  const dateTo = searchParams.get('dateTo')       // YYYY-MM-DD
  const search = searchParams.get('search')       // employee name / employeeId

  const where: any = {}

  // Date filters — prefer specific date > month > range
  if (date) {
    const d = dateOnly(date)
    where.date = d
  } else if (month) {
    const [y, m] = month.split('-').map(Number)
    where.date = { gte: new Date(y, m - 1, 1), lte: new Date(y, m, 0, 23, 59, 59) }
  } else if (dateFrom || dateTo) {
    where.date = {}
    if (dateFrom) where.date.gte = new Date(dateFrom)
    if (dateTo)   where.date.lte = new Date(dateTo + 'T23:59:59')
  }

  if (status) where.status = status

  // Role-based visibility
  // Non-admins: see own + team (dept they head + direct reports). Covers EMPLOYEE-role heads.
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.role)) {
    const scope = await getTeamScope(session.userId)
    if (!scope.visibleIds.length) return successResponse([], 0)
    where.employeeId = { in: scope.visibleIds }
  }

  // Admin filters (also apply for managers within their allowed set)
  if (departmentId && (session.role === 'SUPER_ADMIN' || session.role === 'ADMIN')) {
    const deptEmps = await prisma.employee.findMany({
      where: { departmentId }, select: { id: true },
    })
    where.employeeId = { in: deptEmps.map(e => e.id) }
  }

  if (search && ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)) {
    const users = await prisma.user.findMany({
      where: { name: { contains: search } },
      select: { id: true },
    })
    const emps = await prisma.employee.findMany({
      where: { userId: { in: users.map(u => u.id) } },
      select: { id: true },
    })
    const searchEmpIds = emps.map(e => e.id)
    // Intersect with existing employeeId filter if present
    if (where.employeeId?.in) {
      where.employeeId.in = where.employeeId.in.filter((id: string) => searchEmpIds.includes(id))
    } else {
      where.employeeId = { in: searchEmpIds }
    }
  }

  const [records, total, lateTotal] = await Promise.all([
    prisma.attendance.findMany({
      where, skip, take: limit,
      include: {
        employee: {
          include: {
            user: { select: { name: true, avatar: true } },
            department: { select: { name: true, color: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { punchIn: 'desc' }],
    }),
    prisma.attendance.count({ where }),
    prisma.attendance.count({ where: { ...where, isLate: true } }),
  ])

  // NOTE: returns lateTotal for the *entire filtered set* (not just this page)
  return NextResponse.json({ data: records, total, lateTotal }, { status: 200 })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  try {
    const {
      action,       // 'punch_in' | 'punch_out' | 'admin_save'
      workMode,     // 'WFO' | 'WFH' | 'FIELD'
      notes,
      latitude,
      longitude,
      address,
      employeeId,   // admin_save: whose attendance
      date,         // admin_save: which day
      punchIn,      // admin_save: ISO or null
      punchOut,     // admin_save: ISO or null
      status,       // admin_save: PRESENT/ABSENT/HALF_DAY/LEAVE/HOLIDAY
    } = await req.json()

    // ---- Admin manually adds/edits attendance for any employee ----
    if (action === 'admin_save') {
      if (!hasMinRole(session.role, 'ADMIN')) return errorResponse('Only admin can add attendance', 403)
      if (!employeeId || !date) return errorResponse('employeeId and date required')
      const dOnly = dateOnly(date)
      const pIn = punchIn ? new Date(punchIn) : null
      const pOut = punchOut ? new Date(punchOut) : null
      const hours = pIn && pOut ? Math.max(0, Math.round(((pOut.getTime() - pIn.getTime()) / 3600000) * 100) / 100) : null
      let isLate = false, lateBy: number | null = null
      if (pIn) {
        const [officeStart, grace] = await Promise.all([Settings.officeStartTime(), Settings.lateGraceMinutes()])
        const late = computeLate(pIn, officeStart || '10:00', grace ?? 10)
        isLate = late.isLate; lateBy = late.lateBy
      }
      const rec = await prisma.attendance.upsert({
        where: { employeeId_date: { employeeId, date: dOnly } },
        update: { punchIn: pIn, punchOut: pOut, workMode: workMode || 'WFO', status: status || 'PRESENT', notes: notes || null, hoursWorked: hours, isLate, lateBy },
        create: { employeeId, date: dOnly, punchIn: pIn, punchOut: pOut, workMode: workMode || 'WFO', status: status || 'PRESENT', notes: notes || null, hoursWorked: hours, isLate, lateBy },
      })
      await logFromRequest(req, { userId: session.userId, action: 'ADMIN_SAVE', entityType: 'Attendance', entityId: rec.id, metadata: { employeeId, date } })
      return successResponse(rec)
    }

    const employee = await prisma.employee.findFirst({ where: { userId: session.userId } })
    if (!employee) return errorResponse('Employee profile not found')

    const today = todayDateOnly()
    const dev = deviceFromRequest(req)

    if (action === 'punch_in') {
      const { percent } = getProfileCompletion(employee)
      if (percent < PROFILE_COMPLETION_THRESHOLD) {
        return errorResponse(`Please complete your profile first (${percent}% done, ${PROFILE_COMPLETION_THRESHOLD}% required to check in)`, 403)
      }

      const existing = await prisma.attendance.findUnique({
        where: { employeeId_date: { employeeId: employee.id, date: today } },
      })
      if (existing?.punchIn) return errorResponse('Already punched in today')

      const punchInAt = new Date()

      // Late-mark: office start + grace from Settings (defaults 10:00 / 10 min)
      const [officeStart, grace] = await Promise.all([
        Settings.officeStartTime(),
        Settings.lateGraceMinutes(),
      ])
      const { isLate, lateBy } = computeLate(punchInAt, officeStart || '10:00', grace ?? 10)

      const record = await prisma.attendance.upsert({
        where: { employeeId_date: { employeeId: employee.id, date: today } },
        update: {
          punchIn: punchInAt,
          workMode: workMode || 'WFO',
          status: 'PRESENT',
          isLate,
          lateBy,
          punchInLat: latitude ?? null,
          punchInLng: longitude ?? null,
          punchInAddress: address ?? null,
          punchInIp: dev.ip,
          punchInDevice: dev.device,
          punchInBrowser: dev.browser,
          punchInOs: dev.os,
        },
        create: {
          employeeId: employee.id,
          date: today,
          punchIn: punchInAt,
          workMode: workMode || 'WFO',
          status: 'PRESENT',
          isLate,
          lateBy,
          notes,
          punchInLat: latitude ?? null,
          punchInLng: longitude ?? null,
          punchInAddress: address ?? null,
          punchInIp: dev.ip,
          punchInDevice: dev.device,
          punchInBrowser: dev.browser,
          punchInOs: dev.os,
        },
      })

      await logFromRequest(req, {
        userId: session.userId,
        action: 'PUNCH_IN',
        entityType: 'Attendance',
        entityId: record.id,
        metadata: { workMode, lat: latitude, lng: longitude, isLate, lateBy },
      })

      return successResponse(record)
    }

    if (action === 'punch_out') {
      const existing = await prisma.attendance.findUnique({
        where: { employeeId_date: { employeeId: employee.id, date: today } },
      })
      if (!existing?.punchIn) return errorResponse('No punch-in found for today')
      if (existing.punchOut) return errorResponse('Already punched out today')

      const punchOut = new Date()
      const hoursWorked = (punchOut.getTime() - existing.punchIn.getTime()) / 3600000

      // Half-day threshold from Setting (fallback 4h)
      const thresholdRow = await prisma.setting.findUnique({ where: { key: 'half_day_threshold_hours' } })
      const halfDayThreshold = parseFloat(thresholdRow?.value || '4')
      const status = hoursWorked < halfDayThreshold ? 'HALF_DAY' : 'PRESENT'

      const record = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          punchOut,
          hoursWorked: Math.round(hoursWorked * 100) / 100,
          status,
          punchOutLat: latitude ?? null,
          punchOutLng: longitude ?? null,
          punchOutAddress: address ?? null,
          punchOutIp: dev.ip,
          punchOutDevice: dev.device,
          punchOutBrowser: dev.browser,
          punchOutOs: dev.os,
        },
      })

      await logFromRequest(req, {
        userId: session.userId,
        action: 'PUNCH_OUT',
        entityType: 'Attendance',
        entityId: record.id,
        metadata: { hoursWorked: record.hoursWorked, status },
      })

      return successResponse(record)
    }

    return errorResponse('Invalid action')
  } catch (e) {
    console.error('Attendance error:', e)
    return errorResponse('Failed', 500)
  }
}