'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import {
  Button, Input, Select, Textarea, Modal, EmptyState, Badge
} from '@/components/ui'
import { formatDate, getInitials, formatCurrency } from '@/lib/utils'
import {
  ArrowLeft, Phone, Mail, MapPin, Building2, Edit3, User,
  Loader2, Package, FileText, CreditCard, MessageSquare, RefreshCw,
  Send, Copy, Check, Plus, KeyRound, RotateCcw, Users2, TrendingUp,
  DollarSign, AlertCircle, Calendar, Video, X,
  Trash2
} from 'lucide-react'
import toast from 'react-hot-toast'

const BILLING_CYCLES = ['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY']

// Only these roles can add/edit services, see pricing, and view
// Proposals / Invoices / Payments.
const CAN_EDIT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MARKETING_EXECUTIVE']

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, hasRole } = useAuth()
  const canEdit = hasRole(...CAN_EDIT_ROLES)

  const id = params.id as string
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'services' | 'proposals' | 'invoices' | 'payments' | 'tickets' | 'reports' | 'team'>('services')

  const [modal, setModal] = useState<'none' | 'service' | 'renew' | 'portal' | 'edit'>('none')
  const [saving, setSaving] = useState(false)
  const [showPwd, setShowPwd] = useState<string | null>(null)
  const [customPwd, setCustomPwd] = useState('')

  const [serviceCatalog, setServiceCatalog] = useState<any[]>([])
  const [target, setTarget] = useState<any>(null)

  const [svcForm, setSvcForm] = useState({
    serviceCatalogId: '', serviceName: '', description: '', category: '',
    startDate: new Date().toISOString().split('T')[0],
    expiryDate: '', amount: '', billingCycle: 'ONE_TIME', autoRenew: false,
  })
  const [renewForm, setRenewForm] = useState({
    newExpiryDate: '', amount: '', dueDays: 15, generateInvoice: true,
  })

  const fetchClient = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get(`/clients/${id}`)
      setClient(r.data.data)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
      router.push('/clients')
    } finally { setLoading(false) }
  }, [id, router])

  useEffect(() => { fetchClient() }, [fetchClient])
  useEffect(() => {
    api.get('/services').then(r => setServiceCatalog(r.data.data || [])).catch(() => { })
  }, [])

  // If a restricted tab was somehow active (e.g. deep link) and the user
  // isn't allowed to view it, fall back to Services.
  useEffect(() => {
    if (!canEdit && ['proposals', 'invoices', 'payments'].includes(tab)) {
      setTab('services')
    }
  }, [canEdit, tab])

  const openService = () => {
    setSvcForm({
      serviceCatalogId: '', serviceName: '', description: '', category: '',
      startDate: new Date().toISOString().split('T')[0],
      expiryDate: '', amount: '', billingCycle: 'ONE_TIME', autoRenew: false,
    })
    setModal('service')
  }

  const pickCatalog = (catId: string) => {
    const c = serviceCatalog.find((x: any) => x.id === catId)
    if (c) {
      setSvcForm(p => ({
        ...p,
        serviceCatalogId: catId,
        serviceName: c.name,
        category: c.category || '',
        amount: String(c.basePrice),
        billingCycle: c.billingCycle,
      }))
    }
  }

  const addService = async () => {
    if (!canEdit) return
    if (!svcForm.serviceName) { toast.error('Service name required'); return }
    setSaving(true)
    try {
      await api.post(`/clients/${id}/services`, svcForm)
      toast.success('Service added')
      setModal('none')
      fetchClient()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const openRenew = (svc: any) => {
    setTarget(svc)
    setRenewForm({
      newExpiryDate: '',
      amount: String(svc.amount),
      dueDays: 15,
      generateInvoice: true,
    })
    setModal('renew')
  }

  const renew = async () => {
    if (!canEdit) return
    setSaving(true)
    try {
      const r = await api.post(`/clients/${id}/services/${target.id}/renew`, renewForm)
      toast.success(`Renewed! ${r.data.data?.invoice ? 'Invoice generated.' : ''}`)
      setModal('none')
      fetchClient()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const portalAction = async (action: 'activate' | 'regenerate' | 'disable') => {
    if (action === 'disable' && !confirm('Disable client portal access?')) return
    setSaving(true)
    try {
      const r = await api.post(`/clients/${id}/portal-access`, { action })
      if (action !== 'disable' && r.data.data?.password) {
        setShowPwd(r.data.data.password)
        toast.success(`Portal ${action === 'activate' ? 'activated' : 'password reset'} + welcome sent`)
      } else if (action === 'disable') {
        toast.success('Portal access disabled')
        setModal('none')
      }
      fetchClient()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const setCustomPassword = async () => {
    if (customPwd.trim().length < 6) { toast.error('Password kam se kam 6 characters'); return }
    setSaving(true)
    try {
      await api.post(`/clients/${id}/portal-access`, { action: 'set', password: customPwd.trim() })
      toast.success('Client ka password set ho gaya')
      setCustomPwd('')
      setModal('none')
      fetchClient()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>
  if (!client) return null

  const s = client.stats

  // Tabs visible to everyone vs the restricted set (Proposals/Invoices/Payments)
  const ALL_TABS = [
    { key: 'services', label: 'Services', icon: Package, count: client._count?.services, restricted: false },
    { key: 'proposals', label: 'Proposals', icon: FileText, count: client._count?.proposals, restricted: true },
    { key: 'invoices', label: 'Invoices', icon: FileText, count: client._count?.invoices, restricted: true },
    { key: 'payments', label: 'Payments', icon: CreditCard, count: null, restricted: true },
    { key: 'reports', label: 'Reports', icon: FileText, count: client._count?.reports, restricted: false },
    { key: 'team', label: 'Team', icon: User, count: null, restricted: false },
    { key: 'tickets', label: 'Tickets', icon: MessageSquare, count: client._count?.supportTickets, restricted: false },
  ]
  const visibleTabs = ALL_TABS.filter(t => !t.restricted || canEdit)

  return (
    <div className="space-y-5  mx-auto">
      <Link href="/clients" className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
        <ArrowLeft size={13} /> Back to clients
      </Link>

      {/* Header */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
              {getInitials(client.clientName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 text-xs flex-wrap">
                <span className="font-mono text-gray-500">{client.clientCode}</span>
                <Badge status={client.status} />
                {client.gstApplicable && client.gstNo && <span className="badge bg-purple-100 text-purple-700">GST: {client.gstNo}</span>}
                {client.portalPasswordSet ? (
                  <span className="badge bg-emerald-100 text-emerald-700">🔓 Portal Active</span>
                ) : (
                  <span className="badge bg-gray-100 text-gray-600">🔒 Portal Inactive</span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{client.clientName}</h1>
              <p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5"><Building2 size={12} /> {client.companyName}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 flex-wrap">
                <a href={`tel:${client.phone}`} className="flex items-center gap-1 hover:text-blue-600"><Phone size={12} /> {client.phone}</a>
                {client.email && <a href={`mailto:${client.email}`} className="flex items-center gap-1 hover:text-blue-600"><Mail size={12} /> {client.email}</a>}
                {client.city && <span className="flex items-center gap-1"><MapPin size={12} /> {client.city}{client.state ? `, ${client.state}` : ''}</span>}
                {client.onboardingDate && <span className="text-xs text-gray-500 flex items-center gap-1"><Calendar size={11} />Onboarded: {formatDate(client.onboardingDate)}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button onClick={() => setModal('portal')} className="btn-secondary btn-sm">
                <KeyRound size={13} /> Portal Access
              </button>
            )}
          </div>
        </div>

        {/* Stats row — pricing figures (Total Paid / Outstanding) only for canEdit roles */}
        <div className={`grid grid-cols-2 ${canEdit ? 'md:grid-cols-5' : 'md:grid-cols-3'} gap-3 mt-5 pt-5 border-t border-gray-100`}>
          <div>
            <p className="text-xs text-gray-500">Active Services</p>
            <p className="font-bold text-gray-900 text-lg">{s?.activeServices || 0}</p>
          </div>
          {canEdit && (
            <>
              <div>
                <p className="text-xs text-gray-500">Total Paid</p>
                <p className="font-bold text-emerald-600 text-lg">{formatCurrency(s?.totalPaid || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Outstanding</p>
                <p className={`font-bold text-lg ${s?.totalDue > 0 ? 'text-red-600' : 'text-gray-900'}`}>{formatCurrency(s?.totalDue || 0)}</p>
              </div>
            </>
          )}
          {canEdit && (
            <div>
              <p className="text-xs text-gray-500">Proposals</p>
              <p className="font-bold text-gray-900 text-lg">{client._count?.proposals || 0}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500">Expiring Soon</p>
            <p className={`font-bold text-lg ${s?.expiringSoon > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{s?.expiringSoon || 0}</p>
          </div>
        </div>

        {/* Expiring services alert */}
        {client.expiringServices?.length > 0 && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                {client.expiringServices.length} service(s) expiring in 30 days
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {client.expiringServices.map((s: any) => s.serviceName).join(', ')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-gray-100 flex items-center overflow-x-auto">
          {visibleTabs.map((t: any) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
              <t.icon size={14} /> {t.label}
              {t.count !== null && t.count !== undefined && (
                <span className={`text-xs ${tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'} px-1.5 rounded`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* SERVICES */}
          {tab === 'services' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Client Services</h3>
                {canEdit && <button onClick={openService} className="btn-primary btn-sm"><Plus size={13} /> Add Service</button>}
              </div>
              {!client.services?.length ? (
                <EmptyState icon={<Package />} title="No services" description="Add a service to start tracking" />
              ) : (
                <div className="space-y-2">
                  {client.services.map((s: any) => {
                    const isExpired = s.expiryDate && new Date(s.expiryDate) < new Date()
                    const daysLeft = s.expiryDate ? Math.ceil((new Date(s.expiryDate).getTime() - Date.now()) / 86400000) : null
                    const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30
                    return (
                      <div key={s.id} className={`border rounded-lg p-3 flex items-center gap-3 flex-wrap ${isExpired ? 'border-red-200 bg-red-50' :
                        isExpiringSoon ? 'border-amber-200 bg-amber-50' :
                          'border-gray-200'
                        }`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-gray-900">{s.serviceName}</p>
                            <Badge status={s.status} />
                            <span className="text-xs text-gray-500">{s.billingCycle}</span>
                            {s.department && <span className="badge bg-slate-100 text-slate-700 text-xs">{s.department.name}</span>}
                          </div>
                          <div className="text-xs text-gray-600 mt-1 flex items-center gap-3 flex-wrap">
                            <span>Start: {formatDate(s.startDate)}</span>
                            {s.expiryDate && (
                              <span className={isExpired ? 'text-red-700 font-semibold' : isExpiringSoon ? 'text-amber-700 font-semibold' : ''}>
                                Expiry: {formatDate(s.expiryDate)}
                                {daysLeft !== null && (
                                  <> ({isExpired ? `expired ${-daysLeft}d ago` : `${daysLeft}d left`})</>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Price visible only to canEdit roles */}
                        {canEdit && <div className="font-bold text-gray-900">{formatCurrency(s.amount)}</div>}
                        {canEdit && s.expiryDate && (
                          <button onClick={() => openRenew(s)}
                            className="btn-secondary btn-sm border-emerald-300 text-emerald-700">
                            <RotateCcw size={12} /> Renew
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* PROPOSALS — read-only history (proposals are created from the Lead, before conversion) */}
          {tab === 'proposals' && canEdit && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Proposals</h3>
              </div>
              {!client.proposals?.length ? (
                <EmptyState icon={<FileText size={20} />} title="No proposals" description="Proposals for this client are created from its Lead, before conversion." />
              ) : (
                <div className="space-y-2">
                  {client.proposals.map((p: any) => (
                    <Link key={p.id} href={`/proposals/${p.id}`}
                      className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 flex items-center gap-3 group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-gray-500">{p.proposalNumber}</span>
                          <Badge status={p.status} />
                        </div>
                        <p className="font-medium text-gray-900 mt-0.5">{p.title}</p>
                        <p className="text-xs text-gray-500">{formatDate(p.createdAt)}</p>
                      </div>
                      <p className="font-bold text-gray-900">{formatCurrency(p.finalAmount)}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* INVOICES — canEdit roles only */}
          {tab === 'invoices' && canEdit && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Invoices</h3>
                <Link href={`/invoices/new?clientId=${client.id}`} className="btn-primary btn-sm"><Plus size={13} /> New Invoice</Link>
              </div>
              {!client.invoices?.length ? (
                <EmptyState icon={<FileText size={20} />} title="No invoices" description="No invoices generated yet" />
              ) : (
                <div className="space-y-2">
                  {client.invoices.map((inv: any) => (
                    <Link key={inv.id} href={`/invoices/${inv.id}`}
                      className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-gray-500">{inv.invoiceNumber}</span>
                          <Badge status={inv.status} />
                          {inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== 'PAID' && (
                            <span className="badge bg-red-100 text-red-700">OVERDUE</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatDate(inv.createdAt)}
                          {inv.dueDate && <> · Due {formatDate(inv.dueDate)}</>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{formatCurrency(inv.totalAmount)}</p>
                        {inv.dueAmount > 0 && <p className="text-xs text-red-600">Due: {formatCurrency(inv.dueAmount)}</p>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PAYMENTS — canEdit roles only */}
          {tab === 'payments' && canEdit && (
            <PaymentsSection clientId={client.id} />
          )}

          {/* REPORTS */}
          {tab === 'reports' && (
            <ReportsSection clientId={client.id} services={client.services} />
          )}

          {/* TEAM */}
          {tab === 'team' && (
            <TeamSection clientId={client.id} services={client.services} canEdit={canEdit} user={user} onChanged={fetchClient} />
          )}

          {/* TICKETS */}
          {tab === 'tickets' && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Support Tickets</h3>
              {!client.supportTickets?.length ? (
                <EmptyState icon={<MessageSquare size={20} />} title="No tickets" description="No support tickets from this client" />
              ) : (
                <div className="space-y-2">
                  {client.supportTickets.map((t: any) => (
                    <div key={t.id} className="border border-gray-200 rounded-lg p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-gray-500">{t.ticketNumber}</span>
                          <Badge status={t.status} />
                          <Badge status={t.priority} />
                        </div>
                        <p className="font-medium text-sm mt-0.5">{t.subject}</p>
                      </div>
                      <span className="text-xs text-gray-500">{formatDate(t.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Service Modal */}
      {canEdit && (
        <Modal open={modal === 'service'} onClose={() => setModal('none')} title="Add Service to Client">
          <div className="space-y-3">
            {serviceCatalog.length > 0 && (
              <Select label="Pick from Catalog (optional)" value={svcForm.serviceCatalogId} onChange={e => pickCatalog(e.target.value)} options={[
                { value: '', label: '— Custom —' },
                ...serviceCatalog.map((s: any) => ({ value: s.id, label: `${s.name} — ₹${s.basePrice} / ${s.billingCycle}` }))
              ]} />
            )}
            <div className="grid grid-cols-2 gap-3">
              <Input label="Service Name *" value={svcForm.serviceName} onChange={e => setSvcForm(p => ({ ...p, serviceName: e.target.value }))} />
              <Input label="Category" value={svcForm.category} onChange={e => setSvcForm(p => ({ ...p, category: e.target.value }))} placeholder="SEO, MARKETING, DEVELOPMENT..." />
            </div>
            <Textarea label="Description" value={svcForm.description} onChange={e => setSvcForm(p => ({ ...p, description: e.target.value }))} rows={2} />
            <div className="grid grid-cols-3 gap-3">
              <Input label="Start Date" type="date" value={svcForm.startDate} onChange={e => setSvcForm(p => ({ ...p, startDate: e.target.value }))} />
              <Input label="Expiry Date" type="date" value={svcForm.expiryDate} onChange={e => setSvcForm(p => ({ ...p, expiryDate: e.target.value }))} />
              <Select label="Billing Cycle" value={svcForm.billingCycle} onChange={e => setSvcForm(p => ({ ...p, billingCycle: e.target.value }))} options={BILLING_CYCLES.map(c => ({ value: c, label: c }))} />
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <Input label="Amount (₹)" type="number" value={svcForm.amount} onChange={e => setSvcForm(p => ({ ...p, amount: e.target.value }))} />
              <label className="flex items-center gap-2 h-9 text-sm">
                <input type="checkbox" checked={svcForm.autoRenew} onChange={e => setSvcForm(p => ({ ...p, autoRenew: e.target.checked }))} />
                Auto Renew
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
              <Button onClick={addService} loading={saving}>Add Service</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Renew Modal */}
      {canEdit && (
        <Modal open={modal === 'renew'} onClose={() => setModal('none')} title={`Renew: ${target?.serviceName}`}>
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs">
              <p><b>Current Expiry:</b> {target?.expiryDate ? formatDate(target.expiryDate) : '—'}</p>
              <p><b>Billing Cycle:</b> {target?.billingCycle}</p>
            </div>
            <Input label="New Expiry Date (or leave blank to auto-compute)" type="date" value={renewForm.newExpiryDate} onChange={e => setRenewForm(p => ({ ...p, newExpiryDate: e.target.value }))} />
            <Input label="Renewal Amount (₹)" type="number" value={renewForm.amount} onChange={e => setRenewForm(p => ({ ...p, amount: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Invoice Due in (days)" type="number" value={renewForm.dueDays} onChange={e => setRenewForm(p => ({ ...p, dueDays: Number(e.target.value) }))} />
              <label className="flex items-center gap-2 h-9 text-sm">
                <input type="checkbox" checked={renewForm.generateInvoice} onChange={e => setRenewForm(p => ({ ...p, generateInvoice: e.target.checked }))} />
                Auto-generate invoice
              </label>
            </div>
            <p className="text-xs text-gray-500">📲 WhatsApp confirmation will be sent to the client.</p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
              <Button onClick={renew} loading={saving} className="!bg-emerald-600 hover:!bg-emerald-700">
                <RotateCcw size={13} /> Renew
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Portal Access Modal */}
      {canEdit && (
        <Modal open={modal === 'portal'} onClose={() => { setModal('none'); setShowPwd(null) }} title="Client Portal Access">
          {showPwd ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-emerald-900 mb-1">✅ Welcome sent!</p>
                <p className="text-xs text-emerald-700">Email + WhatsApp delivered with the new password. Save it below — shown only once.</p>
              </div>
              <div className="bg-white border-2 border-blue-500 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Temporary Password</p>
                <p className="text-2xl font-mono font-bold tracking-wider">{showPwd}</p>
                <button onClick={() => { navigator.clipboard.writeText(showPwd); toast.success('Copied!') }}
                  className="text-xs text-blue-600 hover:underline mt-2">Copy</button>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => { setModal('none'); setShowPwd(null) }}>Done</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className={`rounded-lg p-3 text-sm ${client.portalPasswordSet ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-200'}`}>
                Portal is currently <b>{client.portalPasswordSet ? 'ACTIVE' : 'INACTIVE'}</b>
              </div>
              {!client.portalPasswordSet ? (
                <button onClick={() => portalAction('activate')} disabled={saving}
                  className="w-full btn-primary flex items-center justify-center gap-2 py-3">
                  <Send size={14} /> Activate + Send Welcome (Email + WhatsApp)
                </button>
              ) : (
                <>
                  <button onClick={() => portalAction('regenerate')} disabled={saving}
                    className="w-full btn-secondary flex items-center justify-center gap-2 py-3">
                    <RefreshCw size={14} /> Reset Password + Resend Welcome
                  </button>
                  <button onClick={() => portalAction('disable')} disabled={saving}
                    className="w-full btn-danger flex items-center justify-center gap-2 py-3">
                    Disable Portal Access
                  </button>
                </>
              )}

              {/* Admin sets/updates a specific password (no email, admin shares manually) */}
              <div className="border-t border-gray-100 pt-3 mt-1">
                <label className="label flex items-center gap-1"><KeyRound size={12} /> Set custom password (admin)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customPwd}
                    onChange={e => setCustomPwd(e.target.value)}
                    placeholder="Naya password (min 6 chars)"
                    className="input flex-1"
                  />
                  <Button variant="primary" onClick={setCustomPassword} loading={saving} disabled={customPwd.trim().length < 6}>
                    Set
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Set/update the client's portal password here after converting a lead. This doesn't send an email/WhatsApp — share the password with the client yourself.
                </p>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

// Payments sub-section
function PaymentsSection({ clientId }: { clientId: string }) {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dueInvoices, setDueInvoices] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({ invoiceId: '', amount: '', method: 'UPI', reference: '', paidAt: new Date().toISOString().slice(0, 10), nextDueDate: '', notes: '' })

  const load = () => {
    api.get(`/payments?clientId=${clientId}&limit=50`).then(r => setPayments(r.data.data || [])).catch(() => {}).finally(() => setLoading(false))
    api.get(`/payments?type=invoices&clientId=${clientId}&limit=100`)
      .then(r => setDueInvoices((r.data.data || []).filter((i: any) => (i.dueAmount || 0) > 0))).catch(() => {})
  }
  useEffect(() => { load() }, [clientId])

  const openCollect = () => {
    setForm({ invoiceId: dueInvoices[0]?.id || '', amount: dueInvoices[0]?.dueAmount ? String(dueInvoices[0].dueAmount) : '', method: 'UPI', reference: '', paidAt: new Date().toISOString().slice(0, 10), nextDueDate: '', notes: '' })
    setModal(true)
  }
  const submit = async () => {
    if (!form.invoiceId) { toast.error('Select an invoice'); return }
    if (!Number(form.amount)) { toast.error('Amount daalo'); return }
    setSaving(true)
    try {
      await api.post('/payments', { type: 'payment', ...form, amount: Number(form.amount) })
      toast.success('Payment collect ho gaya')
      setModal(false); load()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Payments</h3>
        <button onClick={openCollect} disabled={!dueInvoices.length} className="btn-primary btn-sm disabled:opacity-50" title={dueInvoices.length ? '' : 'No due invoice'}>
          <Plus size={13} /> Collect Payment
        </button>
      </div>

      {!dueInvoices.length && <p className="text-xs text-gray-400">No pending (due) invoice — create an invoice first to collect payment.</p>}

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-4"><Loader2 className="animate-spin inline" /></p>
      ) : !payments.length ? (
        <EmptyState icon={<CreditCard size={20} />} title="No payments" description="Collected payments yahan dikhenge" />
      ) : (
        <div className="space-y-2">
          {payments.map(p => (
            <div key={p.id} className="border border-gray-200 rounded-lg p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700"><DollarSign size={16} /></div>
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {formatCurrency(p.amount)} · <span className="text-gray-500">{p.method}</span>
                  {p.source === 'CLIENT_PORTAL' && <span className="badge bg-blue-100 text-blue-700 text-[10px] ml-2">Client Portal</span>}
                </p>
                <p className="text-xs text-gray-500">
                  Invoice {p.invoice?.invoiceNumber} · {formatDate(p.paidAt)}{p.reference && <> · Ref: {p.reference}</>}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Collect Payment">
        <div className="space-y-3">
          <Select label="Invoice *" value={form.invoiceId}
            onChange={(e: any) => { const inv = dueInvoices.find(i => i.id === e.target.value); setForm((p: any) => ({ ...p, invoiceId: e.target.value, amount: inv?.dueAmount ? String(inv.dueAmount) : p.amount })) }}
            options={[{ value: '', label: 'Select invoice...' }, ...dueInvoices.map(i => ({ value: i.id, label: `${i.invoiceNumber} (Due: ${formatCurrency(i.dueAmount)})` }))]} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount *" type="number" value={form.amount} onChange={(e: any) => setForm((p: any) => ({ ...p, amount: e.target.value }))} />
            <Select label="Method" value={form.method} onChange={(e: any) => setForm((p: any) => ({ ...p, method: e.target.value }))}
              options={['UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD'].map(m => ({ value: m, label: m.replace('_', ' ') }))} />
            <Input label="Reference" value={form.reference} onChange={(e: any) => setForm((p: any) => ({ ...p, reference: e.target.value }))} placeholder="UPI/txn ref" />
            <Input label="Date" type="date" value={form.paidAt} onChange={(e: any) => setForm((p: any) => ({ ...p, paidAt: e.target.value }))} />
            <Input label="Balance due date (part payment)" type="date" value={form.nextDueDate} onChange={(e: any) => setForm((p: any) => ({ ...p, nextDueDate: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button onClick={submit} loading={saving}>Collect</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// Reports sub-section
function ReportsSection({ clientId, services }: { clientId: string, services: any[] }) {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', reportType: 'TEXT',
    fileUrl: '', fileType: '', fileSize: 0, reportPeriod: '', content: '',
    reportDate: new Date().toISOString().split('T')[0],
    clientServiceId: '',
    notifyClient: false,
  })

  const load = () => api.get(`/clients/${clientId}/reports`).then(r => setReports(r.data.data || [])).catch(() => { }).finally(() => setLoading(false))

  useEffect(() => { load() }, [clientId])

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const reader = new FileReader()
      reader.onload = () => res(reader.result as string)
      reader.onerror = rej
      reader.readAsDataURL(file)
    })

  const [uploading, setUploading] = useState(false)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { toast.error('Max 8MB'); return }
    setUploading(true)
    try {
      // /api/upload expects JSON { dataUrl, folder } — NOT FormData
      const dataUrl = await fileToDataUrl(file)
      const r = await api.post('/upload', { dataUrl, folder: 'client-reports' })
      const uploaded = r.data.data
      const isImage = file.type.startsWith('image/')
      const isPdf = file.type === 'application/pdf'
      setForm(p => ({
        ...p,
        fileUrl: uploaded.url,
        fileType: file.type,
        fileSize: uploaded.bytes || file.size,
        reportType: isImage ? 'IMAGE' : isPdf ? 'PDF' : 'MIXED',
      }))
      toast.success('File uploaded')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    if (!form.title) { toast.error('Title required'); return }
    setSaving(true)
    try {
      await api.post(`/clients/${clientId}/reports`, form)
      toast.success('Report added' + (form.notifyClient ? ' + WhatsApp sent' : ''))
      setModal(false)
      setForm({
        title: '', description: '', reportType: 'TEXT', fileUrl: '', fileType: '', fileSize: 0, reportPeriod: '', content: '',
        reportDate: new Date().toISOString().split('T')[0], clientServiceId: '', notifyClient: false
      })
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const del = async (id: string) => {
    if (!confirm('Delete this report?')) return
    await api.delete(`/clients/${clientId}/reports/${id}`)
    toast.success('Deleted')
    load()
  }

  if (loading) return <p className="text-sm text-gray-400 text-center py-4"><Loader2 className="animate-spin inline" /></p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Client Reports</h3>
        <Button size="sm" onClick={() => setModal(true)}><Plus size={13} /> Add Report</Button>
      </div>
      {reports.length === 0 ? (
        <EmptyState icon={<FileText size={20} />} title="No reports" description="Upload SEO reports, monthly summaries, screenshots, PDFs" />
      ) : (
        <div className="space-y-2">
          {reports.map(r => (
            <div key={r.id} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{r.title}</p>
                    <span className="badge bg-slate-100 text-slate-700 text-[10px]">{r.reportType}</span>
                    {r.reportPeriod && <span className="badge bg-purple-100 text-purple-700 text-[10px]">{r.reportPeriod}</span>}
                    {r.clientService && <span className="badge bg-blue-50 text-blue-700 text-[10px]">{r.clientService.serviceName}</span>}
                  </div>
                  {r.description && <p className="text-xs text-gray-600 mt-1">{r.description}</p>}
                  {r.content && <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{r.content}</p>}
                  {r.fileUrl && (
                    <a href={r.fileUrl} target="_blank" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                      📎 View attachment
                    </a>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {r.uploadedBy?.name} · {formatDate(r.reportDate)}
                  </p>
                </div>
                <button onClick={() => del(r.id)} className="text-red-500 hover:bg-red-50 rounded p-1"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Add Client Report">
        <div className="space-y-3">
          <Input label="Title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="e.g. January 2026 SEO Report" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Report Period" value={form.reportPeriod} onChange={e => setForm(p => ({ ...p, reportPeriod: e.target.value }))}
              placeholder="Jan 2026, Week 1 Feb, Q1..." />
            <Input label="Report Date" type="date" value={form.reportDate} onChange={e => setForm(p => ({ ...p, reportDate: e.target.value }))} />
          </div>
          <Select label="Related Service (optional)" value={form.clientServiceId} onChange={e => setForm(p => ({ ...p, clientServiceId: e.target.value }))} options={[
            { value: '', label: '— None —' },
            ...services.map((s: any) => ({ value: s.id, label: s.serviceName }))
          ]} />
          <Textarea label="Description / Highlights" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} />
          <Textarea label="Report Content (text)" value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={4}
            placeholder="Rich text content of the report..." />
          <div>
            <label className="label">Attach File (image / PDF)</label>
            <input type="file" accept="image/*,application/pdf" onChange={handleFile} disabled={uploading} className="input" />
            {uploading && <p className="text-xs text-blue-600 mt-1"><Loader2 size={11} className="animate-spin inline" /> Uploading...</p>}
            {form.fileUrl && !uploading && <p className="text-xs text-emerald-600 mt-1">✓ Uploaded: <a href={form.fileUrl} target="_blank" className="underline">View</a></p>}
          </div>
          <label className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 rounded-lg p-3 cursor-pointer">
            <input type="checkbox" checked={form.notifyClient} onChange={e => setForm(p => ({ ...p, notifyClient: e.target.checked }))} />
            <span>📲 Send WhatsApp notification to client</span>
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save Report</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// Team assignments sub-section — assign dept head + members inline
function TeamSection({ clientId, services, canEdit, user, onChanged }: {
  clientId: string, services: any[], canEdit: boolean, user: any, onChanged: () => void,
}) {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [departments, setDepartments] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])

  const [modal, setModal] = useState<any>(null) // { service, mode: 'head' | 'members' }
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ managerId: '', memberIds: [] as string[] })

  const load = () => {
    setLoading(true)
    api.get(`/projects?clientId=${clientId}&isActive=true`)
      .then(r => setProjects(r.data.data || []))
      .catch(() => { })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [clientId])
  useEffect(() => {
    api.get('/departments').then(r => setDepartments(r.data.data || [])).catch(() => { })
    api.get('/users/by-role?roles=EMPLOYEE,MANAGER').then(r => setStaff(r.data.data || [])).catch(() => { })
  }, [])

  // departmentId -> head user
  const deptHead: Record<string, { id: string, name: string }> = {}
  departments.forEach((d: any) => {
    if (d.manager?.user?.id) deptHead[d.id] = { id: d.manager.user.id, name: d.manager.user.name }
  })

  // Group current assignments by service
  const grouped: Record<string, any> = {}
  projects.forEach(p => {
    const key = p.clientService.id
    if (!grouped[key]) grouped[key] = { service: p.clientService, manager: null, members: [] }
    if (p.role === 'MANAGER' || p.managerId) grouped[key].manager = p
    else grouped[key].members.push(p)
  })

  const groupFor = (svcId: string) => grouped[svcId] || { manager: null, members: [] }

  // Who can assign the HEAD? admin/canEdit only. Who can assign MEMBERS? admin OR the service's head.
  const isServiceHead = (svc: any) => groupFor(svc.id).manager?.managerId === user?.id
  const canAssignHead = canEdit
  const canAssignMembers = (svc: any) => canEdit || isServiceHead(svc)

  // Member candidates: same dept as the service (falls back to all). Include self.
  const memberCandidates = (svc: any) => {
    const list = staff.filter((u: any) =>
      !svc.departmentId || u.employee?.department?.id === svc.departmentId
    )
    return list
  }

  const openHead = (svc: any) => {
    const suggested = svc.departmentId ? deptHead[svc.departmentId]?.id : ''
    setForm({ managerId: groupFor(svc.id).manager?.managerId || suggested || '', memberIds: [] })
    setModal({ service: svc, mode: 'head' })
  }
  const openMembers = (svc: any) => {
    setForm({ managerId: '', memberIds: [] })
    setModal({ service: svc, mode: 'members' })
  }

  const toggle = (uid: string) =>
    setForm(p => ({ ...p, memberIds: p.memberIds.includes(uid) ? p.memberIds.filter(x => x !== uid) : [...p.memberIds, uid] }))

  const submit = async () => {
    if (!modal) return
    if (modal.mode === 'head' && !form.managerId) { toast.error('Pick a head'); return }
    if (modal.mode === 'members' && form.memberIds.length === 0) { toast.error('Pick members'); return }
    setSaving(true)
    try {
      await api.post('/projects', {
        clientServiceId: modal.service.id,
        managerId: modal.mode === 'head' ? form.managerId : undefined,
        memberIds: modal.mode === 'members' ? form.memberIds : [],
      })
      toast.success(modal.mode === 'head' ? 'Head assigned' : 'Members assigned')
      setModal(null)
      load()
      onChanged?.()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const remove = async (assignId: string) => {
    if (!confirm('Remove this assignment?')) return
    try {
      await api.delete(`/projects/${assignId}`)
      toast.success('Removed')
      load()
    } catch { toast.error('Failed') }
  }

  if (loading) return <p className="text-sm text-gray-400 text-center py-4"><Loader2 className="animate-spin inline" /></p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">Project Team</h3>
          <p className="text-xs text-gray-500">Assign a department head for each service — the head can add their own team members or themselves</p>
        </div>
        <Link href={`/projects`} className="text-xs text-blue-600 hover:underline">All assignments →</Link>
      </div>

      {services.length === 0 ? (
        <EmptyState icon={<Package size={20} />} title="No services" description="Add a service to the client first, then team assignment will happen" />
      ) : (
        <div className="space-y-3">
          {services.map((svc: any) => {
            const g = groupFor(svc.id)
            const suggested = svc.departmentId ? deptHead[svc.departmentId] : null
            return (
              <div key={svc.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Package size={14} className="text-slate-500" />
                    <p className="font-medium text-sm">{svc.serviceName}</p>
                    {svc.department && <span className="badge bg-slate-100 text-slate-700 text-xs">{svc.department.name}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {canAssignHead && (
                      <button onClick={() => openHead(svc)} className="btn-secondary btn-sm">
                        <User size={12} /> {g.manager ? 'Change Head' : 'Assign Head'}
                      </button>
                    )}
                    {canAssignMembers(svc) && (
                      <button onClick={() => openMembers(svc)} className="btn-primary btn-sm">
                        <Plus size={12} /> Members
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">🧑‍💼 Head / Manager</p>
                    {g.manager?.manager ? (
                      <div className="flex items-center gap-2 bg-purple-50 rounded p-2">
                        <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
                          {getInitials(g.manager.manager.name)}
                        </div>
                        <p className="text-sm font-medium flex-1">{g.manager.manager.name}</p>
                        {canAssignHead && (
                          <button onClick={() => remove(g.manager.id)} className="text-red-500 hover:bg-red-100 rounded p-1" title="Remove"><Trash2 size={12} /></button>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">
                        No head assigned
                        {suggested && <span className="text-blue-600"> · Suggested: {suggested.name}</span>}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">👥 Members ({g.members.length})</p>
                    {g.members.length === 0 ? <p className="text-xs text-gray-400">No members</p> : (
                      <div className="flex flex-wrap gap-1">
                        {g.members.map((m: any) => (
                          <div key={m.id} className="flex items-center gap-1 bg-blue-50 rounded px-2 py-0.5 text-xs">
                            <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold">
                              {getInitials(m.member?.name || 'X')}
                            </div>
                            <span>{m.member?.name}</span>
                            {canAssignMembers(svc) && (
                              <button onClick={() => remove(m.id)} className="text-red-500 hover:bg-red-100 rounded" title="Remove"><X size={10} /></button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Assign modal */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'head' ? 'Assign Department Head' : 'Assign Team Members'}>
        {modal && (
          <div className="space-y-3">
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <p className="font-medium">{modal.service.serviceName}</p>
              {modal.service.department && <p className="text-xs text-gray-500">{modal.service.department.name} department</p>}
            </div>

            {modal.mode === 'head' ? (
              <div>
                <Select
                  label="Head (department manager)"
                  value={form.managerId}
                  onChange={e => setForm(p => ({ ...p, managerId: e.target.value }))}
                  options={[
                    { value: '', label: '— Select head —' },
                    ...staff.map((u: any) => ({
                      value: u.id,
                      label: `${u.name} · ${(u.role || '').replace(/_/g, ' ')}${u.employee?.department?.name ? ` (${u.employee.department.name})` : ''}`,
                    })),
                  ]}
                />
                {modal.service.departmentId && deptHead[modal.service.departmentId] && (
                  <p className="text-xs text-blue-600 mt-1">
                    Suggested dept head: {deptHead[modal.service.departmentId].name}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="label">Select members {modal.service.department ? `(${modal.service.department.name})` : ''}</label>
                <div className="max-h-60 overflow-y-auto border rounded-lg divide-y divide-gray-100">
                  {memberCandidates(modal.service).length === 0 ? (
                    <p className="text-xs text-gray-400 p-3">No staff found in this department</p>
                  ) : memberCandidates(modal.service).map((u: any) => (
                    <label key={u.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer text-sm">
                      <input type="checkbox" checked={form.memberIds.includes(u.id)} onChange={() => toggle(u.id)} />
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                        {getInitials(u.name)}
                      </div>
                      <div className="flex-1">
                        <p>{u.name}{u.id === user?.id ? ' (You)' : ''}</p>
                        <p className="text-xs text-gray-500">{u.employee?.department?.name || 'No dept'} · {u.role}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">{form.memberIds.length} selected · you can add yourself too</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
              <Button onClick={submit} loading={saving}>Save</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}