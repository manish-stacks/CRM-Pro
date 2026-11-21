// src/components/dashboard/MonthStartSummaryWidget.tsx
'use client'
import { useState, useEffect } from 'react'
import api from '@/lib/axios'
import {
  CalendarCheck2,
  Clock,
  AlertCircle,
  FileDown,
  DollarSign,
  CheckCircle2,
  Calendar,
  Sparkles,
  Info
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export function MonthStartSummaryWidget() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/payroll/monthly-summary')
      .then(res => {
        setData(res.data.data || res.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || !data) return null

  // Statement is strictly visible ONLY during month-start window (1st to 5th)
  // e.g. November's statement is displayed in December between 1st and 5th only.
  if (!data.isMonthStartWindow) return null

  const isMonthStart = data.isMonthStartWindow

  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-brand-50/50 p-6 shadow-sm">
      {/* Decorative background glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-brand-200/30 blur-3xl" />

      <div className="relative">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100/70 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
              <CalendarCheck2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900">
                  {data.monthName} {data.year} Payout & Attendance Statement
                </h3>
                {isMonthStart && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                    <Sparkles size={11} /> Month-Start Window (1st - 5th)
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Monthly performance, working days, deductions and net payable transfer amount
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                data.status === 'PAID'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {data.status === 'PAID' ? 'Transferred / Paid' : 'Processing / Pending'}
            </span>

            {data.payslipId && (
              <a
                href={`/api/payroll/${data.payslipId}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
              >
                <FileDown size={14} /> Download Payslip (PDF)
              </a>
            )}
          </div>
        </div>

        {/* 8-metric KPI grid */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {/* Working Days */}
          <div className="rounded-xl bg-white/90 p-3 shadow-xs border border-gray-100 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Working Days</p>
            <p className="mt-1 text-xl font-bold text-gray-800">{data.workingDays}d</p>
            <p className="text-[10px] text-gray-400">Office open</p>
          </div>

          {/* Present Days */}
          <div className="rounded-xl bg-emerald-50/80 p-3 shadow-xs border border-emerald-100 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Present</p>
            <p className="mt-1 text-xl font-bold text-emerald-700">{data.presentDays}d</p>
            <p className="text-[10px] text-emerald-600">Worked days</p>
          </div>

          {/* Approved Leaves */}
          <div className="rounded-xl bg-blue-50/80 p-3 shadow-xs border border-blue-100 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">Leave</p>
            <p className="mt-1 text-xl font-bold text-blue-700">{data.leaveDays}d</p>
            <p className="text-[10px] text-blue-600">Approved leaves</p>
          </div>

          {/* Short Leaves */}
          <div className="rounded-xl bg-amber-50/80 p-3 shadow-xs border border-amber-100 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">Short Leave</p>
            <p className="mt-1 text-xl font-bold text-amber-800">{data.shortLeaveCount}</p>
            <p className="text-[10px] text-amber-700">
              {data.shortLeavePenaltyDays > 0 ? `-${data.shortLeavePenaltyDays}d LOP` : '1 free/month'}
            </p>
          </div>

          {/* Late Punch-ins */}
          <div className="rounded-xl bg-orange-50/80 p-3 shadow-xs border border-orange-100 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-800">Late Marks</p>
            <p className="mt-1 text-xl font-bold text-orange-800">{data.lateCount}</p>
            <p className="text-[10px] text-orange-700">
              {data.latePenaltyDays > 0 ? `-${data.latePenaltyDays}d LOP` : '4 grace lates'}
            </p>
          </div>

          {/* Absent Days */}
          <div className="rounded-xl bg-red-50/80 p-3 shadow-xs border border-red-100 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700">Absent</p>
            <p className="mt-1 text-xl font-bold text-red-700">{data.absentDays}d</p>
            <p className="text-[10px] text-red-600">Unaccounted</p>
          </div>

          {/* Final Payable Days */}
          <div className="rounded-xl bg-indigo-50/90 p-3 shadow-xs border border-indigo-200 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-800">Payable Days</p>
            <p className="mt-1 text-xl font-extrabold text-indigo-700">{data.payableDays}d</p>
            <p className="text-[10px] text-indigo-600">Final paid</p>
          </div>

          {/* Final Transfer Amount */}
          <div className="rounded-xl bg-emerald-600 p-3 shadow-sm text-center text-white">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-100">Transfer Amt</p>
            <p className="mt-1 text-lg font-extrabold tracking-tight text-white">
              {formatCurrency(data.netSalary)}
            </p>
            <p className="text-[10px] text-emerald-100">Net salary</p>
          </div>
        </div>

        {/* Footer info: Bank Details & Rules breakdown */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/70 px-4 py-2.5 text-xs text-gray-600 border border-gray-100">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-indigo-500 shrink-0" />
            <span>
              <b>Policy Rules:</b> 4 late punch-ins forgiven (5th late incurs 0.5d cut) · Max 2 hrs short leave (1 allowed free; 2nd short leave incurs 0.5d cut).
            </span>
          </div>

          {data.bankName && (
            <div className="flex items-center gap-2 font-medium text-gray-700">
              <span>Payout Account: <b>{data.bankName}</b> {data.accountNumber}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
