// src/app/api/payroll/monthly-summary/route.ts
// Employee-facing monthly attendance and salary payout summary.
// Active especially on 1st-5th of each month so employees see exact
// working days, leaves, short leaves, lates, absent days, final payable days,
// and net payable transfer amount for the completed month.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api'
import { Settings } from '@/lib/settings'
import { getISTDateParts } from '@/lib/attendanceDate'

function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

const ymd = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  try {
    const { searchParams } = new URL(req.url)
    const istNow = getISTDateParts(new Date())
    const currentDay = istNow.day
    const isMonthStartWindow = currentDay >= 1 && currentDay <= 5

    // Default target: previous completed month when in early month (days 1-10), otherwise requested month
    let targetMonth: number
    let targetYear: number

    const qMonth = searchParams.get('month')
    const qYear = searchParams.get('year')

    if (qMonth && qYear) {
      targetMonth = Number(qMonth)
      targetYear = Number(qYear)
    } else {
      if (currentDay <= 10) {
        // Target previous month
        if (istNow.month === 0) { // January -> December previous year
          targetMonth = 12
          targetYear = istNow.year - 1
        } else {
          targetMonth = istNow.month // 0-indexed month is previous month's 1-indexed number
          targetYear = istNow.year
        }
      } else {
        targetMonth = istNow.month + 1
        targetYear = istNow.year
      }
    }

    const employee = await prisma.employee.findFirst({
      where: { userId: session.userId },
      include: {
        department: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
    })

    if (!employee) {
      return errorResponse('Employee record not found', 404)
    }

    // Check if an official generated Payslip already exists
    const payslip = await prisma.payslip.findUnique({
      where: {
        employeeId_month_year: {
          employeeId: employee.id,
          month: targetMonth,
          year: targetYear,
        },
      },
    })

    // Compute / verify attendance figures for accuracy
    const totalDays = daysInMonth(targetYear, targetMonth)
    const monthStart = new Date(Date.UTC(targetYear, targetMonth - 1, 1))
    const monthEnd = new Date(Date.UTC(targetYear, targetMonth - 1, totalDays, 23, 59, 59))

    // Weekly offs and holidays
    const offRow = await prisma.setting.findUnique({ where: { key: 'weekly_off_days' } })
    let offDays: number[] = [0]
    try { offDays = JSON.parse(offRow?.value || '[0]') } catch { }

    const [holidayList, paidLeaveQuota] = await Promise.all([
      Settings.companyHolidays(),
      Settings.payrollPaidLeavesPerMonth(),
    ])

    const holidaySet = new Set(
      (Array.isArray(holidayList) ? holidayList : [])
        .map(h => String(h).slice(0, 10))
        .filter(h => h.startsWith(`${targetYear}-${String(targetMonth).padStart(2, '0')}`))
    )

    // Calculate working days
    const isTargetCurrent = istNow.year === targetYear && (istNow.month + 1) === targetMonth
    const lastDayToCount = isTargetCurrent ? istNow.day : totalDays

    let joinDay = 1
    if (employee.joiningDate) {
      const j = new Date(employee.joiningDate)
      if (j.getUTCFullYear() === targetYear && j.getUTCMonth() + 1 === targetMonth) {
        joinDay = j.getUTCDate()
      } else if (j > monthEnd) {
        joinDay = totalDays + 1
      }
    }

    const companyWorkingDays: number[] = []
    for (let d = joinDay; d <= lastDayToCount; d++) {
      const date = new Date(Date.UTC(targetYear, targetMonth - 1, d))
      if (offDays.includes(date.getUTCDay())) continue
      if (holidaySet.has(ymd(targetYear, targetMonth, d))) continue
      companyWorkingDays.push(d)
    }

    const workDaySet = new Set(companyWorkingDays)

    // Attendance records
    const attendanceRecords = await prisma.attendance.findMany({
      where: { employeeId: employee.id, date: { gte: monthStart, lte: monthEnd } },
    })

    for (const r of attendanceRecords) {
      if (r.status === 'HOLIDAY') workDaySet.delete(new Date(r.date).getUTCDate())
    }
    const effectiveWorkingDays = workDaySet.size

    const onWorkDay = (r: any) => workDaySet.has(new Date(r.date).getUTCDate())
    const marked = attendanceRecords.filter(onWorkDay)

    const presentDays = marked.filter(r => r.status === 'PRESENT').length
    const attendanceHalfDays = marked.filter(r => r.status === 'HALF_DAY').length

    // Approved leaves
    const approvedLeaves = await prisma.leave.findMany({
      where: {
        employeeId: employee.id,
        status: 'APPROVED',
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
      select: { startDate: true, endDate: true, duration: true, days: true, leaveType: true },
    })

    const leaveDaySet = new Set<number>()
    const unpaidTypeSet = new Set<number>()
    const halfLeaveDays = new Set<number>()
    const halfMarked = new Set(marked.filter(r => r.status === 'HALF_DAY').map(r => new Date(r.date).getUTCDate()))

    for (const lv of approvedLeaves) {
      if (lv.duration === 'SHORT_HOURLY') continue
      if (lv.days < 1) {
        const sd = new Date(lv.startDate)
        const hd = sd.getUTCDate()
        if (sd.getUTCFullYear() === targetYear && sd.getUTCMonth() + 1 === targetMonth && workDaySet.has(hd) && !halfMarked.has(hd)) {
          halfLeaveDays.add(hd)
        }
        continue
      }
      const s = new Date(lv.startDate), e = new Date(lv.endDate)
      for (let d = 1; d <= totalDays; d++) {
        const cur = new Date(Date.UTC(targetYear, targetMonth - 1, d))
        if (cur >= new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate())) &&
            cur <= new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate())) &&
            workDaySet.has(d)) {
          leaveDaySet.add(d)
          if (lv.leaveType === 'UNPAID') unpaidTypeSet.add(d)
        }
      }
    }

    for (const r of marked) if (r.status === 'LEAVE') leaveDaySet.add(new Date(r.date).getUTCDate())
    for (const d of leaveDaySet) halfLeaveDays.delete(d)

    const totalLeaveDays = leaveDaySet.size + halfLeaveDays.size * 0.5
    const unpaidTypeDays = unpaidTypeSet.size

    // Short leaves (max 2h per short leave; 1 allowed free per month; 2nd incurs 0.5d half-day deduction)
    const shortLeaves = approvedLeaves.filter(lv => lv.duration === 'SHORT_HOURLY')
    const shortLeaveCount = shortLeaves.length
    const shortLeavePenaltyDays = shortLeaveCount >= 2 ? (shortLeaveCount - 1) * 0.5 : 0

    // Late punch-ins: 4 forgiven. On 5th late (and subsequent), 0.5d half-day deduction.
    const lateCount = marked.filter(r => r.isLate && !leaveDaySet.has(new Date(r.date).getUTCDate())).length
    const latePenaltyDays = lateCount >= 5 ? (lateCount - 4) * 0.5 : 0

    // Absent days calculation
    const accountedDays = new Set<number>()
    for (const r of marked) {
      const dn = new Date(r.date).getUTCDate()
      if (r.status === 'ABSENT' && !r.punchIn && !leaveDaySet.has(dn)) continue
      accountedDays.add(dn)
    }
    for (const d of leaveDaySet) accountedDays.add(d)
    for (const d of halfLeaveDays) accountedDays.add(d)
    const absentDays = Math.max(0, effectiveWorkingDays - accountedDays.size)

    // Paid-leave quota deduction
    const quotaLeaveDays = totalLeaveDays - unpaidTypeDays
    const paidLeaveUsed = Math.min(quotaLeaveDays, Math.max(0, paidLeaveQuota))
    const unpaidLeaveDays = Math.max(0, quotaLeaveDays - paidLeaveUsed) + unpaidTypeDays

    const calculatedLopDays = Math.round(
      (absentDays + unpaidLeaveDays + (attendanceHalfDays * 0.5) + latePenaltyDays + shortLeavePenaltyDays) * 100
    ) / 100
    const calculatedPayableDays = Math.max(0, effectiveWorkingDays - calculatedLopDays)

    // Estimated or official salary
    const baseSalary = employee.salary || 0
    let payableSalary = baseSalary
    if (payslip) {
      payableSalary = payslip.netSalary
    } else {
      const ratio = effectiveWorkingDays > 0 ? calculatedPayableDays / effectiveWorkingDays : 0
      payableSalary = Math.round(baseSalary * ratio)
    }

    const workingDays = payslip?.workingDays ?? effectiveWorkingDays
    const payableDays = payslip ? Math.max(0, (payslip.workingDays || 0) - (payslip.lopDays || 0)) : calculatedPayableDays
    const lopDays = payslip?.lopDays ?? calculatedLopDays

    return successResponse({
      month: targetMonth,
      year: targetYear,
      monthName: MONTH_NAMES[targetMonth - 1],
      isMonthStartWindow,
      currentDay,
      workingDays,
      presentDays: payslip?.presentDays ?? presentDays,
      halfDays: payslip?.halfDays ?? (attendanceHalfDays + halfLeaveDays.size * 0.5),
      leaveDays: payslip?.leaveDays ?? totalLeaveDays,
      shortLeaveCount,
      shortLeavePenaltyDays,
      lateCount,
      latePenaltyDays,
      absentDays,
      lopDays,
      payableDays,
      baseSalary,
      netSalary: payableSalary,
      status: payslip?.status || 'PENDING',
      payslipId: payslip?.id || null,
      notes: payslip?.notes || null,
      bankName: employee.bankName || null,
      accountNumber: employee.accountNumber ? `••••${employee.accountNumber.slice(-4)}` : null,
      generatedAt: payslip?.generatedAt || null,
    })
  } catch (error) {
    console.error('Monthly summary error:', error)
    return errorResponse('Failed to fetch monthly summary', 500)
  }
}
