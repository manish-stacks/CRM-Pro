'use client'
import { useState, useEffect } from 'react'
import {
  Loader2, LogIn, Package, FileText, CreditCard, User, MessageSquare, LogOut,
  Phone, Mail, Calendar, Clock, CheckCircle2, Download, Plus, Building2, ArrowRight,
  ShieldCheck, Wallet, AlertTriangle, Send, X, Lock, TrendingUp, Sparkles,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import { downloadInvoicePdf } from '@/lib/invoicePdf'

export default function ClientPortalPage() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [checking, setChecking] = useState(true)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [logging, setLogging] = useState(false)

  const [tab, setTab] = useState<'overview' | 'services' | 'invoices' | 'reports' | 'tickets' | 'profile'>('overview')
  const [reports, setReports] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [ticketModal, setTicketModal] = useState(false)
  const [ticketForm, setTicketForm] = useState({ subject: '', description: '', priority: 'MEDIUM', category: '' })
  const [ticketSaving, setTicketSaving] = useState(false)
  const [ticketReply, setTicketReply] = useState<Record<string, string>>({})
  const [openThreads, setOpenThreads] = useState<Record<string, boolean>>({})
  const [ticketPage, setTicketPage] = useState(1)
  const TICKETS_PAGE_SIZE = 5
  const [client, setClient] = useState<any>(null)
  const [services, setServices] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [reportingPerson, setReportingPerson] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)

  const [payModal, setPayModal] = useState<any>(null)
  const [payForm, setPayForm] = useState({ amount: '', method: 'UPI', reference: '', notes: '' })
  const [paying, setPaying] = useState(false)

  const [profileForm, setProfileForm] = useState<any>({})
  const [savingProfile, setSavingProfile] = useState(false)
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })

  useEffect(() => {
    fetch('/api/client-portal/services').then(async r => {
      if (r.ok) { setLoggedIn(true); loadData() }
    }).finally(() => setChecking(false))
  }, [])

  const loadData = async () => {
    const [sRes, iRes, pRes, rRes, tRes] = await Promise.all([
      fetch('/api/client-portal/services'),
      fetch('/api/client-portal/invoices'),
      fetch('/api/client-portal/profile'),
      fetch('/api/client-portal/reports'),
      fetch('/api/client-portal/tickets'),
    ])
    if (sRes.ok) setServices((await sRes.json()).data || [])
    if (iRes.ok) setInvoices((await iRes.json()).data || [])
    if (pRes.ok) { const d = await pRes.json(); setClient(d.data); setProfileForm(d.data || {}) }
    if (rRes.ok) setReports((await rRes.json()).data || [])
    if (tRes.ok) setTickets((await tRes.json()).data || [])
  }

  // Lightweight ticket-only refetch — used for polling so an open reply draft
  // (ticketReply state) and the rest of the dashboard aren't touched.
  const pollTickets = async () => {
    try {
      const tRes = await fetch('/api/client-portal/tickets')
      if (tRes.ok) setTickets((await tRes.json()).data || [])
    } catch {
      // silent — this runs in the background every few seconds
    }
  }

  // "Live" ticket updates: poll every 12s only while the Support tab is open.
  useEffect(() => {
    if (!loggedIn || tab !== 'tickets') return
    const id = setInterval(pollTickets, 12000)
    return () => clearInterval(id)
  }, [loggedIn, tab])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(tickets.length / TICKETS_PAGE_SIZE))
    if (ticketPage > totalPages) setTicketPage(totalPages)
  }, [tickets.length])

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    setLogging(true)
    try {
      const r = await fetch('/api/client-portal/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      })
      const data = await r.json()
      if (!r.ok) { toast.error(data.error || 'Login failed'); return }
      setClient(data.client); setReportingPerson(data.reportingPerson); setStats(data.stats)
      setLoggedIn(true); loadData()
      toast.success(`Welcome, ${data.client.clientName}!`)
    } finally { setLogging(false) }
  }

  const logout = async () => {
    await fetch('/api/client-portal/logout', { method: 'POST' })
    setLoggedIn(false); setClient(null)
  }

  const openPay = (inv: any) => {
    setPayModal(inv)
    setPayForm({ amount: String(inv.dueAmount), method: 'UPI', reference: '', notes: '' })
  }

  const downloadClientPdf = async (inv: any) => {
    try {
      const r = await fetch(`/api/client-portal/invoices/${inv.id}`)
      if (!r.ok) { toast.error('Failed to load invoice'); return }
      const full = (await r.json()).data
      let company = {}
      try { const cr = await fetch('/api/client-portal/company-info'); if (cr.ok) company = (await cr.json()).data } catch {}
      downloadInvoicePdf(full, company)
      toast.success('PDF downloaded')
    } catch { toast.error('Failed') }
  }

  const pay = async () => {
    const amt = Number(payForm.amount)
    if (!amt || amt <= 0) { toast.error('Invalid amount'); return }
    setPaying(true)
    try {
      const r = await fetch(`/api/client-portal/invoices/${payModal.id}/pay`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payForm),
      })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || 'Failed'); return }
      toast.success('Payment recorded! Confirmation will be sent.')
      setPayModal(null); loadData()
    } finally { setPaying(false) }
  }

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      const r = await fetch('/api/client-portal/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      })
      if (r.ok) { toast.success('Profile updated'); loadData() } else toast.error('Failed')
    } finally { setSavingProfile(false) }
  }

  const changePwd = async () => {
    if (pwdForm.newPassword !== pwdForm.confirm) { toast.error("Passwords don't match"); return }
    if (pwdForm.newPassword.length < 6) { toast.error('Min 6 chars'); return }
    const r = await fetch('/api/client-portal/profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pwdForm),
    })
    const d = await r.json()
    if (r.ok) { toast.success('Password changed'); setPwdForm({ currentPassword: '', newPassword: '', confirm: '' }) }
    else toast.error(d.error || 'Failed')
  }

  const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  const waLink = (phone?: string) => phone ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}` : '#'
  const greeting = () => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  }

  // ============ LOGIN VIEW ============
  if (checking) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-400" /></div>

  if (!loggedIn) {
    return (
      <div className="min-h-screen grid lg:grid-cols-2">
        {/* Brand panel */}
        <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-800 text-white relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="relative">
            <div className="w-40 h-auto bg-white backdrop-blur flex items-center justify-center p-1 rounded-sm">
              <img src="https://hoverbusinessservices.com/images/hbs-logo.png" alt="HBS" className="w-full" />
            </div>
          </div>
          <div className="relative space-y-4">
            <h2 className="text-4xl font-bold leading-tight">Your projects,<br />all in one place.</h2>
            <p className="text-indigo-100 max-w-sm">Track services, view reports, pay invoices, and reach your account manager — anytime.</p>
            <div className="flex gap-6 pt-4">
              {[['Services', Package], ['Reports', FileText], ['Payments', Wallet]].map(([l, I]: any) => (
                <div key={l} className="flex items-center gap-2 text-sm text-indigo-100"><I size={16} /> {l}</div>
              ))}
            </div>
          </div>
          <p className="relative text-xs text-indigo-200">© {new Date().getFullYear()} Hover Business Services</p>
        </div>

        {/* Login form */}
        <div className="flex items-center justify-center p-6 bg-slate-50">
          <div className="w-full max-w-sm">
            <div className="lg:hidden text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 mx-auto flex items-center justify-center text-white font-bold text-xl">HBS</div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Client Portal</h1>
            <p className="text-sm text-gray-500 mt-1 mb-6">Sign in to your account</p>
            <form onSubmit={login} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" required placeholder="you@company.com"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    value={loginForm.email} onChange={e => setLoginForm(p => ({ ...p, email: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="password" required placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    value={loginForm.password} onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))} />
                </div>
              </div>
              <button type="submit" disabled={logging}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-sm shadow-indigo-200">
                {logging ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={14} />} Sign In
              </button>
            </form>
            <p className="text-xs text-center text-gray-400 mt-6">
              Don't have credentials? Contact your account manager.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ============ AUTHENTICATED VIEW ============
  const totalDue = invoices.reduce((s, i) => s + i.dueAmount, 0)
  const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0)
  const activeServices = services.filter(s => s.status === 'ACTIVE').length
  const daysLeft = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
  const expiring = services.filter(s => s.status === 'ACTIVE' && s.expiryDate && daysLeft(s.expiryDate) >= 0 && daysLeft(s.expiryDate) <= 30)
  const openTickets = tickets.filter(t => t.status !== 'CLOSED' && t.status !== 'RESOLVED').length

  const initials = (client?.clientName || client?.companyName || 'C').split(' ').map((x: string) => x[0]).slice(0, 2).join('').toUpperCase()

  const NAV = [
    { key: 'overview', label: 'Overview', icon: TrendingUp },
    { key: 'services', label: 'Services', icon: Package },
    { key: 'invoices', label: 'Invoices', icon: FileText, badge: invoices.filter(i => i.dueAmount > 0).length },
    { key: 'reports', label: 'Reports', icon: Sparkles },
    { key: 'tickets', label: 'Support', icon: MessageSquare, badge: openTickets },
    { key: 'profile', label: 'Profile', icon: User },
  ]

  const statusPill = (s: string) => {
    const map: Record<string, string> = {
      ACTIVE: 'bg-emerald-100 text-emerald-700', PAID: 'bg-emerald-100 text-emerald-700',
      PENDING: 'bg-amber-100 text-amber-700', PARTIAL: 'bg-amber-100 text-amber-700',
      OVERDUE: 'bg-red-100 text-red-700', OPEN: 'bg-blue-100 text-blue-700',
      IN_PROGRESS: 'bg-amber-100 text-amber-700', RESOLVED: 'bg-emerald-100 text-emerald-700',
    }
    return map[s] || 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white/90 backdrop-blur border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">{initials}</div>
            <div>
              <p className="font-semibold text-gray-900 leading-tight">{client?.companyName}</p>
              <p className="text-xs text-gray-400 font-mono">{client?.clientCode}</p>
            </div>
          </div>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1.5 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors">
            <LogOut size={14} /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
        <div className="max-w-6xl mx-auto px-2 flex items-center gap-0.5 overflow-x-auto">
          {NAV.map((t: any) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3.5 py-2.5 text-sm font-medium border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}>
              <t.icon size={14} /> {t.label}
              {t.badge > 0 && <span className="ml-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">{t.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* ================= OVERVIEW ================= */}
        {tab === 'overview' && (
          <div className="space-y-5">
            {/* Greeting hero */}
            <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white p-6 relative overflow-hidden">
              <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
              <div className="relative">
                <p className="text-indigo-100 text-sm">{greeting()},</p>
                <h1 className="text-2xl font-bold mt-0.5">{client?.clientName || client?.companyName} 👋</h1>
                <p className="text-indigo-100 text-sm mt-1">Here's what's happening with your account.</p>
              </div>
            </div>

            {/* Expiring alert */}
            {expiring.length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
                <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
                <div className="text-sm text-amber-800">
                  <b>{expiring.length} service{expiring.length > 1 ? 's' : ''}</b> expiring within 30 days.{' '}
                  <button onClick={() => setTab('services')} className="underline font-medium">Review now</button>
                </div>
              </div>
            )}

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Active Services', value: activeServices, icon: Package, s: { chip: 'bg-indigo-100 text-indigo-600', val: 'text-indigo-600' } },
                { label: 'Total Paid', value: fmt(totalPaid), icon: CheckCircle2, s: { chip: 'bg-emerald-100 text-emerald-600', val: 'text-emerald-600' } },
                { label: 'Amount Due', value: fmt(totalDue), icon: Wallet, s: totalDue > 0 ? { chip: 'bg-red-100 text-red-600', val: 'text-red-600' } : { chip: 'bg-gray-100 text-gray-500', val: 'text-gray-900' } },
                { label: 'Open Tickets', value: openTickets, icon: MessageSquare, s: openTickets > 0 ? { chip: 'bg-amber-100 text-amber-600', val: 'text-amber-600' } : { chip: 'bg-gray-100 text-gray-500', val: 'text-gray-900' } },
              ].map((c: any) => (
                <div key={c.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${c.s.chip}`}>
                    <c.icon size={17} />
                  </div>
                  <p className="text-xs text-gray-500">{c.label}</p>
                  <p className={`text-xl font-bold mt-0.5 ${c.s.val}`}>{c.value}</p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              {/* Recent invoices */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-gray-900">Recent Invoices</h3>
                  <button onClick={() => setTab('invoices')} className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5">View all <ArrowRight size={11} /></button>
                </div>
                <div className="divide-y divide-gray-50">
                  {invoices.length === 0 ? (
                    <p className="p-8 text-center text-gray-400 text-sm">No invoices yet</p>
                  ) : invoices.slice(0, 5).map(inv => (
                    <div key={inv.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"><FileText size={15} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900">{inv.invoiceNumber}</p>
                        <p className="text-xs text-gray-400">Due: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN') : 'On receipt'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">{fmt(inv.totalAmount)}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusPill(inv.status)}`}>{inv.status}</span>
                      </div>
                      {inv.dueAmount > 0 && (
                        <button onClick={() => openPay(inv)} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-medium">Pay</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Account manager */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs font-medium text-gray-400 mb-3 flex items-center gap-1"><ShieldCheck size={13} /> YOUR ACCOUNT MANAGER</p>
                {reportingPerson ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-bold text-lg">
                        {reportingPerson.name?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{reportingPerson.name}</p>
                        <p className="text-xs text-gray-400 truncate">{reportingPerson.email}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <a href={`tel:${reportingPerson.phone}`} className="flex flex-col items-center gap-1 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs"><Phone size={15} /> Call</a>
                      <a href={`mailto:${reportingPerson.email}`} className="flex flex-col items-center gap-1 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs"><Mail size={15} /> Email</a>
                      <a href={waLink(reportingPerson.phone)} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 text-xs"><MessageSquare size={15} /> WhatsApp</a>
                    </div>
                  </>
                ) : <p className="text-sm text-gray-400">Not assigned yet</p>}
                <button onClick={() => setTicketModal(true)} className="w-full mt-4 border border-dashed border-gray-300 rounded-xl py-2.5 text-sm text-gray-600 hover:border-indigo-400 hover:text-indigo-600 flex items-center justify-center gap-1.5">
                  <Plus size={14} /> Raise a support ticket
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= SERVICES ================= */}
        {tab === 'services' && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">My Services</h2>
            {services.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400"><Package size={34} className="mx-auto mb-2 text-gray-300" />No services yet</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {services.map((s: any) => {
                  const dl = s.expiryDate ? daysLeft(s.expiryDate) : null
                  const pct = dl !== null ? Math.max(0, Math.min(100, (dl / 365) * 100)) : 0
                  return (
                    <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900">{s.serviceName}</p>
                          {s.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{s.description}</p>}
                        </div>
                        <span className={`text-[10px] px-2 py-1 rounded-full font-medium flex-shrink-0 ${statusPill(s.status)}`}>{s.status}</span>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <div>
                          <p className="text-lg font-bold text-gray-900">{fmt(s.amount)}</p>
                          <p className="text-[11px] text-gray-400">{s.billingCycle}</p>
                        </div>
                        {s.expiryDate && (
                          <div className="text-right">
                            <p className={`text-xs font-medium ${dl !== null && dl < 30 ? 'text-amber-600' : 'text-gray-600'}`}>
                              {dl !== null && dl < 0 ? `Expired ${-dl}d ago` : `${dl}d left`}
                            </p>
                            <p className="text-[11px] text-gray-400">{new Date(s.expiryDate).toLocaleDateString('en-IN')}</p>
                          </div>
                        )}
                      </div>
                      {s.expiryDate && dl !== null && (
                        <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className={`h-full rounded-full ${dl < 0 ? 'bg-red-400' : dl < 30 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${dl < 0 ? 100 : pct}%` }} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= INVOICES ================= */}
        {tab === 'invoices' && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">My Invoices</h2>
            {invoices.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400"><FileText size={34} className="mx-auto mb-2 text-gray-300" />No invoices yet</div>
            ) : (
              <div className="space-y-3">
                {invoices.map(inv => (
                  <div key={inv.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 flex-wrap">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500"><FileText size={17} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{inv.invoiceNumber}</p>
                      <p className="text-xs text-gray-500">Total {fmt(inv.totalAmount)}{inv.paidAmount > 0 && <> · Paid {fmt(inv.paidAmount)}</>}{inv.dueDate && <> · Due date {new Date(inv.dueDate).toLocaleDateString('en-IN')}</>}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{fmt(inv.totalAmount)}</p>
                      {inv.dueAmount > 0 && <p className="text-[11px] text-red-600 font-medium">Due {fmt(inv.dueAmount)}</p>}
                      <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium ${statusPill(inv.status)}`}>{inv.status}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => downloadClientPdf(inv)} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg flex items-center gap-1 font-medium"><Download size={13} /> PDF</button>
                      {inv.dueAmount > 0 && <button onClick={() => openPay(inv)} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium">Pay</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= REPORTS ================= */}
        {tab === 'reports' && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Reports Shared With You</h2>
            {reports.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400"><Sparkles size={34} className="mx-auto mb-2 text-gray-300" />No reports shared yet</div>
            ) : (
              <div className="space-y-3">
                {reports.map((r: any) => (
                  <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-gray-900">{r.title}</p>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{r.reportType}</span>
                      {r.reportPeriod && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{r.reportPeriod}</span>}
                      {r.clientService && <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{r.clientService.serviceName}</span>}
                    </div>
                    {r.description && <p className="text-sm text-gray-600 mt-1">{r.description}</p>}
                    {r.content && <div className="text-sm text-gray-800 mt-2 whitespace-pre-wrap bg-slate-50 p-3 rounded-xl">{r.content}</div>}
                    {r.fileUrl && (
                      <a href={r.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline mt-2 inline-flex items-center gap-1"><Download size={13} /> View attachment</a>
                    )}
                    <p className="text-xs text-gray-400 mt-2">By {r.uploadedBy?.name} · {new Date(r.reportDate).toLocaleDateString('en-IN')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TICKETS ================= */}
        {tab === 'tickets' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Support Tickets</h2>
              <button onClick={() => setTicketModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-medium"><Plus size={14} /> Raise Ticket</button>
            </div>
            {tickets.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                <MessageSquare size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No tickets yet. Raise one if you need help.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets
                  .slice((ticketPage - 1) * TICKETS_PAGE_SIZE, ticketPage * TICKETS_PAGE_SIZE)
                  .map((t: any) => {
                  const replyCount = t.replies?.length || 0
                  const threadOpen = !!openThreads[t.id]
                  return (
                  <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-50">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-xs text-gray-400">{t.ticketNumber}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${statusPill(t.status)}`}>{t.status}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">{t.priority}</span>
                      </div>
                      <p className="font-semibold text-gray-900">{t.subject}</p>
                      <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{t.description}</p>
                      <p className="text-xs text-gray-400 mt-2">Assigned: {t.assignedTo?.name || 'Unassigned'} · {new Date(t.createdAt).toLocaleDateString('en-IN')}</p>
                    </div>
                    {replyCount > 0 && (
                      <button
                        onClick={() => setOpenThreads(p => ({ ...p, [t.id]: !p[t.id] }))}
                        className="w-full flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50/50 border-b border-gray-50"
                      >
                        <MessageSquare size={13} />
                        <span className="flex-1 text-left">{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
                        {threadOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    )}
                    {threadOpen && replyCount > 0 && (
                      <div className="bg-slate-50 p-4 space-y-2">
                        {t.replies.map((r: any) => (
                          <div key={r.id} className="bg-white rounded-xl p-3 text-sm border border-gray-100">
                            <p className="text-xs font-semibold text-indigo-600 mb-1">{r.user?.name}</p>
                            <p className="whitespace-pre-wrap text-gray-700">{r.body?.replace('[FROM CLIENT] ', '')}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {t.status !== 'CLOSED' && (
                      <div className="p-3 border-t border-gray-50 flex gap-2">
                        <input type="text" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                          placeholder="Write a reply..." value={ticketReply[t.id] || ''}
                          onChange={e => setTicketReply(p => ({ ...p, [t.id]: e.target.value }))} />
                        <button onClick={async () => {
                          if (!ticketReply[t.id]?.trim()) return
                          const r = await fetch(`/api/client-portal/tickets/${t.id}/replies`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ body: ticketReply[t.id] }),
                          })
                          if (r.ok) { setTicketReply(p => ({ ...p, [t.id]: '' })); setOpenThreads(p => ({ ...p, [t.id]: true })); loadData(); toast.success('Reply sent') }
                        }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 rounded-xl text-sm flex items-center"><Send size={14} /></button>
                      </div>
                    )}
                  </div>
                  )
                })}

                {tickets.length > TICKETS_PAGE_SIZE && (
                  <div className="flex items-center justify-center gap-4 pt-2">
                    <button
                      disabled={ticketPage === 1}
                      onClick={() => setTicketPage(p => Math.max(1, p - 1))}
                      className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm text-gray-600 font-medium">
                      Page {ticketPage} of {Math.max(1, Math.ceil(tickets.length / TICKETS_PAGE_SIZE))}
                    </span>
                    <button
                      disabled={ticketPage >= Math.ceil(tickets.length / TICKETS_PAGE_SIZE)}
                      onClick={() => setTicketPage(p => Math.min(Math.ceil(tickets.length / TICKETS_PAGE_SIZE), p + 1))}
                      className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= PROFILE ================= */}
        {tab === 'profile' && client && (
          <div className="space-y-4 max-w-3xl">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-bold text-xl">{initials}</div>
                <div>
                  <h3 className="font-bold text-gray-900">{client.companyName}</h3>
                  <p className="text-xs text-gray-400 font-mono">{client.clientCode}</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  ['Company', 'companyName', true], ['Client Name', 'clientName', false],
                  ['Phone', 'phone', false], ['Email', 'email', false],
                  ['City', 'city', false], ['State', 'state', false],
                ].map(([label, key, dis]: any) => (
                  <div key={key}>
                    <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                    <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:border-indigo-500"
                      value={profileForm[key] || ''} disabled={dis}
                      onChange={e => setProfileForm((p: any) => ({ ...p, [key]: e.target.value }))} />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Address</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    value={profileForm.address || ''} onChange={e => setProfileForm((p: any) => ({ ...p, address: e.target.value }))} />
                </div>
              </div>
              <button onClick={saveProfile} disabled={savingProfile} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2">
                {savingProfile ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={14} />} Save Changes
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-1.5"><Lock size={15} /> Change Password</h3>
              <div className="space-y-2 max-w-md">
                <input type="password" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" placeholder="Current password" value={pwdForm.currentPassword} onChange={e => setPwdForm(p => ({ ...p, currentPassword: e.target.value }))} />
                <input type="password" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" placeholder="New password (min 6)" value={pwdForm.newPassword} onChange={e => setPwdForm(p => ({ ...p, newPassword: e.target.value }))} />
                <input type="password" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" placeholder="Confirm new password" value={pwdForm.confirm} onChange={e => setPwdForm(p => ({ ...p, confirm: e.target.value }))} />
                <button onClick={changePwd} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium">Change Password</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== Ticket Modal ===== */}
      {ticketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setTicketModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-900">Raise Support Ticket</h3>
              <button onClick={() => setTicketModal(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" placeholder="Subject *" value={ticketForm.subject} onChange={e => setTicketForm(p => ({ ...p, subject: e.target.value }))} />
            <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" placeholder="Describe your issue..." rows={4} value={ticketForm.description} onChange={e => setTicketForm(p => ({ ...p, description: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" value={ticketForm.priority} onChange={e => setTicketForm(p => ({ ...p, priority: e.target.value }))}>
                <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
              </select>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" placeholder="Category (optional)" value={ticketForm.category} onChange={e => setTicketForm(p => ({ ...p, category: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setTicketModal(false)} className="px-4 py-2 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
              <button disabled={ticketSaving} onClick={async () => {
                if (!ticketForm.subject || !ticketForm.description) { toast.error('Subject + description required'); return }
                setTicketSaving(true)
                try {
                  const r = await fetch('/api/client-portal/tickets', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(ticketForm),
                  })
                  const d = await r.json()
                  if (!r.ok) { toast.error(d.error || 'Failed'); return }
                  toast.success('Ticket raised!')
                  setTicketModal(false)
                  setTicketForm({ subject: '', description: '', priority: 'MEDIUM', category: '' })
                  loadData()
                } finally { setTicketSaving(false) }
              }} className="px-4 py-2 rounded-xl text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
                {ticketSaving ? 'Raising...' : 'Raise Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Pay Modal ===== */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setPayModal(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-900">Pay Invoice</h3>
              <button onClick={() => setPayModal(null)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="bg-indigo-50 rounded-xl p-3 text-sm flex items-center justify-between">
              <span className="text-gray-600">{payModal.invoiceNumber}</span>
              <span className="font-bold text-indigo-700">Due {fmt(payModal.dueAmount)}</span>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Amount</label>
              <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Method</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" value={payForm.method} onChange={e => setPayForm(p => ({ ...p, method: e.target.value }))}>
                <option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank Transfer</option><option value="CHEQUE">Cheque</option><option value="CARD">Card</option><option value="CASH">Cash</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Transaction Reference</label>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" placeholder="UPI ref / Cheque no / Bank ref" value={payForm.reference} onChange={e => setPayForm(p => ({ ...p, reference: e.target.value }))} />
            </div>
            <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" placeholder="Notes (optional)" rows={2} value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} />
            <p className="text-xs text-gray-400">Payment will be recorded pending verification by our team.</p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setPayModal(null)} className="px-4 py-2 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={pay} disabled={paying} className="px-4 py-2 rounded-xl text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                {paying ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}