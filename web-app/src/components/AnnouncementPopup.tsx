'use client'
// Celebratory login popup — an admin schedules a message ahead of time
// (e.g. "Townhall party today at 5pm!"), and the first time anyone loads
// the app during that window, this shows once with confetti + sound.
// Mounted once in (dashboard)/layout.tsx, same pattern as ChatNotificationPopup.
import { useState, useEffect, useRef, useCallback } from 'react'
import api from '@/lib/axios'
import { PartyPopper, Volume2, X } from 'lucide-react'
import { DEFAULT_SOUND_VALUE, playCelebrationChime } from '@/lib/celebrationSound'

const POLL_MS = 60_000 // catch an announcement going live while already logged in

interface Announcement {
  id: string
  title: string
  message: string
  soundUrl: string | null
}

// Small self-contained confetti burst — no external library needed.
function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const colors = ['#e11d48', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899']
    const particles = Array.from({ length: 140 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.5,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      speedY: 2 + Math.random() * 3,
      speedX: -1.5 + Math.random() * 3,
      rotation: Math.random() * 360,
      rotationSpeed: -8 + Math.random() * 16,
    }))

    let raf: number
    const start = Date.now()
    const DURATION = 4500

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.y += p.speedY
        p.x += p.speedX
        p.rotation += p.rotationSpeed
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      })
      if (Date.now() - start < DURATION) {
        raf = requestAnimationFrame(tick)
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[101]" />
}

export function AnnouncementPopup() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [needsTapToPlay, setNeedsTapToPlay] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const shownIds = useRef<Set<string>>(new Set())

  const poll = useCallback(async () => {
    try {
      const r = await api.get('/announcements/active')
      const a: Announcement | null = r.data?.data || null
      if (a && !shownIds.current.has(a.id)) {
        shownIds.current.add(a.id)
        setAnnouncement(a)
      }
    } catch { /* silent — this isn't critical path */ }
  }, [])

  useEffect(() => {
    poll()
    const t = setInterval(poll, POLL_MS)
    return () => clearInterval(t)
  }, [poll])

  useEffect(() => {
    if (!announcement?.soundUrl) return
    if (announcement.soundUrl === DEFAULT_SOUND_VALUE) {
      // Web Audio can also be blocked without a user gesture — same fallback UI.
      const ok = playCelebrationChime()
      if (!ok) setNeedsTapToPlay(true)
      return
    }
    if (!audioRef.current) return
    const p = audioRef.current.play()
    if (p && typeof p.catch === 'function') {
      p.catch(() => setNeedsTapToPlay(true)) // browser blocked autoplay-with-sound
    }
  }, [announcement])

  const dismiss = async () => {
    if (!announcement) return
    const id = announcement.id
    setAnnouncement(null)
    setNeedsTapToPlay(false)
    try { await api.post(`/announcements/${id}/dismiss`) } catch { /* best-effort */ }
  }

  if (!announcement) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <ConfettiCanvas />
      {announcement.soundUrl && announcement.soundUrl !== DEFAULT_SOUND_VALUE && (
        <audio ref={audioRef} src={announcement.soundUrl} autoPlay />
      )}

      <div className="relative z-[102] max-w-md w-full bg-white rounded-2xl shadow-2xl p-6 text-center">
        <button onClick={dismiss} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
        <div className="w-16 h-16 mx-auto rounded-full bg-brand-100 flex items-center justify-center mb-4">
          <PartyPopper className="text-brand-600" size={28} />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">{announcement.title}</h2>
        <p className="text-sm text-gray-600 whitespace-pre-wrap mb-5">{announcement.message}</p>

        {needsTapToPlay && announcement.soundUrl && (
          <button
            onClick={() => {
              if (announcement.soundUrl === DEFAULT_SOUND_VALUE) playCelebrationChime()
              else audioRef.current?.play()
              setNeedsTapToPlay(false)
            }}
            className="mb-3 mx-auto flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700"
          >
            <Volume2 size={14} /> Tap to play music
          </button>
        )}

        <button onClick={dismiss} className="btn-primary w-full">
          Awesome! 🎉
        </button>
      </div>
    </div>
  )
}
