// src/app/api/payroll/generate/route.ts
// Phase 3: LOP-correct payroll.
//
// WORKING DAYS
//   workingDays = calendar days − weekly-offs − company holidays (office closed)
//   Holidays and weekly-offs are NEVER deducted.
//   For the CURRENT month we only count days up to today (future days are not
//   "absent"), and for a mid-month joiner we start from the joining date.
//
// LOP (Loss of Pay) — days that get deducted
//   1. Absent days            = working days with no attendance record (and no approved leave)
//   2. Unpaid leave days      = leave days beyond the monthly paid-leave quota (default 1)
//   3. Half days              = 0.5 day each
//   4. Late marks             = every 4 late punch-ins → 0.5 day
//   lopDays      = 1 + 2 + 3 + 4
//   payableDays  = workingDays − lopDays
//
// SALARY
//   Basic       = 50% of Monthly Salary            (admin-configurable)
//   HRA         = 20% of Basic
//   Conveyance  = ₹1600 cap, Medical = ₹1250 cap
//   Special     = remainder so Gross === Monthly Salary
//   PayableGross= Gross × (payableDays / workingDays)
//   PF (12% of payable basic, ₹15k ceiling), ESI, TDS, Profession Tax
//   Net         = PayableGross − deductions
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { Settings } from '@/lib/settings'
import { getISTDateParts } from '@/lib/attendanceDate'

function daysInMonth(y: number, m: number) { return new Date(Date.UTC(y, m, 0)).getUTCDate() }
const ymd = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  try {
    const body = await req.json()

    const month = Number(body.month)
    const year = Number(body.year)
    const employeeIds = body.employeeIds
    const departmentId = body.departmentId
    if (!month || !year) return errorResponse('Month and year required')

    // ---- Policy settings -------------------------------------------------
    const offRow = await prisma.setting.findUnique({ where: { key: 'weekly_off_days' } })
    let offDays: number[] = [0]
    try { offDays = JSON.parse(offRow?.value || '[0]') } catch { }

    const [
      basicPercent, hraPercent, conveyanceAmount, medicalAmount,
      pfPercent, pfWageCeiling, esiPercent, esiGrossCeiling,
      professionTax, professionTaxThreshold,
      tdsPercent, tdsAnnualThreshold, tdsMonthlyExempt,
      holidayList, paidLeaveQuota, latesPerHalfDay, halfDayLop, countFuture,
    ] = await Promise.all([
      Settings.payrollBasicPercent(), Settings.payrollHraPercent(),
      Settings.payrollConveyanceAmount(), Settings.payrollMedicalAmount(),
      Settings.payrollPfPercent(), Settings.payrollPfWageCeiling(),
      Settings.payrollEsiPercent(), Settings.payrollEsiGrossCeiling(),
      Settings.payrollProfessionTax(), Settings.payrollProfessionTaxThreshold(),
      Settings.payrollTdsPercent(), Settings.payrollTdsAnnualThreshold(), Settings.payrollTdsMonthlyExempt(),
      Settings.companyHolidays(), Settings.payrollPaidLeavesPerMonth(),
      Settings.payrollLatesPerHalfDay(), Settings.payrollHalfDayLop(),
      Settings.payrollCountFutureDays(),
    ])

    // Company holidays that fall inside this month ("YYYY-MM-DD" strings)
    const holidaySet = new Set(
      (Array.isArray(holidayList) ? holidayList : [])
        .map(h => String(h).slice(0, 10))
        .filter(h => h.startsWith(`${year}-${String(month).padStart(2, '0')}`))
    )

    // ---- Month window ----------------------------------------------------
    const total = daysInMonth(year, month)
    const monthStart = new Date(Date.UTC(year, month - 1, 1))
    const monthEnd = new Date(Date.UTC(year, month - 1, total, 23, 59, 59))

    // Never count days that haven't happened yet (running payroll mid-month).
    const istNow = getISTDateParts(new Date())
    const isCurrentMonth = istNow.year === year && istNow.month + 1 === month
    const lastCountedDay = countFuture ? total : (isCurrentMonth ? istNow.day : (
      (year > istNow.year || (year === istNow.year && month > istNow.month + 1)) ? 0 : total
    ))

    // Company-wide working-day list (day-of-month numbers)
    const companyWorkingDays: number[] = []
    for (let d = 1; d <= lastCountedDay; d++) {
      const date = new Date(Date.UTC(year, month - 1, d))
      if (offDays.includes(date.getUTCDay())) continue      // weekly off
      if (holidaySet.has(ymd(year, month, d))) continue     // company holiday / office closed
      companyWorkingDays.push(d)
    }

    // ---- Employees -------------------------------------------------------
    const empWhere: any = { user: { isActive: true } }
    if (employeeIds && employeeIds.length > 0) empWhere.id = { in: employeeIds }
    if (departmentId) empWhere.departmentId = departmentId
    const employees = await prisma.employee.findMany({
      where: empWhere,
      include: { user: { select: { name: true } } },
    })
    if (!employees.length) return errorResponse('No active employees found')

    const generated: any[] = []
    for (const emp of employees) {
      // Mid-month joiner → only count from the joining date onwards.
      let joinDay = 1
      if (emp.joiningDate) {
        const j = new Date(emp.joiningDate)
        if (j.getUTCFullYear() === year && j.getUTCMonth() + 1 === month) joinDay = j.getUTCDate()
        else if (j > monthEnd) joinDay = total + 1 // joined after this month
      }
      const workDayNums = companyWorkingDays.filter(d => d >= joinDay)
      const workingDays = workDayNums.length
      const workDaySet = new Set(workDayNums)

      const records = await prisma.attendance.findMany({
        where: { employeeId: emp.id, date: { gte: monthStart, lte: monthEnd } },
      })

      // Attendance rows explicitly marked HOLIDAY also count as non-working
      // for this employee (e.g. an extra office-closed day added later).
      for (const r of records) {
        if (r.status === 'HOLIDAY') workDaySet.delete(new Date(r.date).getUTCDate())
      }
      const effectiveWorkingDays = workDaySet.size

      const onWorkDay = (r: any) => workDaySet.has(new Date(r.date).getUTCDate())
      const marked = records.filter(onWorkDay)

      const presentDays = marked.filter(r => r.status === 'PRESENT').length
      const halfDays = marked.filter(r => r.status === 'HALF_DAY').length
      const leaveDays = marked.filter(r => r.status === 'LEAVE').length

      // Approved leaves recorded in the Leave table but not yet reflected in
      // attendance — count them too, without double counting.
      const approvedLeaves = await prisma.leave.findMany({
        where: {
          employeeId: emp.id,
          status: 'APPROVED',
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart },
        },
        select: { startDate: true, endDate: true },
      })
      const leaveDaySet = new Set<number>()
      for (const lv of approvedLeaves) {
        const s = new Date(lv.startDate), e = new Date(lv.endDate)
        for (let d = 1; d <= total; d++) {
          const cur = new Date(Date.UTC(year, month - 1, d))
          if (cur >= new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate())) &&
            cur <= new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate())) &&
            workDaySet.has(d)) leaveDaySet.add(d)
        }
      }
      for (const r of marked) if (r.status === 'LEAVE') leaveDaySet.add(new Date(r.date).getUTCDate())
      const totalLeaveDays = leaveDaySet.size

      // Late marks → half-day LOP
      const lateCount = marked.filter(r => r.isLate).length
      const lateHalfDays = latesPerHalfDay > 0 ? Math.floor(lateCount / latesPerHalfDay) * 0.5 : 0

      // Absent = working day with nothing recorded at all and no approved leave
      const accountedDays = new Set<number>()
      for (const r of marked) accountedDays.add(new Date(r.date).getUTCDate())
      for (const d of leaveDaySet) accountedDays.add(d)
      const absentDays = Math.max(0, effectiveWorkingDays - accountedDays.size)

      // Paid-leave quota — only `paidLeaveQuota` leaves per month are paid
      const paidLeaveUsed = Math.min(totalLeaveDays, Math.max(0, paidLeaveQuota))
      const unpaidLeaveDays = Math.max(0, totalLeaveDays - paidLeaveUsed)

      const lopDays = Math.round(
        (absentDays + unpaidLeaveDays + (halfDays * halfDayLop) + lateHalfDays) * 100
      ) / 100
      const payableDays = Math.max(0, effectiveWorkingDays - lopDays)

      // ---- Salary components (on FULL monthly salary) --------------------
      const monthlySalary = emp.salary
      const basicSalary = Math.round(monthlySalary * (basicPercent / 100))
      const hra = Math.round(basicSalary * (hraPercent / 100))
      const conveyance = Math.min(conveyanceAmount, Math.round(monthlySalary * 0.05))
      const medical = Math.min(medicalAmount, Math.round(monthlySalary * 0.05))
      const specialAllow = Math.max(0, monthlySalary - (basicSalary + hra + conveyance + medical))
      const grossSalary = basicSalary + hra + conveyance + medical + specialAllow

      // ---- Prorate by PAYABLE days --------------------------------------
      const attRatio = effectiveWorkingDays > 0 ? payableDays / effectiveWorkingDays : 0
      const payableGross = Math.round(grossSalary * attRatio)
      const lopAmount = Math.max(0, grossSalary - payableGross)

      // ---- Statutory deductions -----------------------------------------
      const proratedBasic = Math.round(basicSalary * attRatio)
      const pfBasic = Math.min(proratedBasic, pfWageCeiling)
      const pf = Math.round(pfBasic * (pfPercent / 100))
      const esi = grossSalary <= esiGrossCeiling ? Math.round(payableGross * (esiPercent / 100)) : 0
      const grossAnnual = grossSalary * 12
      const tds = grossAnnual > tdsAnnualThreshold
        ? Math.round(Math.max(0, payableGross - tdsMonthlyExempt) * (tdsPercent / 100)) : 0
      const professionTaxAmt = payableGross > professionTaxThreshold ? professionTax : 0
      const totalDeduct = pf + esi + tds + professionTaxAmt
      const netSalary = Math.max(0, payableGross - totalDeduct)

      const noteParts = [
        `Working ${effectiveWorkingDays}d`,
        `Present ${presentDays}d`,
        halfDays ? `Half ${halfDays}d` : '',
        totalLeaveDays ? `Leave ${totalLeaveDays}d (paid ${paidLeaveUsed}, unpaid ${unpaidLeaveDays})` : '',
        absentDays ? `Absent ${absentDays}d` : '',
        lateCount ? `Late ${lateCount} → ${lateHalfDays}d LOP` : '',
        `LOP ${lopDays}d (₹${lopAmount})`,
      ].filter(Boolean)

      const payslip = await prisma.payslip.upsert({
        where: { employeeId_month_year: { employeeId: emp.id, month, year } },
        update: {
          basicSalary, hra, conveyance, medical, specialAllow,
          grossSalary: payableGross,
          pf, esi, tds, professionTax: professionTaxAmt, totalDeduct,
          netSalary,
          workingDays: effectiveWorkingDays, presentDays, halfDays,
          leaveDays: totalLeaveDays, lopDays,
          notes: noteParts.join(' · '),
        },
        create: {
          employeeId: emp.id, month, year,
          basicSalary, hra, conveyance, medical, specialAllow,
          grossSalary: payableGross,
          pf, esi, tds, professionTax: professionTaxAmt, totalDeduct,
          netSalary,
          workingDays: effectiveWorkingDays, presentDays, halfDays,
          leaveDays: totalLeaveDays, lopDays,
          notes: noteParts.join(' · '),
          status: 'PENDING',
        },
      })
      generated.push({ ...payslip, lateCount, absentDays, unpaidLeaveDays, lopAmount, fullGross: grossSalary })
    }

    await logFromRequest(req, {
      userId: session.userId,
      action: 'GENERATE',
      entityType: 'Payroll',
      metadata: { month, year, count: generated.length, holidays: [...holidaySet] },
    })

    return successResponse({
      generated: generated.length,
      count: generated.length,
      workingDays: companyWorkingDays.length,
      holidays: [...holidaySet],
      month, year,
      payslips: generated,
    })
  } catch (error) {
    console.error('Payroll generate error:', error)
    return errorResponse('Failed to generate payroll', 500)
  }
}
