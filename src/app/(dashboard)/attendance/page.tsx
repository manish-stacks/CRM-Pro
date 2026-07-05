'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import { getCurrentGeo } from '@/lib/geolocation'
import { formatDate, formatDateTime, getInitials, getStatusColor } from '@/lib/utils'
import { Badge, EmptyState, Pagination } from '@/components/ui'
import {
  Clock, LogIn, LogOut, MapPin, Monitor, Smartphone, Tablet as TabletIcon,
  Loader2, Filter, X, Search, Wifi, Home, Briefcase, Download, AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'

const STATUSES = ['PRESENT', 'HALF_DAY', 'LEAVE', 'ABSENT', 'HOLIDAY']
const WORK_MODES = ['WFO', 'WFH', 'FIELD']

function DeviceIcon({ device }: { device?: string | null }) {
  if (device === 'Mobile') return <Smartphone size={12} className="text-slate-400" />
  if (device === 'Tablet') return <TabletIcon size={12} className="text-slate-400" />
  return <Monitor size={12} className="text-slate-400" />
}

export default function AttendancePage() {
  const { user, isAtLeast } = useAuth()
  const canSeeAll = isAtLeast('MANAGER')

  const [records, setRecords] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [lateTotal, setLateTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [today, setToday] = useState<any>(null)
  const [punching, setPunching] = useState(false)
  const [now, setNow] = useState(new Date())

  const [page, setPage] = useState(1)
  const [showFilter, setShowFilter] = useState(false)
  const [filters, setFilters] = useState({
    status: '', month: '', date: '', departmentId: '', search: '',
  })
  const [departments, setDepartments] = useState<any[]>([])

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const activeFilters: Record<string, string> = { page: String(page), limit: '20' }
      Object.entries(filters).forEach(([k, v]) => { if (v) activeFilters[k] = v })
      const r = await api.get(`/attendance?${new URLSearchParams(activeFilters)}`)
      setRecords(r.data.data || [])
      setTotal(r.data.total || 0)
      setLateTotal(r.data.lateTotal || 0)
    } catch { toast.error('Failed to load attendance') }
    finally { setLoading(false) }
  }, [page, filters])

  const fetchToday = useCallback(async () => {
    try {
      const r = await api.get('/attendance/today')
      setToday(r.data.data)
    } catch {}
  }, [])

  useEffect(() => { fetchRecords() }, [fetchRecords])
  useEffect(() => { fetchToday() }, [fetchToday])
  useEffect(() => {
    if (canSeeAll) {
      api.get('/departments').then(r => setDepartments(r.data.data || [])).catch(() => {})
    }
  }, [canSeeAll])

  const isPunchedIn = today?.punchIn && !today?.punchOut
  const isPunchedOut = today?.punchIn && today?.punchOut

  const handlePunch = async (workMode: string = 'WFO') => {
    setPunching(true)
    const action = isPunchedIn ? 'punch_out' : 'punch_in'
    const loadingToast = toast.loading('Getting your location...')

    try {
      // Get browser geo + reverse geocode
      const geo = await getCurrentGeo({ reverseGeocode: true, timeoutMs: 8000 })
      if (geo.error) {
        toast.dismiss(loadingToast)
        toast.error(geo.error)
        setPunching(false)
        return
      }

      toast.dismiss(loadingToast)
      toast.loading(action === 'punch_in' ? 'Punching in...' : 'Punching out...')
      const r = await api.post('/attendance', {
        action,
        workMode,
        latitude: geo.latitude,
        longitude: geo.longitude,
        address: geo.address,
      })
      toast.dismiss()
      setToday(r.data.data)
      toast.success(action === 'punch_in' ? '✅ Punched In!' : '👋 Punched Out!')
      fetchRecords()
    } catch (e: any) {
      toast.dismiss()
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setPunching(false) }
  }

  const activeFilterCount = Object.values(filters).filter(v => v).length

  const exportAttendance = () => {
    const p = new URLSearchParams({ type: 'attendance', format: 'csv' })
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v as string) })
    window.open(`/api/import-export?${p.toString()}`, '_blank')
  }

  const workedSecs = useMemo(() => {
    if (!today?.punchIn) return 0
    const end = today.punchOut ? new Date(today.punchOut) : now
    return Math.max(0, Math.floor((end.getTime() - new Date(today.punchIn).getTime()) / 1000))
  }, [today, now])

  const fmtDuration = (secs: number) => {
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
        <p className="text-sm text-gray-500 mt-1">
          {canSeeAll ? 'Track team attendance with location & device details' : 'Your daily attendance log'}
        </p>
      </div>

      {/* Punch Card */}
      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Today</p>
            <p className="text-lg font-bold text-gray-900">{formatDate(now)}</p>
            <p className="text-3xl font-bold text-gray-900 tabular-nums mt-2">
              {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Status</p>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${
              isPunchedIn ? 'bg-green-100 text-green-700' :
              isPunchedOut ? 'bg-gray-100 text-gray-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              <span className="w-2 h-2 rounded-full bg-current" />
              {isPunchedIn ? 'Working' : isPunchedOut ? 'Day Ended' : 'Not Punched In'}
            </div>
            {today?.punchIn && (
              <p className="text-sm text-gray-600 mt-3 tabular-nums">
                {isPunchedOut ? `Worked: ${today.hoursWorked?.toFixed(2)}h` : `Working: ${fmtDuration(workedSecs)}`}
              </p>
            )}
            {today?.punchInAddress && (
              <p className="text-xs text-gray-500 mt-1 flex items-start gap-1 max-w-xs">
                <MapPin size={11} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="truncate">{today.punchInAddress}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {!isPunchedOut && (
              <>
                {!isPunchedIn && (
                  <div className="flex gap-2">
                    {WORK_MODES.map(mode => (
                      <button
                        key={mode}
                        onClick={() => handlePunch(mode)}
                        disabled={punching}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-300 hover:border-green-500 hover:bg-green-50 text-xs font-semibold text-gray-700 hover:text-green-700 transition-all disabled:opacity-50"
                      >
                        {mode === 'WFO' ? <Briefcase size={13} /> : mode === 'WFH' ? <Home size={13} /> : <MapPin size={13} />}
                        {mode}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => handlePunch()}
                  disabled={punching}
                  className={`flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm transition-all shadow-sm ${
                    isPunchedIn ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
                  } disabled:opacity-50`}
                >
                  {punching ? <Loader2 size={16} className="animate-spin" /> :
                    isPunchedIn ? <><LogOut size={15} /> Punch Out</> :
                    <><LogIn size={15} /> Punch In</>}
                </button>
                <p className="text-xs text-gray-500 text-center">
                  <MapPin size={10} className="inline mr-0.5" />
                  Location will be recorded
                </p>
              </>
            )}
            {isPunchedOut && (
              <div className="text-center">
                <p className="text-sm text-gray-500">✅ Day complete</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {today.hoursWorked?.toFixed(2)}h · {today.status}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">
              {canSeeAll ? 'Team Attendance' : 'My Attendance'}
            </h3>
            <span className="text-xs text-gray-500">({total} records)</span>
            {lateTotal > 0 && (
              <span className="badge bg-red-100 text-red-700 flex items-center gap-1">
                <AlertTriangle size={11} /> {lateTotal} Late
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canSeeAll && (
              <button onClick={exportAttendance} className="btn-secondary btn-sm">
                <Download size={13} /> Export
              </button>
            )}
            <button
              onClick={() => setShowFilter(!showFilter)}
              className={`btn-secondary btn-sm ${activeFilterCount > 0 ? 'border-blue-500 text-blue-600' : ''}`}
            >
              <Filter size={13} /> Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {showFilter && (
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Date</label>
              <input type="date" className="input text-xs"
                value={filters.date}
                onChange={e => { setFilters(p => ({ ...p, date: e.target.value, month: '' })); setPage(1) }} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Month</label>
              <input type="month" className="input text-xs"
                value={filters.month}
                onChange={e => { setFilters(p => ({ ...p, month: e.target.value, date: '' })); setPage(1) }} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
              <select className="input text-xs"
                value={filters.status}
                onChange={e => { setFilters(p => ({ ...p, status: e.target.value })); setPage(1) }}>
                <option value="">All</option>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            {canSeeAll && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Department</label>
                  <select className="input text-xs"
                    value={filters.departmentId}
                    onChange={e => { setFilters(p => ({ ...p, departmentId: e.target.value })); setPage(1) }}>
                    <option value="">All</option>
                    {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Employee</label>
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" className="input text-xs pl-7" placeholder="Search name"
                      value={filters.search}
                      onChange={e => { setFilters(p => ({ ...p, search: e.target.value })); setPage(1) }} />
                  </div>
                </div>
              </>
            )}
            {activeFilterCount > 0 && (
              <div className="col-span-full">
                <button
                  onClick={() => { setFilters({ status: '', month: '', date: '', departmentId: '', search: '' }); setPage(1) }}
                  className="text-xs text-red-600 hover:underline flex items-center gap-1"
                >
                  <X size={12} /> Clear all filters
                </button>
              </div>
            )}
          </div>
        )}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                {canSeeAll && <th>Employee</th>}
                <th>Date</th>
                <th>Punch In</th>
                <th>Punch Out</th>
                <th>Hours</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Late</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canSeeAll ? 9 : 8} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={canSeeAll ? 9 : 8}>
                    <EmptyState icon={<Clock size={48} />} title="No records" description="No attendance records match your filters" />
                  </td>
                </tr>
              ) : records.map((r: any) => (
                <tr key={r.id}>
                  {canSeeAll && (
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                          {getInitials(r.employee?.user?.name || '?')}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{r.employee?.user?.name}</p>
                          <p className="text-xs text-gray-500">{r.employee?.department?.name || '—'}</p>
                        </div>
                      </div>
                    </td>
                  )}
                  <td className="text-sm">{formatDate(r.date)}</td>
                  <td className="text-sm tabular-nums">
                    {r.punchIn ? new Date(r.punchIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="text-sm tabular-nums">
                    {r.punchOut ? new Date(r.punchOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="text-sm tabular-nums font-medium">{r.hoursWorked?.toFixed(2) || '—'}</td>
                  <td><Badge status={r.workMode} /></td>
                  <td><Badge status={r.status} /></td>
                  <td>
                    {r.isLate ? (
                      <span className="badge bg-red-100 text-red-700" title={`${r.lateBy} min late`}>
                        Late {r.lateBy ? `+${r.lateBy}m` : ''}
                      </span>
                    ) : r.punchIn ? (
                      <span className="badge bg-green-100 text-green-700">On time</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="text-xs text-gray-600 max-w-xs">
                    {r.punchInAddress ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-start gap-1">
                          <MapPin size={10} className="text-blue-500 flex-shrink-0 mt-0.5" />
                          <span className="truncate" title={r.punchInAddress}>{r.punchInAddress}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <DeviceIcon device={r.punchInDevice} />
                          <span>{r.punchInBrowser || r.punchInDevice || '—'}</span>
                          {r.punchInIp && <><Wifi size={10} /><span className="tabular-nums">{r.punchInIp}</span></>}
                        </div>
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-gray-100">
          <Pagination page={page} totalPages={Math.ceil(total / 20)} onChange={setPage} />
        </div>
      </div>
    </div>
  )
}
