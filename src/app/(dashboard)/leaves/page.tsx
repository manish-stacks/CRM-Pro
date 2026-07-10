'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import { Button, Input, Select, Textarea, Modal, EmptyState, Pagination, Badge } from '@/components/ui'
import { formatDate, getInitials } from '@/lib/utils'
import {
  Plus, Calendar, Filter, X, Check, Ban, Clock, CalendarDays, Loader2, Search,
  Eye
} from 'lucide-react'
import toast from 'react-hot-toast'

const LEAVE_TYPES = ['PAID', 'UNPAID', 'SICK', 'CASUAL', 'MATERNITY', 'PATERNITY']
const DURATIONS = [
  { key: 'SINGLE_DAY', label: 'Single Day', icon: Calendar },
  { key: 'MULTIPLE_DAYS', label: 'Multiple Days', icon: CalendarDays },
  { key: 'SHORT_HOURLY', label: 'Short (Hourly)', icon: Clock },
]
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']

export default function LeavesPage() {
  const { user, isAtLeast } = useAuth()
  const canApprove = isAtLeast('MANAGER')

  const [leaves, setLeaves] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showFilter, setShowFilter] = useState(false)
  const [filters, setFilters] = useState({
    status: '', leaveType: '', duration: '', month: '', departmentId: '', search: '',
  })
  const [departments, setDepartments] = useState<any[]>([])
  const [balance, setBalance] = useState<any>(null)
  const [reasonModal, setReasonModal] = useState<any>(null)

  const [modal, setModal] = useState<'none' | 'apply' | 'reject'>('none')
  const [target, setTarget] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const [form, setForm] = useState({
    leaveType: 'PAID',
    duration: 'SINGLE_DAY',
    startDate: '',
    endDate: '',
    hourlyStart: '',
    hourlyEnd: '',
    hourlyHours: 0,
    reason: '',
  })

  const fetchLeaves = useCallback(async () => {
    setLoading(true)
    try {
      const p: Record<string, string> = { page: String(page), limit: '20' }
      Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v })
      const r = await api.get(`/leaves?${new URLSearchParams(p)}`)
      setLeaves(r.data.data || [])
      setTotal(r.data.total || 0)
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { fetchLeaves() }, [fetchLeaves])
  useEffect(() => {
    api.get('/leaves/balance').then(r => setBalance(r.data.data)).catch(() => { })
  }, [])
  useEffect(() => {
    if (isAtLeast('ADMIN')) {
      api.get('/departments').then(r => setDepartments(r.data.data || [])).catch(() => { })
    }
  }, [isAtLeast])

  const openApply = () => {
    setForm({
      leaveType: 'PAID', duration: 'SINGLE_DAY',
      startDate: '', endDate: '', hourlyStart: '', hourlyEnd: '', hourlyHours: 0,
      reason: '',
    })
    setModal('apply')
  }

  const apply = async () => {
    if (!form.reason.trim()) { toast.error('Reason required'); return }
    if (form.duration === 'SINGLE_DAY' && !form.startDate) { toast.error('Date required'); return }
    if (form.duration === 'MULTIPLE_DAYS' && (!form.startDate || !form.endDate)) { toast.error('Start & end dates required'); return }
    if (form.duration === 'SHORT_HOURLY' && (!form.startDate || !form.hourlyStart || !form.hourlyEnd)) { toast.error('Date + start/end times required'); return }

    setSaving(true)
    try {
      const payload: any = { ...form }
      if (form.duration === 'SINGLE_DAY') payload.endDate = form.startDate
      await api.post('/leaves', payload)
      toast.success('Applied!')
      setModal('none')
      fetchLeaves()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const approve = async (l: any) => {
    if (!confirm(`Approve leave for ${l.employee?.user?.name}?`)) return
    try {
      await api.patch(`/leaves/${l.id}`, { action: 'approve' })
      toast.success('Approved!')
      fetchLeaves()
    } catch { toast.error('Failed') }
  }

  const openReject = (l: any) => {
    setTarget(l)
    setRejectReason('')
    setModal('reject')
  }
  const reject = async () => {
    if (!rejectReason.trim()) { toast.error('Reason required'); return }
    setSaving(true)
    try {
      await api.patch(`/leaves/${target.id}`, { action: 'reject', rejectionReason: rejectReason })
      toast.success('Rejected!')
      setModal('none')
      fetchLeaves()
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  const activeFilterCount = Object.values(filters).filter(v => v).length

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leaves</h1>
          <p className="text-sm text-gray-500 mt-1">
            {canApprove ? 'Manage team leave requests' : 'Apply for leave and track your requests'}
          </p>
        </div>
        <Button onClick={openApply}><Plus size={14} /> Apply Leave</Button>
      </div>

      {/* My leave balance (auto carry-forward, capped) */}
      {balance && (
        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-indigo-100 text-xs">Available paid leaves</p>
              <p className="text-3xl font-bold mt-0.5">{balance.available}</p>
              <p className="text-indigo-100 text-xs mt-0.5">Max carry-forward: {balance.maxCap} · {balance.monthlyAccrual}/month</p>
            </div>
            <div className="flex gap-5 text-center">
              <div><p className="text-lg font-bold">{balance.accrued}</p><p className="text-[11px] text-indigo-100">Earned</p></div>
              <div><p className="text-lg font-bold">{balance.taken}</p><p className="text-[11px] text-indigo-100">Taken</p></div>
              {balance.lapsed > 0 && <div><p className="text-lg font-bold text-amber-200">{balance.lapsed}</p><p className="text-[11px] text-indigo-100">Lapsed</p></div>}
            </div>
          </div>
          {balance.lapsed > 0 && (
            <p className="text-[11px] text-amber-100 mt-2">⚠️ {balance.lapsed} leave cap ({balance.maxCap}) se upar hone ki wajah se lapse ho gaye.</p>
          )}
        </div>
      )}

      <div className="card">
        <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">All Leaves</h3>
            <span className="text-xs text-gray-500">({total})</span>
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`btn-secondary btn-sm ${activeFilterCount > 0 ? 'border-blue-500 text-blue-600' : ''}`}
          >
            <Filter size={13} /> Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {showFilter && (
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 grid grid-cols-2 md:grid-cols-6 gap-3">
            <select value={filters.status} onChange={e => { setFilters(p => ({ ...p, status: e.target.value })); setPage(1) }} className="input">
              <option value="">Status: All</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.leaveType} onChange={e => { setFilters(p => ({ ...p, leaveType: e.target.value })); setPage(1) }} className="input">
              <option value="">Type: All</option>
              {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filters.duration} onChange={e => { setFilters(p => ({ ...p, duration: e.target.value })); setPage(1) }} className="input">
              <option value="">Duration: All</option>
              {DURATIONS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
            <input type="month" className="input text-xs"
              value={filters.month} onChange={e => { setFilters(p => ({ ...p, month: e.target.value })); setPage(1) }} />
            {canApprove && (
              <>
                <select value={filters.departmentId} onChange={e => { setFilters(p => ({ ...p, departmentId: e.target.value })); setPage(1) }}>
                  <option value="">Dept: All</option>
                  {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" className="input text-xs pl-7" placeholder="Employee"
                    value={filters.search} onChange={e => { setFilters(p => ({ ...p, search: e.target.value })); setPage(1) }} />
                </div>
              </>
            )}
            {activeFilterCount > 0 && (
              <div className="col-span-full">
                <button onClick={() => { setFilters({ status: '', leaveType: '', duration: '', month: '', departmentId: '', search: '' }); setPage(1) }}
                  className="text-xs text-red-600 hover:underline flex items-center gap-1">
                  <X size={12} /> Clear all
                </button>
              </div>
            )}
          </div>
        )}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                {canApprove && <th>Employee</th>}
                <th>Type</th>
                <th>Duration</th>
                <th>Period</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
                {canApprove && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canApprove ? 8 : 6} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : leaves.length === 0 ? (
                <tr><td colSpan={canApprove ? 8 : 6}>
                  <EmptyState icon={<Calendar size={48} />} title="No leaves" description="No leave requests match" />
                </td></tr>
              ) : leaves.map((l: any) => (
                <tr key={l.id}>
                  {canApprove && (
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                          {getInitials(l.employee?.user?.name || '?')}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{l.employee?.user?.name}</p>
                          <p className="text-xs text-gray-500">{l.employee?.department?.name || '—'}</p>
                        </div>
                      </div>
                    </td>
                  )}
                  <td><Badge status={l.leaveType} /></td>
                  <td>
                    <span className="text-xs font-medium text-gray-600">
                      {l.duration === 'SINGLE_DAY' ? '📅 Single' : l.duration === 'MULTIPLE_DAYS' ? '📆 Multiple' : '⏰ Hourly'}
                    </span>
                  </td>
                  <td className="text-sm">
                    {l.duration === 'SHORT_HOURLY' ? (
                      <>
                        <p>{formatDate(l.startDate)}</p>
                        <p className="text-xs text-gray-500">{l.hourlyStart} — {l.hourlyEnd}</p>
                      </>
                    ) : l.duration === 'SINGLE_DAY' ? (
                      formatDate(l.startDate)
                    ) : (
                      <>
                        <p>{formatDate(l.startDate)}</p>
                        <p className="text-xs text-gray-500">to {formatDate(l.endDate)}</p>
                      </>
                    )}
                  </td>
                  <td className="text-sm font-semibold tabular-nums">
                    {l.duration === 'SHORT_HOURLY' ? `${l.hourlyHours}h` : `${l.days}d`}
                  </td>
                  <td className="text-xs text-gray-700 max-w-xs">
                    <button onClick={() => setReasonModal(l)} className="text-left hover:text-blue-600 truncate block max-w-[220px] underline decoration-dotted">
                      {l.reason?.length > 40 ? l.reason.slice(0, 40) + '…' : (l.reason || '—')}
                    </button>
                  </td>
                  <td>
                    <Badge status={l.status} />
                    {l.status === 'REJECTED' && l.rejectionReason && (
                      <p className="text-xs text-red-600 mt-1" title={l.rejectionReason}>Reason: {l.rejectionReason.slice(0, 30)}...</p>
                    )}
                  </td>
                  {canApprove && (
                    <td className="text-right">
                      <div className="flex items-center justify-end">
                        {l.status === 'PENDING' ?
                          (
                            <>
                              <button onClick={() => approve(l)} className="btn-ghost btn-sm text-green-600" title="Approve"><Check size={13} /></button>
                              <button onClick={() => openReject(l)} className="btn-ghost btn-sm text-red-600" title="Reject"><Ban size={13} /></button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">Done</span>
                          )}
                        <button onClick={() => setReasonModal(l)} className="btn-ghost btn-sm text-gray-600 ml-2" title="View reason">
                          <Eye size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100">
          <Pagination page={page} totalPages={Math.ceil(total / 20)} onChange={setPage} />
        </div>
      </div>

      {/* Apply Leave Modal */}
      {/* Full leave reason viewer */}
      <Modal open={!!reasonModal} onClose={() => setReasonModal(null)} title="Leave Reason">
        {reasonModal && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="font-semibold text-gray-900">{reasonModal.employee?.user?.name}</span>
              <Badge status={reasonModal.leaveType} />
              <Badge status={reasonModal.status} />
              <span className="text-gray-500">
                {formatDate(reasonModal.startDate)}{reasonModal.duration === 'MULTIPLE_DAYS' ? ` → ${formatDate(reasonModal.endDate)}` : ''} · {reasonModal.days} day(s)
              </span>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap max-h-[50vh] overflow-y-auto">
              {reasonModal.reason || '—'}
            </div>
            {reasonModal.status === 'REJECTED' && reasonModal.rejectionReason && (
              <div className="bg-red-50 rounded-xl p-3 text-sm text-red-700">
                <b>Rejection reason:</b> {reasonModal.rejectionReason}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={modal === 'apply'} onClose={() => setModal('none')} title="Apply for Leave">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Leave Type" value={form.leaveType} onChange={e => setForm(p => ({ ...p, leaveType: e.target.value }))} options={LEAVE_TYPES.map(t => ({ value: t, label: t }))} />
            <div>
              <label className="label">Duration</label>
              <div className="grid grid-cols-3 gap-1">
                {DURATIONS.map(d => (
                  <button key={d.key} type="button"
                    onClick={() => setForm(p => ({ ...p, duration: d.key }))}
                    className={`flex flex-col items-center gap-1 py-2 rounded-lg border-2 text-xs font-medium ${form.duration === d.key ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}>
                    <d.icon size={16} />
                    {d.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {form.duration === 'SINGLE_DAY' && (
            <Input label="Date" type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
          )}
          {form.duration === 'MULTIPLE_DAYS' && (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Start Date" type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
              <Input label="End Date" type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} />
            </div>
          )}
          {form.duration === 'SHORT_HOURLY' && (
            <>
              <Input label="Date" type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Start Time" type="time" value={form.hourlyStart} onChange={e => setForm(p => ({ ...p, hourlyStart: e.target.value }))} />
                <Input label="End Time" type="time" value={form.hourlyEnd} onChange={e => setForm(p => ({ ...p, hourlyEnd: e.target.value }))} />
              </div>
            </>
          )}

          <Textarea label="Reason" value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
            placeholder="Briefly explain why..." rows={3} />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button onClick={apply} loading={saving}>Submit Application</Button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal open={modal === 'reject'} onClose={() => setModal('none')} title="Reject Leave Request">
        <div className="space-y-3">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p><b>{target?.employee?.user?.name}</b></p>
            <p className="text-xs text-gray-500 mt-1">{target?.reason}</p>
          </div>
          <Textarea label="Rejection Reason" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
            placeholder="Provide reason (will be shown to employee)" rows={3} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button variant="danger" onClick={reject} loading={saving}>Reject</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
