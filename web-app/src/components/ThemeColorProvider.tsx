'use client'
// src/components/ThemeColorProvider.tsx
// Applies the app's brand color (rose/blue/emerald/etc.) as CSS variables.
// Default: auto-picks one of 10 colors each day, same for everyone.
// Admin override: Settings > Appearance can lock one color; we read that
// from localStorage (mirrored there whenever an admin saves it) so this
// works with zero extra API calls on every page load.
import { useEffect } from 'react'
import { todaysPalette, getPaletteById, applyPalette } from '@/lib/themeColors'

export function ThemeColorProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let locked: string | null = null
    try { locked = localStorage.getItem('theme_color_override') } catch {}
    const palette = (locked && locked !== 'auto' && getPaletteById(locked)) || todaysPalette()
    applyPalette(palette)
  }, [])
  return <>{children}</>
}
