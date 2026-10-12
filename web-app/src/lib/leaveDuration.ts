// Human-readable leave length: "1 d", "2 d", "3h 30m", "1 d 4h".
// Hourly leaves use hourlyHours; others use days (1 day = 8h).
export function formatLeaveDuration(l: { duration?: string; days?: number | null; hourlyHours?: number | null }): string {
  const fmtHours = (h: number) => {
    const total = Math.round(h * 60)
    const hh = Math.floor(total / 60), mm = total % 60
    return [hh ? `${hh}h` : '', mm ? `${mm}m` : ''].filter(Boolean).join(' ') || '0h'
  }
  if (l.duration === 'SHORT_HOURLY') return fmtHours(Number(l.hourlyHours ?? (Number(l.days) || 0) * 8))
  const days = Number(l.days) || 0
  const whole = Math.floor(days + 1e-9)
  const rem = days - whole
  if (rem < 0.01) return `${whole} d`
  return `${whole ? whole + ' d ' : ''}${fmtHours(rem * 8)}`.trim()
}
