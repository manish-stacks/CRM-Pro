'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { StatCard } from '@/components/ui'
import { CelebrationWidget } from '@/components/dashboard/CelebrationWidget'
import { Users, Target, FileText, DollarSign, Clock, UserCheck, LogIn, LogOut, Wifi, CalendarCheck } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '@/lib/axios'
import { getCurrentGeo } from '@/lib/geolocation'
import toast from 'react-hot-toast'
import Link from 'next/link'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [todayAttendance, setTodayAttendance] = useState<any>(null)
  const [time, setTime] = useState(new Date())
  const [punching, setPunching] = useState(false)
  const [myProjects, setMyProjects] = useState<any[]>([])
  const [leaveBalance, setLeaveBalance] = useState<any>(null)

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
    api.get('/leaves/balance').then(r => setLeaveBalance(r.data.data)).catch(() => {})
  }, [])

  // Assigned projects — for heads (MANAGER) and team members (EMPLOYEE)
  useEffect(() => {
    if (user?.role === 'MANAGER' || user?.role === 'EMPLOYEE') {
      api.get('/projects?isActive=true&limit=20')
        .then(r => setMyProjects(r.data.data || []))
        .catch(() => { })
    }
  }, [user?.role])

  const handlePunch = async () => {
    setPunching(true)
    try {
      const action = todayAttendance?.punchIn && !todayAttendance?.punchOut ? 'punch_out' : 'punch_in'
      // Capture location best-effort — never block the punch if it fails/denied
      let geo: any = {}
      try {
        const g = await getCurrentGeo({ reverseGeocode: true, timeoutMs: 8000 })
        if (!g.error) geo = g
      } catch { /* ignore */ }
      const res = await api.post('/attendance', {
        action,
        workMode: 'WFO',
        latitude: geo.latitude,
        longitude: geo.longitude,
        address: geo.address,
      })
      setTodayAttendance(res.data.data)
      toast.success(action === 'punch_in' ? '✅ Punched In!' : '👋 Punched Out!')
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setPunching(false) }
  }

  const isPunchedIn = todayAttendance?.punchIn && !todayAttendance?.punchOut
  const isPunchedOut = todayAttendance?.punchIn && todayAttendance?.punchOut
  // Regular employees don't see business/revenue metrics
  const showBiz = user?.role !== 'EMPLOYEE'

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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting()}, {user?.name?.split(' ')[0]}! 👋</h1>
          <p className="text-gray-500 text-sm mt-0.5">{time.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-gray-900 tabular-nums">{time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
        </div>
      </div>

      {/* Attendance punch card */}
      <div className="card p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isPunchedIn ? 'bg-green-100' : isPunchedOut ? 'bg-gray-100' : 'bg-blue-100'}`}>
            <Clock size={22} className={isPunchedIn ? 'text-green-600' : isPunchedOut ? 'text-gray-500' : 'text-blue-600'} />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Today's Attendance</p>
            <p className="text-sm text-gray-500">
              {isPunchedOut ? `✅ Completed · ${todayAttendance.hoursWorked?.toFixed(1)}h worked` :
                isPunchedIn ? `🟢 Working since ${new Date(todayAttendance.punchIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` :
                  'Not punched in yet'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {todayAttendance?.punchIn && (
            <div className="text-sm text-gray-500">
              In: <strong>{new Date(todayAttendance.punchIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</strong>
              {todayAttendance.punchOut && (
                <> · Out: <strong>{new Date(todayAttendance.punchOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</strong></>
              )}
            </div>
          )}
          {!isPunchedOut && (
            <button
              onClick={handlePunch}
              disabled={punching}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${isPunchedIn
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
            >
              {isPunchedIn ? <><LogOut size={15} /> Punch Out</> : <><LogIn size={15} /> Punch In</>}
            </button>
          )}
        </div>
      </div>

      {/* My leave balance (auto carry-forward, capped) */}
      {leaveBalance && (
        <div className="card p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
              <CalendarCheck size={22} className="text-indigo-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Paid Leave Balance</p>
              <p className="text-sm text-gray-500">
                Carried forward + accrued · max {leaveBalance.maxCap} · {leaveBalance.monthlyAccrual}/month
              </p>
            </div>
          </div>
          <div className="flex items-center gap-5 text-center">
            <div>
              <p className="text-2xl font-bold text-indigo-600">{leaveBalance.available}</p>
              <p className="text-[11px] text-gray-400">Available</p>
            </div>
            <div><p className="text-lg font-bold text-gray-700">{leaveBalance.taken}</p><p className="text-[11px] text-gray-400">Taken</p></div>
            {leaveBalance.lapsed > 0 && <div><p className="text-lg font-bold text-amber-500">{leaveBalance.lapsed}</p><p className="text-[11px] text-gray-400">Lapsed</p></div>}
            <Link href="/leaves" className="text-xs text-indigo-600 hover:underline whitespace-nowrap">Details →</Link>
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
          <StatCard label="Employees" value={stats?.totalEmployees || 0} icon={Users} color="text-blue-600" />
          <StatCard label="Leads" value={stats?.totalLeads || 0} icon={Target} color="text-purple-600" />
          <StatCard label="Clients" value={stats?.totalClients || 0} icon={UserCheck} color="text-green-600" />
          <StatCard label="Proposals" value={stats?.totalProposals || 0} icon={FileText} color="text-indigo-600" />
          <StatCard label="Pending Leaves" value={stats?.pendingLeaves || 0} icon={Clock} color="text-yellow-600" />
          <StatCard label="Month Revenue" value={formatCurrency(stats?.monthRevenue || 0)} icon={DollarSign} color="text-emerald-600" />
        </div>
      ))}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        {showBiz && (
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data?.revenueChart || []}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => formatCurrency(v)} />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#rev)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Celebration widget */}
        <div className={showBiz ? '' : 'lg:col-span-3'}>
          <CelebrationWidget />
        </div>
      </div>

      {showBiz && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead pipeline */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Lead Pipeline</h3>
          {(data?.leadsByStatus || []).length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={data?.leadsByStatus || []} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="count" nameKey="status" paddingAngle={3}>
                    {(data?.leadsByStatus || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-shrink-0">
                {(data?.leadsByStatus || []).map((s: any, i: number) => (
                  <div key={s.status} className="flex items-center gap-2 text-sm">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-gray-600">{s.status.replace('_', ' ')}</span>
                    <span className="font-bold text-gray-900 ml-auto">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="py-10 text-center text-gray-400 text-sm">No leads yet</div>}
        </div>

        {/* Recent leads */}
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Recent Leads</h3>
            <Link href="/leads" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {(data?.recentLeads || []).slice(0, 5).map((lead: any) => (
              <div key={lead.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{lead.clientName}</p>
                  <p className="text-xs text-gray-400">{lead.source} · {lead.createdBy?.name}</p>
                </div>
                <span className={`badge ${lead.status === 'NEW' ? 'bg-blue-100 text-blue-700' :
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
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">🗂️ My Projects</h3>
            <Link href="/projects" className="text-xs text-blue-600 hover:underline">Manage →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.values(myProjects.reduce((acc: any, p: any) => {
              const key = p.clientService.id
              if (!acc[key]) acc[key] = { service: p.clientService, isHead: false }
              if ((p.role === 'MANAGER' || p.managerId) && p.managerId === user?.id) acc[key].isHead = true
              return acc
            }, {})).map((g: any) => (
              <Link key={g.service.id} href={`/clients/${g.service.client.id}`}
                className="border border-gray-200 rounded-xl p-3 hover:border-blue-300 hover:bg-blue-50/40 transition-colors">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900 truncate">{g.service.serviceName}</p>
                  <span className={`badge text-[10px] ${g.isHead ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
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
        <div className="card p-5">
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