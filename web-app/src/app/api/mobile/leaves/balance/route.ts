// src/app/api/mobile/leaves/balance/route.ts
// Current logged-in employee's paid-leave balance for the mobile app.
// Reuses the same computeLeaveBalance() simulation as the web dashboard.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { computeLeaveBalance } from '@/lib/leaveBalance'

export async function GET(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { employee } = res as any
  if (!employee) return fail('Employee profile not found', 404)

  const leaves = await prisma.leave.findMany({
    where: { employeeId: employee.id },
    select: { leaveType: true, status: true, days: true, startDate: true },
  })

  const balance = await computeLeaveBalance(employee.joiningDate, leaves)

  return ok({
    available: balance.available,
    accrued: balance.accrued,
    taken: balance.taken,
    lapsed: balance.lapsed,
    monthly_accrual: balance.monthlyAccrual,
    max_cap: balance.maxCap,
  })
}