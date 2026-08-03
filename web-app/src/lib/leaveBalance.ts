// src/lib/leaveBalance.ts
// Auto-calculated paid-leave balance with monthly accrual + carry-forward cap.
//
// Rule (admin-configurable via Settings):
//   - Earn `monthlyAccrual` paid leaves each month (default 1 → 12/year).
//   - Unused leaves carry forward, BUT the balance can never exceed `maxCap`
//     (default 6). Anything above the cap lapses (wasted).
//   - Approved non-UNPAID leaves consume the balance in the month they start.
//   - `leave_balance_start_month` ("YYYY-MM") is a hard reset line: nothing before
//     that month counts (no accrual, no usage), so everyone starts from zero and
//     accrues fresh from that month onward.
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
  countingFrom: string   // "YYYY-MM" the balance is being counted from
  wasReset: boolean      // true when a company-wide reset month is in effect
}

type LeaveRow = { leaveType: string; status: string; days: number; startDate: Date | string }

export async function computeLeaveBalance(
  joiningDate: Date | string | null,
  leaves: LeaveRow[],
): Promise<LeaveBalanceResult> {
  const monthlyAccrual = (await Settings.leaveMonthlyAccrual()) ?? 1
  const maxCap = (await Settings.leaveMaxCarryForward()) ?? 6
  const resetMonth = (await Settings.leaveBalanceStartMonth()) || ''

  const now = new Date()
  let start = joiningDate ? new Date(joiningDate) : new Date(now.getFullYear(), 0, 1)

  // Hard reset: never count anything before this month, even for old employees.
  if (/^\d{4}-\d{2}$/.test(resetMonth)) {
    const [ry, rm] = resetMonth.split('-').map(Number)
    const resetFrom = new Date(ry, rm - 1, 1)
    if (resetFrom > start) start = resetFrom
  }

  const countingFrom = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
  const wasReset = /^\d{4}-\d{2}$/.test(resetMonth)

  const base: LeaveBalanceResult = {
    available: 0, accrued: 0, taken: 0, lapsed: 0,
    monthlyAccrual, maxCap, monthsCounted: 0, countingFrom, wasReset,
  }
  if (start > now) return base

  // Approved, balance-consuming leaves grouped by the month they start in.
  // Anything before the counting window is ignored — it belongs to the old cycle.
  const windowStart = new Date(start.getFullYear(), start.getMonth(), 1)
  const takenByMonth: Record<string, number> = {}
  let totalTaken = 0
  for (const lv of leaves) {
    if (lv.status !== 'APPROVED') continue
    if (lv.leaveType === 'UNPAID') continue
    const d = new Date(lv.startDate)
    if (d < windowStart) continue
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
    monthlyAccrual, maxCap, monthsCounted: months, countingFrom, wasReset,
  }
}