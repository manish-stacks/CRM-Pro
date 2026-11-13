'use client'
// Bridges our in-app notifications to real OS-level notifications — the
// same little toast Chrome/Windows/macOS show for Gmail, Slack, etc.
// Mounted once near the root of the dashboard so it keeps working no
// matter which page is open, not just when the bell dropdown is open.
//
// In the desktop app (Electron), it seamlessly uses native desktop notifications,
// sound chimes, taskbar flashing, and native download notifications.
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/axios'
import { BRAND } from '@/lib/branding'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

const POLL_MS = 15_000
const SEEN_KEY = 'hbs_notif_last_seen_at'

export function BrowserNotifications() {
  const { user } = useAuth()
  const router = useRouter()
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const cutoffRef = useRef<string | null>(null)

  // Listen to desktop app events (navigation on notification click, download toasts)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const electron = (window as any).electronAPI
    if (electron?.isDesktop) {
      const unsubNav = electron.onNavigate?.((link: string) => {
        if (link) router.push(link)
      })
      const unsubDlStart = electron.onDownloadStarted?.(({ fileName }: { fileName: string }) => {
        toast.loading(`Downloading ${fileName}...`, { duration: 3000, id: `dl-${fileName}` })
      })
      const unsubDlDone = electron.onDownloadCompleted?.(({ fileName }: { fileName: string }) => {
        toast.dismiss(`dl-${fileName}`)
        toast.success(`Report downloaded: ${fileName}`)
      })
      const unsubDlFail = electron.onDownloadFailed?.(({ fileName }: { fileName: string }) => {
        toast.dismiss(`dl-${fileName}`)
        toast.error(`Download failed: ${fileName}`)
      })

      return () => {
        unsubNav?.()
        unsubDlStart?.()
        unsubDlDone?.()
        unsubDlFail?.()
      }
    }
  }, [router])

  // Ask once per session in web browser.
  useEffect(() => {
    if (!user) return
    if (typeof window === 'undefined') return
    const electron = (window as any).electronAPI
    if (electron?.isDesktop) {
      setPermission('granted')
      return
    }

    if (!('Notification' in window)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission)
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(setPermission).catch(() => {})
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    const electron = typeof window !== 'undefined' ? (window as any).electronAPI : null
    const isDesktop = !!electron?.isDesktop

    if (!isDesktop && permission !== 'granted') return

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
          if (isDesktop && electron.showNotification) {
            electron.showNotification({
              title: n.title,
              body: n.message || '',
              link: n.link || undefined,
            })
          } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const notif = new Notification(n.title, {
              body: n.message || '',
              icon: BRAND.logoUrl,
              tag: n.id,
            })
            notif.onclick = () => {
              window.focus()
              if (n.link) router.push(n.link)
              notif.close()
            }
          }
        }

        const newest = fresh[fresh.length - 1].createdAt
        cutoffRef.current = newest
        localStorage.setItem(SEEN_KEY, newest)
      } catch {
        // Silent background check
      }
    }

    poll()
    const t = setInterval(poll, POLL_MS)
    return () => { cancelled = true; clearInterval(t) }
  }, [user, permission, router])

  return null
}
