'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import { Button, Input, Select, Textarea, Modal, EmptyState, Pagination, Badge } from '@/components/ui'
import { formatDate, getInitials } from '@/lib/utils'
import { AlertCircle, Plus, MessageSquare, Loader2, User, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const CATEGORIES = ['LEAVE_ISSUE', 'HARDWARE', 'ACCESS', 'PAYROLL', 'GENERAL', 'HR', 'IT']

export default function MyTicketsPage() {
  const { user } = useAuth()

  const [tickets, setTickets] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'created' | 'assigned' | 'all'>('created')

  const [departments, setDepartments] = useState<any[]>([])
  const [modal, setModal] = useState<'none' | 'create'>('none')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    subject: '', description: '', priority: 'MEDIUM', category: '',
    departmentId: '',
  })

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get(`/employee-tickets?page=${page}&limit=20&mode=${mode}`)
      setTickets(r.data.data || [])
      setTotal(r.data.total || 0)
    } catch { toast.error('Failed') }
    finally { setLoading(false) }
  }, [page, mode])

  useEffect(() => { fetch_() }, [fetch_])
  useEffect(() => {
    api.get('/departments').then(r => setDepartments(r.data.data || [])).catch(() => { })
  }, [])

  const create = async () => {
    if (!form.subject || !form.description || !form.departmentId) {
      toast.error('Subject, description, department required'); return
    }
    setSaving(true)
    try {
      await api.post('/employee-tickets', form)
      toast.success('Ticket raised')
      setModal('none')
      setForm({ subject: '', description: '', priority: 'MEDIUM', category: '', departmentId: '' })
      fetch_()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tickets</h1>
          <p className="text-sm text-gray-500 mt-1">Internal tickets — raise or resolve issues within HBS</p>
        </div>
        <Button onClick={() => setModal('create')}><Plus size={14} /> Raise Ticket</Button>
      </div>

      <div className="card">
        <div className="border-b border-gray-100 flex items-center gap-1 px-2 py-2">
          {[
            { key: 'created', label: 'Raised by me' },
            { key: 'assigned', label: 'Assigned to me' },
            { key: 'all', label: 'All (my dept)' },
          ].map((t: any) => (
            <button key={t.key} onClick={() => { setMode(t.key); setPage(1) }}
              className={`px-4 py-1.5 text-sm rounded-md ${mode === t.key ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Ticket#</th>
                <th>Subject</th>
                <th>Department</th>
                <th>Raised By</th>
                <th>Assigned To</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8"><Loader2 className="animate-spin inline text-gray-400" /></td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon={<AlertCircle size={40} />} title="No tickets" description="Raise a ticket if you need help from another dept" /></td></tr>
              ) : tickets.map((t: any) => (
                <tr key={t.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => window.location.href = `/my-tickets/${t.id}`}>
                  <td className="font-mono text-xs">{t.ticketNumber}</td>
                  <td>
                    <p className="font-medium text-sm">{t.subject}</p>
                    {t._count?.replies > 0 && <p className="text-xs text-gray-500">{t._count.replies} replies</p>}
                  </td>
                  <td><span className="badge bg-slate-100 text-slate-700 text-xs">{t.department?.name}</span></td>
                  <td className="text-xs">{t.createdBy?.name}</td>
                  <td className="text-xs">{t.assignedTo?.name || '—'}</td>
                  <td><Badge status={t.priority} /></td>
                  <td><Badge status={t.status} /></td>
                  <td className="text-xs text-gray-500">{formatDate(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100">
          <Pagination page={page} totalPages={Math.ceil(total / 20)} onChange={setPage} />
        </div>
      </div>

      <Modal open={modal === 'create'} onClose={() => setModal('none')} title="Raise Internal Ticket">
        <div className="space-y-3">
          <Input label="Subject *" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
            placeholder="e.g. Laptop screen flickering" />
          <Textarea label="Description *" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={4}
            placeholder="Describe the issue in detail..." />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Send to Department *" value={form.departmentId} onChange={e => setForm(p => ({ ...p, departmentId: e.target.value }))} options={departments.map((d: any) => ({ value: d.id, label: d.name }))} />
            <Select label="Priority" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} options={PRIORITIES.map(p => ({ value: p, label: p }))} />
          </div>
          <Select label="Category" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} options={CATEGORIES.map(c => ({ value: c, label: c.replace(/_/g, ' ') }))} />

          <p className="text-xs text-gray-500">The dept manager will be automatically notified and assigned.</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button onClick={create} loading={saving}>Raise Ticket</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
