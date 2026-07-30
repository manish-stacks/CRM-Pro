'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import {
  Button, Input, Select, Textarea, Modal, EmptyState, Pagination, Badge
} from '@/components/ui'
import { formatDate, getInitials, formatCurrency } from '@/lib/utils'
import {
  Users2, Plus, Search, Filter, X, Eye, Pencil, Phone, Mail, MapPin,
  Loader2, Building2, Package, FileText, Send, Download, Upload,
  FileSpreadsheet, CheckCircle2, AlertTriangle
} from 'lucide-react'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

const STATUSES = ['ACTIVE', 'INACTIVE', 'CHURNED']

export default function ClientsPage() {
  const { user, isAtLeast } = useAuth()
  // Admin, telecalling head (MANAGER) and Marketing Executive only
  const canCreate = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MARKETING_EXECUTIVE'].includes(user?.role || '')
  // Admin + TL (MANAGER) only
  const canExportImport = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role || '')

  const [clients, setClients] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showFilter, setShowFilter] = useState(false)
  const [filters, setFilters] = useState({
    search: '', status: '', state: '',
    marketingPersonId: '', telecallerId: '',
    serviceCatalogId: '', expiry: '',
    dateField: 'createdAt', dateFrom: '', dateTo: '',
  })
  const [catalog, setCatalog] = useState<any[]>([])

  const [telecallerPool, setTelecallerPool] = useState<any[]>([])
  const [marketingPool, setMarketingPool] = useState<any[]>([])
  const [modal, setModal] = useState<'none' | 'add' | 'edit' | 'import'>('none')
  const [saving, setSaving] = useState(false)
  const [showPwd, setShowPwd] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [importRows, setImportRows] = useState<any[]>([])
  const [importFileName, setImportFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; errors: any[] } | null>(null)

  const [form, setForm] = useState({
    companyName: '', clientName: '', phone: '', altPhone: '', email: '',
    address: '', state: '', city: '', pincode: '',
    gstApplicable: false, gstNo: '',
    telecallerId: '', marketingPersonId: '',
    onboardingDate: new Date().toISOString().split('T')[0],
    sendWelcome: true,
  })

  const fetchClients = useCallback(async () => {
    setLoading(true)
    try {
      const p: Record<string, string> = { page: String(page), limit: '20' }
      Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v })
      const r = await api.get(`/clients?${new URLSearchParams(p)}`)
      setClients(r.data.data || [])
      setTotal(r.data.total || 0)
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { fetchClients() }, [fetchClients])
  useEffect(() => {
    if (canCreate) {
      api.get('/services?limit=200').then(r => setCatalog(r.data.data || [])).catch(() => {})
      // Own admin option — Admin/Super Admin aren't a role by themselves in
      // these lists, so they'd never show up otherwise. Adding self lets an
      // admin pick themselves as Telecaller/Marketing Person too.
      const selfOption = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role || '')
        ? [{ id: user!.id, name: user!.name, role: user!.role }]
        : []
      api.get('/users/by-role?roles=TELECALLER,MANAGER&headOfRole=TELECALLER')
        .then(r => setTelecallerPool([...selfOption, ...(r.data.data || [])]))
        .catch(() => { })
      api.get('/users/by-role?roles=MARKETING_EXECUTIVE,MANAGER&headOfRole=MARKETING_EXECUTIVE')
        .then(r => setMarketingPool([...selfOption, ...(r.data.data || [])]))
        .catch(() => { })
    }
  }, [canCreate])

  const openAdd = () => {
    setForm({
      companyName: '', clientName: '', phone: '', altPhone: '', email: '',
      address: '', state: '', city: '', pincode: '',
      gstApplicable: false, gstNo: '',
      // A marketing exec / telecaller adding their own client doesn't need to
      // pick themselves — pre-fill it, same as the mobile app. Admin gets
      // pre-filled with their own name in both, since they can be either.
      telecallerId: user?.role === 'TELECALLER' ? (user.id || '')
        : ['SUPER_ADMIN', 'ADMIN'].includes(user?.role || '') ? (user?.id || '') : '',
      marketingPersonId: user?.role === 'MARKETING_EXECUTIVE' ? (user.id || '')
        : ['SUPER_ADMIN', 'ADMIN'].includes(user?.role || '') ? (user?.id || '') : '',
      onboardingDate: new Date().toISOString().split('T')[0],
      sendWelcome: true,
    })
    setModal('add')
  }

  // ---- Export ----
  const handleExport = async () => {
    setExporting(true)
    try {
      const p: Record<string, string> = { type: 'clients', format: 'csv' }
      Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v })
      window.open(`/api/import-export?${new URLSearchParams(p)}`, '_blank')
    } finally {
      setTimeout(() => setExporting(false), 800)
    }
  }

  // ---- Import ----
  const openImport = () => {
    setImportRows([])
    setImportFileName('')
    setImportResult(null)
    setModal('import')
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFileName(file.name)
    setImportResult(null)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      // Normalize common header variants (from our own export or a plain sheet)
      const normalized = rows.map(r => ({
        companyName: r.companyName || r.CompanyName || r.Company || r.company || '',
        clientName: r.clientName || r.ContactName || r.contactName || r.Name || r.name || '',
        phone: r.phone || r.Phone || '',
        email: r.email || r.Email || '',
        address: r.address || r.Address || '',
        city: r.city || r.City || '',
        state: r.state || r.State || '',
        gstNo: r.gstNo || r.GSTIN || '',
        status: r.status || r.Status || 'ACTIVE',
      }))
      setImportRows(normalized)
    } catch {
      toast.error('Could not read file — please upload a .csv or .xlsx')
      setImportRows([])
    }
  }

  const handleImport = async () => {
    const valid = importRows.filter(r => r.companyName && r.clientName && r.phone)
    if (valid.length === 0) {
      toast.error('No valid rows — Company, Name and Phone are required')
      return
    }
    setImporting(true)
    try {
      const r = await api.post('/import-export', { clients: importRows })
      setImportResult({ imported: r.data.data.imported, errors: r.data.data.errors || [] })
      toast.success(`${r.data.data.imported} client(s) imported`)
      fetchClients()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const create = async () => {
    if (!form.companyName || !form.clientName || !form.phone) {
      toast.error('Company, name, phone required'); return
    }
    setSaving(true)
    try {
      const r = await api.post('/clients', form)
      const welcome = r.data.data?.welcome
      if (welcome?.password) {
        toast.success('Client created!')
        setShowPwd(welcome.password)
      } else {
        toast.success('Client created')
        setModal('none')
      }
      fetchClients()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const canEditAssign = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role || '')
  const isEdit = modal === 'edit'

  const openEdit = (c: any) => {
    setEditId(c.id)
    setForm({
      companyName: c.companyName || '', clientName: c.clientName || '', phone: c.phone || '', altPhone: c.altPhone || '', email: c.email || '',
      address: c.address || '', state: c.state || '', city: c.city || '', pincode: c.pincode || '',
      gstApplicable: !!c.gstApplicable, gstNo: c.gstNo || '',
      telecallerId: c.telecallerId || '', marketingPersonId: c.marketingPersonId || '',
      onboardingDate: c.onboardingDate ? c.onboardingDate.split('T')[0] : new Date().toISOString().split('T')[0],
      sendWelcome: false,
    })
    setModal('edit')
  }

  const update = async () => {
    if (!form.companyName || !form.clientName || !form.phone) {
      toast.error('Company, name, phone required'); return
    }
    setSaving(true)
    try {
      await api.put(`/clients/${editId}`, form)
      toast.success('Client updated')
      setModal('none')
      fetchClients()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const activeFilterCount = Object.entries(filters)
    .filter(([k, v]) => k !== 'dateField' && !!v).length

  const setF = (k: string, v: string) => { setFilters(p => ({ ...p, [k]: v })); setPage(1) }
  const resetFilters = () => {
    setFilters({
      search: '', status: '', state: '',
      marketingPersonId: '', telecallerId: '',
      serviceCatalogId: '', expiry: '',
      dateField: 'createdAt', dateFrom: '', dateTo: '',
    })
    setPage(1)
  }

  const expiryLabel = (c: any) => {
    const withExp = (c.services || []).filter((s: any) => s.expiryDate)
    if (!withExp.length) return null
    const d = new Date(withExp[0].expiryDate)
    const days = Math.ceil((d.getTime() - Date.now()) / 86400000)
    return { date: d, days, name: withExp[0].serviceName }
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">Manage clients, services, invoices, and payments</p>
        </div>
        <div className="flex items-center gap-2">
          {canExportImport && (
            <>
              <Button variant="secondary" onClick={handleExport} loading={exporting} title="Exports clients matching the current search/filters">
                <Download size={14} /> Export
              </Button>
              <Button variant="secondary" onClick={openImport}>
                <Upload size={14} /> Import
              </Button>
            </>
          )}
          {canCreate && <Button onClick={openAdd}><Plus size={14} /> Add Client</Button>}
        </div>
      </div>

      <div className="card">
        <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100 flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" className="input pl-9 text-sm" placeholder="Search code, name, company, phone, email"
                value={filters.search}
                onChange={e => { setFilters(p => ({ ...p, search: e.target.value })); setPage(1) }} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{total} total</span>
            <button onClick={() => setShowFilter(!showFilter)}
              className={`btn-secondary btn-sm ${activeFilterCount > 0 ? 'border-brand-500 text-brand-600' : ''}`}>
              <Filter size={13} /> Filters
              {activeFilterCount > 0 && <span className="ml-1 bg-brand-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{activeFilterCount}</span>}
            </button>
          </div>
        </div>

        {showFilter && (
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <select value={filters.status} onChange={e => setF('status', e.target.value)} className="input">
                <option value="">Status: All</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* Marketing Executive name-wise */}
              <select value={filters.marketingPersonId} onChange={e => setF('marketingPersonId', e.target.value)} className="input">
                <option value="">Marketing Exec: All</option>
                {marketingPool.filter((u: any) => u.role === 'MARKETING_EXECUTIVE').map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>

              {/* Telecaller */}
              <select value={filters.telecallerId} onChange={e => setF('telecallerId', e.target.value)} className="input">
                <option value="">Telecaller: All</option>
                {telecallerPool.filter((u: any) => u.role === 'TELECALLER').map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>

              {/* Service-wise */}
              <select value={filters.serviceCatalogId} onChange={e => setF('serviceCatalogId', e.target.value)} className="input">
                <option value="">Service: All</option>
                {catalog.map((c: any) => <option key={c.id} value={c.id}>{c.name || c.serviceName}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Service expiry-wise */}
              <select value={filters.expiry} onChange={e => setF('expiry', e.target.value)} className="input">
                <option value="">Expiry: All</option>
                <option value="expired">Already expired</option>
                <option value="7">Expiring in 7 days</option>
                <option value="15">Expiring in 15 days</option>
                <option value="30">Expiring in 30 days</option>
                <option value="60">Expiring in 60 days</option>
                <option value="90">Expiring in 90 days</option>
                <option value="active">Active (not expired)</option>
                <option value="none">No expiry set</option>
              </select>

              {/* Date-wise */}
              <select value={filters.dateField} onChange={e => setF('dateField', e.target.value)} className="input">
                <option value="createdAt">Date: Created</option>
                <option value="onboardingDate">Date: Onboarding</option>
              </select>
              <Input type="date" value={filters.dateFrom} onChange={e => setF('dateFrom', e.target.value)} />
              <Input type="date" value={filters.dateTo} onChange={e => setF('dateTo', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input placeholder="State" value={filters.state} onChange={e => setF('state', e.target.value)} />
            </div>

            {activeFilterCount > 0 && (
              <button onClick={resetFilters} className="text-xs text-red-600 hover:underline flex items-center gap-1">
                <X size={12} /> Clear all filters
              </button>
            )}
          </div>
        )}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Client Code</th>
                <th>Client</th>
                <th>Contact</th>
                <th>Location</th>
                <th>Services</th>
                <th>Next Expiry</th>
                <th>Invoices</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-8"><Loader2 className="animate-spin inline text-gray-400" /></td></tr>
              ) : clients.length === 0 ? (
                <tr><td colSpan={9}><EmptyState icon={<Users2 size={40} />} title="No clients" description="No clients match your filters" /></td></tr>
              ) : clients.map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="font-mono text-xs text-gray-600">{c.clientCode}</td>
                  <td>
                    <p className="font-medium text-gray-900 text-sm">{c.clientName}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1"><Building2 size={10} />{c.companyName}</p>
                  </td>
                  <td className="text-xs text-gray-700">
                    <div className="flex items-center gap-1"><Phone size={10} className="text-gray-400" />{c.phone}</div>
                    {c.email && <div className="flex items-center gap-1 text-gray-500"><Mail size={10} />{c.email}</div>}
                  </td>
                  <td className="text-xs text-gray-600">
                    {c.city && <div className="flex items-center gap-1"><MapPin size={10} />{c.city}{c.state ? `, ${c.state}` : ''}</div>}
                  </td>
                  <td className="text-sm">
                    <Package size={12} className="inline text-gray-400 mr-1" />{c._count?.services || 0}
                    {c.services?.length ? (
                      <span className="block text-[10px] text-gray-400 truncate max-w-[140px]">
                        {c.services.map((x: any) => x.serviceName).join(', ')}
                      </span>
                    ) : null}
                  </td>
                  <td className="text-xs">
                    {(() => {
                      const e = expiryLabel(c)
                      if (!e) return <span className="text-gray-300">—</span>
                      const cls = e.days < 0 ? 'text-red-600' : e.days <= 15 ? 'text-amber-600' : 'text-gray-600'
                      return (
                        <>
                          <span className={`font-semibold ${cls}`}>{formatDate(e.date)}</span>
                          <span className={`block text-[10px] ${cls}`}>
                            {e.days < 0 ? `${Math.abs(e.days)}d overdue` : e.days === 0 ? 'today' : `in ${e.days}d`}
                          </span>
                        </>
                      )
                    })()}
                  </td>
                  <td className="text-sm"><FileText size={12} className="inline text-gray-400 mr-1" />{c._count?.invoices || 0}</td>
                  <td><Badge status={c.status} /></td>
                  <td className="text-right">
                    <Link href={`/clients/${c.id}`} className="btn-ghost btn-sm !p-1.5" title="View">
                      <Eye size={13} />
                    </Link>
                    {canEditAssign && (
                      <button onClick={() => openEdit(c)} className="btn-ghost btn-sm !p-1.5" title="Edit">
                        <Pencil size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100">
          <Pagination page={page} totalPages={Math.ceil(total / 20)} onChange={setPage} />
        </div>
      </div>

      {/* Add Client Modal */}
      <Modal open={modal === 'add' || modal === 'edit'} onClose={() => { setModal('none'); setShowPwd(null); setEditId(null) }} title={modal === 'edit' ? 'Edit Client' : 'Add New Client'}>
        {showPwd ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-emerald-900 mb-1">✅ Client created!</p>
              <p className="text-xs text-emerald-700">Welcome message sent via email + WhatsApp. Temporary password shown below (save it — this is the only time it appears):</p>
            </div>
            <div className="bg-white border-2 border-brand-500 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Temporary Password</p>
              <p className="text-2xl font-mono font-bold text-gray-900 tracking-wider">{showPwd}</p>
              <button onClick={() => { navigator.clipboard.writeText(showPwd); toast.success('Copied!') }}
                className="text-xs text-brand-600 hover:underline mt-2">Copy</button>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => { setModal('none'); setShowPwd(null) }}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Company Name *" value={form.companyName} onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))} />
              <Input label="Client Name *" value={form.clientName} onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))} />
              <Input label="Phone *" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+91 9999999999" />
              <Input label="Alt Phone" value={form.altPhone} onChange={e => setForm(p => ({ ...p, altPhone: e.target.value }))} />
              <Input label="Email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              <Input label="Onboarding Date" type="date" value={form.onboardingDate} onChange={e => setForm(p => ({ ...p, onboardingDate: e.target.value }))} />
            </div>
            <Textarea label="Address" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} rows={2} />
            <div className="grid grid-cols-3 gap-3">
              <Input label="City" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
              <Input label="State" value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} />
              <Input label="Pincode" value={form.pincode} onChange={e => setForm(p => ({ ...p, pincode: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">GST Applicable</label>
                <div className="flex items-center gap-3 h-9">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" checked={!form.gstApplicable} onChange={() => setForm(p => ({ ...p, gstApplicable: false }))} /> No
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" checked={form.gstApplicable} onChange={() => setForm(p => ({ ...p, gstApplicable: true }))} /> Yes
                  </label>
                </div>
              </div>
              {form.gstApplicable && (
                <Input label="GST Number" value={form.gstNo} onChange={e => setForm(p => ({ ...p, gstNo: e.target.value.toUpperCase() }))} placeholder="22ABCDE1234F1Z5" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Telecaller" value={form.telecallerId} onChange={e => setForm(p => ({ ...p, telecallerId: e.target.value }))} options={telecallerPool.map(u => ({ value: u.id, label: u.role === 'MANAGER' ? `${u.name} (Head)` : ['SUPER_ADMIN', 'ADMIN'].includes(u.role) ? `${u.name} (Admin)` : u.name }))} />

              <Select label="Marketing Person" value={form.marketingPersonId} onChange={e => setForm(p => ({ ...p, marketingPersonId: e.target.value }))} options={marketingPool.map(u => ({ value: u.id, label: u.role === 'MANAGER' ? `${u.name} (Head)` : ['SUPER_ADMIN', 'ADMIN'].includes(u.role) ? `${u.name} (Admin)` : u.name }))} />

            </div>
            {isEdit ? (
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
                <Button onClick={update} loading={saving}>Save Changes</Button>
              </div>
            ) : (
              <>
                <label className="flex items-center gap-2 bg-brand-50 border border-blue-200 rounded-lg p-3 cursor-pointer">
                  <input type="checkbox" checked={form.sendWelcome} onChange={e => setForm(p => ({ ...p, sendWelcome: e.target.checked }))} />
                  <div className="flex-1 text-sm">
                    <p className="font-medium text-blue-900 flex items-center gap-1"><Send size={13} /> Send Welcome Message</p>
                    <p className="text-xs text-brand-700">Auto-generate portal password + send credentials via email + WhatsApp</p>
                  </div>
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
                  <Button onClick={create} loading={saving}>Create Client</Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal open={modal === 'import'} onClose={() => setModal('none')} title="Import Clients">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Upload a <span className="font-medium">.csv</span> or <span className="font-medium">.xlsx</span> file.
            Columns like Company/Name/Phone/Email/Address/City/State/GSTIN are picked up automatically —
            it works with the file from <span className="font-medium">Export</span> too.
          </p>

          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-8 cursor-pointer hover:border-blue-400 hover:bg-brand-50/30 transition-colors">
            <FileSpreadsheet size={28} className="text-gray-400" />
            <span className="text-sm text-gray-600">
              {importFileName ? importFileName : 'Click to choose a file'}
            </span>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileSelect} />
          </label>

          {importRows.length > 0 && !importResult && (
            <div className="bg-gray-50 rounded-xl p-3 text-sm">
              <p className="font-medium text-gray-800 mb-1">{importRows.length} row(s) found</p>
              <p className="text-xs text-gray-500">
                {importRows.filter(r => r.companyName && r.clientName && r.phone).length} valid ·{' '}
                {importRows.filter(r => !r.companyName || !r.clientName || !r.phone).length} missing company/name/phone (will be skipped)
              </p>
            </div>
          )}

          {importResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-emerald-700">
                <CheckCircle2 size={15} /> {importResult.imported} client(s) imported
              </p>
              {importResult.errors.length > 0 && (
                <div className="mt-2 text-xs text-red-600">
                  <p className="flex items-center gap-1 font-medium"><AlertTriangle size={12} /> {importResult.errors.length} row(s) failed</p>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    {importResult.errors.slice(0, 5).map((er: any, i: number) => (
                      <li key={i}>Row {er.row}: {er.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal('none')}>
              {importResult ? 'Close' : 'Cancel'}
            </Button>
            {!importResult && (
              <Button onClick={handleImport} loading={importing} disabled={importRows.length === 0}>
                Import {importRows.length > 0 ? `${importRows.filter(r => r.companyName && r.clientName && r.phone).length} Client(s)` : ''}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
