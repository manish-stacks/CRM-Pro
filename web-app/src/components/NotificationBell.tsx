'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import api from '@/lib/axios'
import { Bell, Check, X, ExternalLink, Loader2 } from 'lucide-react'

const TYPE_ICONS: Record<string, string> = {
  info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌',
  birthday: '🎂', anniversary: '🎊', lead: '📞', meeting: '🎯',
  ticket: '🎫', payment: '💰', report: '📊',
}

function timeAgo(d: string | Date) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(d).toLocaleDateString('en-IN')
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async (unreadOnly = false) => {
    setLoading(true)
    try {
      const r = await api.get(`/notifications?limit=20${unreadOnly ? '&unread=true' : ''}`)
      const d = r.data.data
      setItems(d.items || [])
      setUnread(d.unreadCount || 0)
    } catch {} finally { setLoading(false) }
  }, [])

  // Initial load + poll every 30s
  useEffect(() => {
    load()
    const t = setInterval(() => load(), 30_000)
    return () => clearInterval(t)
  }, [load])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const markAllRead = async () => {
    await api.post('/notifications', { markAllRead: true })
    load()
  }

  const markOne = async (id: string) => {
    await api.patch(`/notifications/${id}`)
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    setUnread(prev => Math.max(0, prev - 1))
  }

  const del = async (id: string) => {
    await api.delete(`/notifications/${id}`)
    setItems(prev => prev.filter(n => n.id !== id))
    load()
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="relative w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600">
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 max-h-[80vh] overflow-hidden flex flex-col z-50">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
              {unread > 0 && <p className="text-xs text-gray-500">{unread} unread</p>}
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                <Bell size={28} className="mx-auto mb-2 text-gray-300" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {items.map(n => (
                  <div key={n.id} className={`p-3 hover:bg-gray-50 flex items-start gap-3 ${!n.isRead ? 'bg-blue-50/40' : ''}`}>
                    <div className="text-lg flex-shrink-0 mt-0.5">{TYPE_ICONS[n.type] || '🔔'}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{n.title}</p>
                      <p className="text-xs text-gray-600 truncate">{n.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-gray-400">{timeAgo(n.createdAt)}</p>
                        {n.link && (
                          <Link href={n.link} onClick={() => { markOne(n.id); setOpen(false) }}
                            className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5">
                            View <ExternalLink size={9} />
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {!n.isRead && (
                        <button onClick={() => markOne(n.id)} className="text-emerald-600 hover:bg-emerald-50 rounded p-1" title="Mark read">
                          <Check size={11} />
                        </button>
                      )}
                      <button onClick={() => del(n.id)} className="text-red-500 hover:bg-red-50 rounded p-1" title="Delete">
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link href="/notifications" onClick={() => setOpen(false)}
            className="block text-center text-xs text-blue-600 hover:underline p-2 border-t border-gray-100">
            View all
          </Link>
        </div>
      )}
    </div>
  )
}
