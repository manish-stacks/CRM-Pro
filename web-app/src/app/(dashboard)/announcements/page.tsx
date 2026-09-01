'use client'
// Admin-only: schedule a celebratory popup (title + message + optional
// song) that shows once to everyone the first time they're on the app
// during the chosen window — e.g. "Townhall party today, 5pm!"
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import { EmptyState } from '@/components/ui'
import { PartyPopper, Loader2, Trash2, Music, X, Ban, Volume2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { DEFAULT_SOUND_VALUE, playCelebrationChime } from '@/lib/celebrationSound'

const DURATION_PRESETS = [
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '4 hours', ms: 4 * 60 * 60 * 1000 },
  { label: 'Rest of today', ms: null }, // computed specially — until 23:59:59 of scheduled date
  { label: '24 hours', ms: 24 * 60 * 60 * 1000 },
]

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function status(a: any) {
  const now = Date.now()
  const start = new Date(a.scheduledAt).getTime()
  const end = new Date(a.expiresAt).getTime()
  if (!a.isActive) return { label: 'Cancelled', color: 'text-gray-400 bg-gray-100' }
  if (now < start) return { label: 'Upcoming', color: 'text-blue-600 bg-blue-50' }
  if (now > end) return { label: 'Ended', color: 'text-gray-400 bg-gray-100' }
  return { label: 'Live now', color: 'text-emerald-700 bg-emerald-50' }
}

export default function AnnouncementsPage() {
  const { isAtLeast } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [soundUrl, setSoundUrl] = useState('')
  const [soundName, setSoundName] = useState('')
  const [soundMode, setSoundMode] = useState<'none' | 'default' | 'upload'>('none')
  const [scheduledAt, setScheduledAt] = useState(() => toLocalInputValue(new Date()))
  const [durationIdx, setDurationIdx] = useState(1)

  const load = () => {
    api.get('/announcements').then(r => setItems(r.data?.data || [])).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  if (!isAtLeast('ADMIN')) {
    return <div className="p-8"><EmptyState icon={<PartyPopper size={50} />} title="Access denied" description="Only admins can schedule announcements" /></div>
  }

  const handleSoundPick = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) { toast.error('Sound file must be under 8MB'); return }
    setUploading(true)
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const r = await api.post('/upload', { dataUrl, folder: 'announcements', resourceType: 'video' })
      setSoundUrl(r.data?.data?.url || '')
      setSoundName(file.name)
      toast.success('Song uploaded')
    } catch {
      toast.error('Sound upload failed')
    } finally {
      setUploading(false)
    }
  }

  const computeExpiry = () => {
    const start = new Date(scheduledAt)
    const preset = DURATION_PRESETS[durationIdx]
    if (preset.ms === null) {
      const end = new Date(start)
      end.setHours(23, 59, 59, 999)
      return end
    }
    return new Date(start.getTime() + preset.ms)
  }

  const schedule = async () => {
    if (!title.trim() || !message.trim()) { toast.error('Title and message are required'); return }
    setSaving(true)
    try {
      await api.post('/announcements', {
        title: title.trim(),
        message: message.trim(),
        soundUrl: soundUrl || null,
        scheduledAt: new Date(scheduledAt).toISOString(),
        expiresAt: computeExpiry().toISOString(),
      })
      toast.success('Announcement scheduled')
      setTitle(''); setMessage(''); setSoundUrl(''); setSoundName(''); setSoundMode('none')
      setScheduledAt(toLocalInputValue(new Date()))
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to schedule')
    } finally {
      setSaving(false)
    }
  }

  const cancelOne = async (id: string) => {
    await api.patch(`/announcements/${id}`, { isActive: false })
    toast.success('Cancelled')
    load()
  }

  const deleteOne = async (id: string) => {
    if (!confirm('Delete this announcement? This cannot be undone.')) return
    await api.delete(`/announcements/${id}`)
    toast.success('Deleted')
    load()
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><PartyPopper size={22} className="text-brand-600" /> Announcements</h1>
        <p className="text-sm text-gray-500 mt-1">Schedule a celebration popup — everyone sees it once, with confetti and an optional song, the first time they're on the app during the window you pick.</p>
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Townhall Party Today! 🎉" className="input w-full" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Message</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Join us at 5pm in the main hall for food, music and awards!" className="input w-full" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Celebration song</label>
          <div className="flex gap-2 mb-2">
            {(['none', 'default', 'upload'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => {
                  setSoundMode(mode)
                  if (mode === 'default') { setSoundUrl(DEFAULT_SOUND_VALUE); setSoundName('') }
                  else if (mode === 'none') { setSoundUrl(''); setSoundName('') }
                  else { setSoundUrl(''); setSoundName('') } // 'upload' — wait for file pick
                }}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  soundMode === mode ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {mode === 'none' ? 'No sound' : mode === 'default' ? 'Default chime' : 'Upload song'}
              </button>
            ))}
          </div>

          {soundMode === 'default' && (
            <button onClick={() => playCelebrationChime()} className="btn-secondary text-sm flex items-center gap-1.5">
              <Volume2 size={14} /> Preview chime
            </button>
          )}

          {soundMode === 'upload' && (
            soundUrl ? (
              <div className="flex items-center gap-2 text-sm bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
                <Music size={14} className="text-brand-600" />
                <span className="flex-1 truncate">{soundName || 'Song uploaded'}</span>
                <button onClick={() => { setSoundUrl(''); setSoundName('') }} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary text-sm flex items-center gap-1.5">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Music size={14} />}
                {uploading ? 'Uploading...' : 'Upload a song (MP3, up to 8MB)'}
              </button>
            )
          )}
          <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={e => e.target.files?.[0] && handleSoundPick(e.target.files[0])} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Starts showing at</label>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Keep showing for</label>
            <select value={durationIdx} onChange={e => setDurationIdx(Number(e.target.value))} className="input w-full">
              {DURATION_PRESETS.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <button onClick={schedule} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-1.5">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <PartyPopper size={14} />}
          Schedule
        </button>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Scheduled</h2>
        {loading ? (
          <div className="card p-8 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>
        ) : items.length === 0 ? (
          <div className="card"><EmptyState icon={<PartyPopper size={40} />} title="Nothing scheduled yet" description="Announcements you schedule will show up here" /></div>
        ) : (
          <div className="space-y-2">
            {items.map(a => {
              const s = status(a)
              return (
                <div key={a.id} className="card p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm text-gray-900 truncate">{a.title}</p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${s.color}`}>{s.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(a.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      {' → '}
                      {new Date(a.expiresAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      {' · '}{a._count?.views ?? 0} seen
                      {a.soundUrl ? ' · 🎵' : ''}
                    </p>
                  </div>
                  {s.label !== 'Cancelled' && s.label !== 'Ended' && (
                    <button onClick={() => cancelOne(a.id)} title="Cancel" className="text-gray-400 hover:text-amber-600 p-1"><Ban size={15} /></button>
                  )}
                  <button onClick={() => deleteOne(a.id)} title="Delete" className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={15} /></button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
