// src/lib/leaveBalance.ts
// Auto-calculated paid-leave balance with monthly accrual + carry-forward cap.
//
// Rule (admin-configurable via Settings):
//   - Earn `monthlyAccrual` paid leaves each month (default 1 → 12/year).
//   - Unused leaves carry forward, BUT the balance can never exceed `maxCap`
//     (default 6). Anything above the cap lapses (wasted).
//   - Approved non-UNPAID leaves consume the balance in the month they start.
//
// Simulation runs month-by-month from the employee's joining month to now, so
// carry-forward + capping + lapsing all fall out naturally with no cron/reset.
import { Settings } from './settings'

export interface LeaveBalanceResult {
  available: number      // current usable balance (capped)
  accrued: number        // total earned over the period
  taken: number          // total approved paid leaves used
  lapsed: number         // leaves wasted because of the cap
  monthlyAccrual: number
  maxCap: number
  monthsCounted: number
}

type LeaveRow = { leaveType: string; status: string; days: number; startDate: Date | string }

export async function computeLeaveBalance(
  joiningDate: Date | string | null,
  leaves: LeaveRow[],
): Promise<LeaveBalanceResult> {
  const monthlyAccrual = (await Settings.leaveMonthlyAccrual()) ?? 1
  const maxCap = (await Settings.leaveMaxCarryForward()) ?? 6

  const now = new Date()
  const start = joiningDate ? new Date(joiningDate) : new Date(now.getFullYear(), 0, 1)

  const base: LeaveBalanceResult = {
    available: 0, accrued: 0, taken: 0, lapsed: 0, monthlyAccrual, maxCap, monthsCounted: 0,
  }
  if (start > now) return base

  // Approved, balance-consuming leaves grouped by the month they start in
  const takenByMonth: Record<string, number> = {}
  let totalTaken = 0
  for (const lv of leaves) {
    if (lv.status !== 'APPROVED') continue
    if (lv.leaveType === 'UNPAID') continue
    const d = new Date(lv.startDate)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    const days = lv.days || 0
    takenByMonth[key] = (takenByMonth[key] || 0) + days
    totalTaken += days
  }

  let balance = 0
  let accrued = 0
  let lapsed = 0
  let months = 0

  const cur = new Date(start.getFullYear(), start.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 1)
  while (cur <= end) {
    months++
    // 1) accrue for the month, then apply the carry cap (excess lapses)
    balance += monthlyAccrual
    accrued += monthlyAccrual
    if (balance > maxCap) { lapsed += balance - maxCap; balance = maxCap }
    // 2) deduct leaves taken in this month
    const key = `${cur.getFullYear()}-${cur.getMonth()}`
    balance -= (takenByMonth[key] || 0)
    if (balance < 0) balance = 0 // over-usage = loss-of-pay, floor at 0
    cur.setMonth(cur.getMonth() + 1)
  }

  const r = (n: number) => Math.round(n * 2) / 2 // nearest 0.5
  return {
    available: r(balance),
    accrued: r(accrued),
    taken: r(totalTaken),
    lapsed: r(lapsed),
    monthlyAccrual, maxCap, monthsCounted: months,
  }
}