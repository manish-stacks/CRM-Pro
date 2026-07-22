'use client'
import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/axios'
import { Button, Input, Textarea, Modal, EmptyState } from '@/components/ui'
import { StickyNote, Plus, Pin, Copy, Trash2, Edit3, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const COLORS: Record<string, string> = {
  yellow: 'bg-yellow-50 border-yellow-200',
  blue: 'bg-blue-50 border-blue-200',
  green: 'bg-emerald-50 border-emerald-200',
  pink: 'bg-pink-50 border-pink-200',
  purple: 'bg-purple-50 border-purple-200',
  orange: 'bg-orange-50 border-orange-200',
}
const COLOR_DOTS: Record<string, string> = {
  yellow: 'bg-yellow-400', blue: 'bg-blue-400', green: 'bg-emerald-400',
  pink: 'bg-pink-400', purple: 'bg-purple-400', orange: 'bg-orange-400',
}

export default function NotesPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'none' | 'form'>('none')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ title: '', content: '', color: 'yellow' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/notes')
      setItems(r.data.data || [])
    } catch { toast.error('Failed to load notes') } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({ title: '', content: '', color: 'yellow' })
    setModal('form')
  }

  const openEdit = (n: any) => {
    setEditing(n)
    setForm({ title: n.title, content: n.content || '', color: n.color || 'yellow' })
    setModal('form')
  }

  const save = async () => {
    if (!form.title.trim()) { toast.error('Title required'); return }
    setSaving(true)
    try {
      if (editing) {
        await api.patch(`/notes/${editing.id}`, form)
        toast.success('Note updated')
      } else {
        await api.post('/notes', form)
        toast.success('Note saved')
      }
      setModal('none')
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const togglePin = async (n: any) => {
    setItems(prev => prev.map(x => x.id === n.id ? { ...x, pinned: !x.pinned } : x))
    try { await api.patch(`/notes/${n.id}`, { pinned: !n.pinned }); load() } catch { toast.error('Failed'); load() }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this note?')) return
    try {
      await api.delete(`/notes/${id}`)
      setItems(prev => prev.filter(x => x.id !== id))
      toast.success('Deleted')
    } catch { toast.error('Failed') }
  }

  const copy = async (n: any) => {
    try {
      await navigator.clipboard.writeText(n.content || '')
      toast.success('Copied to clipboard')
    } catch { toast.error('Copy failed') }
  }

  const pinned = items.filter(n => n.pinned)
  const rest = items.filter(n => !n.pinned)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><StickyNote size={22} /> Sticky Notes</h1>
          <p className="text-sm text-gray-500 mt-1">Your private scratchpad — logins, references, quick data. Only you can see these.</p>
        </div>
        <Button onClick={openCreate}><Plus size={14} /> New Note</Button>
      </div>

      {loading ? (
        <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<StickyNote size={40} />} title="No notes yet" description="Jot down a login ID, a reference, or anything you want to keep handy" />
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Pinned</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {pinned.map(n => (
                  <NoteCard key={n.id} n={n} onEdit={openEdit} onPin={togglePin} onDelete={remove} onCopy={copy} />
                ))}
              </div>
            </div>
          )}
          {rest.length > 0 && (
            <div>
              {pinned.length > 0 && <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 mt-4">Others</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {rest.map(n => (
                  <NoteCard key={n.id} n={n} onEdit={openEdit} onPin={togglePin} onDelete={remove} onCopy={copy} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={modal === 'form'} onClose={() => setModal('none')} title={editing ? 'Edit Note' : 'New Sticky Note'}>
        <div className="space-y-3">
          <Input label="Title *" placeholder="e.g. Hostinger login" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          <Textarea label="Content" value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={5}
            placeholder={'e.g.\nUsername: admin\nPassword: ****'} />
          <div>
            <label className="label">Color</label>
            <div className="flex gap-2 mt-1">
              {Object.keys(COLORS).map(c => (
                <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
                  className={`w-7 h-7 rounded-full ${COLOR_DOTS[c]} ${form.color === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`} />
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-400">Note: this is stored as plain text, not encrypted — avoid using it for anything highly sensitive.</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing ? 'Save Changes' : 'Save Note'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function NoteCard({ n, onEdit, onPin, onDelete, onCopy }: any) {
  return (
    <div className={`rounded-xl border p-3 shadow-sm flex flex-col ${COLORS[n.color] || COLORS.yellow}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-semibold text-sm text-gray-900 break-words">{n.title}</p>
        <button onClick={() => onPin(n)} className={`flex-shrink-0 p-1 rounded hover:bg-black/5 ${n.pinned ? 'text-amber-600' : 'text-gray-400'}`} title={n.pinned ? 'Unpin' : 'Pin'}>
          <Pin size={13} fill={n.pinned ? 'currentColor' : 'none'} />
        </button>
      </div>
      <p className="text-xs text-gray-700 whitespace-pre-wrap break-words flex-1 mb-2">{n.content || <span className="text-gray-400">No content</span>}</p>
      <div className="flex items-center gap-1 mt-auto pt-1 border-t border-black/5">
        <button onClick={() => onCopy(n)} className="text-gray-500 hover:bg-black/5 rounded p-1.5" title="Copy content"><Copy size={12} /></button>
        <button onClick={() => onEdit(n)} className="text-gray-500 hover:bg-black/5 rounded p-1.5" title="Edit"><Edit3 size={12} /></button>
        <button onClick={() => onDelete(n.id)} className="text-red-500 hover:bg-red-500/10 rounded p-1.5 ml-auto" title="Delete"><Trash2 size={12} /></button>
      </div>
    </div>
  )
}
