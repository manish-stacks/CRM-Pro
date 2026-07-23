'use client'
// Visit Sheet — admin/manager can schedule visits for marketing executives and
// track every field visit. A MARKETING_EXECUTIVE sees only their own sheet and
// can add their own visits. Auto-created entries (meeting assigned / deal done)
// appear here too, tagged by source.
import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '@/lib/axios'
import { useAuth } from '@/hooks/useAuth'
import {
  Button, Badge, Modal, Input, Select, Textarea,
  EmptyState, Pagination, SearchInput, StatCard, ConfirmDialog,
} from '@/components/ui'
import { formatDate, getInitials } from '@/lib/utils'
import { MapPin, Plus, CalendarDays, Clock, CheckCircle2, AlertTriangle, Trash2, Pencil, Users2 } from 'lucide-react'
import toast from 'react-hot-toast'

const RANGES = [
  { value: '', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
]

const STATUSES = [
  { value: '', label: 'All status' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const SOURCE_LABEL: Record<string, string> = {
  MANUAL: 'Manual',
  MEETING_ASSIGNED: 'Meeting',
  DEAL_DONE: 'Deal',
}

const emptyForm = {
  userId: '', clientId: '', clientName: '', purpose: '',
  scheduledDate: '', scheduledTime: '', location: '', notes: '',
}

export default function VisitsPage() {
  const { user, isAtLeast } = useAuth()
  const isAdmin = isAtLeast('MANAGER')

  const [rows, setRows] = useState<any[]>([])
  const [counts, setCounts] = useState<any>({ pending: 0, today: 0, completed: 0, overdue: 0 })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const [range, setRange] = useState('')
  const [status, setStatus] = useState('')
  const [userId, setUserId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')

  const [people, setPeople] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [delId, setDelId] = useState<string | null>(null)

  const limit = 20
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (range) params.set('range', range)
      if (status) params.set('status', status)
      if (userId) params.set('userId', userId)
      if (!range && dateFrom) params.set('dateFrom', dateFrom)
      if (!range && dateTo) params.set('dateTo', dateTo)
      if (search) params.set('search', search)
      const r = await api.get(`/tracking/visits?${params.toString()}`)
      setRows(r.data.data?.visits || [])
      setCounts(r.data.data?.counts || {})
      setTotal(r.data.total || 0)
    } catch {
      toast.error('Failed to load visits')
    } finally { setLoading(false) }
  }, [page, range, status, userId, dateFrom, dateTo, search])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [range, status, userId, dateFrom, dateTo, search])

  useEffect(() => {
    api.get('/users/by-role?roles=MARKETING_EXECUTIVE').then(r => setPeople(r.data.data || [])).catch(() => {})
    api.get('/clients?limit=200').then(r => setClients(r.data.data || [])).catch(() => {})
  }, [])

  const peopleOptions = useMemo(
    () => [{ value: '', label: 'All executives' }, ...people.map((p: any) => ({ value: p.id, label: p.name }))],
    [people]
  )

  const openCreate = () => {
    setEditId(null)
    setForm({ ...emptyForm, userId: isAdmin ? '' : (user?.id || ''), scheduledDate: new Date().toISOString().slice(0, 10) })
    setOpen(true)
  }

  const openEdit = (v: any) => {
    setEditId(v.id)
    setForm({
      userId: v.userId || '',
      clientId: v.clientId || '',
      clientName: v.clientName || '',
      purpose: v.purpose || '',
      scheduledDate: v.scheduledDate ? new Date(v.scheduledDate).toISOString().slice(0, 10) : '',
      scheduledTime: v.scheduledTime || '',
      location: v.checkInAddress || '',
      notes: v.notes || '',
      status: v.status || 'PENDING',
    })
    setOpen(true)
  }

  const save = async () => {
    if (!form.userId) return toast.error('Select a marketing executive')
    if (!form.clientName?.trim() && !form.clientId) return toast.error('Client name is required')
    if (!form.scheduledDate) return toast.error('Visit date is required')
    setSaving(true)
    try {
      if (editId) {
        await api.put(`/tracking/visits/${editId}`, form)
        toast.success('Visit updated')
      } else {
        await api.post('/tracking/visits', form)
        toast.success('Visit scheduled — executive notified')
      }
      setOpen(false)
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to save visit')
    } finally { setSaving(false) }
  }

  const doDelete = async () => {
    if (!delId) return
    try {
      await api.delete(`/tracking/visits/${delId}`)
      toast.success('Visit deleted')
      setDelId(null)
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to delete')
    }
  }

  const onPickClient = (id: string) => {
    const c = clients.find((x: any) => x.id === id)
    setForm((f: any) => ({
      ...f,
      clientId: id,
      clientName: c ? (c.companyName || c.clientName) : f.clientName,
      location: c?.address || f.location,
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visit Sheet</h1>
          <p className="text-sm text-gray-500 mt-0.5">Field visits — scheduled, auto-created from meetings, and completed deals</p>
        </div>
        <Button variant="primary" onClick={openCreate}><Plus size={16} />Schedule Visit</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Today" value={counts.today ?? 0} icon={CalendarDays} color="blue" />
        <StatCard label="Pending" value={counts.pending ?? 0} icon={Clock} color="amber" />
        <StatCard label="Completed" value={counts.completed ?? 0} icon={CheckCircle2} color="green" />
        <StatCard label="Overdue" value={counts.overdue ?? 0} icon={AlertTriangle} color="red" />
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="grid md:grid-cols-4 gap-3">
          <Select label="Date range" options={RANGES} value={range} onChange={e => setRange(e.target.value)} />
          <Select label="Status" options={STATUSES} value={status} onChange={e => setStatus(e.target.value)} />
          {isAdmin && <Select label="Executive" options={peopleOptions} value={userId} onChange={e => setUserId(e.target.value)} />}
          <div>
            <label className="label">Search</label>
            <SearchInput value={search} onChange={setSearch} placeholder="Client or purpose..." />
          </div>
        </div>
        {!range && (
          <div className="grid md:grid-cols-4 gap-3">
            <Input label="From date" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <Input label="To date" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<MapPin size={48} />} title="No visits found" description="Try changing the filters, or schedule a new visit." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Client</th>
                  <th className="text-left font-semibold px-4 py-3">Executive</th>
                  <th className="text-left font-semibold px-4 py-3">Date / Time</th>
                  <th className="text-left font-semibold px-4 py-3">Source</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                  <th className="text-left font-semibold px-4 py-3">Duration</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map(v => {
                  const overdue = v.scheduledDate && ['PENDING', 'IN_PROGRESS'].includes(v.status)
                    && new Date(v.scheduledDate) < new Date(new Date().toDateString())
                  return (
                    <tr key={v.id} className="border-t border-gray-50 hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{v.clientName}</p>
                        {v.purpose && <p className="text-xs text-gray-400">{v.purpose}</p>}
                        {v.lead?.leadNumber && <span className="text-[10px] text-brand-600">{v.lead.leadNumber}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
                            {getInitials(v.user?.name || '?')}
                          </div>
                          <span className="text-gray-700">{v.user?.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={overdue ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                          {v.scheduledDate ? formatDate(v.scheduledDate) : '—'}
                        </span>
                        {v.scheduledTime && <span className="text-xs text-gray-400 block">{v.scheduledTime}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                          {SOURCE_LABEL[v.source] || v.source}
                        </span>
                        {v.outcome && <span className="text-[11px] text-gray-400 block mt-0.5">{v.outcome.replace(/_/g, ' ')}</span>}
                      </td>
                      <td className="px-4 py-3"><Badge status={v.status} /></td>
                      <td className="px-4 py-3 text-gray-500">{v.durationMins != null ? `${v.durationMins} min` : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(v)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-brand-600"><Pencil size={14} /></button>
                          {isAtLeast('ADMIN') && (
                            <button onClick={() => setDelId(v.id)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}

      {/* Create / Edit modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Edit Visit' : 'Schedule Visit'} className="!max-w-2xl">
        <div className="grid md:grid-cols-2 gap-4">
          <Select
            label="Marketing Executive *"
            options={[{ value: '', label: 'Select executive' }, ...people.map((p: any) => ({ value: p.id, label: p.name }))]}
            value={form.userId}
            onChange={e => setForm((f: any) => ({ ...f, userId: e.target.value }))}
            disabled={!isAdmin}
          />
          <Select
            label="Existing Client (optional)"
            options={[{ value: '', label: '— New / Lead —' }, ...clients.map((c: any) => ({ value: c.id, label: c.companyName || c.clientName }))]}
            value={form.clientId}
            onChange={e => onPickClient(e.target.value)}
          />
          <Input
            label="Client Name *" value={form.clientName} className="md:col-span-2"
            onChange={e => setForm((f: any) => ({ ...f, clientName: e.target.value }))}
            placeholder="Company or client name"
          />
          <Input
            label="Visit Date *" type="date" value={form.scheduledDate}
            onChange={e => setForm((f: any) => ({ ...f, scheduledDate: e.target.value }))}
          />
          <Input
            label="Visit Time" type="time" value={form.scheduledTime}
            onChange={e => setForm((f: any) => ({ ...f, scheduledTime: e.target.value }))}
          />
          <Input
            label="Purpose" value={form.purpose} className="md:col-span-2"
            onChange={e => setForm((f: any) => ({ ...f, purpose: e.target.value }))}
            placeholder="Demo, negotiation, follow-up..."
          />
          <Input
            label="Location" value={form.location} className="md:col-span-2"
            onChange={e => setForm((f: any) => ({ ...f, location: e.target.value }))}
            placeholder="Client address"
          />
          {editId && (
            <Select
              label="Status"
              options={STATUSES.filter(s => s.value)}
              value={form.status}
              onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}
            />
          )}
          <Textarea
            label="Notes" value={form.notes} className="md:col-span-2" rows={3}
            onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))}
          />
        </div>
        <div className="flex justify-end gap-2 pt-5">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={saving}>
            {editId ? 'Save Changes' : 'Schedule & Notify'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!delId}
        onClose={() => setDelId(null)}
        onConfirm={doDelete}
        title="Delete visit?"
        message="This visit will be permanently removed from the sheet."
        danger
      />
    </div>
  )
}
