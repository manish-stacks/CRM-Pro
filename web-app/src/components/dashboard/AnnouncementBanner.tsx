'use client'
// Shows today's currently-live announcement(s) as a banner at the top of
// the Dashboard — stays up for as long as the admin's chosen window lasts,
// and only ever for the day it was scheduled on (gone by tomorrow even if
// nobody dismissed it).
import { useState, useEffect } from 'react'
import api from '@/lib/axios'
import { PartyPopper, Volume2, X } from 'lucide-react'
import { DEFAULT_SOUND_VALUE, playCelebrationChime } from '@/lib/celebrationSound'

const POLL_MS = 60_000

interface Announcement {
  id: string
  title: string
  message: string
  soundUrl: string | null
  expiresAt: string
}

export function AnnouncementBanner() {
  const [items, setItems] = useState<Announcement[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const load = () => {
      api.get('/announcements/current').then(r => setItems(r.data?.data || [])).catch(() => {})
    }
    load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [])

  const visible = items.filter(a => !dismissedIds.has(a.id))
  if (visible.length === 0) return null

  const playSound = (a: Announcement) => {
    if (a.soundUrl === DEFAULT_SOUND_VALUE) playCelebrationChime()
    else if (a.soundUrl) new Audio(a.soundUrl).play().catch(() => {})
  }

  return (
    <div className="space-y-3">
      {visible.map(a => (
        <div key={a.id} className="animate-rise relative overflow-hidden rounded-2xl px-5 py-4 flex items-center gap-4 bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-sm">
          <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <PartyPopper size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{a.title}</p>
            <p className="text-white/90 text-xs mt-0.5">{a.message}</p>
          </div>
          {a.soundUrl && (
            <button onClick={() => playSound(a)} title="Play" className="text-white/80 hover:text-white p-1.5 flex-shrink-0">
              <Volume2 size={16} />
            </button>
          )}
          <button onClick={() => setDismissedIds(prev => new Set(prev).add(a.id))} title="Dismiss" className="text-white/80 hover:text-white p-1.5 flex-shrink-0">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
