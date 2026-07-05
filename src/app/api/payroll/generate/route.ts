// src/app/api/payroll/generate/route.ts
// Phase 2: proper payroll calculation with all salary components + statutory deductions
// Formula:
//   Basic       = 50% of Monthly Salary
//   HRA         = 20% of Basic
//   Conveyance  = ₹1600 fixed (up to India tax cap)
//   Medical     = ₹1250 fixed
//   Special     = remainder (to make gross = monthly salary)
//   Gross       = Basic + HRA + Conveyance + Medical + Special
//   Attendance  = (present + halfDay*0.5 + leaveDays) / workingDays
//   PayableGross = Gross × Attendance
//   PF          = 12% of Basic (capped at ₹15,000 basic = ₹1800 max)
//   ESI         = 0.75% of Gross if Gross <= ₹21,000, else 0
//   TDS         = simple slab (only if grossAnnual > ₹5 lakh → 5% of gross above ₹41,667/mo)
//   ProfessionTax = ₹200 (states like MH/KA)
//   Net         = PayableGross - PF - ESI - TDS - ProfessionTax
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

function daysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate() }

function isWeeklyOff(date: Date, offDays: number[]) {
  return offDays.includes(date.getDay())
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  try {
    const body = await req.json()

    const month = Number(body.month)
    const year = Number(body.year)
    const employeeIds = body.employeeIds
    if (!month || !year) return errorResponse('Month and year required')

    // Weekly-off from settings (fallback: Sunday only)
    const offRow = await prisma.setting.findUnique({ where: { key: 'weekly_off_days' } })
    let offDays = [0]
    try { offDays = JSON.parse(offRow?.value || '[0]') } catch { }

    // Compute working days for the month
    const total = daysInMonth(year, month)
    let workingDays = 0
    for (let d = 1; d <= total; d++) {
      const date = new Date(year, month - 1, d)
      if (!isWeeklyOff(date, offDays)) workingDays++
    }

    // Which employees?
    const empWhere: any = { user: { isActive: true } }
    if (employeeIds && employeeIds.length > 0) empWhere.id = { in: employeeIds }
    const employees = await prisma.employee.findMany({
      where: empWhere,
      include: { user: { select: { name: true } } },
    })

    if (!employees.length) return errorResponse('No active employees found')

    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0, 23, 59, 59)

    const generated: any[] = []
    for (const emp of employees) {
      // Attendance summary
      const records = await prisma.attendance.findMany({
        where: { employeeId: emp.id, date: { gte: monthStart, lte: monthEnd } },
      })
      const presentDays = records.filter(r => r.status === 'PRESENT').length
      const halfDays = records.filter(r => r.status === 'HALF_DAY').length
      const leaveDays = records.filter(r => r.status === 'LEAVE').length
      const absentDays = Math.max(0, workingDays - (presentDays + halfDays + leaveDays))
      const effectiveDays = presentDays + (halfDays * 0.5) + leaveDays
      const lopDays = Math.max(0, workingDays - (presentDays + halfDays + leaveDays))

      const monthlySalary = emp.salary
      const basicSalary = Math.round(monthlySalary * 0.5)
      const hra = Math.round(basicSalary * 0.20)
      const conveyance = Math.min(1600, Math.round(monthlySalary * 0.05))
      const medical = Math.min(1250, Math.round(monthlySalary * 0.05))
      const specialAllow = Math.max(0, monthlySalary - (basicSalary + hra + conveyance + medical))
      const grossSalary = basicSalary + hra + conveyance + medical + specialAllow

      // Prorate by attendance
      const attRatio = workingDays > 0 ? effectiveDays / workingDays : 0
      const payableGross = Math.round(grossSalary * attRatio)

      // Statutory deductions
      // PF must be based on the actual PAYABLE (attendance-prorated) basic, not the
      // full monthly basic — otherwise everyone above the ₹15,000 PF-wage ceiling gets
      // an identical ₹1,800 PF deduction even with near-zero attendance/net salary.
      const proratedBasic = Math.round(basicSalary * attRatio)
      const pfBasic = Math.min(proratedBasic, 15000)
      const pf = Math.round(pfBasic * 0.12)
      const esi = grossSalary <= 21000 ? Math.round(payableGross * 0.0075) : 0
      const grossAnnual = grossSalary * 12
      const tds = grossAnnual > 500000 ? Math.round(Math.max(0, (payableGross - 41667)) * 0.05) : 0
      const professionTax = payableGross > 15000 ? 200 : 0
      const totalDeduct = pf + esi + tds + professionTax

      const netSalary = Math.max(0, payableGross - totalDeduct)

      const payslip = await prisma.payslip.upsert({
        where: { employeeId_month_year: { employeeId: emp.id, month, year } },
        update: {
          basicSalary, hra, conveyance, medical, specialAllow,
          grossSalary: payableGross,
          pf, esi, tds, professionTax, totalDeduct,
          netSalary,
          workingDays, presentDays, halfDays, leaveDays, lopDays,
        },
        create: {
          employeeId: emp.id, month, year,
          basicSalary, hra, conveyance, medical, specialAllow,
          grossSalary: payableGross,
          pf, esi, tds, professionTax, totalDeduct,
          netSalary,
          workingDays, presentDays, halfDays, leaveDays, lopDays,
          status: 'PENDING',
        },
      })
      generated.push(payslip)
    }

    await logFromRequest(req, {
      userId: session.userId,
      action: 'GENERATE',
      entityType: 'Payroll',
      metadata: { month, year, count: generated.length },
    })

    return successResponse({
      generated: generated.length,
      workingDays,
      month, year,
      payslips: generated,
    })
  } catch (error) {
    console.error('Payroll generate error:', error)
    return errorResponse('Failed to generate payroll', 500)
  }
}