'use client'
// Navbar "Sticky Notes" widget — quick personal scratchpad (login IDs,
// references, anything). No date attached, unlike ReminderWidget. Full
// management (color, pin, edit) lives on the /notes page.
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import api from '@/lib/axios'
import { StickyNote, Plus, Copy, Pin, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const COLOR_DOTS: Record<string, string> = {
  yellow: 'bg-yellow-400', blue: 'bg-blue-400', green: 'bg-emerald-400',
  pink: 'bg-pink-400', purple: 'bg-purple-400', orange: 'bg-orange-400',
}
const CARD_BG: Record<string, string> = {
  yellow: 'bg-yellow-50', blue: 'bg-blue-50', green: 'bg-emerald-50',
  pink: 'bg-pink-50', purple: 'bg-purple-50', orange: 'bg-orange-50',
}

export function NoteWidget() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [color, setColor] = useState('yellow')
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/notes')
      setItems((r.data.data || []).slice(0, 8))
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { if (open) load() }, [open, load])

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setShowAdd(false) }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const add = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      await api.post('/notes', { title, content, color })
      setTitle(''); setContent(''); setColor('yellow'); setShowAdd(false)
      load()
    } catch { toast.error('Failed to save') } finally { setSaving(false) }
  }

  const copy = async (n: any) => {
    try { await navigator.clipboard.writeText(n.content || ''); toast.success('Copied') } catch {}
  }

  const togglePin = async (n: any) => {
    setItems(prev => prev.map(x => x.id === n.id ? { ...x, pinned: !x.pinned } : x))
    try { await api.patch(`/notes/${n.id}`, { pinned: !n.pinned }) } catch { load() }
  }

  const remove = async (id: string) => {
    setItems(prev => prev.filter(x => x.id !== id))
    try { await api.delete(`/notes/${id}`) } catch { load() }
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="relative w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600" title="Sticky Notes">
        <StickyNote size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 max-h-[75vh] overflow-hidden flex flex-col z-50">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Sticky Notes</h3>
            <button onClick={() => setShowAdd(v => !v)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              <Plus size={12} /> Add
            </button>
          </div>

          {showAdd && (
            <div className="p-3 border-b border-gray-100 space-y-2 bg-gray-50">
              <input className="input text-sm" placeholder="Title (e.g. Hostinger login)" value={title} onChange={e => setTitle(e.target.value)} />
              <textarea className="input text-sm" rows={3} placeholder="Content..." value={content} onChange={e => setContent(e.target.value)} />
              <div className="flex items-center gap-1.5">
                {Object.keys(COLOR_DOTS).map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className={`w-5 h-5 rounded-full ${COLOR_DOTS[c]} ${color === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`} />
                ))}
              </div>
              <button onClick={add} disabled={saving || !title.trim()} className="btn-primary btn-sm w-full justify-center">
                {saving ? <Loader2 size={13} className="animate-spin" /> : 'Save Note'}
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {loading ? (
              <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                <StickyNote size={28} className="mx-auto mb-2 text-gray-300" />
                <p>No notes yet</p>
              </div>
            ) : items.map(n => (
              <div key={n.id} className={`rounded-lg border border-black/5 p-2.5 ${CARD_BG[n.color] || CARD_BG.yellow}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                  <button onClick={() => togglePin(n)} className={`flex-shrink-0 ${n.pinned ? 'text-amber-600' : 'text-gray-400'}`}>
                    <Pin size={11} fill={n.pinned ? 'currentColor' : 'none'} />
                  </button>
                </div>
                {n.content && <p className="text-xs text-gray-600 mt-0.5 line-clamp-2 whitespace-pre-wrap">{n.content}</p>}
                <div className="flex items-center gap-1 mt-1.5">
                  <button onClick={() => copy(n)} className="text-gray-500 hover:bg-black/5 rounded p-1" title="Copy"><Copy size={11} /></button>
                  <button onClick={() => remove(n.id)} className="text-red-500 hover:bg-red-500/10 rounded p-1 ml-auto" title="Delete"><Trash2 size={11} /></button>
                </div>
              </div>
            ))}
          </div>

          <Link href="/notes" onClick={() => setOpen(false)}
            className="block text-center text-xs text-blue-600 hover:underline p-2 border-t border-gray-100">
            View all
          </Link>
        </div>
      )}
    </div>
  )
}
