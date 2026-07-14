// src/app/api/mobile/leaves/route.ts
// Leave apply + own leave history for the mobile app (employee login).
// Mirrors the web dashboard's /api/leaves logic (same validation + duration
// handling) but scoped to the logged-in employee only, and shaped for mobile.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { logFromRequest } from '@/lib/audit'

const LEAVE_TYPES = ['PAID', 'UNPAID', 'SICK', 'CASUAL', 'MATERNITY', 'PATERNITY']
const DURATIONS   = ['SINGLE_DAY', 'MULTIPLE_DAYS', 'SHORT_HOURLY']

export async function GET(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session, employee } = res as any
  if (!employee) return fail('Employee profile not found', 404)

  const leaves = await prisma.leave.findMany({
    where: { employeeId: employee.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return ok(leaves.map(l => ({
    id: l.id,
    leave_type: l.leaveType,
    duration: l.duration,
    start_date: l.startDate.toISOString().slice(0, 10),
    end_date: l.endDate.toISOString().slice(0, 10),
    days: l.days,
    hourly_start: l.hourlyStart,
    hourly_end: l.hourlyEnd,
    hourly_hours: l.hourlyHours,
    reason: l.reason,
    status: l.status,
    rejection_reason: l.rejectionReason,
    created_at: l.createdAt,
  })))
}

export async function POST(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session, employee } = res as any
  if (!employee) return fail('Employee profile not found', 404)

  let body: any = {}
  try { body = await req.json() } catch { return fail('Invalid body') }

  const {
    leave_type, leaveType,
    duration,
    start_date, startDate,
    end_date, endDate,
    hourly_start, hourlyStart,
    hourly_end, hourlyEnd,
    hourly_hours, hourlyHours,
    reason,
  } = body

  const lType = leave_type || leaveType
  const sDate = start_date || startDate
  const eDate = end_date || endDate
  const hStart = hourly_start || hourlyStart
  const hEnd = hourly_end || hourlyEnd
  const hHours = hourly_hours ?? hourlyHours

  if (!reason?.trim() || !lType || !duration) return fail('Leave type, duration and reason are required')
  if (!LEAVE_TYPES.includes(lType)) return fail('Invalid leave type')
  if (!DURATIONS.includes(duration)) return fail('Invalid duration')

  let start: Date, end: Date, days: number

  if (duration === 'SINGLE_DAY') {
    if (!sDate) return fail('Date is required')
    start = new Date(sDate)
    end = new Date(sDate)
    days = 1
  } else if (duration === 'MULTIPLE_DAYS') {
    if (!sDate || !eDate) return fail('Start and end dates are required')
    start = new Date(sDate)
    end = new Date(eDate)
    days = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1
    if (days <= 0) return fail('Invalid date range')
  } else {
    // SHORT_HOURLY
    if (!sDate || !hStart || !hEnd) return fail('Date and start/end times are required')
    start = new Date(sDate)
    end = new Date(sDate)
    const hours = Number(hHours) || (() => {
      const [sh, sm] = hStart.split(':').map(Number)
      const [eh, em] = hEnd.split(':').map(Number)
      return ((eh * 60 + em) - (sh * 60 + sm)) / 60
    })()
    if (!hours || hours <= 0) return fail('Invalid hourly time range')
    days = hours / 8 // 8 hours = 1 day
  }

  try {
    const leave = await prisma.leave.create({
      data: {
        employeeId: employee.id,
        leaveType: lType,
        duration,
        startDate: start,
        endDate: end,
        days,
        hourlyStart: duration === 'SHORT_HOURLY' ? hStart : null,
        hourlyEnd: duration === 'SHORT_HOURLY' ? hEnd : null,
        hourlyHours: duration === 'SHORT_HOURLY' ? (Number(hHours) || days * 8) : null,
        reason: reason.trim(),
        status: 'PENDING',
      },
    })

    await logFromRequest(req, {
      userId: session.userId,
      action: 'CREATE',
      entityType: 'Leave',
      entityId: leave.id,
      metadata: { via: 'mobile', leaveType: lType, duration, days },
    })

    return ok({
      id: leave.id,
      status: leave.status,
      days: leave.days,
    })
  } catch (e: any) {
    console.error('Mobile leave create error:', e)
    return fail('Failed to apply leave')
  }
}