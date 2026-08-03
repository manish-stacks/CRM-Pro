'use client'
// Floating "new message" popup — shows for new chat + ticket notifications no
// matter which page the user is currently on, so replies get seen quickly.
// Mounted once in the dashboard layout (see (dashboard)/layout.tsx).
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/axios'
import { MessageCircle, X, Ticket } from 'lucide-react'

const POLL_MS = 10_000       // how often we check for new notifications
const AUTO_DISMISS_MS = 8_000
const POPUP_TYPES = new Set(['chat', 'ticket'])

interface Toast {
  id: string
  title: string
  message: string
  link?: string | null
  type: string
}

function getInitials(name?: string) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export function ChatNotificationPopup() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const router = useRouter()
  const lastSeenAt = useRef<string | null>(null)
  const shownIds = useRef<Set<string>>(new Set())
  const initialized = useRef(false)

  const poll = useCallback(async () => {
    try {
      const r = await api.get('/notifications?limit=15')
      const items: any[] = r.data?.data?.items || []
      if (!items.length) { initialized.current = true; return }

      // First poll: just establish the baseline, don't pop up old notifications.
      if (!initialized.current) {
        lastSeenAt.current = items[0].createdAt
        initialized.current = true
        return
      }

      const fresh = items.filter(n =>
        POPUP_TYPES.has(n.type) &&
        !shownIds.current.has(n.id) &&
        (!lastSeenAt.current || new Date(n.createdAt) > new Date(lastSeenAt.current))
      )
      if (fresh.length) {
        lastSeenAt.current = items[0].createdAt
        fresh.forEach(n => shownIds.current.add(n.id))
        setToasts(prev => [...fresh.slice(0, 3), ...prev].slice(0, 3))
      }
    } catch { /* silent — this is a best-effort UI nicety */ }
  }, [])

  useEffect(() => {
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => clearInterval(id)
  }, [poll])

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  useEffect(() => {
    if (!toasts.length) return
    const timers = toasts.map(t => setTimeout(() => dismiss(t.id), AUTO_DISMISS_MS))
    return () => timers.forEach(clearTimeout)
  }, [toasts])

  const open = (t: Toast) => {
    dismiss(t.id)
    if (t.link) router.push(t.link)
  }

  if (!toasts.length) return null

  return (
    <div className="fixed bottom-4 right-4 z-[999] flex flex-col gap-2 w-[320px]">
      {toasts.map(t => (
        <div
          key={t.id}
          onClick={() => open(t)}
          className="bg-white border border-gray-200 shadow-lg rounded-xl p-3 flex items-start gap-3 cursor-pointer hover:shadow-xl transition-shadow"
        >
          <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {t.type === 'ticket' ? <Ticket size={16} /> : getInitials(t.title)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1">
              <MessageCircle size={12} className="text-brand-500 flex-shrink-0" />
              {t.title}
            </p>
            <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{t.message}</p>
          </div>
          <button
            onClick={e => { e.stopPropagation(); dismiss(t.id) }}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
