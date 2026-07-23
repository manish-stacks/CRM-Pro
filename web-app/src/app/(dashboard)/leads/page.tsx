'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import {
  Button, Input, Select, Textarea, Modal, EmptyState, Pagination, Badge
} from '@/components/ui'
import { formatDate, getInitials } from '@/lib/utils'
import {
  Users, Plus, Search, Filter, X, Eye, Phone, Mail, Globe,
  ExternalLink, MapPin, MessageSquare, Loader2, CalendarClock,
  Download, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle
} from 'lucide-react'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

const STATUSES = [
  { key: 'NEW',               label: 'New',              color: 'blue'   },
  { key: 'RINGING',           label: 'Ringing',          color: 'amber'  },
  { key: 'FOLLOW_UP',         label: 'Follow Up',        color: 'yellow' },
  { key: 'CALLBACK',          label: 'Callback',         color: 'cyan'   },
  { key: 'MEETING_SCHEDULED', label: 'Meeting Scheduled', color: 'purple' },
  { key: 'CONVERTED',         label: 'Converted',        color: 'emerald' },
  { key: 'CLOSED',            label: 'Closed',           color: 'slate'  },
  { key: 'NOT_INTERESTED',    label: 'Not Interested',   color: 'red'    },
]
const SOURCES = ['WEBSITE', 'REFERRAL', 'SOCIAL_MEDIA', 'COLD_CALL', 'EMAIL', 'WALKIN', 'OTHER']

// Default follow-up: tomorrow, 11:00 AM — sensible default so a new lead
// never sits without a next-action date; the user can still change it.
function defaultFollowUp() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const followUpDate = d.toISOString().split('T')[0]
  return { followUpDate, followUpTime: '11:00' }
}

export default function LeadsPage() {
  const { user, isAtLeast } = useAuth()
  const canSeeAll = isAtLeast('MANAGER')

  const [leads, setLeads] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showFilter, setShowFilter] = useState(false)
  const [filters, setFilters] = useState({
    status: '', source: '', assignedToId: '', meetingAssignedToId: '', createdById: '', search: '', dateFrom: '', dateTo: '',
  })
  const [telecallers, setTelecallers] = useState<any[]>([])
  const [marketingPersons, setMarketingPersons] = useState<any[]>([])

  const [modal, setModal] = useState<'none' | 'add' | 'import'>('none')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importRows, setImportRows] = useState<any[]>([])
  const [importFileName, setImportFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; errors: any[] } | null>(null)

  const [form, setForm] = useState({
    companyName: '', clientName: '', clientPhone: '', clientEmail: '',
    alternatePhone: '', link: '', address: '', city: '', state: '',
    source: 'WEBSITE', service: '', price: '',
    status: 'NEW', remark: '', ...defaultFollowUp(),
  })

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const p: Record<string, string> = { page: String(page), limit: '20' }
      Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v })
      const r = await api.get(`/leads?${new URLSearchParams(p)}`)
      setLeads(r.data.data || [])
      setTotal(r.data.total || 0)
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { fetchLeads() }, [fetchLeads])
  useEffect(() => {
    if (canSeeAll) {
      api.get('/users/by-role?roles=TELECALLER')
        .then(r => setTelecallers(r.data.data || []))
        .catch(() => {})
      api.get('/users/by-role?roles=MARKETING_EXECUTIVE')
        .then(r => setMarketingPersons(r.data.data || []))
        .catch(() => {})
    }
  }, [canSeeAll])

  const openAdd = () => {
    setForm({
      companyName: '', clientName: '', clientPhone: '', clientEmail: '',
      alternatePhone: '', link: '', address: '', city: '', state: '',
      source: 'WEBSITE', service: '', price: '',
      status: 'NEW', remark: '', ...defaultFollowUp(),
    })
    setModal('add')
  }

  const create = async () => {
    if (!form.clientName.trim() || !form.clientPhone.trim()) {
      toast.error('Client name and phone required')
      return
    }
    setSaving(true)
    try {
      await api.post('/leads', form)
      toast.success('Lead created!')
      setModal('none')
      fetchLeads()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  // ---- Export ----
  const handleExport = async () => {
    setExporting(true)
    try {
      const p: Record<string, string> = { type: 'leads', format: 'csv' }
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
      // to what the import API expects, without requiring an exact header match.
      const normalized = rows.map(r => ({
        clientName: r.clientName || r.Name || r.name || r.ClientName || '',
        clientPhone: r.clientPhone || r.Phone || r.phone || r.ClientPhone || '',
        clientEmail: r.clientEmail || r.Email || r.email || '',
        companyName: r.companyName || r.Company || r.company || '',
        source: r.source || r.Source || 'OTHER',
        service: r.service || r.Service || '',
      }))
      setImportRows(normalized)
    } catch (err) {
      toast.error('Could not read file — please upload a .csv or .xlsx')
      setImportRows([])
    }
  }

  const handleImport = async () => {
    const valid = importRows.filter(r => r.clientName && r.clientPhone)
    if (valid.length === 0) {
      toast.error('No valid rows — Name and Phone are required')
      return
    }
    setImporting(true)
    try {
      const r = await api.post('/import-export', { leads: importRows })
      setImportResult({ imported: r.data.data.imported, errors: r.data.data.errors || [] })
      toast.success(`${r.data.data.imported} lead(s) imported`)
      fetchLeads()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const activeFilterCount = Object.values(filters).filter(v => v).length

  const statusPill = (status: string) => {
    const s = STATUSES.find(x => x.key === status)
    if (!s) return <Badge status={status} />
    const cls = {
      blue: 'bg-brand-100 text-brand-700', amber: 'bg-amber-100 text-amber-700',
      yellow: 'bg-yellow-100 text-yellow-700', cyan: 'bg-cyan-100 text-cyan-700',
      purple: 'bg-purple-100 text-purple-700', emerald: 'bg-emerald-100 text-emerald-700',
      slate: 'bg-slate-100 text-slate-700', red: 'bg-red-100 text-red-700',
    }[s.color] || 'bg-gray-100 text-gray-700'
    return <span className={`badge ${cls}`}>{s.label}</span>
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-1">
            {canSeeAll ? 'All leads across the team' : user?.role === 'MARKETING_EXECUTIVE' ? 'Meetings assigned to you + leads you added' : 'Leads assigned to you + leads you added'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleExport} loading={exporting} title="Exports leads matching the current search/filters (including date range)">
            <Download size={14} /> Export{activeFilterCount > 0 ? ` (${activeFilterCount} filtered)` : ''}
          </Button>
          <Button variant="secondary" onClick={openImport}>
            <Upload size={14} /> Import
          </Button>
          <Button onClick={openAdd}><Plus size={14} /> Add Lead</Button>
        </div>
      </div>

      <div className="card">
        <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100 flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" className="input pl-9 text-sm" placeholder="Search name, phone, email, lead#"
                value={filters.search}
                onChange={e => { setFilters(p => ({...p, search: e.target.value})); setPage(1) }} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{total} total</span>
            <button
              onClick={() => setShowFilter(!showFilter)}
              className={`btn-secondary btn-sm ${activeFilterCount > 0 ? 'border-brand-500 text-brand-600' : ''}`}
            >
              <Filter size={13} /> Filters
              {activeFilterCount > 0 && <span className="ml-1 bg-brand-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{activeFilterCount}</span>}
            </button>
          </div>
        </div>

        {showFilter && (
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 grid grid-cols-2 md:grid-cols-6 gap-3">
            <select value={filters.status} onChange={e => { setFilters(p => ({...p, status: e.target.value})); setPage(1) }} className="input">
              <option value="">Status: All</option>
              {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <select value={filters.source} onChange={e => { setFilters(p => ({...p, source: e.target.value})); setPage(1) }} className="input">
              <option value="">Source: All</option>
              {SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            {canSeeAll && (
              <select value={filters.assignedToId} onChange={e => { setFilters(p => ({...p, assignedToId: e.target.value})); setPage(1) }} className="input">
                <option value="">Telecaller: All</option>
                {telecallers.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            {canSeeAll && (
              <select value={filters.meetingAssignedToId} onChange={e => { setFilters(p => ({...p, meetingAssignedToId: e.target.value})); setPage(1) }} className="input">
                <option value="">Marketing Person: All</option>
                {marketingPersons.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            {canSeeAll && (
              <select value={filters.createdById} onChange={e => { setFilters(p => ({...p, createdById: e.target.value})); setPage(1) }} className="input">
                <option value="">Added By: All</option>
                {[...telecallers, ...marketingPersons].map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            <input type="date" className="input text-xs" placeholder="From"
              value={filters.dateFrom} onChange={e => { setFilters(p => ({...p, dateFrom: e.target.value})); setPage(1) }} />
            <input type="date" className="input text-xs" placeholder="To"
              value={filters.dateTo} onChange={e => { setFilters(p => ({...p, dateTo: e.target.value})); setPage(1) }} />
            {activeFilterCount > 0 && (
              <button onClick={() => { setFilters({status:'',source:'',assignedToId:'',meetingAssignedToId:'',createdById:'',search:'',dateFrom:'',dateTo:''}); setPage(1) }}
                className="text-xs text-red-600 hover:underline flex items-center gap-1 col-span-full">
                <X size={12} /> Clear all
              </button>
            )}
          </div>
        )}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Lead#</th>
                <th>Client</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Follow-up / Meeting</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400"><Loader2 className="animate-spin inline" /></td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon={<Users size={40} />} title="No leads" description="No leads match your filters" /></td></tr>
              ) : leads.map(l => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="font-mono text-xs text-gray-600">{l.leadNumber}</td>
                  <td>
                    <p className="font-medium text-gray-900 text-sm">{l.clientName}</p>
                    {l.companyName && <p className="text-xs text-gray-500">{l.companyName}</p>}
                  </td>
                  <td className="text-xs text-gray-700">
                    <div className="flex items-center gap-1"><Phone size={10} className="text-gray-400" /> {l.clientPhone}</div>
                    {l.clientEmail && <div className="flex items-center gap-1 text-gray-500"><Mail size={10} /> {l.clientEmail}</div>}
                  </td>
                  <td>{statusPill(l.status)}</td>
                  <td className="text-sm">
                    {l.assignedTo ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">
                          {getInitials(l.assignedTo.name)}
                        </div>
                        <div>
                          <p className="text-xs font-medium">{l.assignedTo.name}</p>
                          <p className="text-[10px] text-gray-500">{l.assignedTo.role?.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                    ) : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="text-xs">
                    {l.meetingDate ? (
                      <div className="text-purple-700 font-medium">
                        <p>🎯 {formatDate(l.meetingDate)}</p>
                        <p className="text-[10px]">{l.meetingSlot || l.meetingTime}</p>
                        {l.meetingAssignedTo && <p className="text-[10px] text-gray-500">→ {l.meetingAssignedTo.name}</p>}
                        {l.status !== 'MEETING_SCHEDULED' && (
                          <p className="text-[10px] text-gray-400">({l.status.replace(/_/g, ' ').toLowerCase()})</p>
                        )}
                      </div>
                    ) : l.followUpDate ? (
                      <div className="text-yellow-700">
                        <p>📞 {formatDate(l.followUpDate)}</p>
                        {l.followUpTime && <p className="text-[10px]">{l.followUpTime}</p>}
                      </div>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="text-xs text-gray-500">{formatDate(l.createdAt)}</td>
                  <td className="text-right">
                    <Link href={`/leads/${l.id}`} className="btn-ghost btn-sm !p-1.5" title="View">
                      <Eye size={13} />
                    </Link>
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

      {/* Add Lead Modal */}
      <Modal open={modal === 'add'} onClose={() => setModal('none')} title="Add New Lead">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Company Name" value={form.companyName} onChange={e => setForm(p => ({...p, companyName: e.target.value}))} />
            <Input label="Client Name *" value={form.clientName} onChange={e => setForm(p => ({...p, clientName: e.target.value}))} />
            <Input label="Client Phone *" value={form.clientPhone} onChange={e => setForm(p => ({...p, clientPhone: e.target.value}))} placeholder="+91 9999999999" />
            <Input label="Client Email" type="email" value={form.clientEmail} onChange={e => setForm(p => ({...p, clientEmail: e.target.value}))} />
            <Input label="Alternate Phone" value={form.alternatePhone} onChange={e => setForm(p => ({...p, alternatePhone: e.target.value}))} />
            <Input label="Link / Website" value={form.link} onChange={e => setForm(p => ({...p, link: e.target.value}))} placeholder="https://..." />
          </div>
          <Textarea label="Address" value={form.address} onChange={e => setForm(p => ({...p, address: e.target.value}))} rows={2} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" value={form.city} onChange={e => setForm(p => ({...p, city: e.target.value}))} />
            <Input label="State" value={form.state} onChange={e => setForm(p => ({...p, state: e.target.value}))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Source" value={form.source} onChange={e => setForm(p => ({...p, source: e.target.value}))} options={SOURCES.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))} />
            <Input label="Service Pitched" value={form.service} onChange={e => setForm(p => ({...p, service: e.target.value}))} placeholder="e.g. Website + SEO" />
            <Input label="Est. Price (₹)" type="number" value={form.price} onChange={e => setForm(p => ({...p, price: e.target.value}))} placeholder="25000" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Lead Status" value={form.status} onChange={e => setForm(p => ({...p, status: e.target.value}))} options={STATUSES.filter(s => !['CONVERTED', 'CLOSED', 'MEETING_SCHEDULED'].includes(s.key)).map(s => ({ value: s.key, label: s.label }))} />
            <Input label="Follow-up Date" type="date" value={form.followUpDate} onChange={e => setForm(p => ({...p, followUpDate: e.target.value}))} />
            <Input label="Follow-up Time" type="time" value={form.followUpTime} onChange={e => setForm(p => ({...p, followUpTime: e.target.value}))} />
          </div>
          <Textarea label="Remark" value={form.remark} onChange={e => setForm(p => ({...p, remark: e.target.value}))}
            placeholder="First call notes, client's response, etc." rows={3} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button onClick={create} loading={saving}>Create Lead</Button>
          </div>
        </div>
      </Modal>

      {/* Import Leads Modal */}
      <Modal open={modal === 'import'} onClose={() => setModal('none')} title="Import Leads">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Upload a <span className="font-medium">.csv</span> or <span className="font-medium">.xlsx</span> file.
            Columns like Name/Phone/Email/Company/Source/Service are picked up automatically —
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
                {importRows.filter(r => r.clientName && r.clientPhone).length} valid ·{' '}
                {importRows.filter(r => !r.clientName || !r.clientPhone).length} missing name/phone (will be skipped)
              </p>
            </div>
          )}

          {importResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-emerald-700">
                <CheckCircle2 size={15} /> {importResult.imported} lead(s) imported
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
                Import {importRows.length > 0 ? `${importRows.filter(r => r.clientName && r.clientPhone).length} Lead(s)` : ''}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}