'use client'
import { useEffect, useState } from 'react'

// Site-wide Christmas theme (header to footer). Pure overlay, never blocks clicks.
// Shows 18 Dec 2026 to 2 Jan 2027. Change the dates below if needed.
const SHOW_FROM = new Date(2026, 11, 18)
const SHOW_TILL = new Date(2027, 0, 2)
const KEY = 'christmas-theme-off'
const C = ['#e63946', '#2a9d3f', '#ffd60a', '#ffffff', '#4cc9f0']

const GARLAND = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="40" viewBox="0 0 64 40">
  <path d="M0 4Q16 16 32 4T64 4" stroke="#1b7a34" stroke-width="4" fill="none"/>
  <path d="M0 4Q16 16 32 4T64 4" stroke="#2fbf55" stroke-width="1.2" stroke-dasharray="3 4" fill="none"/>
  <circle cx="16" cy="13" r="4.5" fill="#e63946"/><circle cx="48" cy="13" r="4.5" fill="#ffd60a"/>
  <g transform="translate(32 18)"><circle r="3" fill="#e63946"/><path d="M0 -3l1 -4M0 -3l-1 -4" stroke="#fff" stroke-width="1"/></g></svg>`
)

function Gift({ c }: { c: string }) {
  return (
    <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden>
      <rect x="5" y="16" width="30" height="20" rx="2" fill={c} />
      <rect x="3" y="11" width="34" height="8" rx="2" fill={c} opacity=".85" />
      <rect x="18" y="11" width="4" height="25" fill="#ffd60a" />
      <path d="M20 11c-6-9-13-3-8 0M20 11c6-9 13-3 8 0" stroke="#ffd60a" strokeWidth="2.4" fill="none" />
    </svg>
  )
}
function Tree() {
  return (
    <svg width="38" height="44" viewBox="0 0 40 46" aria-hidden>
      <path d="M20 3l11 14H9zM20 12l14 16H6zM20 22l16 18H4z" fill="#1b7a34" />
      <rect x="17" y="38" width="6" height="7" fill="#7a4a21" />
      <path d="M20 0l1.6 3.4 3.6.4-2.7 2.4.8 3.6L20 8l-3.3 1.8.8-3.6-2.7-2.4 3.6-.4z" fill="#ffd60a" className="xm-twinkle" />
      <circle cx="15" cy="22" r="2" fill="#e63946" className="xm-twinkle" /><circle cx="25" cy="30" r="2" fill="#ffd60a" className="xm-twinkle" /><circle cx="14" cy="34" r="2" fill="#4cc9f0" className="xm-twinkle" />
    </svg>
  )
}

export default function ChristmasTheme() {
  const [on, setOn] = useState(false)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const n = new Date()
    if (n < SHOW_FROM || n > SHOW_TILL) return
    setActive(true)
    try { setOn(localStorage.getItem(KEY) !== '1') } catch { setOn(true) }
  }, [])

  if (!active) return null
  const toggle = () => { const v = !on; setOn(v); try { localStorage.setItem(KEY, v ? '0' : '1') } catch { } }

  return (
    <>
      <style>{`
        @keyframes xmSnow{0%{transform:translate(0,-6vh);opacity:0}10%{opacity:.95}100%{transform:translate(var(--sx),108vh);opacity:.9}}
        @keyframes xmBlink{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
        @keyframes xmSwing{0%,100%{transform:rotate(-1deg)}50%{transform:rotate(1deg)}}
        @keyframes xmTwinkle{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes xmSpin{to{rotate:360deg}}
        @keyframes xmFog{0%{transform:translateX(-6%)}50%{transform:translateX(6%)}100%{transform:translateX(-6%)}}
        @keyframes xmHang{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
        .xm-twinkle{animation:xmTwinkle 1.2s ease-in-out infinite}
        @media (prefers-reduced-motion:reduce){.xm-twinkle,.xm-moving{animation:none!important}}
      `}</style>

      {on && (
        <div aria-hidden className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 40 }}>
          {/* header: pine garland + blinking lights */}
          <div className="xm-moving absolute top-0 left-0 right-0 h-10 origin-top" style={{
            backgroundImage: `url("data:image/svg+xml,${GARLAND}")`, backgroundRepeat: 'repeat-x', backgroundSize: '64px 40px',
            animation: 'xmSwing 5s ease-in-out infinite',
          }} />
          <div className="absolute left-0 right-0 flex justify-between px-2" style={{ top: 30 }}>
            {Array.from({ length: 40 }).map((_, i) => (
              <span key={i} className="xm-moving block rounded-full" style={{
                width: 6, height: 6, marginTop: i % 2 ? 5 : 0, background: C[i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 2], boxShadow: `0 0 8px 2px ${C[i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 2]}`,
                animation: `xmBlink ${1.2 + (i % 5) * 0.3}s ease-in-out ${(i % 8) * 0.2}s infinite`,
              }} />
            ))}
          </div>

          {/* soft fog drifting at the top and the bottom (visible on white and dark themes) */}
          <div className="xm-moving absolute left-[-10%] right-[-10%] top-8 h-24" style={{ background: 'radial-gradient(ellipse at 30% 0%,rgba(150,190,235,.28),transparent 70%)', filter: 'blur(10px)', animation: 'xmFog 14s ease-in-out infinite' }} />
          <div className="xm-moving absolute left-[-10%] right-[-10%] bottom-0 h-44" style={{ background: 'radial-gradient(ellipse at 70% 100%,rgba(150,190,235,.45),rgba(190,215,245,.2) 45%,transparent 72%)', filter: 'blur(8px)', animation: 'xmFog 18s ease-in-out infinite' }} />

          {/* hanging baubles */}
          {[6, 17, 29, 43, 57, 70, 82, 94].map((x, i) => {
            const len = 28 + (i % 4) * 22, r = 9 + (i % 3) * 3, col = ['#e63946', '#2a9d3f', '#ffd60a', '#3a86ff'][i % 4]
            return (
              <div key={i} className="xm-moving absolute origin-top" style={{ left: `${x}%`, top: 34, animation: `xmHang ${3.5 + (i % 3)}s ease-in-out ${i * 0.3}s infinite` }}>
                <div style={{ width: 1.5, height: len, background: '#b8a46a', margin: '0 auto' }} />
                <div style={{ width: r * 2, height: r * 2, borderRadius: '50%', marginLeft: -r + 10, background: `radial-gradient(circle at 32% 30%,#fff 0,${col} 38%,${col} 100%)`, boxShadow: `0 2px 8px rgba(0,0,0,.25),0 0 10px ${col}88` }} />
              </div>
            )
          })}

          {/* header to footer: falling snowflakes (icy blue so they show on a white page) */}
          {Array.from({ length: 42 }).map((_, i) => {
            const sz = 9 + (i % 5) * 4
            const flake = i % 3 !== 0
            return <span key={i} className="xm-moving absolute" style={{
              left: `${(i * 2.4 + (i % 7)) % 100}%`, top: 0, lineHeight: 1,
              fontSize: flake ? sz : undefined, width: flake ? undefined : sz * 0.45, height: flake ? undefined : sz * 0.45,
              color: i % 2 ? '#7db6ee' : '#a8d1f7',
              background: flake ? undefined : 'radial-gradient(circle at 35% 30%,#fff,#bcdcf8)',
              border: flake ? undefined : '1px solid #8fc0ee', borderRadius: '50%',
              textShadow: '0 0 4px rgba(60,120,200,.55)', boxShadow: flake ? undefined : '0 0 6px rgba(70,130,210,.55)',
              ['--sx' as any]: `${(i % 2 ? 1 : -1) * (15 + (i % 5) * 10)}px`,
              animation: `xmSnow ${9 + (i % 7) * 2}s linear ${(i % 11) * 0.9}s infinite${flake ? `, xmSpin ${6 + (i % 5) * 2}s linear infinite` : ''}`,
            }}>{flake ? '\u2744' : ''}</span>
          })}

          {/* footer: snow ground, trees and gifts */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-between items-end px-2">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className={i % 2 ? 'hidden md:block' : ''} style={{ marginBottom: 2 }}>
                {i % 3 === 0 ? <Tree /> : <Gift c={['#e63946', '#2a9d3f', '#3a86ff', '#ff7b00'][i % 4]} />}
              </div>
            ))}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-2" style={{ background: 'linear-gradient(#f4f9ff,#bcd8f5)', borderRadius: '8px 8px 0 0', boxShadow: '0 -1px 6px rgba(70,130,210,.45)' }} />
        </div>
      )}

      <button onClick={toggle} title={on ? 'Turn off Christmas theme' : 'Turn on Christmas theme'}
        className="fixed bottom-14 left-3 h-9 w-9 rounded-full bg-white shadow-lg border border-red-200 text-lg flex items-center justify-center hover:scale-110 transition-transform"
        style={{ zIndex: 45, opacity: on ? 1 : 0.6 }}>{'🎄'}</button>
    </>
  )
}