'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import { StatCard, EmptyState, Badge, Select, Input } from '@/components/ui'
import { formatDate, getInitials } from '@/lib/utils'
import {
  Target, Video, CalendarClock, CheckCircle2, XCircle, Ban,
  Phone, MapPin, TrendingUp, Users, Award, ArrowRight,
  Building2, Clock, Loader2, Search, X, CalendarDays
} from 'lucide-react'
import toast from 'react-hot-toast'

const RANGE_TABS = [
  { key: '', label: 'Overview' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'week', label: 'Next 7 days' },
  { key: 'past', label: 'Past' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All status' },
  { value: 'MEETING_SCHEDULED', label: 'Meeting Scheduled' },
  { value: 'CONVERTED', label: 'Converted' },
  { value: 'CLOSED', label: 'Closed / Lost' },
  { value: 'NOT_INTERESTED', label: 'Not Interested' },
  { value: 'FOLLOW_UP', label: 'Follow Up' },
]

const STATUS_COLORS: Record<string, string> = {
  MEETING_SCHEDULED: 'bg-purple-100 text-purple-700',
  CONVERTED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-slate-100 text-slate-700',
  NOT_INTERESTED: 'bg-red-100 text-red-700',
  FOLLOW_UP: 'bg-yellow-100 text-yellow-700',
  RINGING: 'bg-amber-100 text-amber-700',
}

export default function MarketingDashboardPage() {
  const { user, isAtLeast } = useAuth()
  const canSeeOthers = isAtLeast('ADMIN')

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [executives, setExecutives] = useState<any[]>([])

  // ---- Filters ----
  const [range, setRange] = useState('')
  const [exactDate, setExactDate] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusF, setStatusF] = useState('')
  const [search, setSearch] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const clearFilters = () => {
    setRange(''); setExactDate(''); setDateFrom(''); setDateTo(''); setStatusF(''); setSearch('')
  }
  const hasFilter = !!(range || exactDate || dateFrom || dateTo || statusF || search)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (selectedUserId) p.set('userId', selectedUserId)
      if (exactDate) p.set('date', exactDate)
      else if (range) p.set('range', range)
      else {
        if (dateFrom) p.set('dateFrom', dateFrom)
        if (dateTo) p.set('dateTo', dateTo)
      }
      if (statusF) p.set('status', statusF)
      if (search) p.set('search', search)
      const q = p.toString()
      const r = await api.get(`/marketing/dashboard${q ? `?${q}` : ''}`)
      setData(r.data.data)
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }, [selectedUserId, range, exactDate, dateFrom, dateTo, statusF, search])

  useEffect(() => { fetch_() }, [fetch_])

  useEffect(() => {
    if (canSeeOthers) {
      api.get('/marketing/executives').then(r => setExecutives(r.data.data || [])).catch(() => {})
    }
  }, [canSeeOthers])

  if (loading) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>
  if (!data) return null

  const s = data.stats

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketing Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Track meetings, follow-ups, and deals</p>
        </div>
        {canSeeOthers && (
          <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} className="max-w-xs input">
            <option value="">👤 My dashboard</option>
            {executives.map((e: any) => <option key={e.id} value={e.id}>{e.name} ({e.role.replace(/_/g, ' ')})</option>)}
          </select>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Assigned" value={s.totalAssigned} icon={Target} color="blue" />
        <StatCard label="Today" value={s.todayCount ?? 0} icon={CalendarDays} color="purple" sub={`${s.tomorrowCount ?? 0} tomorrow`} />
        <StatCard label="Converted" value={s.converted} icon={CheckCircle2} color="green" />
        <StatCard label="Lost / Closed" value={s.closed + s.notInterested} icon={XCircle} color="red" />
        <StatCard label="Conversion" value={`${s.conversionRate}%`} icon={TrendingUp} color="emerald" />
      </div>

      {/* ---------- Filter bar ---------- */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {RANGE_TABS.map(t => {
            const active = !exactDate && range === t.key
            return (
              <button key={t.key || 'ov'}
                onClick={() => { setExactDate(''); setDateFrom(''); setDateTo(''); setRange(t.key) }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                  active ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
                }`}>
                {t.label}
                {t.key === 'today' && s.todayCount ? ` (${s.todayCount})` : ''}
                {t.key === 'tomorrow' && s.tomorrowCount ? ` (${s.tomorrowCount})` : ''}
              </button>
            )
          })}
          <button onClick={() => setShowAdvanced(v => !v)}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold border border-gray-200 text-gray-600 hover:border-gray-300">
            {showAdvanced ? 'Hide' : 'More'} filters
          </button>
          {hasFilter && (
            <button onClick={clearFilters} className="text-xs text-red-600 hover:underline flex items-center gap-1">
              <X size={12} /> Clear
            </button>
          )}
        </div>

        {showAdvanced && (
          <div className="grid md:grid-cols-5 gap-3 pt-1">
            <Input label="Exact date" type="date" value={exactDate}
              onChange={e => { setExactDate(e.target.value); setRange('') }} />
            <Input label="From" type="date" value={dateFrom} disabled={!!exactDate || !!range}
              onChange={e => setDateFrom(e.target.value)} />
            <Input label="To" type="date" value={dateTo} disabled={!!exactDate || !!range}
              onChange={e => setDateTo(e.target.value)} />
            <Select label="Status" options={STATUS_OPTIONS} value={statusF} onChange={e => setStatusF(e.target.value)} />
            <div>
              <label className="label">Search</label>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-8 text-sm" placeholder="Client, company, lead no."
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---------- Filtered result list ---------- */}
      {data.filterActive && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <CalendarDays size={16} className="text-purple-600" /> Filtered Meetings
            </h2>
            <span className="badge bg-purple-100 text-purple-700">{data.filteredMeetings?.length || 0}</span>
          </div>
          {!data.filteredMeetings?.length ? (
            <p className="text-sm text-gray-500 text-center py-6">No meetings found for this filter.</p>
          ) : (
            <div className="space-y-2">
              {data.filteredMeetings.map((l: any) => (
                <Link key={l.id} href={`/leads/${l.id}`}
                  className="flex items-center gap-3 bg-white rounded-lg p-3 border border-gray-100 hover:border-purple-300 hover:shadow-sm transition-all group">
                  <div className="text-center flex-shrink-0 w-12">
                    <p className="text-[10px] text-purple-500 font-semibold uppercase">
                      {l.meetingDate ? new Date(l.meetingDate).toLocaleDateString('en-IN', { weekday: 'short' }) : '--'}
                    </p>
                    <p className="text-lg font-bold text-gray-900 leading-none">
                      {l.meetingDate ? new Date(l.meetingDate).getDate() : '--'}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {l.meetingDate ? new Date(l.meetingDate).toLocaleDateString('en-IN', { month: 'short' }) : ''}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0 border-l border-gray-100 pl-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{l.clientName}</p>
                      <span className={`badge ${STATUS_COLORS[l.status]}`}>{l.status.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                      {l.companyName && <span className="flex items-center gap-1"><Building2 size={10} /> {l.companyName}</span>}
                      <span className="flex items-center gap-1"><Phone size={10} /> {l.clientPhone}</span>
                      {(l.meetingSlot || l.meetingTime) && <span className="flex items-center gap-1"><Clock size={10} /> {l.meetingSlot || l.meetingTime}</span>}
                      {l.meetingLocation && <span className="flex items-center gap-1"><MapPin size={10} /> {l.meetingLocation}</span>}
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-gray-400 group-hover:text-purple-600" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Today's meetings — the most important section */}
      {!data.filterActive && (
      <>
      <div className="card p-5 border-purple-200 bg-purple-50/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Video size={16} className="text-purple-600" /> Today's Meetings
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Meetings scheduled for today</p>
          </div>
          <span className="badge bg-purple-100 text-purple-700">{data.todayMeetings.length}</span>
        </div>
        {data.todayMeetings.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No meetings today. Enjoy your day! 😊</p>
        ) : (
          <div className="space-y-2">
            {data.todayMeetings.map((l: any) => (
              <Link key={l.id} href={`/leads/${l.id}`}
                className="flex items-center gap-3 bg-white rounded-lg p-3 border border-purple-100 hover:border-purple-300 hover:shadow-sm transition-all group">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white font-bold">
                  {l.meetingTime?.split(':')[0] || '--'}<span className="text-xs">:{l.meetingTime?.split(':')[1] || '00'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{l.clientName}</p>
                    <span className={`badge ${STATUS_COLORS[l.status]}`}>{l.status.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                    {l.companyName && <span className="flex items-center gap-1"><Building2 size={10} /> {l.companyName}</span>}
                    <span className="flex items-center gap-1"><Phone size={10} /> {l.clientPhone}</span>
                    {l.meetingSlot && <span className="flex items-center gap-1"><Clock size={10} /> {l.meetingSlot}</span>}
                    {l.meetingLocation && <span className="flex items-center gap-1"><MapPin size={10} /> {l.meetingLocation}</span>}
                    {l.assignedTo && <span>👤 from: {l.assignedTo.name}</span>}
                  </div>
                  {l.meetingNotes && <p className="text-xs text-gray-600 mt-1 italic line-clamp-1">{l.meetingNotes}</p>}
                </div>
                <ArrowRight size={16} className="text-gray-400 group-hover:text-purple-600" />
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upcoming meetings */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <CalendarClock size={14} /> Upcoming (Next 7 Days)
            </h3>
            <span className="text-xs text-gray-500">{data.upcomingMeetings.length}</span>
          </div>
          {data.upcomingMeetings.length === 0 ? (
            <EmptyState icon={<CalendarClock size={32} className="text-gray-400" />} title="Nothing upcoming" description="No meetings in the next week" />
          ) : (
            <div className="space-y-2">
              {data.upcomingMeetings.map((l: any) => (
                <Link key={l.id} href={`/leads/${l.id}`}
                  className="flex items-center gap-2 hover:bg-gray-50 rounded-lg p-2 -mx-2">
                  <div className="text-center flex-shrink-0 w-12">
                    <p className="text-[10px] text-purple-500 font-semibold uppercase">
                      {new Date(l.meetingDate).toLocaleDateString('en-IN', { weekday: 'short' })}
                    </p>
                    <p className="text-lg font-bold text-gray-900 leading-none">{new Date(l.meetingDate).getDate()}</p>
                    <p className="text-[10px] text-gray-500">
                      {new Date(l.meetingDate).toLocaleDateString('en-IN', { month: 'short' })}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0 border-l border-gray-200 pl-3">
                    <p className="font-medium text-sm text-gray-900 truncate">{l.clientName}</p>
                    <p className="text-xs text-gray-500">{l.meetingSlot || l.meetingTime || 'Time TBD'}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Past meetings */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Award size={14} /> Recent Meetings (30 days)
            </h3>
            <span className="text-xs text-gray-500">{data.pastMeetings.length}</span>
          </div>
          {data.pastMeetings.length === 0 ? (
            <EmptyState icon={<Award size={32} className="text-gray-400" />} title="No past meetings" description="Your history will show here" />
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {data.pastMeetings.map((l: any) => (
                <Link key={l.id} href={`/leads/${l.id}`}
                  className="flex items-center gap-2 hover:bg-gray-50 rounded-lg p-2 -mx-2">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                    {getInitials(l.clientName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{l.clientName}</p>
                    <p className="text-xs text-gray-500">{formatDate(l.meetingDate)}</p>
                  </div>
                  <span className={`badge ${STATUS_COLORS[l.status]} text-[10px]`}>
                    {l.status === 'CONVERTED' ? '✓' : l.status === 'CLOSED' ? '✗' : l.status.replace(/_/g, ' ')}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  )
}
