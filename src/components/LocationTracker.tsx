'use client'
// Field-tracking pinger. While a field user (MARKETING_EXECUTIVE, or anyone punched in
// with workMode FIELD) is checked in, sends a location ping every 5 minutes so their
// full office-hours route is recorded. Silent — no UI, no toasts.
import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import { getCurrentGeo } from '@/lib/geolocation'

const PING_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

export default function LocationTracker() {
  const { user } = useAuth()
  const busy = useRef(false)

  useEffect(() => {
    if (!user) return
    // Tracking is ONLY for marketing executives
    if (user.role !== 'MARKETING_EXECUTIVE') return
    let cancelled = false

    const tick = async () => {
      if (busy.current) return
      busy.current = true
      try {
        // Are we in an active (checked-in) session?
        const r = await api.get('/attendance/today')
        const att = r.data?.data
        if (!att?.punchIn || att.punchOut) return

        const geo = await getCurrentGeo({ reverseGeocode: true })
        if (geo.error || (!geo.latitude && !geo.longitude)) return

        await api.post('/tracking/ping', {
          latitude: geo.latitude,
          longitude: geo.longitude,
          accuracy: geo.accuracy ?? null,
          address: geo.address ?? null,
          isMoving: true,
          source: 'foreground',
          recordedAt: new Date().toISOString(),
        }).catch(() => {})
      } catch {
        /* silent */
      } finally {
        busy.current = false
      }
    }

    // Fire once on mount, then every 5 minutes
    tick()
    const id = setInterval(() => { if (!cancelled) tick() }, PING_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [user])

  return null
}