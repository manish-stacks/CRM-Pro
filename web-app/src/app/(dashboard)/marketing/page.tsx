'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import { StatCard, EmptyState, Badge, Select } from '@/components/ui'
import { formatDate, getInitials } from '@/lib/utils'
import {
  Target, Video, CalendarClock, CheckCircle2, XCircle, Ban,
  Phone, MapPin, TrendingUp, Users, Award, ArrowRight,
  Building2, Clock, Loader2
} from 'lucide-react'
import toast from 'react-hot-toast'

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

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const q = selectedUserId ? `?userId=${selectedUserId}` : ''
      const r = await api.get(`/marketing/dashboard${q}`)
      setData(r.data.data)
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }, [selectedUserId])

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
        <StatCard label="Open Meetings" value={s.openCount} icon={Video} color="purple" />
        <StatCard label="Converted" value={s.converted} icon={CheckCircle2} color="green" />
        <StatCard label="Lost / Closed" value={s.closed + s.notInterested} icon={XCircle} color="red" />
        <StatCard label="Conversion" value={`${s.conversionRate}%`} icon={TrendingUp} color="emerald" />
      </div>

      {/* Today's meetings — the most important section */}
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
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
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
    </div>
  )
}
