'use client'
// HBS AI Attendance Kiosk v3.4 — Next-Gen Biometric Terminal
// Bulletproof Anti-Spoofing: Blocks mobile phone photos and static screens
// using 3D Interactive Biometric Liveness (Smile / Blink / Head-turn challenge).
import { useEffect, useRef, useState, useCallback } from 'react'
import { BRAND } from '@/lib/branding'
import { loadFaceApi, onFaceProgress, readFace, startCamera, stopCamera, FaceStep } from '@/lib/faceClient'
import {
  CheckCircle2,
  LogOut,
  XCircle,
  Clock,
  ScanFace,
  ShieldCheck,
  Wifi,
  WifiOff,
  Sparkles,
  Maximize2,
  Minimize2,
  Sun,
  Volume2,
  VolumeX,
  UserCheck,
  AlertTriangle,
  Unplug,
  Smile,
  Eye,
  ShieldAlert,
  Zap,
} from 'lucide-react'

type Result = {
  ok: boolean
  action?: 'PUNCH_IN' | 'PUNCH_OUT' | 'ALREADY_IN' | 'DONE'
  name?: string
  avatar?: string | null
  empCode?: string
  time?: string
  isLate?: boolean
  lateBy?: number
  hoursWorked?: number
  message?: string
}

type FeedItem = {
  name: string
  action: 'PUNCH_IN' | 'PUNCH_OUT' | 'ALREADY_IN'
  time: string
  late?: boolean
  hours?: number
}

type KioskMode = 'AUTO' | 'PUNCH_IN' | 'PUNCH_OUT'

const SAMPLES = 3 // consecutive valid frames before submission
const COOLDOWN_MS = 5000 // display duration for scan result
const SPOOF_TIMEOUT_MS = 4500 // if face visible for 4.5s without any live expression, flag as spoof

const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''

// Web Audio API Sci-Fi Chimes
function playBeep(type: 'success' | 'warn' | 'error' | 'verified') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    if (type === 'success') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15) // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    } else if (type === 'verified') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime) // A5
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14)
      osc.start()
      osc.stop(ctx.currentTime + 0.14)
    } else if (type === 'warn') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(440, ctx.currentTime)
      osc.frequency.setValueAtTime(330, ctx.currentTime + 0.14)
      gain.gain.setValueAtTime(0.14, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    } else {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(220, ctx.currentTime)
      osc.frequency.setValueAtTime(160, ctx.currentTime + 0.15)
      gain.gain.setValueAtTime(0.18, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)
      osc.start()
      osc.stop(ctx.currentTime + 0.35)
    }
  } catch {
    // Audio context may require user gesture on some browsers
  }
}

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
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [online, setOnline] = useState(true)
  const [now, setNow] = useState(new Date())
  const [engine, setEngine] = useState<FaceStep>({ msg: 'Starting AI Biometric Engine…', pct: 0 })

  // Smart Terminal Controls
  const [mode, setMode] = useState<KioskMode>('AUTO')
  const [antiSpoofEnabled, setAntiSpoofEnabled] = useState(true)
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false)

  // Anti-Spoofing & Liveness State
  const [livenessStatus, setLivenessStatus] = useState<'idle' | 'awaiting_expression' | 'live_verified' | 'spoof_detected'>('idle')
  const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  // Baseline metrics for relative expression check
  const baselineLivenessRef = useRef<{ baseSmile: number; maxEar: number; baseYaw: number; count: number } | null>(null)
  const isLiveVerifiedRef = useRef(false)
  const faceDetectedSinceRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)

  // Progress subscription
  useEffect(() => onFaceProgress(setEngine), [])

  // Clock & Network
  useEffect(() => {
    const k = localStorage.getItem('kioskKey')
    setKey(k || '')
    keyRef.current = k || ''

    const savedMode = (localStorage.getItem('kioskMode') as KioskMode) || 'AUTO'
    setMode(savedMode)

    const savedSpoof = localStorage.getItem('kioskAntiSpoofEnabled')
    if (savedSpoof !== null) setAntiSpoofEnabled(savedSpoof === 'true')

    const t = setInterval(() => setNow(new Date()), 1000)
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    setOnline(navigator.onLine)

    return () => {
      clearInterval(t)
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  // Screen WakeLock: Keeps tablet/kiosk screen ALWAYS ON
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        const lock = await (navigator as any).wakeLock.request('screen')
        setWakeLockActive(true)
        lock.addEventListener('release', () => setWakeLockActive(false))
      }
    } catch {
      setWakeLockActive(false)
    }
  }, [])

  useEffect(() => {
    requestWakeLock()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestWakeLock()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [requestWakeLock])

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  // Switch Mode
  const handleModeChange = (newMode: KioskMode) => {
    setMode(newMode)
    localStorage.setItem('kioskMode', newMode)
  }

  // Toggle Anti-Spoofing
  const toggleAntiSpoof = () => {
    const nextVal = !antiSpoofEnabled
    setAntiSpoofEnabled(nextVal)
    localStorage.setItem('kioskAntiSpoofEnabled', String(nextVal))
  }

  // Disconnect Kiosk Terminal
  const handleDisconnect = () => {
    localStorage.removeItem('kioskKey')
    localStorage.removeItem('kioskMode')
    keyRef.current = ''
    setKey('')
    setDisconnectModalOpen(false)
    if (streamRef.current) stopCamera(streamRef.current)
    setPhase('init')
  }

  // Main Detection Loop with 3D Biometric Anti-Spoofing
  useEffect(() => {
    if (!key) return
    let stopped = false
    let timer: any

    const run = async () => {
      try {
        const [f, s] = await Promise.all([loadFaceApi(), startCamera(videoRef.current!)])
        streamRef.current = s
        setPhase('ready')

        const samples: number[][] = []

        const tick = async () => {
          if (stopped) return
          if (busyRef.current) {
            timer = setTimeout(tick, 300)
            return
          }

          try {
            const r = await readFace(f, videoRef.current!, 0.18)

            if (!r) {
              // Face left the frame -> reset all tracking
              samples.length = 0
              baselineLivenessRef.current = null
              isLiveVerifiedRef.current = false
              faceDetectedSinceRef.current = 0
              setDetecting(false)
              setFaceBox(null)
              setLivenessStatus('idle')
            } else {
              setDetecting(true)
              setFaceBox(r.box)

              const nowMs = Date.now()
              if (!faceDetectedSinceRef.current) {
                faceDetectedSinceRef.current = nowMs
              }

              // Always collect descriptor samples
              samples.push(r.descriptor)
              if (samples.length > SAMPLES + 2) samples.shift()

              // Establish or update baseline liveness
              const { ear, smileRatio, yawOffset } = r.liveness

              if (!baselineLivenessRef.current) {
                baselineLivenessRef.current = {
                  baseSmile: smileRatio,
                  maxEar: ear,
                  baseYaw: yawOffset,
                  count: 1,
                }
              } else if (baselineLivenessRef.current.count < 3) {
                baselineLivenessRef.current.baseSmile = Math.min(baselineLivenessRef.current.baseSmile, smileRatio)
                baselineLivenessRef.current.maxEar = Math.max(baselineLivenessRef.current.maxEar, ear)
                baselineLivenessRef.current.count++
              } else {
                baselineLivenessRef.current.maxEar = Math.max(baselineLivenessRef.current.maxEar, ear)
              }

              // =======================================================
              // 3D INTERACTIVE ANTI-SPOOF LIVENESS EVALUATION
              // A photo on a phone screen CANNOT smile or blink!
              // =======================================================
              if (!antiSpoofEnabled) {
                isLiveVerifiedRef.current = true
              } else if (!isLiveVerifiedRef.current) {
                const b = baselineLivenessRef.current
                setLivenessStatus('awaiting_expression')

                // Check 1: User Smiles (mouth width expands by >= 12% over resting baseline)
                const hasSmiled = b && smileRatio >= b.baseSmile * 1.12

                // Check 2: User Blinks (EAR relative dip >= 18% from max open eyes)
                const hasBlinked = b && b.maxEar > 0.22 && ear < b.maxEar * 0.82

                // Check 3: User Turns Head Slightly (3D perspective yaw change >= 0.08)
                const hasTurnedHead = b && Math.abs(yawOffset - b.baseYaw) > 0.08

                if (hasSmiled || hasBlinked || hasTurnedHead) {
                  isLiveVerifiedRef.current = true
                  setLivenessStatus('live_verified')
                  if (soundEnabled) playBeep('verified')
                }

                // If face is static on screen for >= 4.5s with zero expression -> FLAG SPOOF!
                const elapsedMs = nowMs - faceDetectedSinceRef.current
                if (!isLiveVerifiedRef.current && elapsedMs >= SPOOF_TIMEOUT_MS) {
                  busyRef.current = true
                  setLivenessStatus('spoof_detected')
                  if (soundEnabled) playBeep('warn')
                  setResult({
                    ok: false,
                    message: 'Anti-Spoof Alert: Static photo or mobile screen detected. Real live person required (smile or blink).',
                  })

                  setTimeout(() => {
                    busyRef.current = false
                    setResult(null)
                    setDetecting(false)
                    samples.length = 0
                    baselineLivenessRef.current = null
                    isLiveVerifiedRef.current = false
                    faceDetectedSinceRef.current = 0
                    setLivenessStatus('idle')
                  }, 4000)

                  timer = setTimeout(tick, 300)
                  return
                }

                // Wait for the smile/blink verification
                if (!isLiveVerifiedRef.current) {
                  timer = setTimeout(tick, 140)
                  return
                }
              }

              // =======================================================
              // LIVENESS VERIFIED & SAMPLES COLLECTED -> SUBMIT PUNCH
              // =======================================================
              if (isLiveVerifiedRef.current && samples.length >= SAMPLES) {
                const avg = r.descriptor.map((_, i) => samples.reduce((a, d) => a + d[i], 0) / samples.length)
                samples.length = 0
                busyRef.current = true
                setChecking(true)
                await submitPunch(avg)
                setChecking(false)

                setTimeout(() => {
                  busyRef.current = false
                  setResult(null)
                  setDetecting(false)
                  setFaceBox(null)
                  baselineLivenessRef.current = null
                  isLiveVerifiedRef.current = false
                  faceDetectedSinceRef.current = 0
                  setLivenessStatus('idle')
                }, COOLDOWN_MS)
              }
            }
          } catch {
            /* ignore single frame glitches */
          }
          timer = setTimeout(tick, 140)
        }
        tick()
      } catch (e: any) {
        setError(
          e?.name === 'NotAllowedError'
            ? 'Camera access was blocked. Please grant camera permission in browser settings.'
            : e?.message || 'Could not start AI camera stream.'
        )
        setPhase('error')
      }
    }

    run()
    return () => {
      stopped = true
      clearTimeout(timer)
      if (streamRef.current) stopCamera(streamRef.current)
    }
  }, [key, mode, antiSpoofEnabled])

  // Submit face descriptor to backend with current mode
  const submitPunch = async (descriptor: number[]) => {
    try {
      const res = await fetch('/api/kiosk/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-kiosk-key': keyRef.current },
        body: JSON.stringify({ descriptor, mode }),
      })
      const j = await res.json().catch(() => ({}))

      if (j.code === 'BAD_KEY') {
        localStorage.removeItem('kioskKey')
        keyRef.current = ''
        setKey('')
        return
      }

      if (j.success) {
        setResult({ ok: true, ...j })
        if (soundEnabled) playBeep('success')

        if (j.action === 'PUNCH_IN' || j.action === 'PUNCH_OUT' || j.action === 'ALREADY_IN') {
          setFeed(p => [
            { name: j.name, action: j.action, time: j.time, late: j.isLate, hours: j.hoursWorked },
            ...p,
          ].slice(0, 6))
        }
      } else {
        setResult({ ok: false, message: j.message || 'Face not recognised. Please look straight into camera.' })
        if (soundEnabled) playBeep(j.code === 'NOT_IN_YET' ? 'warn' : 'error')
      }
    } catch {
      setResult({ ok: false, message: 'Offline: Unable to communicate with authentication server.' })
      if (soundEnabled) playBeep('error')
    }
  }

  // ---------------------------------------------------------------------------
  // Initial Authorization Setup Screen
  // ---------------------------------------------------------------------------
  if (key === null) return <div className="min-h-screen bg-[#030712]" />

  if (!key) {
    return (
      <div className="min-h-screen bg-[#030712] relative overflow-hidden flex items-center justify-center p-6 select-none font-sans">
        <div className="absolute -top-40 -left-40 w-[550px] h-[550px] rounded-full bg-cyan-600/15 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-[550px] h-[550px] rounded-full bg-blue-600/15 blur-3xl" />
        <div className="relative w-full max-w-md bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <ScanFace className="text-white" size={30} />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-2">
              <Sparkles size={12} /> AI Attendance Terminal v3.4
            </div>
            <h1 className="text-white text-2xl font-bold tracking-tight">Deploy Office Kiosk</h1>
            <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
              Enter your master Kiosk Key provided by the Administrator. You can disconnect or change this key anytime with the Disconnect button.
            </p>
          </div>
          <div className="space-y-3">
            <input
              type="password"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="Enter Kiosk License Key"
              onKeyDown={e => {
                if (e.key === 'Enter' && keyInput.trim()) {
                  localStorage.setItem('kioskKey', keyInput.trim())
                  keyRef.current = keyInput.trim()
                  setKey(keyInput.trim())
                }
              }}
              className="w-full rounded-2xl bg-black/40 border border-white/15 text-white placeholder:text-slate-600 px-4 py-3.5 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/20 transition-all font-mono"
            />
            <button
              disabled={!keyInput.trim()}
              onClick={() => {
                localStorage.setItem('kioskKey', keyInput.trim())
                keyRef.current = keyInput.trim()
                setKey(keyInput.trim())
              }}
              className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 text-white font-semibold py-3.5 shadow-lg shadow-cyan-500/25 transition-all text-sm tracking-wide"
            >
              Initialize AI Terminal
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Main Biometric HUD Interface
  // ---------------------------------------------------------------------------
  const r = result
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'

  const state: 'idle' | 'detecting' | 'checking' | 'ok' | 'in' | 'out' | 'fail' = r
    ? !r.ok
      ? 'fail'
      : r.action === 'PUNCH_IN'
      ? 'in'
      : r.action === 'PUNCH_OUT'
      ? 'out'
      : 'ok'
    : checking
    ? 'checking'
    : detecting
    ? 'detecting'
    : 'idle'

  const ringStyles: Record<string, string> = {
    idle: 'border-white/15 shadow-[0_0_80px_-20px_rgba(255,255,255,0.06)]',
    detecting:
      livenessStatus === 'live_verified'
        ? 'border-emerald-400 shadow-[0_0_90px_-10px_rgba(52,211,153,0.5)] ring-2 ring-emerald-500/30'
        : 'border-cyan-400 shadow-[0_0_90px_-10px_rgba(6,182,212,0.45)] ring-2 ring-cyan-500/30',
    checking: 'border-sky-400 shadow-[0_0_90px_-10px_rgba(56,189,248,0.5)] ring-2 ring-sky-500/30',
    in: 'border-emerald-400 shadow-[0_0_100px_-5px_rgba(52,211,153,0.6)] ring-4 ring-emerald-500/40',
    out: 'border-blue-400 shadow-[0_0_100px_-5px_rgba(96,165,250,0.6)] ring-4 ring-blue-500/40',
    ok: 'border-amber-400 shadow-[0_0_100px_-5px_rgba(251,191,36,0.6)] ring-4 ring-amber-500/40',
    fail: 'border-rose-500 shadow-[0_0_100px_-5px_rgba(244,63,94,0.65)] ring-4 ring-rose-500/40',
  }

  const resultTitle = !r
    ? ''
    : !r.ok
    ? 'Verification Failed'
    : r.action === 'PUNCH_IN'
    ? 'Punch-In Verified'
    : r.action === 'PUNCH_OUT'
    ? 'Punch-Out Verified'
    : r.action === 'ALREADY_IN'
    ? 'Already Punched In'
    : 'Already Punched Out'

  return (
    <div className="min-h-screen bg-[#030712] text-white relative overflow-x-hidden select-none flex flex-col font-sans">
      <style>{`
        @keyframes laserScan {
          0% { top: 4%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: 96%; opacity: 0; }
        }
        @keyframes resultPop {
          0% { transform: scale(0.85); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Cyber Glow */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-cyan-600/10 blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[130px] pointer-events-none" />

      {/* TOP STATUS BAR */}
      <header className="relative z-20 flex items-center justify-between px-5 sm:px-8 py-3.5 border-b border-white/[0.06] bg-black/30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND.logoUrl}
            alt=""
            className="h-9 w-9 rounded-xl bg-white p-1 object-contain shadow-md"
            onError={e => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold tracking-tight text-white">{BRAND.name}</p>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                AI TERMINAL v3.4
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono tracking-wider">3D LIVENESS SHIELD ACTIVE</p>
          </div>
        </div>

        {/* Top Controls: Mode, Anti-Spoof Toggle, Disconnect, Audio, Fullscreen */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mode Selector */}
          <div className="hidden sm:flex items-center bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
            <button
              onClick={() => handleModeChange('PUNCH_IN')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                mode === 'PUNCH_IN'
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/25 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> IN ONLY
            </button>
            <button
              onClick={() => handleModeChange('AUTO')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                mode === 'AUTO'
                  ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/25 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles size={12} /> SMART AUTO
            </button>
            <button
              onClick={() => handleModeChange('PUNCH_OUT')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                mode === 'PUNCH_OUT'
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span> OUT ONLY
            </button>
          </div>

          {/* Anti-Spoof Toggle */}
          <button
            onClick={toggleAntiSpoof}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all ${
              antiSpoofEnabled
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-sm'
                : 'bg-white/5 border-white/10 text-slate-500'
            }`}
            title="Toggle Anti-Spoof Liveness Protection"
          >
            {antiSpoofEnabled ? (
              <ShieldCheck size={13} className="text-emerald-400" />
            ) : (
              <Zap size={13} className="text-slate-500" />
            )}
            <span>ANTI-SPOOF: {antiSpoofEnabled ? 'SMILE / BLINK' : 'OFF'}</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300"
            title={soundEnabled ? 'Mute AI Chimes' : 'Enable AI Chimes'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} className="text-slate-500" />}
          </button>

          {/* Always-on Wakelock Badge */}
          {wakeLockActive && (
            <div
              className="hidden lg:flex items-center gap-1 text-[11px] font-mono text-amber-400/90 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-xl"
              title="Display Sleep Disabled"
            >
              <Sun size={12} /> <span>ALWAYS-ON</span>
            </div>
          )}

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          {/* DISCONNECT KIOSK BUTTON */}
          <button
            onClick={() => setDisconnectModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-mono font-semibold transition-all"
            title="Disconnect Kiosk Terminal from this device"
          >
            <Unplug size={13} />
            <span className="hidden sm:inline">DISCONNECT</span>
          </button>
        </div>
      </header>

      {/* DISCONNECT CONFIRMATION MODAL */}
      {disconnectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-white/15 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
              <Unplug size={24} />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Disconnect Kiosk?</h3>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                This will unlink the terminal and remove the saved license key from this browser. You will need the admin key to reconnect.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setDisconnectModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30"
              >
                Yes, Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN KIOSK BODY */}
      <main className="relative z-10 flex-1 grid lg:grid-cols-12 gap-6 lg:gap-10 items-center px-4 sm:px-8 lg:px-12 py-5 max-w-7xl w-full mx-auto">
        {/* LEFT COLUMN: CLOCK, PROTOCOL & ACTIVITY FEED (5 cols) */}
        <section className="lg:col-span-5 space-y-6 order-2 lg:order-1">
          {/* Digital Clock */}
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-7 shadow-xl">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
              <span className="flex items-center gap-1.5 text-cyan-400 font-semibold uppercase tracking-wider">
                <Sparkles size={14} /> {greeting}
              </span>
              <span className="text-slate-500">BIOMETRIC TERMINAL</span>
            </div>
            <div className="text-6xl sm:text-7xl font-bold font-mono tracking-tight tabular-nums text-white">
              {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).replace(/\s?(am|pm)/i, '')}
              <span className="text-2xl font-sans text-cyan-400 ml-2 font-medium uppercase">
                {now.getHours() >= 12 ? 'pm' : 'am'}
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1.5 font-medium">
              {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>

            {/* Active Protocol Pill */}
            <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">ACTIVE PROTOCOL:</span>
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                  mode === 'PUNCH_IN'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : mode === 'PUNCH_OUT'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                }`}
              >
                {mode === 'PUNCH_IN' ? 'Punch In Only' : mode === 'PUNCH_OUT' ? 'Punch Out Only' : 'Smart Cooldown (30m)'}
              </span>
            </div>
          </div>

          {/* Quick Mobile Mode Buttons */}
          <div className="sm:hidden grid grid-cols-3 gap-2">
            <button
              onClick={() => handleModeChange('PUNCH_IN')}
              className={`p-2.5 rounded-xl text-xs font-bold ${
                mode === 'PUNCH_IN' ? 'bg-emerald-500 text-black' : 'bg-white/5 text-slate-400'
              }`}
            >
              IN ONLY
            </button>
            <button
              onClick={() => handleModeChange('AUTO')}
              className={`p-2.5 rounded-xl text-xs font-bold ${
                mode === 'AUTO' ? 'bg-cyan-500 text-black' : 'bg-white/5 text-slate-400'
              }`}
            >
              SMART AUTO
            </button>
            <button
              onClick={() => handleModeChange('PUNCH_OUT')}
              className={`p-2.5 rounded-xl text-xs font-bold ${
                mode === 'PUNCH_OUT' ? 'bg-rose-500 text-white' : 'bg-white/5 text-slate-400'
              }`}
            >
              OUT ONLY
            </button>
          </div>

          {/* Live Activity Feed */}
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3.5">
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-cyan-400" /> RECENT VERIFICATIONS
              </p>
              <span className="text-[11px] font-mono text-slate-500">TODAY</span>
            </div>

            {feed.length === 0 ? (
              <p className="text-sm text-slate-500 py-3 text-center font-mono">Terminal active. Awaiting first scan...</p>
            ) : (
              <div className="space-y-2.5">
                {feed.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm bg-black/30 border border-white/[0.06] rounded-2xl p-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          f.action === 'PUNCH_IN'
                            ? 'bg-emerald-400 shadow-sm shadow-emerald-400'
                            : f.action === 'PUNCH_OUT'
                            ? 'bg-blue-400 shadow-sm shadow-blue-400'
                            : 'bg-amber-400'
                        }`}
                      />
                      <span className="font-medium text-slate-200 truncate">{f.name}</span>
                      {f.late && (
                        <span className="text-[10px] text-amber-300 bg-amber-400/15 border border-amber-400/30 px-1.5 py-0.5 rounded-md font-mono">
                          LATE
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 text-xs font-mono shrink-0 ml-2">
                      {f.action === 'PUNCH_IN' ? 'IN' : f.action === 'PUNCH_OUT' ? 'OUT' : 'ACTIVE'} · {fmtTime(f.time)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: AI SCANNER WITH INTERACTIVE LIVENESS (7 cols) */}
        <section className="lg:col-span-7 flex flex-col items-center order-1 lg:order-2">
          <div
            className={`relative w-full max-w-[560px] aspect-[4/5] sm:aspect-square rounded-[2.5rem] overflow-hidden border-2 bg-black transition-all duration-500 ${ringStyles[state]}`}
          >
            {/* Live Video Feed */}
            <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover -scale-x-100" />

            {/* CYBER SCANNER RETICLE & HUD */}
            {phase === 'ready' && !r && (
              <>
                {/* Outer Reticle Brackets */}
                <div className="absolute top-5 left-5 w-12 h-12 border-t-4 border-l-4 rounded-tl-3xl border-cyan-400/80 transition-all duration-300 pointer-events-none" />
                <div className="absolute top-5 right-5 w-12 h-12 border-t-4 border-r-4 rounded-tr-3xl border-cyan-400/80 transition-all duration-300 pointer-events-none" />
                <div className="absolute bottom-5 left-5 w-12 h-12 border-b-4 border-l-4 rounded-bl-3xl border-cyan-400/80 transition-all duration-300 pointer-events-none" />
                <div className="absolute bottom-5 right-5 w-12 h-12 border-b-4 border-r-4 rounded-br-3xl border-cyan-400/80 transition-all duration-300 pointer-events-none" />

                {/* Laser Scanning Line */}
                <div
                  className="absolute left-8 right-8 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_20px_3px_rgba(6,182,212,0.8)] pointer-events-none"
                  style={{ animation: 'laserScan 2.4s ease-in-out infinite' }}
                />

                {/* Top Telemetry Header */}
                <div className="absolute top-6 inset-x-0 flex justify-center pointer-events-none">
                  <div
                    className={`inline-flex items-center gap-2 backdrop-blur-md px-4 py-1.5 rounded-full border text-xs font-mono shadow-lg transition-all ${
                      livenessStatus === 'live_verified'
                        ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-300'
                        : livenessStatus === 'awaiting_expression'
                        ? 'bg-amber-950/80 border-amber-400/60 text-amber-300 animate-pulse'
                        : 'bg-black/60 border-cyan-500/30 text-cyan-300'
                    }`}
                  >
                    {livenessStatus === 'live_verified' ? (
                      <>
                        <CheckCircle2 size={14} className="text-emerald-400" />
                        <span className="font-bold">LIVE PERSON VERIFIED · PROCESSING PUNCH</span>
                      </>
                    ) : livenessStatus === 'awaiting_expression' ? (
                      <>
                        <Smile size={14} className="text-amber-400 animate-bounce" />
                        <span className="font-bold">PLEASE SMILE OR BLINK TO VERIFY LIVENESS</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                        <span>AI SCANNER: {detecting ? 'ANALYZING BIOMETRICS' : 'READY TO SCAN'}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Dynamic Face Bounding Box */}
                {faceBox && (
                  <div
                    className={`absolute border-2 border-dashed rounded-2xl pointer-events-none transition-all duration-150 ${
                      livenessStatus === 'live_verified'
                        ? 'border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.6)]'
                        : livenessStatus === 'awaiting_expression'
                        ? 'border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.6)]'
                        : 'border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.6)]'
                    }`}
                    style={{
                      left: '20%',
                      top: '20%',
                      width: '60%',
                      height: '60%',
                    }}
                  >
                    <span
                      className={`absolute -top-6 left-2 text-[10px] font-mono px-2 py-0.5 rounded border backdrop-blur-md ${
                        livenessStatus === 'live_verified'
                          ? 'text-emerald-300 bg-black/80 border-emerald-400/50'
                          : livenessStatus === 'awaiting_expression'
                          ? 'text-amber-300 bg-black/80 border-amber-400/50'
                          : 'text-cyan-300 bg-black/80 border-cyan-400/50'
                      }`}
                    >
                      {livenessStatus === 'live_verified'
                        ? '✓ REAL PERSON CONFIRMED'
                        : livenessStatus === 'awaiting_expression'
                        ? '😊 SMILE / BLINK NOW'
                        : 'IDENTIFYING...'}
                    </span>
                  </div>
                )}

                {/* Bottom Status Ticker */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent pt-16 pb-6 text-center">
                  <span
                    className={`inline-flex items-center gap-2.5 text-sm font-semibold px-5 py-2 rounded-full border backdrop-blur-md transition-all ${
                      state === 'idle'
                        ? 'bg-black/60 border-white/15 text-slate-300'
                        : livenessStatus === 'live_verified'
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 ring-2 ring-emerald-500/30'
                        : livenessStatus === 'awaiting_expression'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-500/30'
                        : 'bg-cyan-500/20 border-cyan-400 text-cyan-300 ring-2 ring-cyan-500/30'
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        state === 'idle'
                          ? 'bg-slate-400 animate-pulse'
                          : livenessStatus === 'live_verified'
                          ? 'bg-emerald-400'
                          : 'bg-amber-400 animate-bounce'
                      }`}
                    />
                    {state === 'idle'
                      ? 'Look directly at camera to scan'
                      : livenessStatus === 'live_verified'
                      ? 'Biometrics Verified — Matching…'
                      : 'Please smile or blink to verify you are a real person'}
                  </span>
                </div>
              </>
            )}

            {/* Initialization Loader */}
            {phase === 'init' && (
              <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-300 text-sm p-6 text-center">
                <div className="w-14 h-14 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
                <p className="font-mono text-cyan-300 font-semibold">{engine.msg}</p>
                <div className="w-56 h-2 rounded-full bg-white/10 overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                    style={{ width: `${engine.pct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 font-mono">Compiling GPU neural networks...</p>
              </div>
            )}

            {/* Error Display */}
            {phase === 'error' && (
              <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center gap-4 text-center p-8">
                <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <XCircle size={36} />
                </div>
                <h3 className="text-white font-bold text-lg">Camera Error</h3>
                <p className="text-rose-300 text-sm max-w-sm">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/20 font-mono"
                >
                  Reload Terminal
                </button>
              </div>
            )}

            {/* RESULT POPUP OVERLAY */}
            {r && (
              <div
                className={`absolute inset-0 bg-gradient-to-b ${
                  !r.ok
                    ? 'from-rose-950/95 via-rose-900/90 to-black/95'
                    : r.action === 'PUNCH_IN'
                    ? 'from-emerald-950/95 via-emerald-900/90 to-black/95'
                    : r.action === 'PUNCH_OUT'
                    ? 'from-blue-950/95 via-blue-900/90 to-black/95'
                    : 'from-amber-950/95 via-amber-900/90 to-black/95'
                } backdrop-blur-md flex flex-col items-center justify-center text-center p-6 sm:p-10 gap-3 z-30`}
                style={{ animation: 'resultPop 0.28s ease-out' }}
              >
                {/* Avatar / Icon */}
                {r.ok ? (
                  r.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.avatar}
                      alt=""
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover border-4 border-white/40 shadow-2xl"
                    />
                  ) : (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white/15 border-4 border-white/30 flex items-center justify-center text-4xl sm:text-5xl font-bold font-mono">
                      {(r.name || '?')[0]}
                    </div>
                  )
                ) : (
                  <div className="w-20 h-20 rounded-full bg-rose-500/20 border-2 border-rose-400 flex items-center justify-center text-rose-400">
                    <AlertTriangle size={42} />
                  </div>
                )}

                {/* Status Badge */}
                <div
                  className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${
                    !r.ok
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : r.action === 'PUNCH_IN'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : r.action === 'PUNCH_OUT'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {r.ok && r.action === 'PUNCH_IN' && <CheckCircle2 size={14} />}
                  {r.ok && r.action === 'PUNCH_OUT' && <LogOut size={14} />}
                  {r.ok && r.action === 'ALREADY_IN' && <UserCheck size={14} />}
                  {resultTitle}
                </div>

                {/* Employee Name & Code */}
                {r.ok && <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{r.name}</h2>}
                {r.ok && <p className="text-slate-300 font-mono text-xs">{r.empCode}</p>}

                {/* Time Badge */}
                {r.ok && (
                  <div className="inline-flex items-center gap-2 bg-black/40 border border-white/10 rounded-full px-4 py-1.5 text-xs font-mono text-slate-200">
                    <Clock size={13} className="text-cyan-400" />
                    <span>{fmtTime(r.time)}</span>
                    {r.action === 'PUNCH_IN' && r.isLate && (
                      <span className="text-amber-300 font-bold">· LATE ({r.lateBy}m)</span>
                    )}
                    {r.action === 'PUNCH_OUT' && r.hoursWorked != null && (
                      <span className="text-cyan-300 font-bold">· {r.hoursWorked} hrs</span>
                    )}
                  </div>
                )}

                {/* Message */}
                {r.message && <p className="text-slate-200 text-sm max-w-sm mt-1 leading-relaxed">{r.message}</p>}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col items-center gap-1 text-center font-mono text-xs text-slate-400">
            <p className="flex items-center gap-1.5 text-cyan-400 font-semibold">
              <ShieldCheck size={14} /> 3D LIVENESS ACTIVE: Phone screen & photo spoofing blocked (Smile / Blink required).
            </p>
            <p className="text-slate-500 text-[11px]">
              {mode === 'PUNCH_IN'
                ? '🔒 IN-ONLY MODE ACTIVE: Accidental logout is completely disabled.'
                : mode === 'PUNCH_OUT'
                ? '🚪 OUT-ONLY MODE ACTIVE: Scans will register departure.'
                : '⚡ SMART AUTO: 30-min minimum attendance protection enabled.'}
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
