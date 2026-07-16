'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  Loader2, LogIn, Package, FileText, User, MessageSquare, LogOut,
  Mail, TrendingUp, Sparkles, Lock, X, Send,
} from 'lucide-react'
import { useClientPortal } from './context'

const NAV = [
  { href: '/client-portal', label: 'Overview', icon: TrendingUp },
  { href: '/client-portal/services', label: 'Services', icon: Package },
  { href: '/client-portal/invoices', label: 'Invoices', icon: FileText, badgeKey: 'invoicesDue' },
  { href: '/client-portal/reports', label: 'Reports', icon: Sparkles },
  { href: '/client-portal/tickets', label: 'Support', icon: MessageSquare, badgeKey: 'openTickets' },
  { href: '/client-portal/profile', label: 'Profile', icon: User },
]

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const {
    loggedIn, checking, loginForm, setLoginForm, logging, login,
    client, logout, initials, invoices, openTickets, pollTickets,
    ticketModal, setTicketModal, ticketForm, setTicketForm, ticketSaving, setTicketSaving, loadData,
    payModal, setPayModal, payForm, setPayForm, paying, pay, fmt,
  } = useClientPortal()

  // "Live" ticket updates: poll every 12s only while the Support route is open.
  useEffect(() => {
    if (!loggedIn || pathname !== '/client-portal/tickets') return
    const id = setInterval(pollTickets, 12000)
    return () => clearInterval(id)
  }, [loggedIn, pathname])

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
              {[['Services', Package], ['Reports', FileText], ['Payments', TrendingUp]].map(([l, I]: any) => (
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

  const badges: Record<string, number> = {
    invoicesDue: invoices.filter((i: any) => i.dueAmount > 0).length,
    openTickets,
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white/90 backdrop-blur border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
              {client?.image ? <img src={client.image} alt="" className="w-full h-full object-cover" /> : initials}
            </div>
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
          {NAV.map((t) => {
            const active = pathname === t.href
            const badge = t.badgeKey ? badges[t.badgeKey] : 0
            return (
              <Link key={t.href} href={t.href}
                className={`px-3.5 py-2.5 text-sm font-medium border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${active ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}>
                <t.icon size={14} /> {t.label}
                {badge > 0 && <span className="ml-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">{badge}</span>}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {children}
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