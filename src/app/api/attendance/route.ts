// src/app/api/attendance/route.ts
// Phase 2: Punch in/out saves geolocation + device + IP.
// GET filters: date, month, department, username, status.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, getPaginationParams } from '@/lib/api'
import { deviceFromRequest } from '@/lib/device'
import { logFromRequest } from '@/lib/audit'
import { todayDateOnly, dateOnly, computeLate } from '@/lib/attendanceDate'
import { Settings } from '@/lib/settings'

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
  const nonAdmin = ['EMPLOYEE', 'TELECALLER', 'MARKETING_EXECUTIVE']

  if (nonAdmin.includes(session.role)) {
    // Regular employee sees only own
    const emp = await prisma.employee.findFirst({ where: { userId: session.userId } })
    if (emp) where.employeeId = emp.id
    else return successResponse([], 0)
  } else if (session.role === 'MANAGER') {
    // Manager sees own team members' attendance
    const managerEmp = await prisma.employee.findFirst({ where: { userId: session.userId } })
    if (managerEmp) {
      // Departments this manager heads
      const managedDepts = await prisma.department.findMany({
        where: { managerId: managerEmp.id },
        select: { id: true },
      })
      const managedDeptIds = managedDepts.map(d => d.id)
      const deptEmps = managedDeptIds.length > 0
        ? await prisma.employee.findMany({ where: { departmentId: { in: managedDeptIds } }, select: { id: true } })
        : []
      // Include the manager's own attendance
      const allowedEmpIds = new Set([managerEmp.id, ...deptEmps.map(e => e.id)])
      where.employeeId = { in: Array.from(allowedEmpIds) }
    }
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
      action,       // 'punch_in' | 'punch_out'
      workMode,     // 'WFO' | 'WFH' | 'FIELD'
      notes,
      latitude,
      longitude,
      address,
    } = await req.json()

    const employee = await prisma.employee.findFirst({ where: { userId: session.userId } })
    if (!employee) return errorResponse('Employee profile not found')

    const today = todayDateOnly()
    const dev = deviceFromRequest(req)

    if (action === 'punch_in') {
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