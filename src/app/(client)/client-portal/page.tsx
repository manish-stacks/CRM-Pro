'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, LogIn, Package, FileText, CreditCard, User, MessageSquare, LogOut, DollarSign, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { downloadInvoicePdf } from '@/lib/invoicePdf'

export default function ClientPortalPage() {
  const router = useRouter()
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

  // Check session
  useEffect(() => {
    fetch('/api/client-portal/services').then(async r => {
      if (r.ok) {
        setLoggedIn(true)
        loadData()
      }
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
    if (sRes.ok) {
      const d = await sRes.json()
      setServices(d.data || [])
    }
    if (iRes.ok) {
      const d = await iRes.json()
      setInvoices(d.data || [])
    }
    if (pRes.ok) {
      const d = await pRes.json()
      setClient(d.data)
      setProfileForm(d.data || {})
    }
    if (rRes.ok) setReports((await rRes.json()).data || [])
    if (tRes.ok) setTickets((await tRes.json()).data || [])
  }

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    setLogging(true)
    try {
      const r = await fetch('/api/client-portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      })
      const data = await r.json()
      if (!r.ok) { toast.error(data.error || 'Login failed'); return }
      setClient(data.client)
      setReportingPerson(data.reportingPerson)
      setStats(data.stats)
      setLoggedIn(true)
      loadData()
      toast.success(`Welcome, ${data.client.clientName}!`)
    } finally { setLogging(false) }
  }

  const logout = async () => {
    await fetch('/api/client-portal/logout', { method: 'POST' })
    setLoggedIn(false)
    setClient(null)
  }

  const openPay = (inv: any) => {
    setPayModal(inv)
    setPayForm({ amount: String(inv.dueAmount), method: 'UPI', reference: '', notes: '' })
  }

  const downloadClientPdf = async (inv: any) => {
    try {
      // Fetch full invoice with items + client details
      const r = await fetch(`/api/client-portal/invoices/${inv.id}`)
      if (!r.ok) { toast.error('Failed to load invoice'); return }
      const full = (await r.json()).data
      // Fetch company info
      let company = {}
      try {
        const cr = await fetch('/api/client-portal/company-info')
        if (cr.ok) company = (await cr.json()).data
      } catch {}
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payForm),
      })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || 'Failed'); return }
      toast.success('Payment recorded! Confirmation will be sent.')
      setPayModal(null)
      loadData()
    } finally { setPaying(false) }
  }

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      const r = await fetch('/api/client-portal/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      })
      if (r.ok) { toast.success('Profile updated'); loadData() } else toast.error('Failed')
    } finally { setSavingProfile(false) }
  }

  const changePwd = async () => {
    if (pwdForm.newPassword !== pwdForm.confirm) { toast.error('Passwords don\'t match'); return }
    if (pwdForm.newPassword.length < 6) { toast.error('Min 6 chars'); return }
    const r = await fetch('/api/client-portal/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pwdForm),
    })
    const d = await r.json()
    if (r.ok) { toast.success('Password changed'); setPwdForm({ currentPassword: '', newPassword: '', confirm: '' }) }
    else toast.error(d.error || 'Failed')
  }

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  // ============ LOGIN VIEW ============
  if (checking) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>

  if (!loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 mx-auto flex items-center justify-center text-white font-bold text-xl mb-3">
              HBS
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Client Portal</h1>
            <p className="text-sm text-gray-500">Sign in to view your services, invoices, and reports</p>
          </div>
          <form onSubmit={login} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" required className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-blue-500"
                value={loginForm.email} onChange={e => setLoginForm(p => ({...p, email: e.target.value}))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
              <input type="password" required className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-blue-500"
                value={loginForm.password} onChange={e => setLoginForm(p => ({...p, password: e.target.value}))} />
            </div>
            <button type="submit" disabled={logging}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2">
              {logging ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={14} />}
              Sign In
            </button>
            <p className="text-xs text-center text-gray-400 mt-4">
              Don't have credentials? Contact your account manager.
            </p>
          </form>
        </div>
      </div>
    )
  }

  // ============ AUTHENTICATED VIEW ============
  const totalDue = invoices.reduce((s, i) => s + i.dueAmount, 0)
  const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0)
  const activeServices = services.filter(s => s.status === 'ACTIVE').length
  const expiringSoon = services.filter(s => {
    if (s.status !== 'ACTIVE' || !s.expiryDate) return false
    const days = Math.ceil((new Date(s.expiryDate).getTime() - Date.now()) / 86400000)
    return days >= 0 && days <= 30
  }).length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">HBS</div>
            <div>
              <p className="font-semibold text-gray-900">{client?.companyName}</p>
              <p className="text-xs text-gray-500">{client?.clientCode}</p>
            </div>
          </div>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1">
            <LogOut size={13} /> Logout
          </button>
        </div>
        <div className="max-w-6xl mx-auto px-4 flex items-center gap-1 overflow-x-auto">
          {[
            { key: 'overview', label: 'Overview', icon: DollarSign },
            { key: 'services', label: 'Services', icon: Package },
            { key: 'invoices', label: 'Invoices', icon: FileText },
            { key: 'reports',  label: 'Reports',  icon: FileText },
            { key: 'tickets',  label: 'Support',  icon: MessageSquare },
            { key: 'profile',  label: 'Profile',  icon: User },
          ].map((t: any) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Overview */}
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl p-4 border border-gray-100">
                <p className="text-xs text-gray-500">Active Services</p>
                <p className="text-2xl font-bold mt-1">{activeServices}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-100">
                <p className="text-xs text-gray-500">Total Paid</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{fmt(totalPaid)}</p>
              </div>
              <div className={`bg-white rounded-xl p-4 border ${totalDue > 0 ? 'border-red-200' : 'border-gray-100'}`}>
                <p className="text-xs text-gray-500">Amount Due</p>
                <p className={`text-2xl font-bold mt-1 ${totalDue > 0 ? 'text-red-600' : ''}`}>{fmt(totalDue)}</p>
              </div>
              <div className={`bg-white rounded-xl p-4 border ${expiringSoon > 0 ? 'border-amber-200' : 'border-gray-100'}`}>
                <p className="text-xs text-gray-500">Expiring Soon</p>
                <p className={`text-2xl font-bold mt-1 ${expiringSoon > 0 ? 'text-amber-600' : ''}`}>{expiringSoon}</p>
              </div>
            </div>

            {reportingPerson && (
              <div className="bg-white rounded-xl p-4 border border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Your Account Manager</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    {reportingPerson.name?.[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{reportingPerson.name}</p>
                    <p className="text-xs text-gray-500">
                      {reportingPerson.email} · {reportingPerson.phone}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Recent unpaid invoices */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-sm">Recent Invoices</h3>
                <button onClick={() => setTab('invoices')} className="text-xs text-blue-600 hover:underline">View all</button>
              </div>
              <div className="divide-y divide-gray-100">
                {invoices.slice(0, 5).map(inv => (
                  <div key={inv.id} className="p-3 flex items-center gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{inv.invoiceNumber}</p>
                      <p className="text-xs text-gray-500">Due: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN') : 'On receipt'}</p>
                    </div>
                    <p className="font-bold">{fmt(inv.totalAmount)}</p>
                    {inv.dueAmount > 0 && (
                      <button onClick={() => openPay(inv)} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg">Pay Now</button>
                    )}
                    {inv.status === 'PAID' && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">Paid</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Services */}
        {tab === 'services' && (
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold">My Services</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {services.length === 0 ? (
                <p className="p-8 text-center text-gray-400 text-sm">No services yet</p>
              ) : services.map((s: any) => {
                const days = s.expiryDate ? Math.ceil((new Date(s.expiryDate).getTime() - Date.now()) / 86400000) : null
                return (
                  <div key={s.id} className="p-4 flex items-center gap-3">
                    <div className="flex-1">
                      <p className="font-semibold">{s.serviceName}</p>
                      {s.description && <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                        <span>{s.billingCycle}</span>
                        {s.expiryDate && (
                          <span className={days !== null && days < 30 ? 'text-amber-700 font-medium' : ''}>
                            Expires: {new Date(s.expiryDate).toLocaleDateString('en-IN')}
                            {days !== null && <> ({days < 0 ? `expired ${-days}d ago` : `${days}d left`})</>}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{fmt(s.amount)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded ${s.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{s.status}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Invoices */}
        {tab === 'invoices' && (
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold">My Invoices</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {invoices.length === 0 ? (
                <p className="p-8 text-center text-gray-400 text-sm">No invoices yet</p>
              ) : invoices.map(inv => (
                <div key={inv.id} className="p-4 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-gray-500">
                      Total: {fmt(inv.totalAmount)}
                      {inv.paidAmount > 0 && <> · Paid: {fmt(inv.paidAmount)}</>}
                    </p>
                    {inv.dueDate && <p className="text-xs text-gray-500">Due: {new Date(inv.dueDate).toLocaleDateString('en-IN')}</p>}
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${inv.dueAmount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmt(inv.dueAmount)}</p>
                    <p className="text-xs text-gray-500">{inv.status}</p>
                  </div>
                  <button onClick={() => downloadClientPdf(inv)}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1">
                    ⬇ PDF
                  </button>
                  {inv.dueAmount > 0 && (
                    <button onClick={() => openPay(inv)} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg">Pay</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reports */}
        {tab === 'reports' && (
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold">Reports Shared with You</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {reports.length === 0 ? (
                <p className="p-8 text-center text-gray-400 text-sm">No reports shared yet</p>
              ) : reports.map((r: any) => (
                <div key={r.id} className="p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold">{r.title}</p>
                    <span className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{r.reportType}</span>
                    {r.reportPeriod && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{r.reportPeriod}</span>}
                    {r.clientService && <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{r.clientService.serviceName}</span>}
                  </div>
                  {r.description && <p className="text-sm text-gray-600 mt-1">{r.description}</p>}
                  {r.content && <div className="text-sm text-gray-800 mt-2 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg">{r.content}</div>}
                  {r.fileUrl && (
                    <a href={r.fileUrl} target="_blank" className="text-sm text-blue-600 hover:underline mt-2 inline-flex items-center gap-1">
                      📎 View attachment
                    </a>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    By {r.uploadedBy?.name} · {new Date(r.reportDate).toLocaleDateString('en-IN')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tickets */}
        {tab === 'tickets' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Support Tickets</h3>
              <button onClick={() => setTicketModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded-lg flex items-center gap-1">
                <MessageSquare size={13} /> Raise Ticket
              </button>
            </div>
            {tickets.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                <MessageSquare size={30} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No tickets. Raise one if you need help.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((t: any) => (
                  <div key={t.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-xs text-gray-500">{t.ticketNumber}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          t.status === 'OPEN' ? 'bg-blue-100 text-blue-700' :
                          t.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
                          t.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{t.status}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">{t.priority}</span>
                      </div>
                      <p className="font-semibold">{t.subject}</p>
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{t.description}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Assigned to: {t.assignedTo?.name || 'Unassigned'} · Created: {new Date(t.createdAt).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    {t.replies?.length > 0 && (
                      <div className="bg-slate-50 p-4 space-y-2">
                        {t.replies.map((r: any) => (
                          <div key={r.id} className="bg-white rounded p-3 text-sm">
                            <p className="text-xs font-semibold text-blue-600 mb-1">{r.user?.name}</p>
                            <p className="whitespace-pre-wrap">{r.body?.replace('[FROM CLIENT] ', '')}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {t.status !== 'CLOSED' && (
                      <div className="p-3 border-t border-gray-100 flex gap-2">
                        <input type="text" className="input text-sm flex-1"
                          placeholder="Reply..."
                          value={ticketReply[t.id] || ''}
                          onChange={e => setTicketReply(p => ({...p, [t.id]: e.target.value}))} />
                        <button onClick={async () => {
                          if (!ticketReply[t.id]?.trim()) return
                          const r = await fetch(`/api/client-portal/tickets/${t.id}/replies`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ body: ticketReply[t.id] }),
                          })
                          if (r.ok) { setTicketReply(p => ({...p, [t.id]: ''})); loadData(); toast.success('Reply sent') }
                        }} className="bg-blue-600 hover:bg-blue-700 text-white px-3 rounded-lg text-sm">Send</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Profile */}
        {tab === 'profile' && client && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold mb-3">My Details</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500">Company</label><input className="input" value={profileForm.companyName || ''} disabled /></div>
                <div><label className="text-xs text-gray-500">Client Name</label><input className="input" value={profileForm.clientName || ''} onChange={e => setProfileForm((p: any) => ({...p, clientName: e.target.value}))} /></div>
                <div><label className="text-xs text-gray-500">Phone</label><input className="input" value={profileForm.phone || ''} onChange={e => setProfileForm((p: any) => ({...p, phone: e.target.value}))} /></div>
                <div><label className="text-xs text-gray-500">Email</label><input className="input" value={profileForm.email || ''} onChange={e => setProfileForm((p: any) => ({...p, email: e.target.value}))} /></div>
                <div><label className="text-xs text-gray-500">City</label><input className="input" value={profileForm.city || ''} onChange={e => setProfileForm((p: any) => ({...p, city: e.target.value}))} /></div>
                <div><label className="text-xs text-gray-500">State</label><input className="input" value={profileForm.state || ''} onChange={e => setProfileForm((p: any) => ({...p, state: e.target.value}))} /></div>
                <div className="col-span-2"><label className="text-xs text-gray-500">Address</label><input className="input" value={profileForm.address || ''} onChange={e => setProfileForm((p: any) => ({...p, address: e.target.value}))} /></div>
              </div>
              <button onClick={saveProfile} disabled={savingProfile} className="mt-3 btn-primary">
                {savingProfile ? <Loader2 size={13} className="animate-spin" /> : 'Save Changes'}
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold mb-3">Change Password</h3>
              <div className="space-y-2 max-w-md">
                <input type="password" className="input" placeholder="Current password" value={pwdForm.currentPassword} onChange={e => setPwdForm(p => ({...p, currentPassword: e.target.value}))} />
                <input type="password" className="input" placeholder="New password (min 6)" value={pwdForm.newPassword} onChange={e => setPwdForm(p => ({...p, newPassword: e.target.value}))} />
                <input type="password" className="input" placeholder="Confirm new password" value={pwdForm.confirm} onChange={e => setPwdForm(p => ({...p, confirm: e.target.value}))} />
                <button onClick={changePwd} className="btn-primary">Change Password</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ticket Modal */}
      {ticketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-3">
            <h3 className="font-semibold text-lg">Raise Support Ticket</h3>
            <input className="input" placeholder="Subject *" value={ticketForm.subject}
              onChange={e => setTicketForm(p => ({...p, subject: e.target.value}))} />
            <textarea className="input" placeholder="Describe your issue..." rows={4} value={ticketForm.description}
              onChange={e => setTicketForm(p => ({...p, description: e.target.value}))} />
            <div className="grid grid-cols-2 gap-3">
              <select className="input" value={ticketForm.priority}
                onChange={e => setTicketForm(p => ({...p, priority: e.target.value}))}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
              <input className="input" placeholder="Category (optional)" value={ticketForm.category}
                onChange={e => setTicketForm(p => ({...p, category: e.target.value}))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setTicketModal(false)} className="btn-secondary">Cancel</button>
              <button disabled={ticketSaving} onClick={async () => {
                if (!ticketForm.subject || !ticketForm.description) { toast.error('Subject + description required'); return }
                setTicketSaving(true)
                try {
                  const r = await fetch('/api/client-portal/tickets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(ticketForm),
                  })
                  const d = await r.json()
                  if (!r.ok) { toast.error(d.error || 'Failed'); return }
                  toast.success('Ticket raised!')
                  setTicketModal(false)
                  setTicketForm({ subject: '', description: '', priority: 'MEDIUM', category: '' })
                  loadData()
                } finally { setTicketSaving(false) }
              }} className="btn-primary">
                {ticketSaving ? 'Raising...' : 'Raise Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-3">
            <h3 className="font-semibold text-lg">Pay Invoice</h3>
            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <p><b>Invoice:</b> {payModal.invoiceNumber}</p>
              <p><b>Due:</b> {fmt(payModal.dueAmount)}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500">Amount</label>
              <input type="number" className="input" value={payForm.amount} onChange={e => setPayForm(p => ({...p, amount: e.target.value}))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Method</label>
              <select className="input" value={payForm.method} onChange={e => setPayForm(p => ({...p, method: e.target.value}))}>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CARD">Card</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Transaction Reference</label>
              <input className="input" placeholder="UPI ref / Cheque no / Bank ref" value={payForm.reference} onChange={e => setPayForm(p => ({...p, reference: e.target.value}))} />
            </div>
            <textarea className="input" placeholder="Notes (optional)" rows={2} value={payForm.notes} onChange={e => setPayForm(p => ({...p, notes: e.target.value}))} />
            <p className="text-xs text-gray-500">Payment will be recorded pending verification by our team.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setPayModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={pay} disabled={paying} className="btn-primary !bg-emerald-600 hover:!bg-emerald-700">
                {paying ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
