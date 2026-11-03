'use client'
import { useEffect, useState } from 'react'

// Site-wide Diwali theme (header to footer). Pure overlay, never blocks clicks.
const SHOW_FROM = new Date(2026, 9, 30)
const SHOW_TILL = new Date(2026, 10, 15)
const KEY = 'diwali-theme-off'
const C = ['#ff9f1c', '#ff4d6d', '#ffd60a', '#7bf1a8', '#4cc9f0', '#f72585']

const TORAN = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="40" viewBox="0 0 64 40">
  <path d="M0 4Q16 14 32 4T64 4" stroke="#2a9d3f" stroke-width="3" fill="none"/>
  <g transform="translate(32 16)">${[0, 60, 120, 180, 240, 300].map(a => `<ellipse cx="0" cy="-5" rx="3.4" ry="5.5" fill="#ff9f1c" transform="rotate(${a})"/>`).join('')}<circle r="3" fill="#d00000"/></g>
  <path d="M32 26v6" stroke="#b8860b" stroke-width="1.4"/><path d="M28 32h8l-1.5 5h-5z" fill="#ffd60a"/></svg>`
)

function Diya() {
  return (
    <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="24" r="18" fill="#ffb703" opacity=".25" className="dt-glow" />
      <g className="dt-flame"><path d="M32 6c6 8 8 13 4 19-2 3-6 3-8 0-4-6-2-11 4-19z" fill="#ffb703" /><path d="M32 14c3 4 4 7 2 10-1 2-3 2-4 0-2-3-1-6 2-10z" fill="#fff3b0" /></g>
      <path d="M6 36h52c0 12-10 22-26 22S6 48 6 36z" fill="#c2410c" /><path d="M6 36h52c-1 3-3 5-6 6H12c-3-1-5-3-6-6z" fill="#ea580c" />
    </svg>
  )
}

export default function DiwaliTheme() {
  const [on, setOn] = useState(false)
  const [active, setActive] = useState(false)
  const [fw, setFw] = useState<{ id: number; x: number; y: number; c: string }[]>([])

  useEffect(() => {
    const n = new Date()
    if (n < SHOW_FROM || n > SHOW_TILL) return
    setActive(true)
    try { setOn(localStorage.getItem(KEY) !== '1') } catch { setOn(true) }
  }, [])

  // a firework every few seconds
  useEffect(() => {
    if (!active || !on) return
    const t = setInterval(() => {
      const f = { id: Date.now(), x: 8 + Math.random() * 84, y: 12 + Math.random() * 40, c: C[Math.floor(Math.random() * C.length)] }
      setFw(p => [...p.slice(-2), f])
      setTimeout(() => setFw(p => p.filter(x => x.id !== f.id)), 1500)
    }, 4500)
    return () => clearInterval(t)
  }, [active, on])

  if (!active) return null
  const toggle = () => { const v = !on; setOn(v); try { localStorage.setItem(KEY, v ? '0' : '1') } catch { } }

  return (
    <>
      <style>{`
        @keyframes dtFlame{0%,100%{transform:scale(1) rotate(-2deg)}50%{transform:scale(1.12,1.22) rotate(3deg)}}
        @keyframes dtGlow{0%,100%{opacity:.2}50%{opacity:.6}}
        @keyframes dtBlink{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
        @keyframes dtRise{0%{transform:translate(0,0);opacity:0}8%{opacity:.95}92%{opacity:.9}100%{transform:translate(var(--sx),-112vh);opacity:0}}
        @keyframes dtSwing{0%,100%{transform:rotate(-1.2deg)}50%{transform:rotate(1.2deg)}}
        @keyframes dtBurst{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(.2);opacity:0}}
        .dt-flame{transform-origin:32px 26px;animation:dtFlame 1.1s ease-in-out infinite}
        .dt-glow{animation:dtGlow 1.5s ease-in-out infinite}
        @media (prefers-reduced-motion:reduce){.dt-flame,.dt-glow,.dt-moving{animation:none!important}}
      `}</style>

      {on && (
        <div aria-hidden className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 40 }}>
          {/* header: marigold toran + blinking lights */}
          <div className="dt-moving absolute top-0 left-0 right-0 h-10 origin-top" style={{
            backgroundImage: `url("data:image/svg+xml,${TORAN}")`, backgroundRepeat: 'repeat-x', backgroundSize: '64px 40px',
            animation: 'dtSwing 5s ease-in-out infinite', opacity: 0.95,
          }} />
          <div className="absolute left-0 right-0 flex justify-between px-2" style={{ top: 38 }}>
            {Array.from({ length: 40 }).map((_, i) => (
              <span key={i} className="dt-moving block rounded-full" style={{
                width: 6, height: 6, marginTop: i % 2 ? 4 : 0, background: C[i % C.length], boxShadow: `0 0 8px 2px ${C[i % C.length]}`,
                animation: `dtBlink ${1.2 + (i % 5) * 0.3}s ease-in-out ${(i % 8) * 0.2}s infinite`,
              }} />
            ))}
          </div>

          {/* footer to header: rising sky lanterns and sparkles */}
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={'l' + i} className="dt-moving absolute rounded-t-xl rounded-b-md" style={{
              left: `${6 + i * 9.5}%`, bottom: -40, width: 16, height: 22,
              background: 'linear-gradient(#ffd166,#ff7b00)', boxShadow: '0 0 18px 6px rgba(255,160,0,.55)',
              ['--sx' as any]: `${(i % 2 ? 1 : -1) * (20 + (i % 4) * 14)}px`,
              animation: `dtRise ${22 + (i % 5) * 4}s linear ${i * 2.3}s infinite`,
            }} />
          ))}
          {Array.from({ length: 22 }).map((_, i) => (
            <span key={'s' + i} className="dt-moving absolute rounded-full" style={{
              left: `${(i * 4.7 + 2) % 98}%`, bottom: -10, width: 4, height: 4, background: C[i % C.length], boxShadow: `0 0 8px 2px ${C[i % C.length]}`,
              ['--sx' as any]: `${(i % 2 ? 1 : -1) * 30}px`,
              animation: `dtRise ${9 + (i % 6) * 2}s ease-in ${(i % 9) * 1.1}s infinite`,
            }} />
          ))}

          {/* fireworks */}
          {fw.map(f => (
            <div key={f.id} className="absolute" style={{ left: `${f.x}%`, top: `${f.y}%` }}>
              {Array.from({ length: 22 }).map((_, i) => {
                const a = (i / 22) * Math.PI * 2, d = 50 + (i % 3) * 24
                return <span key={i} className="absolute rounded-full" style={{ width: 5, height: 5, background: i % 2 ? f.c : '#ffd60a', boxShadow: `0 0 8px ${f.c}`,
                  ['--dx' as any]: `${Math.cos(a) * d}px`, ['--dy' as any]: `${Math.sin(a) * d}px`, animation: 'dtBurst 1.3s ease-out forwards' }} />
              })}
            </div>
          ))}

          {/* footer: row of diyas */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-between items-end px-2">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className={i % 2 ? 'hidden md:block' : ''} style={{ marginBottom: i % 3 === 0 ? 0 : 2 }}><Diya /></div>
            ))}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg,#ff9f1c,#ff4d6d,#ffd60a,#7bf1a8,#4cc9f0,#ff9f1c)' }} />
        </div>
      )}

      <button onClick={toggle} title={on ? 'Turn off Diwali theme' : 'Turn on Diwali theme'}
        className="fixed bottom-14 left-3 h-9 w-9 rounded-full bg-white shadow-lg border border-orange-200 text-lg flex items-center justify-center hover:scale-110 transition-transform"
        style={{ zIndex: 45, opacity: on ? 1 : 0.6 }}>{'🪔'}</button>
    </>
  )
}
