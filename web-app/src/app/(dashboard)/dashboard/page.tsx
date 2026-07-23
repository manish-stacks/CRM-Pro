'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { StatCard } from '@/components/ui'
import { CelebrationWidget } from '@/components/dashboard/CelebrationWidget'
import { Users, Target, FileText, DollarSign, Clock, UserCheck, LogIn, LogOut, Wifi, CalendarCheck, AlertTriangle, CheckCircle2, MapPin, Briefcase, Home, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '@/lib/axios'
import { getCurrentGeo } from '@/lib/geolocation'
import { FIELD_LABELS } from '@/lib/profileCompletion'
import toast from 'react-hot-toast'
import Link from 'next/link'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1']
const STATUS_COLORS: Record<string, string> = {
  NEW: '#8b5cf6', RINGING: '#3b82f6', CALLBACK: '#06b6d4', FOLLOW_UP: '#f59e0b',
  MEETING_SCHEDULED: '#ef4444', CONVERTED: '#10b981', NOT_INTERESTED: '#ec4899',
}
const getLeadColor = (status: string, i: number) => STATUS_COLORS[status?.toUpperCase()?.replace(/\s+/g, '_')] || COLORS[i % COLORS.length]
const WORK_MODES = ['WFO', 'WFH', 'FIELD']
export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [todayAttendance, setTodayAttendance] = useState<any>(null)
  const [time, setTime] = useState(new Date())
  const [punching, setPunching] = useState(false)
  const [myProjects, setMyProjects] = useState<any[]>([])
  const [leaveBalance, setLeaveBalance] = useState<any>(null)
  const [profileCompletion, setProfileCompletion] = useState<{ percent: number; missingFields: string[] } | null>(null)

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const fetchDashboard = useCallback(async () => {
    try {
      const [dashRes, attRes] = await Promise.all([
        api.get('/reports?type=dashboard'),
        api.get('/attendance/today'),
      ])
      setData(dashRes.data.data || dashRes.data)
      setTodayAttendance(attRes.data.data)
    } catch { }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])
  useEffect(() => {
    api.get('/leaves/balance').then(r => setLeaveBalance(r.data.data)).catch(() => { })
  }, [])
  useEffect(() => {
    api.get('/auth/profile').then(r => setProfileCompletion(r.data.data?.profileCompletion || null)).catch(() => { })
  }, [])

  // Assigned projects — for heads (MANAGER) and team members (EMPLOYEE)
  useEffect(() => {
    if (user?.role === 'MANAGER' || user?.role === 'EMPLOYEE') {
      api.get('/projects?isActive=true&limit=20')
        .then(r => setMyProjects(r.data.data || []))
        .catch(() => { })
    }
  }, [user?.role])

  const handlePunch = async (workMode: string = 'WFO') => {
    setPunching(true)
    const locToast = toast.loading('Getting your location...')
    try {
      const action = todayAttendance?.punchIn && !todayAttendance?.punchOut ? 'punch_out' : 'punch_in'
      let geo: any = {}
      try {
        // Coordinates only — address is resolved server-side (much faster).
        const g = await getCurrentGeo({
          reverseGeocode: false,
          timeoutMs: 10000,
          settleMs: 2500,
          highAccuracy: true,
          desiredAccuracyM: 100,
          warnAccuracyM: 500,
          maxAgeMs: 0,
        })
        if (!g.error) geo = g
        else toast(`Punching without location — ${g.error}`, { icon: '📍' })
      } catch { /* ignore */ }
      toast.dismiss(locToast)
      if (geo.ipLevel) {
        toast('This PC has no GPS, so the location is a Wi-Fi/IP estimate and can be several km off. Punch from the mobile app for an exact address.', { icon: '⚠️', duration: 7000 })
      } else if (geo.lowAccuracy) {
        toast(`Location is approximate (±${Math.round(geo.accuracy || 0)}m).`, { icon: '⚠️', duration: 5000 })
      }
      const res = await api.post('/attendance', {
        action,
        workMode,
        latitude: geo.latitude ?? null,
        longitude: geo.longitude ?? null,
        accuracy: geo.accuracy ?? null,
      })
      setTodayAttendance(res.data.data)
      toast.success(action === 'punch_in' ? '✅ Punched In!' : '👋 Punched Out!')
    } catch (e: any) {
      toast.dismiss(locToast)
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setPunching(false) }
  }

  const isPunchedIn = todayAttendance?.punchIn && !todayAttendance?.punchOut
  const isPunchedOut = todayAttendance?.punchIn && todayAttendance?.punchOut

  const workedSecs = useMemo(() => {
    if (!todayAttendance?.punchIn) return 0
    const end = todayAttendance.punchOut ? new Date(todayAttendance.punchOut) : time
    return Math.max(0, Math.floor((end.getTime() - new Date(todayAttendance.punchIn).getTime()) / 1000))
  }, [todayAttendance, time])

  const fmtDuration = (secs: number) => {
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  // Regular employees don't see business/revenue metrics
  const showBiz = user?.role !== 'EMPLOYEE'
  // Revenue Trend chart + Month Revenue stat: admins only
  const showRevenue = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role || '')

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const stats = data?.stats
  // const birthdays = data?.birthdays || []
  // const selfBirthday = birthdays.find((b: any) => b.id === user?.id)
  // const upcomingBirthdays = data?.upcomingBirthdays || []

  return (
    <div className="space-y-6">

      {/* Header */}
      <div
        className="animate-rise relative overflow-hidden rounded-2xl px-6 py-6 flex items-start justify-between bg-rose-50"
        style={{
          backgroundImage: "url('/images/city-skyline.png')",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center right',
          backgroundSize: 'contain',
        }}
      >
        <div className="relative">
          <h1 className="text-2xl font-bold text-gray-900">{greeting()}, {user?.name?.split(' ')[0]}! 👋</h1>
          <p className="text-gray-500 text-sm mt-0.5">{time.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="relative text-right flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-sm flex-shrink-0">
            <Clock className="text-rose-400" size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-gray-900">{time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
            <p className="text-xs text-gray-500 text-right">India Standard Time (IST)</p>
          </div>
        </div>
      </div>

      {/* Profile completion — nudge/block until required details are filled */}
      {profileCompletion && profileCompletion.percent < 100 && (
        <div className="card p-5 rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div
                className="relative w-14 h-14 flex-shrink-0 rounded-full grid place-items-center"
                style={{
                  background: `conic-gradient(#ef4444 ${profileCompletion.percent * 3.6}deg, #fde2e2 0deg)`,
                }}
              >
                <div className="w-11 h-11 rounded-full bg-white grid place-items-center">
                  <span className="text-xs font-bold text-red-500">{profileCompletion.percent}%</span>
                </div>
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {profileCompletion.percent < 90 ? 'Complete your profile to check in' : 'Almost there — finish your profile'}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {profileCompletion.percent < 90
                    ? `Your profile is only ${profileCompletion.percent}% complete. You need at least 90% to punch in.`
                    : `Your profile is ${profileCompletion.percent}% complete. Fill the rest for full records.`}
                </p>
                {profileCompletion.missingFields.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    Missing: {profileCompletion.missingFields.slice(0, 4).map(f => FIELD_LABELS[f] || f).join(', ')}
                    {profileCompletion.missingFields.length > 4 ? ` +${profileCompletion.missingFields.length - 4} more` : ''}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0">
              <Link
                href="/profile"
                className="px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-rose-500 hover:bg-rose-700 transition-colors whitespace-nowrap"
              >
                Complete Now →
              </Link>
              <img src="/images/profile-clipboard.png" alt="" className="w-14 h-14 object-contain hidden sm:block" />
            </div>
          </div>
        </div>
      )}

      {/* Attendance punch card */}
      <div className="animate-rise stagger-1 p-6 rounded-2xl bg-white shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Today</p>
            <p className="text-lg font-bold text-gray-900">{formatDate(time)}</p>

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide my-1">Status</p>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${isPunchedIn ? 'bg-emerald-100 text-emerald-700' :
              isPunchedOut ? 'bg-gray-100 text-gray-700' :
                'bg-rose-50 text-rose-500'
              }`}>
              <span className="relative w-2 h-2 rounded-full bg-current">
                {isPunchedIn && <span className="pulse-ring absolute inset-0 text-emerald-500" />}
              </span>
              {isPunchedIn ? 'Working' : isPunchedOut ? 'Day Ended' : 'Not Punched In'}
            </div>
          </div>

          <div>
            {todayAttendance?.punchIn && (
              <p className="text-sm text-gray-600 mt-3 tabular-nums">
                {isPunchedOut ? `Worked: ${todayAttendance.hoursWorked?.toFixed(2)}h` : `Working: ${fmtDuration(workedSecs)}`}
              </p>
            )}
            {todayAttendance?.punchInAddress && (
              <p className="text-xs text-gray-500 mt-1 flex items-start gap-1 max-w-xs">
                <MapPin size={11} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="truncate">{todayAttendance.punchInAddress}</span>
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
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-white border border-gray-200 hover:border-rose-300 hover:bg-rose-50 hover:-translate-y-0.5 text-xs font-semibold text-gray-700 hover:text-rose-500 transition-all duration-200 disabled:opacity-50"
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
                  className={`flex items-center justify-center gap-2 px-5 py-3 rounded-full font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 ${isPunchedIn ? 'bg-gray-700 hover:bg-gray-800 text-white' : 'bg-rose-500 hover:bg-rose-700 text-white'
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
                  {todayAttendance.hoursWorked?.toFixed(2)}h · {todayAttendance.status}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* My leave balance (auto carry-forward, capped) — employees see this inside CelebrationWidget instead */}
      {leaveBalance && user?.role !== 'SUPER_ADMIN' && user?.role !== 'EMPLOYEE' && (
        <div className="card card-glow hover-lift animate-rise stagger-2 p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center">
              <CalendarCheck size={22} className="text-brand-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Paid Leave Balance</p>
              <p className="text-sm text-gray-500">
                Carried forward + accrued · max {leaveBalance.maxCap} · {leaveBalance.monthlyAccrual}/month
                {leaveBalance.wasReset && leaveBalance.countingFrom && <> · from {leaveBalance.countingFrom}</>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-5 text-center">
            <div>
              <p className="text-2xl font-bold text-brand-600">{leaveBalance.available}</p>
              <p className="text-[11px] text-gray-400">Available</p>
            </div>
            <div><p className="text-lg font-bold text-gray-700">{leaveBalance.taken}</p><p className="text-[11px] text-gray-400">Taken</p></div>
            {leaveBalance.lapsed > 0 && <div><p className="text-lg font-bold text-amber-500">{leaveBalance.lapsed}</p><p className="text-[11px] text-gray-400">Lapsed</p></div>}
            <Link href="/leaves" className="text-xs text-brand-600 hover:underline whitespace-nowrap">Details →</Link>
          </div>
        </div>
      )}

      {/* Stats grid */}
      {showBiz && (loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="animate-rise stagger-1"><StatCard label="Employees" value={stats?.totalEmployees || 0} icon={Users} color="text-brand-600" /></div>
          <div className="animate-rise stagger-2"><StatCard label="Leads" value={stats?.totalLeads || 0} icon={Target} color="text-purple-600" /></div>
          <div className="animate-rise stagger-3"><StatCard label="Clients" value={stats?.totalClients || 0} icon={UserCheck} color="text-green-600" /></div>
          <div className="animate-rise stagger-4"><StatCard label="Proposals" value={stats?.totalProposals || 0} icon={FileText} color="text-indigo-600" /></div>
          <div className="animate-rise stagger-5"><StatCard label="Pending Leaves" value={stats?.pendingLeaves || 0} icon={Clock} color="text-yellow-600" /></div>
          {showRevenue && (
            <div className="animate-rise stagger-6"><StatCard label="Month Revenue" value={formatCurrency(stats?.monthRevenue || 0)} icon={DollarSign} color="text-brand-600" /></div>
          )}
        </div>
      ))}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart — admin only */}
        {showBiz && showRevenue && (
          <div className="card card-glow hover-lift animate-rise stagger-1 p-5 lg:col-span-2">
            <h3 className="font-semibold text-gray-900 mb-4">Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data?.revenueChart || []}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#be123c" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#be123c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => formatCurrency(v)} />
                <Area type="monotone" dataKey="revenue" stroke="#be123c" fill="url(#rev)" strokeWidth={2.5} dot={false} animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Celebration widget */}
        <div className={`animate-rise stagger-2 ${showBiz && showRevenue ? '' : 'lg:col-span-3'}`}>
          <CelebrationWidget leaveBalance={user?.role === 'EMPLOYEE' ? leaveBalance : null} />
        </div>
      </div>

      {showBiz && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lead pipeline */}
          <div className="card card-glow hover-lift animate-rise stagger-1 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Lead Pipeline</h3>
            {(data?.leadsByStatus || []).length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={data?.leadsByStatus || []} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="count" nameKey="status" paddingAngle={3}>
                      {(data?.leadsByStatus || []).map((s: any, i: number) => <Cell key={i} fill={getLeadColor(s.status, i)} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 flex-shrink-0">
                  {(data?.leadsByStatus || []).map((s: any, i: number) => (
                    <div key={s.status} className="flex items-center gap-2 text-sm">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getLeadColor(s.status, i) }} />
                      <span className="text-gray-600">{s.status.replace('_', ' ')}</span>
                      <span className="font-bold text-gray-900 ml-auto">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <div className="py-10 text-center text-gray-400 text-sm">No leads yet</div>}
          </div>

          {/* Recent leads */}
          <div className="card card-glow hover-lift animate-rise stagger-2 overflow-hidden">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Recent Leads</h3>
              <Link href="/leads" className="text-xs text-brand-600 hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {(data?.recentLeads || []).slice(0, 5).map((lead: any) => (
                <div key={lead.id} className="flex items-center justify-between px-5 py-3 transition-colors duration-150 hover:bg-brand-50/40">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{lead.clientName}</p>
                    <p className="text-xs text-gray-400">{lead.source} · {lead.createdBy?.name}</p>
                  </div>
                  <span className={`badge ${lead.status === 'NEW' ? 'bg-brand-100 text-brand-700' :
                    lead.status === 'CONVERTED' ? 'bg-green-100 text-green-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{lead.status}</span>
                </div>
              ))}
              {(!data?.recentLeads || data.recentLeads.length === 0) && (
                <div className="py-8 text-center text-gray-400 text-sm">No leads yet</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* My Projects — heads & team members */}
      {(user?.role === 'MANAGER' || user?.role === 'EMPLOYEE') && myProjects.length > 0 && (
        <div className="card card-glow hover-lift animate-rise p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">🗂️ My Projects</h3>
            <Link href="/projects" className="text-xs text-brand-600 hover:underline">Manage →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.values(myProjects.reduce((acc: any, p: any) => {
              const key = p.clientService.id
              if (!acc[key]) acc[key] = { service: p.clientService, isHead: false }
              if ((p.role === 'MANAGER' || p.managerId) && p.managerId === user?.id) acc[key].isHead = true
              return acc
            }, {})).map((g: any) => (
              <Link key={g.service.id} href={`/clients/${g.service.client.id}`}
                className="border border-gray-200 rounded-xl p-3 hover:border-brand-300 hover:bg-brand-50/40 hover:-translate-y-0.5 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900 truncate">{g.service.serviceName}</p>
                  <span className={`badge text-[10px] ${g.isHead ? 'bg-purple-100 text-purple-700' : 'bg-brand-100 text-brand-700'}`}>
                    {g.isHead ? 'Head' : 'Member'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{g.service.client?.clientName}</p>
                {g.service.department && <p className="text-[10px] text-gray-400 mt-1">{g.service.department.name}</p>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Expiring services */}
      {(data?.expiringServices || []).length > 0 && (
        <div className="card card-glow hover-lift animate-rise p-5">
          <h3 className="font-semibold text-gray-900 mb-3">⚠️ Services Expiring Soon</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.expiringServices.map((svc: any) => {
              const days = Math.ceil((new Date(svc.expiryDate).getTime() - Date.now()) / 86400000)
              return (
                <div key={svc.id} className={`rounded-xl p-3 border ${days <= 7 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  <p className="text-sm font-semibold text-gray-900">{svc.serviceName}</p>
                  <p className="text-xs text-gray-500">{svc.client?.companyName}</p>
                  <p className={`text-xs font-bold mt-1 ${days <= 7 ? 'text-red-600' : 'text-yellow-600'}`}>
                    Expires in {days} day{days !== 1 ? 's' : ''}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}