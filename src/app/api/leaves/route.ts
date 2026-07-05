// src/app/api/leaves/route.ts
// Phase 2: leave apply now supports 3 duration types + rich filters + manager team view.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, successStatusResponse, errorResponse, getPaginationParams } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

const LEAVE_TYPES = ['PAID', 'UNPAID', 'SICK', 'CASUAL', 'MATERNITY', 'PATERNITY']
const DURATIONS   = ['SINGLE_DAY', 'MULTIPLE_DAYS', 'SHORT_HOURLY']

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { searchParams } = new URL(req.url)
  const { skip, limit } = getPaginationParams(searchParams)
  const status = searchParams.get('status')
  const leaveType = searchParams.get('leaveType')
  const duration = searchParams.get('duration')
  const month = searchParams.get('month')       // YYYY-MM
  const departmentId = searchParams.get('departmentId')
  const employeeId = searchParams.get('employeeId')
  const search = searchParams.get('search')     // employee name

  const where: any = {}

  if (status) where.status = status
  if (leaveType) where.leaveType = leaveType
  if (duration) where.duration = duration

  if (month) {
    const [y, m] = month.split('-').map(Number)
    where.startDate = { gte: new Date(y, m - 1, 1), lte: new Date(y, m, 0, 23, 59, 59) }
  }

  // Role-based visibility
  const nonAdmin = ['EMPLOYEE', 'TELECALLER', 'MARKETING_EXECUTIVE']

  if (nonAdmin.includes(session.role)) {
    const emp = await prisma.employee.findFirst({ where: { userId: session.userId } })
    if (emp) where.employeeId = emp.id
    else return successResponse([], 0)
  } else if (session.role === 'MANAGER') {
    const managerEmp = await prisma.employee.findFirst({ where: { userId: session.userId } })
    if (managerEmp) {
      const managedDepts = await prisma.department.findMany({
        where: { managerId: managerEmp.id },
        select: { id: true },
      })
      const deptEmps = managedDepts.length
        ? await prisma.employee.findMany({ where: { departmentId: { in: managedDepts.map(d => d.id) } }, select: { id: true } })
        : []
      const allowed = new Set([managerEmp.id, ...deptEmps.map(e => e.id)])
      where.employeeId = { in: Array.from(allowed) }
    }
  }

  // Admin-only extra filters
  if (departmentId && (session.role === 'SUPER_ADMIN' || session.role === 'ADMIN')) {
    const deptEmps = await prisma.employee.findMany({ where: { departmentId }, select: { id: true } })
    where.employeeId = { in: deptEmps.map(e => e.id) }
  }
  if (employeeId && ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)) {
    where.employeeId = employeeId
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
    const searchIds = emps.map(e => e.id)
    if (where.employeeId?.in) {
      where.employeeId.in = where.employeeId.in.filter((id: string) => searchIds.includes(id))
    } else {
      where.employeeId = { in: searchIds }
    }
  }

  const [leaves, total] = await Promise.all([
    prisma.leave.findMany({
      where,
      include: {
        employee: {
          include: {
            user: { select: { name: true, avatar: true } },
            department: { select: { name: true, color: true } },
          },
        },
      },
      skip, take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.leave.count({ where }),
  ])

  return successResponse(leaves, total)
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  try {
    const body = await req.json()
    const {
      leaveType, duration,
      startDate, endDate,
      hourlyStart, hourlyEnd, hourlyHours,
      reason,
    } = body

    if (!reason || !leaveType || !duration) return errorResponse('Leave type, duration and reason are required')
    if (!LEAVE_TYPES.includes(leaveType)) return errorResponse('Invalid leave type')
    if (!DURATIONS.includes(duration)) return errorResponse('Invalid duration')

    const employee = await prisma.employee.findFirst({ where: { userId: session.userId } })
    if (!employee) return errorResponse('Employee profile not found')

    let start: Date, end: Date, days: number

    if (duration === 'SINGLE_DAY') {
      if (!startDate) return errorResponse('Start date required')
      start = new Date(startDate)
      end = new Date(startDate)
      days = 1
    } else if (duration === 'MULTIPLE_DAYS') {
      if (!startDate || !endDate) return errorResponse('Start and end dates required')
      start = new Date(startDate)
      end = new Date(endDate)
      days = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1
      if (days <= 0) return errorResponse('Invalid date range')
    } else {
      // SHORT_HOURLY
      if (!startDate || !hourlyStart || !hourlyEnd) return errorResponse('Date and start/end times required')
      start = new Date(startDate)
      end = new Date(startDate)
      const hours = Number(hourlyHours) || (() => {
        const [sh, sm] = hourlyStart.split(':').map(Number)
        const [eh, em] = hourlyEnd.split(':').map(Number)
        return ((eh * 60 + em) - (sh * 60 + sm)) / 60
      })()
      if (!hours || hours <= 0) return errorResponse('Invalid hourly time range')
      days = hours / 8  // 8 hours = 1 day
    }

    const leave = await prisma.leave.create({
      data: {
        employeeId: employee.id,
        leaveType,
        duration,
        startDate: start,
        endDate: end,
        days,
        hourlyStart: duration === 'SHORT_HOURLY' ? hourlyStart : null,
        hourlyEnd:   duration === 'SHORT_HOURLY' ? hourlyEnd   : null,
        hourlyHours: duration === 'SHORT_HOURLY' ? (Number(hourlyHours) || days * 8) : null,
        reason,
        status: 'PENDING',
      },
      include: {
        employee: {
          include: { user: { select: { name: true } } },
        },
      },
    })

    await logFromRequest(req, {
      userId: session.userId,
      action: 'CREATE',
      entityType: 'Leave',
      entityId: leave.id,
      metadata: { leaveType, duration, days },
    })

    return successStatusResponse(leave, 201)
  } catch (error) {
    console.error('Leave create error:', error)
    return errorResponse('Failed to apply leave', 500)
  }
}
