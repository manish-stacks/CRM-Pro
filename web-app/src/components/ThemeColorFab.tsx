'use client'
// src/components/ThemeColorFab.tsx
// Floating accent-color picker, fixed to the right edge of every page.
// Mirrors Settings > Appearance: pick a color to lock it, or "Auto" for
// the daily rotation. Applies instantly + persists (localStorage always,
// backend best-effort so it's remembered for everyone next load).
import { useEffect, useRef, useState } from 'react'
import { Palette, X } from 'lucide-react'
import api from '@/lib/axios'
import { THEME_PALETTES, todaysPalette, getPaletteById, applyPalette } from '@/lib/themeColors'

export function ThemeColorFab() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('auto')
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { setCurrent(localStorage.getItem('theme_color_override') || 'auto') } catch {}
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const choose = async (id: string) => {
    setCurrent(id)
    applyPalette(id === 'auto' ? todaysPalette() : getPaletteById(id)!)
    try { localStorage.setItem('theme_color_override', id) } catch {}
    try {
      await api.put('/settings', { settings: { theme_color: { value: id, category: 'appearance' } } })
    } catch {}
  }

  const swatchRgb = (id: string) => (id === 'auto' ? todaysPalette() : getPaletteById(id))?.shades[500]
  const currentLabel = current === 'auto' ? 'Auto' : getPaletteById(current)?.label || 'Auto'

  return (
    <div ref={boxRef} className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex items-center">
      {/* Panel */}
      <div
        className={`bg-white rounded-l-2xl border border-r-0 border-gray-200 shadow-xl transition-all duration-200 ease-out origin-right overflow-hidden ${
          open ? 'w-56 opacity-100 scale-100' : 'w-0 opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="w-56 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Accent color</p>
              <p className="text-[11px] text-gray-500">{currentLabel}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 -mr-1 -mt-1 p-1">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-5 gap-2.5">
            {[{ id: 'auto', label: 'Auto' }, ...THEME_PALETTES].map(p => (
              <button key={p.id} type="button" title={p.label} onClick={() => choose(p.id)}
                className="relative w-8 h-8 rounded-full ring-1 ring-black/5 hover:scale-110 transition-transform"
                style={{ background: `rgb(${swatchRgb(p.id)})` }}>
                {current === p.id && (
                  <span className="absolute inset-0 rounded-full ring-2 ring-offset-2 ring-gray-900" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab handle */}
      <button type="button" onClick={() => setOpen(o => !o)} title="Accent color"
        className="h-12 w-9 rounded-l-xl shadow-xl flex items-center justify-center text-white border border-r-0 border-black/10 hover:brightness-110 active:scale-95 transition-all"
        style={{ background: 'rgb(var(--brand-600))' }}>
        <Palette size={16} />
      </button>
    </div>
  )
}