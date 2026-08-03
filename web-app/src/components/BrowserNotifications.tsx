'use client'
// Bridges our in-app notifications to real OS-level notifications — the
// same little toast Chrome/Windows/macOS show for Gmail, Slack, etc.
// Mounted once near the root of the dashboard so it keeps working no
// matter which page is open, not just when the bell dropdown is open.
//
// Bonus: this also "just works" inside the Electron desktop app with zero
// extra Electron code — Chromium (which Electron embeds) implements the
// same window.Notification API and routes it straight to the OS's native
// notification center.
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/axios'
import { useAuth } from '@/hooks/useAuth'

const POLL_MS = 20_000
const SEEN_KEY = 'hbs_notif_last_seen_at'

export function BrowserNotifications() {
  const { user } = useAuth()
  const router = useRouter()
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const cutoffRef = useRef<string | null>(null)

  // Ask once per session. Browsers ignore repeat calls if the person
  // already granted/blocked it, so this is safe to run on every mount.
  useEffect(() => {
    if (!user) return
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission)
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(setPermission).catch(() => {})
    }
  }, [user])

  useEffect(() => {
    if (!user || permission !== 'granted') return

    // Don't blast every historical unread notification the moment someone
    // grants permission — only notify for things that arrive from now on.
    // Persisted so a page refresh a few seconds later doesn't re-fire the
    // same ones either.
    if (!cutoffRef.current) {
      cutoffRef.current = localStorage.getItem(SEEN_KEY) || new Date().toISOString()
    }

    let cancelled = false
    const poll = async () => {
      try {
        const r = await api.get('/notifications?limit=20&unread=true')
        const items: any[] = r.data?.data?.items || []
        if (cancelled || items.length === 0) return

        const cutoff = cutoffRef.current!
        const fresh = items.filter(n => n.createdAt > cutoff).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        if (fresh.length === 0) return

        for (const n of fresh) {
          const notif = new Notification(n.title, {
            body: n.message || '',
            icon: '/images/hbs-logo.png',
            tag: n.id, // de-dupes if the same notification is polled twice
          })
          notif.onclick = () => {
            window.focus()
            if (n.link) router.push(n.link)
            notif.close()
          }
        }

        const newest = fresh[fresh.length - 1].createdAt
        cutoffRef.current = newest
        localStorage.setItem(SEEN_KEY, newest)
      } catch {
        // Silent — this is a background enhancement, not core functionality.
      }
    }

    poll()
    const t = setInterval(poll, POLL_MS)
    return () => { cancelled = true; clearInterval(t) }
  }, [user, permission, router])

  return null
}
