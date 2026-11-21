'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { PunchOutConfirmModal } from '@/components/PunchOutConfirmModal'
import { CelebrationWidget } from '@/components/dashboard/CelebrationWidget'
import { AnnouncementBanner } from '@/components/dashboard/AnnouncementBanner'
import { MonthStartSummaryWidget } from '@/components/dashboard/MonthStartSummaryWidget'
import {
  Users, Target, FileText, DollarSign, Clock, UserCheck,
  LogIn, LogOut, CalendarCheck, AlertTriangle, CheckCircle2,
  MapPin, Briefcase, Home, Loader2, Sparkles, ArrowUpRight,
  TrendingUp, Shield, Sun, Moon, Sunrise, Calendar, ChevronRight
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '@/lib/axios'
import { FIELD_LABELS } from '@/lib/profileCompletion'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { isCompanyWideRole } from '@/lib/permissions'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1']
const STATUS_COLORS: Record<string, string> = {
  NEW: '#8b5cf6',
  RINGING: '#3b82f6',
  CALLBACK: '#06b6d4',
  FOLLOW_UP: '#f59e0b',
  MEETING_SCHEDULED: '#ef4444',
  CONVERTED: '#10b981',
  NOT_INTERESTED: '#ec4899',
}
const getLeadColor = (status: string, i: number) =>
  STATUS_COLORS[status?.toUpperCase()?.replace(/\s+/g, '_')] || COLORS[i % COLORS.length]

const WORK_MODES = [
  { id: 'WFO', label: 'Office (WFO)', icon: Briefcase },
  { id: 'WFH', label: 'Home (WFH)', icon: Home },
  { id: 'FIELD', label: 'Field Visit', icon: MapPin },
]

const DEFAULT_PUNCH_LOCATION = {
  latitude: 28.6959,
  longitude: 77.1525,
  address: 'Netaji Subhash Place, Pitampura, New Delhi',
  accuracy: 0,
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [todayAttendance, setTodayAttendance] = useState<any>(null)
  const [time, setTime] = useState(new Date())
  const [punching, setPunching] = useState(false)
  const [selectedMode, setSelectedMode] = useState<string>('WFO')
  const [myProjects, setMyProjects] = useState<any[]>([])
  const [leaveBalance, setLeaveBalance] = useState<any>(null)
  const [profileCompletion, setProfileCompletion] = useState<{ percent: number; missingFields: string[] } | null>(null)
  const [confirmOut, setConfirmOut] = useState(false)

  // Live digital clock with second updates
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

  // Assigned projects for managers and employees
  useEffect(() => {
    if (user?.role === 'MANAGER' || user?.role === 'EMPLOYEE') {
      api.get('/projects?isActive=true&limit=20')
        .then(r => setMyProjects(r.data.data || []))
        .catch(() => { })
    }
  }, [user?.role])

  const handlePunch = async (workMode: string = selectedMode) => {
    const isOut = todayAttendance?.punchIn && !todayAttendance?.punchOut
    if (isOut && !confirmOut) { setConfirmOut(true); return }
    setConfirmOut(false)
    setPunching(true)
    try {
      const action = todayAttendance?.punchIn && !todayAttendance?.punchOut ? 'punch_out' : 'punch_in'
      const geo: any = DEFAULT_PUNCH_LOCATION
      const res = await api.post('/attendance', {
        action,
        workMode,
        latitude: geo.latitude ?? null,
        longitude: geo.longitude ?? null,
        accuracy: geo.accuracy ?? null,
      })
      setTodayAttendance(res.data.data)
      toast.success(action === 'punch_in' ? 'Successfully Punched In' : 'Successfully Punched Out')
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to update attendance')
    } finally { setPunching(false) }
  }

  const isPunchedIn = !!(todayAttendance?.punchIn && !todayAttendance?.punchOut)
  const isPunchedOut = !!(todayAttendance?.punchIn && todayAttendance?.punchOut)

  const workedSecs = useMemo(() => {
    if (!todayAttendance?.punchIn) return 0
    const end = todayAttendance.punchOut ? new Date(todayAttendance.punchOut) : time
    return Math.max(0, Math.floor((end.getTime() - new Date(todayAttendance.punchIn).getTime()) / 1000))
  }, [todayAttendance, time])

  const fmtDuration = (secs: number) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const showBiz = user?.role !== 'EMPLOYEE'
  const showRevenue = isCompanyWideRole(user?.role || '')

  const greeting = () => {
    const h = time.getHours()
    if (h < 12) return { text: 'Good morning', icon: Sunrise }
    if (h < 17) return { text: 'Good afternoon', icon: Sun }
    return { text: 'Good evening', icon: Moon }
  }

  const greet = greeting()
  const GreetIcon = greet.icon
  const stats = data?.stats

  return (
    <div className="space-y-6 pb-12">
      <AnnouncementBanner />

      {/* ============================================================ */}
      {/* 1. EXECUTIVE HERO BANNER */}
      {/* ============================================================ */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 md:p-8 text-white shadow-xl shadow-slate-950/20 border border-slate-800/80">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-amber-300 backdrop-blur-md border border-white/10">
                <GreetIcon size={14} className="shrink-0" />
                <span>{greet.text}</span>
              </span>
              <span className="inline-flex items-center rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-200 border border-indigo-400/20">
                {user?.role?.replace(/_/g, ' ') || 'Staff Member'}
              </span>
              <span className="hidden sm:inline-block text-xs text-slate-400">
                {time.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight sm:text-3xl md:text-4xl text-white">
              Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-white to-sky-200">{user?.name?.split(' ')[0] || 'User'}</span>!
            </h1>

            <p className="max-w-xl text-xs sm:text-sm text-slate-300 leading-relaxed">
              Enterprise operations live dashboard. Track sales performance, biometric shifts, and revenue metrics in real-time.
            </p>

            {/* Quick Action Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Link
                href="/leaves"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md border border-white/10 transition shadow-sm"
              >
                <Calendar size={13} className="text-indigo-300" /> Apply Leave
              </Link>
              <Link
                href="/payroll"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md border border-white/10 transition shadow-sm"
              >
                <DollarSign size={13} className="text-emerald-300" /> View Payslips
              </Link>
              {showBiz && (
                <Link
                  href="/leads"
                  className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition"
                >
                  <Target size={13} /> Manage Leads
                </Link>
              )}
            </div>
          </div>

          {/* Digital Clock & IST Indicator */}
          <div className="flex items-center gap-4 rounded-2xl bg-white/10 p-4 backdrop-blur-md border border-white/10 lg:flex-col lg:items-end lg:p-5 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/30 text-indigo-200 shadow-inner border border-white/10">
                <Clock size={22} />
              </div>
              <div>
                <p className="text-2xl font-mono font-bold tracking-tight sm:text-3xl">
                  {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[11px] font-medium text-slate-300">India Standard Time (IST)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. MONTH-START STATEMENT CARD (Visible 1st-5th only) */}
      {/* ============================================================ */}
      <MonthStartSummaryWidget />

      {/* Profile completion warning */}
      {profileCompletion && profileCompletion.percent < 100 && (
        <div className="rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50/90 to-amber-100/50 p-5 shadow-xs">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div
                className="relative h-13 w-13 shrink-0 rounded-full grid place-items-center shadow-inner"
                style={{
                  background: `conic-gradient(#f59e0b ${profileCompletion.percent * 3.6}deg, #fef3c7 0deg)`,
                }}
              >
                <div className="h-10 w-10 rounded-full bg-white grid place-items-center shadow-xs">
                  <span className="text-xs font-black text-amber-600">{profileCompletion.percent}%</span>
                </div>
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm sm:text-base">
                  {profileCompletion.percent < 90 ? 'Profile Completion Pending' : 'Almost Done — Complete Profile Verification'}
                </p>
                <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                  Ensure all KYC documents and emergency contacts are filled to avoid payroll delays.
                </p>
                {profileCompletion.missingFields.length > 0 && (
                  <p className="text-xs text-amber-700/80 font-medium mt-1">
                    Pending fields: {profileCompletion.missingFields.slice(0, 4).map(f => FIELD_LABELS[f] || f).join(', ')}
                  </p>
                )}
              </div>
            </div>

            <Link
              href="/profile"
              className="rounded-full bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition shadow-sm flex items-center gap-1.5"
            >
              Complete Profile <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. BIOMETRIC ATTENDANCE & WORKSTATION PUNCH CARD */}
      {/* ============================================================ */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <CalendarCheck size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Biometric Attendance Workstation</h2>
              <p className="text-[11px] text-slate-500">Real-time punch terminal & shift compliance</p>
            </div>
          </div>
          <span className="text-xs font-medium text-slate-400">
            Shift: 10:00 AM – 06:30 PM
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:items-center">
          {/* Status Column */}
          <div className="space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Shift Status</p>
            <div>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-extrabold ${
                  isPunchedIn
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : isPunchedOut
                    ? 'bg-slate-100 text-slate-800 border border-slate-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                <span className="relative flex h-2.5 w-2.5">
                  {isPunchedIn && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isPunchedIn ? 'bg-emerald-500' : isPunchedOut ? 'bg-slate-500' : 'bg-amber-500'}`} />
                </span>
                {isPunchedIn ? 'ON DUTY · ACTIVE' : isPunchedOut ? 'SHIFT COMPLETED' : 'NOT PUNCHED IN'}
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Standard shift 8.5 hours. 10-minute grace period allowed till 10:10 AM IST.
            </p>
          </div>

          {/* Time & Duration Column */}
          <div className="space-y-2 border-y border-slate-100 py-4 md:border-y-0 md:border-x md:px-6 md:py-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Logged Hours Today</p>
            <p className="font-mono text-3xl font-black text-slate-900 tracking-tight">
              {isPunchedOut
                ? `${todayAttendance.hoursWorked?.toFixed(2)}h`
                : todayAttendance?.punchIn
                ? fmtDuration(workedSecs)
                : '00:00:00'}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
              <MapPin size={13} className="text-slate-400 shrink-0" />
              <span className="truncate">{todayAttendance?.punchInAddress || DEFAULT_PUNCH_LOCATION.address}</span>
            </div>
          </div>

          {/* Actions Column */}
          <div className="flex flex-col gap-3">
            {!isPunchedOut ? (
              <>
                {!isPunchedIn && (
                  <div className="grid grid-cols-3 gap-2">
                    {WORK_MODES.map(mode => {
                      const Icon = mode.icon
                      const isSelected = selectedMode === mode.id
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setSelectedMode(mode.id)}
                          disabled={punching}
                          className={`flex items-center justify-center gap-1 rounded-xl py-2 px-1 text-xs font-bold transition border ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          } disabled:opacity-50`}
                        >
                          <Icon size={12} className={isSelected ? 'text-indigo-600' : 'text-slate-400'} />
                          <span>{mode.id}</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                <button
                  onClick={() => handlePunch(selectedMode)}
                  disabled={punching}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold shadow-md transition active:scale-[0.99] disabled:opacity-50 ${
                    isPunchedIn
                      ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20'
                      : 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:from-indigo-500 hover:to-indigo-600 shadow-indigo-600/20'
                  }`}
                >
                  {punching ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : isPunchedIn ? (
                    <><LogOut size={16} /> Punch Out (End Shift)</>
                  ) : (
                    <><LogIn size={16} /> Punch In ({selectedMode})</>
                  )}
                </button>

                <PunchOutConfirmModal
                  open={confirmOut}
                  onClose={() => setConfirmOut(false)}
                  onConfirm={() => handlePunch(selectedMode)}
                  loading={punching}
                  punchInAt={todayAttendance?.punchIn}
                />
              </>
            ) : (
              <div className="rounded-2xl bg-emerald-50/80 border border-emerald-200 p-4 text-center">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 mb-1">
                  <CheckCircle2 size={16} />
                </div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-800">
                  Shift Completed Successfully
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Logged: {todayAttendance.hoursWorked?.toFixed(2)}h · Status: {todayAttendance.status}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Leave balance quick card */}
      {leaveBalance && user?.role !== 'SUPER_ADMIN' && user?.role !== 'EMPLOYEE' && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
              <CalendarCheck size={20} />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">Paid Leave Entitlement</p>
              <p className="text-xs text-slate-500">
                Accrual: {leaveBalance.monthlyAccrual}d/mo · Cap: {leaveBalance.maxCap}d
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-center">
            <div>
              <p className="text-xl font-black text-sky-600">{leaveBalance.available}d</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Available</p>
            </div>
            <div>
              <p className="text-xl font-black text-slate-700">{leaveBalance.taken}d</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Taken</p>
            </div>
            {leaveBalance.lapsed > 0 && (
              <div>
                <p className="text-xl font-black text-amber-500">{leaveBalance.lapsed}d</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lapsed</p>
              </div>
            )}
            <Link href="/leaves" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline">
              View History →
            </Link>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. EXECUTIVE KPI STATS CARDS */}
      {/* ============================================================ */}
      {showBiz && (loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-3xl bg-slate-100 animate-pulse border border-slate-200/50" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Employees</span>
              <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users size={16} />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{stats?.totalEmployees || 0}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">Active team</p>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Leads</span>
              <div className="h-8 w-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Target size={16} />
              </div>
            </div>
            <p className="text-2xl font-black text-purple-700 mt-2">{stats?.totalLeads || 0}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">Pipeline volume</p>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Clients</span>
              <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <UserCheck size={16} />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-700 mt-2">{stats?.totalClients || 0}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">Retained accounts</p>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Proposals</span>
              <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <FileText size={16} />
              </div>
            </div>
            <p className="text-2xl font-black text-indigo-700 mt-2">{stats?.totalProposals || 0}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">Commercial bids</p>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pending Leaves</span>
              <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock size={16} />
              </div>
            </div>
            <p className="text-2xl font-black text-amber-600 mt-2">{stats?.pendingLeaves || 0}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">Awaiting review</p>
          </div>

          {showRevenue && (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Month Revenue</span>
                <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <DollarSign size={16} />
                </div>
              </div>
              <p className="text-xl font-black text-emerald-700 mt-2 truncate">
                {formatCurrency(stats?.monthRevenue || 0)}
              </p>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">Gross billing</p>
            </div>
          )}
        </div>
      ))}

      {/* ============================================================ */}
      {/* 5. REVENUE GROWTH TREND & CELEBRATIONS */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {showBiz && showRevenue && (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Revenue Growth Trend</h3>
                <p className="text-xs text-slate-500">Monthly gross billing and collections overview</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                <TrendingUp size={12} /> Active Trend
              </span>
            </div>

            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data?.revenueChart || []}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => formatCurrency(v)} />
                <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2.5} fill="url(#revGrad)" animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className={`space-y-6 ${showBiz && showRevenue ? '' : 'lg:col-span-3'}`}>
          <CelebrationWidget leaveBalance={user?.role === 'EMPLOYEE' ? leaveBalance : null} />
        </div>
      </div>

      {/* ============================================================ */}
      {/* 6. PIPELINE STATUS & RECENT LEADS FEED */}
      {/* ============================================================ */}
      {showBiz && showRevenue && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Donut Pipeline Card */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Lead Pipeline Breakdown</h3>
                <p className="text-xs text-slate-500">Distribution across sales conversion stages</p>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {stats?.totalLeads || 0} Total
              </span>
            </div>

            {(data?.leadsByStatus || []).length > 0 ? (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="w-full sm:w-1/2">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={data?.leadsByStatus || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        dataKey="count"
                        nameKey="status"
                        paddingAngle={3}
                      >
                        {(data?.leadsByStatus || []).map((s: any, i: number) => (
                          <Cell key={i} fill={getLeadColor(s.status, i)} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full sm:w-1/2 space-y-2">
                  {(data?.leadsByStatus || []).map((s: any, i: number) => (
                    <div key={s.status} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2 truncate">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: getLeadColor(s.status, i) }} />
                        <span className="text-slate-600 truncate">{s.status.replace(/_/g, ' ')}</span>
                      </div>
                      <span className="font-extrabold text-slate-900 ml-2">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-14 text-center text-xs text-slate-400">No leads recorded yet</div>
            )}
          </div>

          {/* Recent Inquiries Feed */}
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Recent Inquiries</h3>
                <p className="text-xs text-slate-500">Latest prospects registered by sales & telecallers</p>
              </div>
              <Link href="/leads" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline">
                View all leads →
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {(data?.recentLeads || []).slice(0, 5).map((lead: any) => {
                const initials = (lead.clientName || 'Lead')
                  .split(' ')
                  .map((n: string) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()

                return (
                  <div key={lead.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/70 transition">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 border border-indigo-100">
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{lead.clientName}</p>
                        <p className="text-xs text-slate-500">
                          {lead.source || 'Direct'} · Added by {lead.createdBy?.name || 'Inbound'}
                        </p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black tracking-wide ${
                      lead.status === 'NEW'
                        ? 'bg-purple-100 text-purple-700'
                        : lead.status === 'CONVERTED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : lead.status === 'MEETING_SCHEDULED'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {lead.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                )
              })}
              {(!data?.recentLeads || data.recentLeads.length === 0) && (
                <div className="py-12 text-center text-xs text-slate-400">No recent leads found</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 7. MY ASSIGNED PROJECTS */}
      {/* ============================================================ */}
      {(user?.role === 'MANAGER' || user?.role === 'EMPLOYEE') && myProjects.length > 0 && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">My Active Projects</h3>
              <p className="text-xs text-slate-500">Engagements and deliverables assigned to you</p>
            </div>
            <Link href="/projects" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline">
              Manage Projects →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
            {Object.values(myProjects.reduce((acc: any, p: any) => {
              const key = p.clientService.id
              if (!acc[key]) acc[key] = { service: p.clientService, isHead: false }
              if ((p.role === 'MANAGER' || p.managerId) && p.managerId === user?.id) acc[key].isHead = true
              return acc
            }, {})).map((g: any) => (
              <Link
                key={g.service.id}
                href={`/clients/${g.service.client.id}`}
                className="rounded-2xl border border-slate-200/70 p-4 hover:border-indigo-300 hover:bg-indigo-50/20 transition group"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition truncate">
                    {g.service.serviceName}
                  </p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    g.isHead ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    {g.isHead ? 'Project Lead' : 'Team Member'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{g.service.client?.clientName}</p>
                {g.service.department && (
                  <p className="text-[11px] text-slate-400 mt-1">{g.service.department.name}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 8. SERVICES EXPIRING SOON */}
      {/* ============================================================ */}
      {(data?.expiringServices || []).length > 0 && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Service Renewals Due</h3>
              <p className="text-xs text-slate-500">Client contracts up for renewal within the next 30 days</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
            {data.expiringServices.map((svc: any) => {
              const days = Math.ceil((new Date(svc.expiryDate).getTime() - Date.now()) / 86400000)
              const isUrgent = days <= 7
              return (
                <div
                  key={svc.id}
                  className={`rounded-2xl p-4 border transition ${
                    isUrgent
                      ? 'bg-red-50/70 border-red-200'
                      : 'bg-amber-50/60 border-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-900 truncate">{svc.serviceName}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      isUrgent ? 'bg-red-200/80 text-red-800' : 'bg-amber-200/80 text-amber-800'
                    }`}>
                      {days <= 0 ? 'Expired' : `${days}d left`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{svc.client?.companyName || svc.client?.clientName}</p>
                  <p className={`text-xs font-bold mt-2 ${isUrgent ? 'text-red-700' : 'text-amber-700'}`}>
                    {days <= 0 ? 'Contract expired' : `Expires on ${formatDate(svc.expiryDate)}`}
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
