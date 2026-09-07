'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/axios'
import { useAuth } from '@/hooks/useAuth'
import { Button, Input, Select, SearchSelect, Modal, EmptyState, Pagination, SearchInput, Spinner } from '@/components/ui'
import { useMemo } from 'react'
import { formatDate } from '@/lib/utils'
import { FileBarChart2, Plus, Eye, Download, Trash2, CheckCircle2, FileEdit, Building2, SlidersHorizontal } from 'lucide-react'
import toast from 'react-hot-toast'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function defaultPeriod() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export default function SeoReportsPage() {
  const router = useRouter()
  const { isAtLeast } = useAuth()

  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientFilterLabel, setClientFilterLabel] = useState('')
  const [service, setService] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [createdBy, setCreatedBy] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [services, setServices] = useState<any[]>([])
  const [clientLabel, setClientLabel] = useState('')
  const [form, setForm] = useState({ clientId: '', clientServiceId: '', reportMonth: defaultPeriod(), reportDate: new Date().toISOString().split('T')[0] })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p: Record<string, string> = { page: String(page), limit: '20' }
      if (search) p.search = search
      if (status) p.status = status
      if (clientId) p.clientId = clientId
      if (service) p.service = service
      if (month) p.month = month
      if (year) p.year = year
      if (createdBy) p.createdById = createdBy
      if (from) p.from = from
      if (to) p.to = to
      const r = await api.get(`/seo-reports?${new URLSearchParams(p)}`)
      setRows(r.data.data || [])
      setTotal(r.data.total || 0)
    } catch { toast.error('Failed to load reports') }
    finally { setLoading(false) }
  }, [page, search, status, clientId, service, month, year, createdBy, from, to])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, status, clientId, service, month, year, createdBy, from, to])

  const serviceNames = useMemo(
    () => Array.from(new Set(rows.map(r => r.clientService?.serviceName).filter(Boolean))) as string[],
    [rows]
  )
  const creators = useMemo(
    () => Array.from(new Set(rows.map(r => r.createdBy?.name).filter(Boolean))) as string[],
    [rows]
  )
  const activeFilterCount = [status, clientId, service, month, year, createdBy, from, to].filter(Boolean).length

  const clearFilters = () => {
    setStatus(''); setClientId(''); setClientFilterLabel(''); setService('')
    setMonth(''); setYear(''); setCreatedBy(''); setFrom(''); setTo('')
  }

  useEffect(() => {
    if (!form.clientId) { setServices([]); return }
    api.get(`/clients/${form.clientId}/services`).then(r => setServices(r.data.data || [])).catch(() => { })
  }, [form.clientId])

  const create = async () => {
    if (!form.clientId) return toast.error('Select a client')
    if (!form.reportMonth.trim()) return toast.error('Enter the reporting period')
    setSaving(true)
    try {
      const r = await api.post('/seo-reports', form)
      toast.success('Draft created')
      router.push(`/seo-reports/${r.data.data.id}`)
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Failed') }
    finally { setSaving(false) }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this report?')) return
    try { await api.delete(`/seo-reports/${id}`); toast.success('Deleted'); load() }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Failed') }
  }

  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileBarChart2 size={20} className="text-red-600" /> SEO / GMB Reports
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Build the monthly report, submit it, and it lands on the client dashboard with email + WhatsApp.</p>
        </div>
        <Button onClick={() => { setForm({ clientId: '', clientServiceId: '', reportMonth: defaultPeriod(), reportDate: new Date().toISOString().split('T')[0] }); setClientLabel(''); setModal(true) }}>
          <Plus size={14} /> New Report
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-[200px]">
            <SearchInput value={search} onChange={setSearch} placeholder="Search client, month, report no..." />
          </div>
          <Select
            value={status}
            onChange={e => setStatus(e.target.value)}
            options={[{ value: '', label: 'All Status' }, { value: 'DRAFT', label: 'Draft' }, { value: 'SUBMITTED', label: 'Submitted' }]}
          />
          <Button variant="secondary" onClick={() => setShowFilters(v => !v)}>
            <SlidersHorizontal size={14} /> Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 bg-brand-100 text-brand-700 text-[10px] rounded px-1.5">{activeFilterCount}</span>
            )}
          </Button>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-xs text-brand-600 hover:underline px-1">Clear all</button>
          )}
        </div>

        {showFilters && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
            <SearchSelect
              label="Client"
              value={clientId}
              valueLabel={clientFilterLabel}
              onSelect={(v, label) => { setClientId(v); setClientFilterLabel(label) }}
              fetchOptions={async (q) => {
                const r = await api.get(`/clients?limit=20${q ? `&search=${encodeURIComponent(q)}` : ''}`)
                return (r.data.data || []).map((c: any) => ({ value: c.id, label: `${c.companyName} (${c.clientCode})` }))
              }}
              placeholder="Any client"
            />
            <Select
              label="Service"
              value={service}
              onChange={e => setService(e.target.value)}
              options={[{ value: '', label: 'All services' }, ...serviceNames.map(n => ({ value: n, label: n }))]}
            />
            <Select
              label="Month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              options={[{ value: '', label: 'All months' }, ...MONTHS.map(m => ({ value: m, label: m }))]}
            />
            <Select
              label="Year"
              value={year}
              onChange={e => setYear(e.target.value)}
              options={[
                { value: '', label: 'All years' },
                ...Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i)).map(y => ({ value: y, label: y })),
              ]}
            />
            <Select
              label="Created By"
              value={createdBy}
              onChange={e => setCreatedBy(e.target.value)}
              options={[{ value: '', label: 'Anyone' }, ...creators.map(n => ({ value: n, label: n }))]}
            />
            <Input label="Created From" type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} />
            <Input label="Created To" type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<FileBarChart2 size={20} />} title="No reports yet" description="Create your first dynamic SEO + GMB monthly report" />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs">
              <tr>
                <th className="text-left px-3 py-2.5">Report No.</th>
                <th className="text-left px-3 py-2.5">Client</th>
                <th className="text-left px-3 py-2.5">Service</th>
                <th className="text-left px-3 py-2.5">Period</th>
                <th className="text-left px-3 py-2.5">Status</th>
                <th className="text-left px-3 py-2.5">Created By</th>
                <th className="text-right px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-medium text-gray-900">{r.reportNumber}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Building2 size={13} className="text-gray-400" />
                      <span>{r.client?.companyName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">{r.clientService?.serviceName || '—'}</td>
                  <td className="px-3 py-2.5">{r.reportMonth}</td>
                  <td className="px-3 py-2.5">
                    {r.status === 'SUBMITTED' ? (
                      <span className="badge bg-green-100 text-green-700 text-[10px] inline-flex items-center gap-1"><CheckCircle2 size={11} /> Submitted</span>
                    ) : (
                      <span className="badge bg-amber-100 text-amber-700 text-[10px] inline-flex items-center gap-1"><FileEdit size={11} /> Draft</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 text-xs">{r.createdBy?.name}<br /><span className="text-gray-400">{formatDate(r.createdAt)}</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link href={`/seo-reports/${r.id}`} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Open"><Eye size={15} /></Link>
                      {r.pdfUrl && (
                        <a href={r.pdfUrl} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-gray-100 text-blue-600" title="Download PDF"><Download size={15} /></a>
                      )}
                      {(r.status === 'DRAFT' || isAtLeast('ADMIN')) && (
                        <button onClick={() => remove(r.id)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Delete"><Trash2 size={15} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}

      <Modal open={modal} onClose={() => setModal(false)} title="New SEO / GMB Report">
        <div className="space-y-3">
          <SearchSelect
            label="Client"
            value={form.clientId}
            valueLabel={clientLabel}
            onSelect={(v, label) => { setForm(p => ({ ...p, clientId: v, clientServiceId: '' })); setClientLabel(label) }}
            fetchOptions={async (q) => {
              const r = await api.get(`/clients?limit=20${q ? `&search=${encodeURIComponent(q)}` : ''}`)
              return (r.data.data || []).map((c: any) => ({ value: c.id, label: `${c.companyName} (${c.clientCode})` }))
            }}
            placeholder="Search client..."
          />
          <Select
            label="Project / Service"
            value={form.clientServiceId}
            onChange={e => setForm(p => ({ ...p, clientServiceId: e.target.value }))}
            options={[{ value: '', label: 'Select service' }, ...services.map((s: any) => ({ value: s.id, label: s.serviceName }))]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Reporting Period" value={form.reportMonth} onChange={e => setForm(p => ({ ...p, reportMonth: e.target.value }))} placeholder="August 2026" />
            <Input label="Report Date" type="date" value={form.reportDate} onChange={e => setForm(p => ({ ...p, reportDate: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button onClick={create} loading={saving}>Create & Build</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
