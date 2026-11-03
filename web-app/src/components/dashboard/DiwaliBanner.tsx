'use client'
import { useEffect, useState } from 'react'

// Festive dashboard banner. Shown only around Diwali 2026 (Nov 8).
const DIWALI = new Date(2026, 10, 8)
const SHOW_FROM = new Date(2026, 9, 30)
const SHOW_TILL = new Date(2026, 10, 15)
const KEY = 'diwali2026-dismissed'
const LIGHTS = ['#ff9f1c', '#ff4d6d', '#ffd60a', '#7bf1a8', '#4cc9f0']

function Diya({ size = 46, delay = 0 }: { size?: number; delay?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <radialGradient id="dg" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#fff3b0" /><stop offset="100%" stopColor="#ff8c00" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx="32" cy="22" r="20" fill="url(#dg)" className="dw-glow" style={{ animationDelay: `${delay}s` }} />
      <g className="dw-flame" style={{ animationDelay: `${delay}s` }}>
        <path d="M32 6c6 8 8 13 4 19-2 3-6 3-8 0-4-6-2-11 4-19z" fill="#ffb703" />
        <path d="M32 14c3 4 4 7 2 10-1 2-3 2-4 0-2-3-1-6 2-10z" fill="#fff3b0" />
      </g>
      <path d="M6 36h52c0 12-10 22-26 22S6 48 6 36z" fill="#c2410c" />
      <path d="M6 36h52c-1 3-3 5-6 6H12c-3-1-5-3-6-6z" fill="#ea580c" />
      <path d="M14 46c6 6 30 6 36 0" stroke="#fbbf24" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function Rangoli() {
  return (
    <svg viewBox="0 0 120 120" className="dw-spin" width="120" height="120" aria-hidden>
      {Array.from({ length: 12 }).map((_, i) => (
        <g key={i} transform={`rotate(${i * 30} 60 60)`}>
          <ellipse cx="60" cy="22" rx="7" ry="16" fill={LIGHTS[i % LIGHTS.length]} opacity="0.9" />
          <circle cx="60" cy="48" r="3" fill="#fff" opacity="0.9" />
        </g>
      ))}
      <circle cx="60" cy="60" r="12" fill="#ffd60a" /><circle cx="60" cy="60" r="6" fill="#ff4d6d" />
    </svg>
  )
}

export function DiwaliBanner({ name }: { name?: string }) {
  const [days, setDays] = useState<number | null>(null)
  const [hidden, setHidden] = useState(false)
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([])

  useEffect(() => {
    const now = new Date()
    if (now < SHOW_FROM || now > SHOW_TILL) return
    try { if (localStorage.getItem(KEY) === new Date().toDateString()) { setHidden(true); return } } catch { }
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    setDays(Math.round((DIWALI.getTime() - today.getTime()) / 86400000))
  }, [])

  if (days === null || hidden) return null

  const close = () => {
    setHidden(true)
    try { localStorage.setItem(KEY, new Date().toDateString()) } catch { }
  }
  const burst = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const b = { id: Date.now(), x: e.clientX - r.left, y: e.clientY - r.top }
    setBursts(p => [...p.slice(-3), b])
    setTimeout(() => setBursts(p => p.filter(x => x.id !== b.id)), 1200)
  }
  const label = days > 0 ? `${days} day${days > 1 ? 's' : ''} to Diwali` : days === 0 ? 'Today is Diwali!' : 'Festival of Lights'

  return (
    <div onClick={burst} className="dw-wrap relative overflow-hidden rounded-2xl text-white shadow-lg cursor-pointer select-none"
      style={{ background: 'linear-gradient(120deg,#3b0a2a 0%,#8a1c3c 40%,#e8590c 80%,#ffb703 100%)' }}>
      <style>{`
        @keyframes dwFlame{0%,100%{transform:scale(1) rotate(-2deg)}50%{transform:scale(1.12,1.2) rotate(3deg)}}
        @keyframes dwGlow{0%,100%{opacity:.55}50%{opacity:1}}
        @keyframes dwBlink{0%,100%{opacity:.35;transform:scale(.85)}50%{opacity:1;transform:scale(1.15)}}
        @keyframes dwFloat{0%{transform:translateY(0) scale(1);opacity:0}15%{opacity:.9}100%{transform:translateY(-130px) scale(.4);opacity:0}}
        @keyframes dwSpin{to{transform:rotate(360deg)}}
        @keyframes dwShine{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes dwBurst{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(.2);opacity:0}}
        .dw-flame{transform-origin:32px 26px;animation:dwFlame 1.1s ease-in-out infinite}
        .dw-glow{animation:dwGlow 1.4s ease-in-out infinite}
        .dw-spin{animation:dwSpin 40s linear infinite}
        .dw-ember{position:absolute;bottom:-6px;width:5px;height:5px;border-radius:50%;background:#ffd60a;box-shadow:0 0 8px 2px #ff9f1c;animation:dwFloat 5s ease-in infinite}
        .dw-title{background:linear-gradient(90deg,#fff,#ffe29a,#fff,#ffe29a);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:dwShine 6s linear infinite}
        .dw-spark{position:absolute;width:6px;height:6px;border-radius:50%;pointer-events:none;animation:dwBurst 1.1s ease-out forwards}
        @media (prefers-reduced-motion:reduce){.dw-flame,.dw-glow,.dw-spin,.dw-ember,.dw-title{animation:none}}
      `}</style>

      {/* string of lights */}
      <div className="absolute top-0 left-0 right-0 flex justify-between px-3 pointer-events-none">
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} className="block rounded-full" style={{
            width: 7, height: 7, marginTop: i % 2 ? 6 : 2, background: LIGHTS[i % LIGHTS.length],
            boxShadow: `0 0 10px 3px ${LIGHTS[i % LIGHTS.length]}`, animation: `dwBlink ${1.2 + (i % 5) * 0.3}s ease-in-out ${(i % 7) * 0.2}s infinite`,
          }} />
        ))}
      </div>

      {/* floating embers */}
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={i} className="dw-ember" style={{ left: `${(i * 7 + 3) % 98}%`, animationDelay: `${(i % 6) * 0.8}s`, animationDuration: `${4 + (i % 4)}s` }} />
      ))}

      <div className="relative flex items-center gap-4 px-5 pt-9 pb-5">
        <div className="hidden sm:flex items-end gap-1 shrink-0">
          <Diya size={40} delay={0.2} /><Diya size={54} /><Diya size={40} delay={0.5} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] tracking-[0.25em] uppercase text-amber-200">{label}</p>
          <h2 className="dw-title text-2xl sm:text-3xl font-extrabold leading-tight">Happy Diwali{name ? `, ${name}` : ''}!</h2>
          <p className="text-sm text-amber-50/90 mt-1">May this festival of lights fill your life with joy, success and prosperity. Team Hover Business Services wishes you and your family a sparkling Diwali.</p>
          <p className="text-[11px] text-amber-200/80 mt-1.5">Tap anywhere for sparkles</p>
        </div>
        <div className="hidden md:block shrink-0 opacity-90"><Rangoli /></div>
      </div>

      <button onClick={e => { e.stopPropagation(); close() }} aria-label="Close"
        className="absolute top-2 right-3 z-10 text-white/70 hover:text-white text-lg leading-none">&times;</button>

      {bursts.map(b => (
        <div key={b.id} className="absolute pointer-events-none" style={{ left: b.x, top: b.y }}>
          {Array.from({ length: 18 }).map((_, i) => {
            const a = (i / 18) * Math.PI * 2, d = 40 + (i % 3) * 22
            return <span key={i} className="dw-spark" style={{ background: LIGHTS[i % LIGHTS.length], boxShadow: `0 0 8px ${LIGHTS[i % LIGHTS.length]}`,
              ['--dx' as any]: `${Math.cos(a) * d}px`, ['--dy' as any]: `${Math.sin(a) * d}px` }} />
          })}
        </div>
      ))}
    </div>
  )
}
