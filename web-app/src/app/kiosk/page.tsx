'use client'
// Office attendance kiosk. Open /kiosk on the front-desk PC or tablet, enter the
// kiosk key once, and leave it running. People just look at the camera.
import { useEffect, useRef, useState } from 'react'
import { BRAND } from '@/lib/branding'
import { loadFaceApi, readFace, startCamera, stopCamera } from '@/lib/faceClient'
import { CheckCircle2, LogOut, XCircle, Clock, ScanFace, ShieldCheck, Wifi, WifiOff, Sparkles } from 'lucide-react'

type Result = {
  ok: boolean; action?: string; name?: string; avatar?: string | null; empCode?: string
  time?: string; isLate?: boolean; hoursWorked?: number; message?: string
}
type Feed = { name: string; action: 'PUNCH_IN' | 'PUNCH_OUT'; time: string; late?: boolean }

const SAMPLES = 3          // consecutive good frames averaged per scan
const COOLDOWN_MS = 4500   // how long the result stays on screen

const fmtTime = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''

export default function KioskPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const busyRef = useRef(false)
  const keyRef = useRef('')
  const [key, setKey] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [phase, setPhase] = useState<'init' | 'ready' | 'error'>('init')
  const [error, setError] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [feed, setFeed] = useState<Feed[]>([])
  const [online, setOnline] = useState(true)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const k = localStorage.getItem('kioskKey')
    setKey(k || '')
    keyRef.current = k || ''
    const t = setInterval(() => setNow(new Date()), 1000)
    const up = () => setOnline(true), down = () => setOnline(false)
    window.addEventListener('online', up); window.addEventListener('offline', down)
    setOnline(navigator.onLine)
    return () => { clearInterval(t); window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  useEffect(() => {
    if (!key) return
    let stream: MediaStream | null = null
    let stopped = false
    let timer: any

    const run = async () => {
      try {
        const [f, s] = await Promise.all([loadFaceApi(), startCamera(videoRef.current!)])
        stream = s
        setPhase('ready')

        const samples: number[][] = []
        const tick = async () => {
          if (stopped) return
          if (busyRef.current) { timer = setTimeout(tick, 400); return }
          try {
            const r = await readFace(f, videoRef.current!)
            if (!r) { samples.length = 0; setDetecting(false) }
            else {
              setDetecting(true)
              samples.push(r.descriptor)
              if (samples.length >= SAMPLES) {
                const avg = r.descriptor.map((_, i) => samples.reduce((a, d) => a + d[i], 0) / samples.length)
                samples.length = 0
                busyRef.current = true
                setChecking(true)
                await submit(avg)
                setChecking(false)
                setTimeout(() => { busyRef.current = false; setResult(null); setDetecting(false) }, COOLDOWN_MS)
              }
            }
          } catch { /* ignore a bad frame */ }
          timer = setTimeout(tick, 350)
        }
        tick()
      } catch (e: any) {
        setError(e?.name === 'NotAllowedError' ? 'Camera permission is blocked. Allow the camera and reload this page.' : (e?.message || 'Could not start the camera.'))
        setPhase('error')
      }
    }
    run()
    return () => { stopped = true; clearTimeout(timer); stopCamera(stream) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const submit = async (descriptor: number[]) => {
    try {
      const res = await fetch('/api/kiosk/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-kiosk-key': keyRef.current },
        body: JSON.stringify({ descriptor }),
      })
      const j = await res.json().catch(() => ({}))
      if (j.code === 'BAD_KEY') {
        localStorage.removeItem('kioskKey'); keyRef.current = ''; setKey('')
        return
      }
      if (j.success) {
        setResult({ ok: true, ...j })
        if (j.action === 'PUNCH_IN' || j.action === 'PUNCH_OUT') {
          setFeed(p => [{ name: j.name, action: j.action, time: j.time, late: j.isLate }, ...p].slice(0, 5))
        }
      } else setResult({ ok: false, message: j.message || 'Face not recognised. Please try again.' })
    } catch {
      setResult({ ok: false, message: 'No connection to the server.' })
    }
  }

  // ---------- setup screen ----------
  if (key === null) return <div className="min-h-screen bg-slate-950" />
  if (!key) {
    return (
      <div className="min-h-screen bg-slate-950 relative overflow-hidden flex items-center justify-center p-6">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-brand-600/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="relative w-full max-w-sm bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-7 space-y-5 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/30">
            <ShieldCheck className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-white text-xl font-semibold">Set up attendance kiosk</h1>
            <p className="text-slate-400 text-sm mt-1">Enter the kiosk key given by your admin. You only need to do this once on this device.</p>
          </div>
          <input type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="Kiosk key"
            onKeyDown={e => { if (e.key === 'Enter' && keyInput.trim()) { localStorage.setItem('kioskKey', keyInput.trim()); keyRef.current = keyInput.trim(); setKey(keyInput.trim()) } }}
            className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
          <button disabled={!keyInput.trim()} onClick={() => { localStorage.setItem('kioskKey', keyInput.trim()); keyRef.current = keyInput.trim(); setKey(keyInput.trim()) }}
            className="w-full rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-sm font-semibold py-3 transition">Start kiosk</button>
        </div>
      </div>
    )
  }

  // ---------- main screen ----------
  const r = result
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const state: 'idle' | 'detecting' | 'checking' | 'ok' | 'in' | 'out' | 'fail' =
    r ? (!r.ok ? 'fail' : r.action === 'PUNCH_IN' ? 'in' : r.action === 'PUNCH_OUT' ? 'out' : 'ok')
      : checking ? 'checking' : detecting ? 'detecting' : 'idle'

  const ring: Record<string, string> = {
    idle: 'border-white/15 shadow-[0_0_60px_-10px_rgba(255,255,255,0.08)]',
    detecting: 'border-amber-400/70 shadow-[0_0_70px_-8px_rgba(251,191,36,0.45)]',
    checking: 'border-sky-400/70 shadow-[0_0_70px_-8px_rgba(56,189,248,0.5)]',
    in: 'border-emerald-400 shadow-[0_0_80px_-6px_rgba(52,211,153,0.6)]',
    out: 'border-indigo-400 shadow-[0_0_80px_-6px_rgba(129,140,248,0.6)]',
    ok: 'border-amber-400 shadow-[0_0_80px_-6px_rgba(251,191,36,0.5)]',
    fail: 'border-red-400 shadow-[0_0_80px_-6px_rgba(248,113,113,0.55)]',
  }
  const corner = state === 'idle' ? 'border-white/60' : state === 'detecting' ? 'border-amber-300' : state === 'checking' ? 'border-sky-300' : state === 'fail' ? 'border-red-300' : state === 'out' ? 'border-indigo-300' : 'border-emerald-300'
  const status: Record<string, string> = {
    idle: 'Look at the camera', detecting: 'Hold still…', checking: 'Verifying…', in: '', out: '', ok: '', fail: '',
  }
  const overlayBg = state === 'in' ? 'from-emerald-600/95 to-emerald-800/95' : state === 'out' ? 'from-indigo-600/95 to-indigo-900/95' : state === 'fail' ? 'from-red-600/95 to-red-900/95' : 'from-amber-600/95 to-amber-800/95'
  const title = !r ? '' : !r.ok ? 'Not recognised' : r.action === 'PUNCH_IN' ? 'Punched in' : r.action === 'PUNCH_OUT' ? 'Punched out' : r.action === 'ALREADY_IN' ? 'Already punched in' : 'Already punched out'

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-white relative overflow-x-hidden select-none flex flex-col">
      <style>{`
        @keyframes kscan { 0% { top: 6%; opacity: 0 } 15% { opacity: 1 } 85% { opacity: 1 } 100% { top: 94%; opacity: 0 } }
        @keyframes kpop { 0% { transform: scale(.6); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
      `}</style>
      <div className="absolute -top-48 -left-32 w-[600px] h-[600px] rounded-full bg-brand-600/15 blur-3xl" />
      <div className="absolute -bottom-48 -right-32 w-[600px] h-[600px] rounded-full bg-indigo-600/15 blur-3xl" />

      {/* top bar */}
      <header className="relative z-10 flex items-center justify-between px-4 sm:px-6 lg:px-10 py-3 sm:py-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND.logoUrl} alt="" className="h-9 w-9 rounded-xl bg-white p-1 object-contain" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          <div>
            <p className="text-sm font-semibold leading-tight">{BRAND.name}</p>
            <p className="text-[11px] text-slate-400 leading-tight">Face Attendance</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${online ? 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10' : 'text-red-300 border-red-400/30 bg-red-400/10'}`}>
          {online ? <Wifi size={13} /> : <WifiOff size={13} />} {online ? 'Online' : 'Offline'}
        </div>
      </header>

      <main className="relative z-10 flex-1 grid lg:grid-cols-2 gap-5 lg:gap-14 items-center px-4 sm:px-6 lg:px-14 pb-6 lg:pb-8 max-w-7xl w-full mx-auto">
        {/* compact clock for phones and small tablets */}
        <div className="lg:hidden order-1 text-center -mb-1">
          <p className="text-brand-400 text-xs font-medium">{greeting}</p>
          <div className="text-4xl font-semibold tabular-nums leading-tight">
            {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).replace(/\s?(am|pm)/i, '')}
            <span className="text-base text-slate-400 ml-1.5 uppercase">{now.getHours() >= 12 ? 'pm' : 'am'}</span>
          </div>
          <p className="text-slate-400 text-xs">{now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
        </div>
        {/* left: clock + steps + activity */}
        <section className="space-y-6 lg:space-y-8 order-3 lg:order-1">
          <div className="hidden lg:block">
            <p className="text-brand-400 text-sm font-medium flex items-center gap-1.5"><Sparkles size={14} /> {greeting}</p>
            <div className="text-7xl lg:text-8xl font-semibold tabular-nums tracking-tight mt-1">
              {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).replace(/\s?(am|pm)/i, '')}
              <span className="text-2xl lg:text-3xl text-slate-400 ml-2 font-medium uppercase">{now.getHours() >= 12 ? 'pm' : 'am'}</span>
            </div>
            <p className="text-slate-400 mt-1">{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>

          <div className="hidden sm:grid grid-cols-3 gap-3">
            {[
              { n: 1, t: 'Look at the camera', i: ScanFace },
              { n: 2, t: 'Hold still for a second', i: Clock },
              { n: 3, t: 'You are marked', i: CheckCircle2 },
            ].map(s => (
              <div key={s.n} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <s.i size={20} className="text-brand-400" />
                <p className="text-[11px] text-slate-500 mt-3">Step {s.n}</p>
                <p className="text-sm text-slate-200 leading-snug">{s.t}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">Recent activity</p>
            {feed.length === 0 && <p className="text-sm text-slate-500">No scans yet on this device.</p>}
            <div className="space-y-2">
              {feed.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full ${f.action === 'PUNCH_IN' ? 'bg-emerald-400' : 'bg-indigo-400'}`} />
                    <span className="truncate text-slate-200">{f.name}</span>
                    {f.late && <span className="text-[10px] text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded">Late</span>}
                  </div>
                  <span className="text-slate-400 text-xs shrink-0">{f.action === 'PUNCH_IN' ? 'In' : 'Out'} · {fmtTime(f.time)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* right: camera */}
        <section className="order-2 lg:order-2 flex flex-col items-center">
          <div className={`relative w-full max-w-[520px] aspect-[3/4] max-h-[62dvh] sm:max-h-none sm:aspect-square rounded-3xl sm:rounded-[2rem] overflow-hidden border-2 bg-black transition-all duration-500 ${ring[state]}`}>
            <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover -scale-x-100" />

            {/* viewfinder corners */}
            {phase === 'ready' && !r && (
              <>
                <span className={`absolute top-4 left-4 w-8 h-8 sm:top-5 sm:left-5 sm:w-10 sm:h-10 border-t-4 border-l-4 rounded-tl-2xl transition-colors ${corner}`} />
                <span className={`absolute top-4 right-4 w-8 h-8 sm:top-5 sm:right-5 sm:w-10 sm:h-10 border-t-4 border-r-4 rounded-tr-2xl transition-colors ${corner}`} />
                <span className={`absolute bottom-4 left-4 w-8 h-8 sm:bottom-5 sm:left-5 sm:w-10 sm:h-10 border-b-4 border-l-4 rounded-bl-2xl transition-colors ${corner}`} />
                <span className={`absolute bottom-4 right-4 w-8 h-8 sm:bottom-5 sm:right-5 sm:w-10 sm:h-10 border-b-4 border-r-4 rounded-br-2xl transition-colors ${corner}`} />
                {(state === 'idle' || state === 'detecting') && (
                  <div className="absolute left-8 right-8 h-0.5 bg-gradient-to-r from-transparent via-white/80 to-transparent shadow-[0_0_14px_2px_rgba(255,255,255,0.5)]"
                    style={{ animation: 'kscan 2.6s ease-in-out infinite' }} />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent pt-14 pb-5 text-center">
                  <span className="inline-flex items-center gap-2 text-sm font-medium bg-black/50 backdrop-blur px-4 py-1.5 rounded-full border border-white/10">
                    <span className={`w-2 h-2 rounded-full ${state === 'idle' ? 'bg-slate-300 animate-pulse' : state === 'detecting' ? 'bg-amber-400 animate-pulse' : 'bg-sky-400 animate-pulse'}`} />
                    {status[state]}
                  </span>
                </div>
              </>
            )}

            {phase === 'init' && (
              <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-300 text-sm">
                <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-brand-500 animate-spin" />
                Starting camera and face engine…
              </div>
            )}
            {phase === 'error' && (
              <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-3 text-center p-8">
                <XCircle className="text-red-400" size={40} />
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}

            {/* result overlay */}
            {r && (
              <div className={`absolute inset-0 bg-gradient-to-b ${overlayBg} backdrop-blur-sm flex flex-col items-center justify-center text-center p-5 sm:p-8 gap-2 sm:gap-3`}
                style={{ animation: 'kpop .25s ease-out' }}>
                {r.ok ? (
                  r.avatar
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={r.avatar} alt="" className="w-20 h-20 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-white/50 shadow-xl" />
                    : <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-white/20 border-4 border-white/40 flex items-center justify-center text-4xl sm:text-5xl font-bold">{(r.name || '?')[0]}</div>
                ) : <XCircle size={72} className="text-white/90" />}
                <div className="flex items-center gap-2 text-2xl sm:text-3xl font-semibold">
                  {r.ok && r.action === 'PUNCH_IN' && <CheckCircle2 size={30} />}
                  {r.ok && r.action === 'PUNCH_OUT' && <LogOut size={28} />}
                  {title}
                </div>
                {r.ok && <div className="text-lg sm:text-xl">{r.name}</div>}
                {r.ok && <div className="text-white/70 text-sm -mt-1">{r.empCode}</div>}
                {r.ok && (
                  <div className="mt-2 inline-flex items-center gap-2 bg-black/25 rounded-full px-4 py-1.5 text-sm">
                    <Clock size={14} /> {fmtTime(r.time)}
                    {r.action === 'PUNCH_IN' && r.isLate && <span className="text-amber-200">· Late</span>}
                    {r.action === 'PUNCH_OUT' && r.hoursWorked != null && <span>· {r.hoursWorked} hrs worked</span>}
                  </div>
                )}
                {r.message && <p className="text-white/85 text-sm max-w-xs">{r.message}</p>}
              </div>
            )}
          </div>
          <p className="text-slate-500 text-xs mt-4 text-center">First scan of the day punches in. The next scan punches out.</p>
        </section>
      </main>
    </div>
  )
}
