'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { downloadInvoicePdf } from '@/lib/invoicePdf'

type Ctx = ReturnType<typeof useClientPortalState>

const ClientPortalContext = createContext<Ctx | null>(null)

export function useClientPortal() {
  const ctx = useContext(ClientPortalContext)
  if (!ctx) throw new Error('useClientPortal must be used inside ClientPortalProvider')
  return ctx
}

function useClientPortalState() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [checking, setChecking] = useState(true)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [logging, setLogging] = useState(false)

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
      fetch('/api/client-portal/payments'),
      fetch('/api/client-portal/profile'),
      fetch('/api/client-portal/reports'),
      fetch('/api/client-portal/tickets'),
    ])
    if (sRes.ok) setServices((await sRes.json()).data || [])
    if (iRes.ok) setInvoices((await iRes.json()).data || [])
    if (pRes.ok) {
      const d = await pRes.json()
      setClient(d.data)
      setProfileForm(d.data || {})
      setReportingPerson(d.accountManager || d.data?.accountManager || null)
    }

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
      try { const cr = await fetch('/api/client-portal/company-info'); if (cr.ok) company = (await cr.json()).data } catch { }
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
  const daysLeft = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
  const statusPill = (s: string) => {
    const map: Record<string, string> = {
      ACTIVE: 'bg-emerald-100 text-emerald-700', PAID: 'bg-emerald-100 text-emerald-700',
      PENDING: 'bg-amber-100 text-amber-700', PARTIAL: 'bg-amber-100 text-amber-700',
      OVERDUE: 'bg-red-100 text-red-700', OPEN: 'bg-brand-100 text-brand-700',
      IN_PROGRESS: 'bg-amber-100 text-amber-700', RESOLVED: 'bg-emerald-100 text-emerald-700',
    }
    return map[s] || 'bg-gray-100 text-gray-600'
  }

  // Derived values used across pages/topbar
  const totalDue = invoices.reduce((s, i) => s + i.dueAmount, 0)
  const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0)
  const activeServices = services.filter(s => s.status === 'ACTIVE').length
  const expiring = services.filter(s => s.status === 'ACTIVE' && s.expiryDate && daysLeft(s.expiryDate) >= 0 && daysLeft(s.expiryDate) <= 30)
  const openTickets = tickets.filter(t => t.status !== 'CLOSED' && t.status !== 'RESOLVED').length
  const initials = (client?.clientName || client?.companyName || 'C').split(' ').map((x: string) => x[0]).slice(0, 2).join('').toUpperCase()

  return {
    loggedIn, checking, loginForm, setLoginForm, logging, login, logout,
    reports, tickets, setTickets,
    ticketModal, setTicketModal, ticketForm, setTicketForm, ticketSaving, setTicketSaving,
    ticketReply, setTicketReply, openThreads, setOpenThreads, ticketPage, setTicketPage,
    TICKETS_PAGE_SIZE, pollTickets,
    client, services, invoices, reportingPerson, stats,
    payModal, setPayModal, payForm, setPayForm, paying, openPay, pay, downloadClientPdf,
    profileForm, setProfileForm, savingProfile, saveProfile,
    pwdForm, setPwdForm, changePwd,
    fmt, waLink, greeting, daysLeft, statusPill, loadData,
    totalDue, totalPaid, activeServices, expiring, openTickets, initials,
  }
}

export function ClientPortalProvider({ children }: { children: React.ReactNode }) {
  const value = useClientPortalState()
  return <ClientPortalContext.Provider value={value}>{children}</ClientPortalContext.Provider>
}
