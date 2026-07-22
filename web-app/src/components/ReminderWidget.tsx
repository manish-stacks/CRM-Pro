'use client'
// Navbar "Reminders" widget — lets an employee jot a personal reminder and
// see what's coming up, without leaving the page. Full history/editing lives
// on the /reminders page (linked at the bottom of this dropdown).
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import api from '@/lib/axios'
import { AlarmClock, Plus, Check, X, Loader2 } from 'lucide-react'

function fmt(d: string | Date) {
  const dt = new Date(d)
  return dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function ReminderWidget() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [remindAt, setRemindAt] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/reminders?status=pending')
      setItems((r.data.data?.items || []).slice(0, 8))
      setPendingCount(r.data.data?.pendingCount || 0)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(() => load(), 60_000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setShowAdd(false) }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const add = async () => {
    if (!title.trim() || !remindAt) return
    setSaving(true)
    try {
      await api.post('/reminders', { title, remindAt })
      setTitle(''); setRemindAt(''); setShowAdd(false)
      load()
    } catch {} finally { setSaving(false) }
  }

  const markDone = async (id: string) => {
    setItems(prev => prev.filter(r => r.id !== id))
    setPendingCount(prev => Math.max(0, prev - 1))
    try { await api.patch(`/reminders/${id}`, { isDone: true }) } catch { load() }
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="relative w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600" title="Reminders">
        <AlarmClock size={16} />
        {pendingCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {pendingCount > 99 ? '99+' : pendingCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 max-h-[75vh] overflow-hidden flex flex-col z-50">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">My Reminders</h3>
              {pendingCount > 0 && <p className="text-xs text-gray-500">{pendingCount} pending</p>}
            </div>
            <button onClick={() => setShowAdd(v => !v)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              <Plus size={12} /> Add
            </button>
          </div>

          {showAdd && (
            <div className="p-3 border-b border-gray-100 space-y-2 bg-gray-50">
              <input className="input text-sm" placeholder="Remind me to..." value={title} onChange={e => setTitle(e.target.value)} />
              <input className="input text-sm" type="datetime-local" value={remindAt} onChange={e => setRemindAt(e.target.value)} />
              <button onClick={add} disabled={saving || !title.trim() || !remindAt} className="btn-primary btn-sm w-full justify-center">
                {saving ? <Loader2 size={13} className="animate-spin" /> : 'Save Reminder'}
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                <AlarmClock size={28} className="mx-auto mb-2 text-gray-300" />
                <p>No pending reminders</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {items.map(r => (
                  <div key={r.id} className="p-3 hover:bg-gray-50 flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                      {r.note && <p className="text-xs text-gray-500 truncate">{r.note}</p>}
                      <p className="text-[10px] text-amber-600 mt-0.5">{fmt(r.remindAt)}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => markDone(r.id)} className="text-emerald-600 hover:bg-emerald-50 rounded p-1" title="Mark done">
                        <Check size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link href="/reminders" onClick={() => setOpen(false)}
            className="block text-center text-xs text-blue-600 hover:underline p-2 border-t border-gray-100">
            View all
          </Link>
        </div>
      )}
    </div>
  )
}
