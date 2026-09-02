'use client'
import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Bell, X } from 'lucide-react'
import api from '@/lib/axios'

const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
}
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || ''

const DISMISS_KEY = 'webpush-prompt-dismissed'

export default function WebPushRegistrar() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [busy, setBusy] = useState(false)

  const supported = typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && !!FIREBASE_CONFIG.projectId
    && !!VAPID_KEY

  const register = useCallback(async () => {
    // Dynamic import — the Firebase web SDK never lands in the initial bundle,
    // and never runs during SSR.
    const { initializeApp, getApps } = await import('firebase/app')
    const { getMessaging, getToken, onMessage, isSupported } = await import('firebase/messaging')

    if (!(await isSupported())) return

    const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG)

    // The worker can't read env vars, so the config rides along in the query
    // string. Keeping the same URL means repeat registrations are no-ops.
    const swUrl = `/firebase-messaging-sw.js?${new URLSearchParams(FIREBASE_CONFIG as any)}`
    const registration = await navigator.serviceWorker.register(swUrl, { scope: '/' })

    const messaging = getMessaging(app)
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    })
    if (!token) return

    await api.post('/notifications/web-push-token', { token })

    // Tab is focused → the browser won't draw an OS notification, so surface
    // it in-app instead of losing it.
    onMessage(messaging, (payload: any) => {
      const n = payload?.notification || {}
      const link = payload?.data?.link
      toast(
        (t) => (
          <span
            onClick={() => { toast.dismiss(t.id); if (link) window.location.href = link }}
            className={link ? 'cursor-pointer' : ''}
          >
            <b className="block">{n.title || 'Notification'}</b>
            <span className="text-sm">{n.body || ''}</span>
          </span>
        ),
        { icon: '🔔', duration: 6000 }
      )
      // Nudge the header bell to refetch its unread count.
      window.dispatchEvent(new CustomEvent('notifications:refresh'))
    })
  }, [])

  useEffect(() => {
    if (!supported) return

    if (Notification.permission === 'granted') {
      // Already allowed — refresh the token quietly. FCM rotates tokens, and a
      // stale one fails silently, which looks exactly like "push is broken".
      register().catch(err => console.warn('[WebPush] register failed:', err))
      return
    }

    if (Notification.permission === 'default' && !localStorage.getItem(DISMISS_KEY)) {
      setShowPrompt(true)
    }
  }, [supported, register])

  const enable = async () => {
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        toast.error('Notifications blocked. Chrome ke address bar me 🔒 se allow kar sakte ho.')
        setShowPrompt(false)
        localStorage.setItem(DISMISS_KEY, '1')
        return
      }
      await register()
      toast.success('Desktop notifications on')
      setShowPrompt(false)
    } catch (e) {
      console.error('[WebPush] enable failed:', e)
      toast.error('Could not turn on notifications')
    } finally {
      setBusy(false)
    }
  }

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setShowPrompt(false)
  }

  if (!supported || !showPrompt) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-white border border-gray-200 rounded-xl shadow-lg p-4 flex items-start gap-3 animate-fade-in">
      <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
        <Bell size={16} className="text-brand-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">Would you like to turn on desktop notifications?</p>
        <p className="text-xs text-gray-500 mt-0.5">
         New leads, meeting assignments, rescheduling, and cancellations — everything will be visible right here in Chrome, even when the CRM tab is closed.
        </p>
        <div className="flex gap-2 mt-2.5">
          <button onClick={enable} disabled={busy} className="btn-primary btn-sm">
            {busy ? 'Enabling…' : 'Turn on'}
          </button>
          <button onClick={dismiss} className="btn-secondary btn-sm">Not now</button>
        </div>
      </div>
      <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
        <X size={15} />
      </button>
    </div>
  )
}
