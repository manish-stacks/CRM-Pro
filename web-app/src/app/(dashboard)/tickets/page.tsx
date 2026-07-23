'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import api from '@/lib/axios'
import { useAuth } from '@/hooks/useAuth'
import { Button, Input, Select, Textarea, Modal, EmptyState, Pagination, Badge } from '@/components/ui'
import { formatDate, getInitials } from '@/lib/utils'
import { MessageSquare, Plus, Search, Filter, Loader2, AlertCircle, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED']
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

export default function TicketsPage() {
  const { user, isAtLeast } = useAuth()

  const [tickets, setTickets] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ search: '', status: '', priority: '', departmentId: '' })

  const [clients, setClients] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])

  const [modal, setModal] = useState<'none' | 'create'>('none')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    clientId: '', subject: '', description: '', priority: 'MEDIUM',
    category: '', departmentId: '', assignedToId: '',
  })

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const p: Record<string, string> = { page: String(page), limit: '20' }
      Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v })
      const r = await api.get(`/tickets?${new URLSearchParams(p)}`)
      setTickets(r.data.data || [])
      setTotal(r.data.total || 0)
    } catch { toast.error('Failed') }
    finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { fetch_() }, [fetch_])
  useEffect(() => {
    api.get('/clients?limit=200').then(r => setClients(r.data.data || [])).catch(() => { })
    api.get('/departments').then(r => setDepartments(r.data.data || [])).catch(() => { })
    if (isAtLeast('MANAGER')) {
      api.get('/users/by-role?roles=EMPLOYEE,MANAGER,ADMIN').then(r => setUsers(r.data.data || [])).catch(() => { })
    }
  }, [isAtLeast])

  const create = async () => {
    if (!form.clientId || !form.subject || !form.description) {
      toast.error('Client, subject, description required'); return
    }
    setSaving(true)
    try {
      await api.post('/tickets', form)
      toast.success('Ticket created')
      setModal('none')
      fetch_()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
          <p className="text-sm text-gray-500 mt-1">Client-raised issues and requests</p>
        </div>
        <Button onClick={() => setModal('create')}><Plus size={14} /> New Ticket</Button>
      </div>

      <div className="card">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" className="input pl-9 text-sm" placeholder="Search ticket#, subject, client"
              value={filters.search} onChange={e => { setFilters(p => ({ ...p, search: e.target.value })); setPage(1) }} />
          </div>
          <select value={filters.status} onChange={e => { setFilters(p => ({ ...p, status: e.target.value })); setPage(1) }} className="max-w-xs input">
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <select value={filters.priority} onChange={e => { setFilters(p => ({ ...p, priority: e.target.value })); setPage(1) }} className="max-w-xs input">
            <option value="">All priorities</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filters.departmentId} onChange={e => { setFilters(p => ({ ...p, departmentId: e.target.value })); setPage(1) }} className="max-w-xs input">
            <option value="">All departments</option>
            {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <span className="text-xs text-gray-500 ml-auto">{total} tickets</span>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Ticket#</th>
                <th>Subject</th>
                <th>Client</th>
                <th>Department</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assigned</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-8"><Loader2 className="animate-spin inline text-gray-400" /></td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan={9}><EmptyState icon={<MessageSquare size={48} />} title="No tickets" description="No tickets match your filters" /></td></tr>
              ) : tickets.map((t: any) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="font-mono text-xs">{t.ticketNumber}</td>
                  <td>
                    <p className="font-medium text-sm">{t.subject}</p>
                    {t._count?.replies > 0 && <p className="text-xs text-gray-500">{t._count.replies} replies</p>}
                  </td>
                  <td className="text-sm">
                    {t.client?.clientName}
                    <p className="text-xs text-gray-500">{t.client?.companyName}</p>
                  </td>
                  <td>{t.department?.name ? <span className="badge bg-slate-100 text-slate-700 text-xs">{t.department.name}</span> : <span className="text-xs text-gray-400">—</span>}</td>
                  <td><Badge status={t.priority} /></td>
                  <td><Badge status={t.status} /></td>
                  <td className="text-sm">
                    {t.assignedTo ? (
                      <div className="flex items-center gap-1">
                        <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">{getInitials(t.assignedTo.name)}</div>
                        <span className="text-xs">{t.assignedTo.name}</span>
                      </div>
                    ) : <span className="text-xs text-gray-400">Unassigned</span>}
                  </td>
                  <td className="text-xs text-gray-500">{formatDate(t.createdAt)}</td>
                  <td className="text-right">
                    <Link href={`/tickets/${t.id}`} className="text-xs text-brand-600 hover:underline">Open</Link>
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

      <Modal open={modal === 'create'} onClose={() => setModal('none')} title="New Support Ticket">
        <div className="space-y-3">
          <Select label="Client *" value={form.clientId} onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))} options={clients.map((c: any) => ({ value: c.id, label: `${c.clientName} — ${c.companyName}` }))} />
          <Input label="Subject *" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} />
          <Textarea label="Description *" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={4} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Priority" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} options={PRIORITIES.map(p => ({ value: p, label: p }))} />
            <Input label="Category" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="Bug, Feature, Support" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Department" value={form.departmentId} onChange={e => setForm(p => ({ ...p, departmentId: e.target.value }))} options={departments.map((d: any) => ({ value: d.id, label: d.name }))} />
            <Select label="Assign to" value={form.assignedToId} onChange={e => setForm(p => ({ ...p, assignedToId: e.target.value }))} options={users.map((u: any) => ({ value: u.id, label: u.name }))} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button onClick={create} loading={saving}>Create Ticket</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
