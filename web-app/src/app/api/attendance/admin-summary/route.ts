// src/app/api/attendance/admin-summary/route.ts
// Admin-only "today's overview" — cross-references every active employee
// against today's Attendance row (if any) and any APPROVED leave covering
// today, since employees who never punch in have NO Attendance row at all
// (nothing auto-creates an ABSENT row). Also supports ?filter= to return the
// employee list for one category (used by the click-through filter on the
// Attendance page).
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse } from '@/lib/api'
import { dateOnly, todayDateOnly } from '@/lib/attendanceDate'

const CATEGORIES = ['PUNCHED_IN', 'NOT_PUNCHED_IN', 'ON_LEAVE', 'SHORT_LEAVE']

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const dateParam = searchParams.get('date')
  const filter = searchParams.get('filter')
  const departmentId = searchParams.get('departmentId')

  const day = dateParam ? dateOnly(dateParam) : todayDateOnly()
  const dayEnd = new Date(day)
  dayEnd.setUTCHours(23, 59, 59, 999)

  const employees = await prisma.employee.findMany({
    where: {
      user: { isActive: true },
      ...(departmentId ? { departmentId } : {}),
    },
    select: {
      id: true, employeeId: true, position: true,
      user: { select: { name: true, avatar: true, role: true } },
      department: { select: { name: true, color: true } },
    },
  })
  const empIds = employees.map(e => e.id)

  const [attendanceRows, leaveRows] = await Promise.all([
    prisma.attendance.findMany({
      where: { date: day, employeeId: { in: empIds } },
      select: { employeeId: true, punchIn: true, punchOut: true, status: true, workMode: true },
    }),
    prisma.leave.findMany({
      where: {
        status: 'APPROVED',
        employeeId: { in: empIds },
        startDate: { lte: dayEnd },
        endDate: { gte: day },
      },
      select: { employeeId: true, duration: true, days: true, leaveType: true, hourlyStart: true, hourlyEnd: true },
    }),
  ])

  const attMap = new Map(attendanceRows.map(a => [a.employeeId, a]))
  const leaveMap = new Map(leaveRows.map(l => [l.employeeId, l]))

  const categorized = employees.map(e => {
    const att = attMap.get(e.id)
    const leave = leaveMap.get(e.id)
    let category: string
    if (att?.punchIn) {
      category = 'PUNCHED_IN'
    } else if (leave) {
      category = (leave.duration === 'SHORT_HOURLY' || leave.days < 1) ? 'SHORT_LEAVE' : 'ON_LEAVE'
    } else {
      category = 'NOT_PUNCHED_IN'
    }
    return {
      employeeId: e.id,
      name: e.user.name,
      avatar: e.user.avatar,
      role: e.user.role,
      empCode: e.employeeId,
      position: e.position,
      department: e.department?.name || null,
      departmentColor: e.department?.color || null,
      category,
      punchIn: att?.punchIn || null,
      punchOut: att?.punchOut || null,
      workMode: att?.workMode || null,
      leaveType: leave?.leaveType || null,
      leaveHours: leave?.duration === 'SHORT_HOURLY' ? { start: leave.hourlyStart, end: leave.hourlyEnd } : null,
    }
  })

  const counts = {
    total: categorized.length,
    punchedIn: categorized.filter(c => c.category === 'PUNCHED_IN').length,
    notPunchedIn: categorized.filter(c => c.category === 'NOT_PUNCHED_IN').length,
    onLeave: categorized.filter(c => c.category === 'ON_LEAVE').length,
    shortLeave: categorized.filter(c => c.category === 'SHORT_LEAVE').length,
  }

  const list = filter && CATEGORIES.includes(filter)
    ? categorized.filter(c => c.category === filter)
    : []

  return successResponse({
    date: `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, '0')}-${String(day.getUTCDate()).padStart(2, '0')}`,
    counts,
    list,
  })
}
