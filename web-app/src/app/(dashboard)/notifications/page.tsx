'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import api from '@/lib/axios'
import { Button, EmptyState, Pagination } from '@/components/ui'
import { Bell, Check, X, ExternalLink, Loader2, Filter } from 'lucide-react'
import toast from 'react-hot-toast'

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
  return new Date(d).toLocaleString('en-IN')
}

export default function NotificationsPage() {
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [unread, setUnread] = useState(0)
  const [page, setPage] = useState(1)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get(`/notifications?page=${page}&limit=30${unreadOnly ? '&unread=true' : ''}`)
      const d = r.data.data
      setItems(d.items || [])
      setTotal(d.total || 0)
      setUnread(d.unreadCount || 0)
    } catch {} finally { setLoading(false) }
  }, [page, unreadOnly])

  useEffect(() => { load() }, [load])

  const markAll = async () => {
    await api.post('/notifications', { markAllRead: true })
    toast.success('All marked as read')
    load()
  }

  const markOne = async (id: string) => {
    await api.patch(`/notifications/${id}`)
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    setUnread(prev => Math.max(0, prev - 1))
  }

  const del = async (id: string) => {
    await api.delete(`/notifications/${id}`)
    load()
  }

  return (
    <div className="space-y-5 mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">{unread} unread of {total} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setUnreadOnly(!unreadOnly); setPage(1) }}
            className={`btn-secondary btn-sm ${unreadOnly ? 'border-blue-500 text-blue-600' : ''}`}>
            <Filter size={13} /> {unreadOnly ? 'Unread only' : 'All'}
          </button>
          {unread > 0 && <Button size="sm" onClick={markAll}><Check size={13} /> Mark all read</Button>}
        </div>
      </div>

      <div className="card divide-y divide-gray-100">
        {loading ? (
          <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Bell size={48} />} title="No notifications" description={unreadOnly ? "You've read everything!" : "Nothing here yet"} />
        ) : items.map(n => (
          <div key={n.id} className={`p-4 flex items-start gap-3 ${!n.isRead ? 'bg-blue-50/40' : ''}`}>
            <div className="text-xl flex-shrink-0 mt-0.5">{TYPE_ICONS[n.type] || '🔔'}</div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${!n.isRead ? 'font-semibold' : ''}`}>{n.title}</p>
              <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <p className="text-[10px] text-gray-400">{timeAgo(n.createdAt)}</p>
                {n.link && (
                  <Link href={n.link} onClick={() => markOne(n.id)}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                    View <ExternalLink size={9} />
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!n.isRead && (
                <button onClick={() => markOne(n.id)} className="text-emerald-600 hover:bg-emerald-50 rounded p-1.5" title="Mark read">
                  <Check size={13} />
                </button>
              )}
              <button onClick={() => del(n.id)} className="text-red-500 hover:bg-red-50 rounded p-1.5" title="Delete">
                <X size={13} />
              </button>
            </div>
          </div>
        ))}
        <div className="px-5 py-3">
          <Pagination page={page} totalPages={Math.ceil(total / 30)} onChange={setPage} />
        </div>
      </div>
    </div>
  )
}
