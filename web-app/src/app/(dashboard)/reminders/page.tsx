'use client'
import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/axios'
import { Button, Input, Textarea, Modal, EmptyState } from '@/components/ui'
import { AlarmClock, Plus, Check, Trash2, Edit3, Loader2, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'

function fmt(d: string | Date) {
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// <input type=datetime-local> needs "YYYY-MM-DDTHH:mm" in local time
function toLocalInput(d: string | Date) {
  const dt = new Date(d)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

export default function RemindersPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pending' | 'done'>('pending')
  const [modal, setModal] = useState<'none' | 'form'>('none')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ title: '', note: '', remindAt: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get(`/reminders?status=${tab}`)
      setItems(r.data.data?.items || [])
    } catch { toast.error('Failed to load reminders') } finally { setLoading(false) }
  }, [tab])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({ title: '', note: '', remindAt: '' })
    setModal('form')
  }

  const openEdit = (r: any) => {
    setEditing(r)
    setForm({ title: r.title, note: r.note || '', remindAt: toLocalInput(r.remindAt) })
    setModal('form')
  }

  const save = async () => {
    if (!form.title.trim()) { toast.error('Title required'); return }
    if (!form.remindAt) { toast.error('Pick a date & time'); return }
    setSaving(true)
    try {
      if (editing) {
        await api.patch(`/reminders/${editing.id}`, form)
        toast.success('Reminder updated')
      } else {
        await api.post('/reminders', form)
        toast.success('Reminder added')
      }
      setModal('none')
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const toggleDone = async (r: any) => {
    setItems(prev => prev.filter(x => x.id !== r.id))
    try {
      await api.patch(`/reminders/${r.id}`, { isDone: !r.isDone })
      toast.success(r.isDone ? 'Marked pending' : 'Marked done')
    } catch { toast.error('Failed'); load() }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this reminder?')) return
    try {
      await api.delete(`/reminders/${id}`)
      setItems(prev => prev.filter(x => x.id !== id))
      toast.success('Deleted')
    } catch { toast.error('Failed') }
  }

  const isOverdue = (r: any) => !r.isDone && new Date(r.remindAt) < new Date()

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><AlarmClock size={22} /> My Reminders</h1>
          <p className="text-sm text-gray-500 mt-1">Personal to-dos — you'll get a notification when the time arrives</p>
        </div>
        <Button onClick={openCreate}><Plus size={14} /> New Reminder</Button>
      </div>

      <div className="card">
        <div className="border-b border-gray-100 flex items-center">
          {[{ key: 'pending', label: 'Pending' }, { key: 'done', label: 'Completed' }].map((t: any) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>
          ) : items.length === 0 ? (
            <EmptyState icon={<AlarmClock size={40} />} title={tab === 'pending' ? 'No pending reminders' : 'Nothing completed yet'}
              description="Create a reminder and get notified right on time" />
          ) : items.map((r: any) => (
            <div key={r.id} className="p-4 flex items-start gap-3 hover:bg-gray-50">
              <button onClick={() => toggleDone(r)}
                className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${r.isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 text-transparent hover:border-emerald-400'}`}
                title={r.isDone ? 'Mark pending' : 'Mark done'}>
                {r.isDone ? <Check size={13} /> : <RotateCcw size={11} />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${r.isDone ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{r.title}</p>
                {r.note && <p className="text-xs text-gray-500 mt-0.5">{r.note}</p>}
                <p className={`text-xs mt-1 ${isOverdue(r) ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                  {isOverdue(r) ? 'Overdue — ' : ''}{fmt(r.remindAt)}
                </p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(r)} className="btn-ghost btn-sm !p-1.5" title="Edit"><Edit3 size={13} /></button>
                <button onClick={() => remove(r.id)} className="btn-ghost btn-sm !p-1.5" title="Delete"><Trash2 size={13} className="text-red-500" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={modal === 'form'} onClose={() => setModal('none')} title={editing ? 'Edit Reminder' : 'New Reminder'}>
        <div className="space-y-3">
          <Input label="Title *" placeholder="Remind me to..." value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          <Textarea label="Note" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} rows={2} placeholder="Optional details" />
          <div>
            <label className="label">Remind at *</label>
            <input type="datetime-local" className="input" value={form.remindAt} onChange={e => setForm(p => ({ ...p, remindAt: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing ? 'Save Changes' : 'Add Reminder'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
