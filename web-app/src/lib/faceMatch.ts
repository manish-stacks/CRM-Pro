// src/lib/faceMatch.ts — server-side matching of face descriptors.
export const MATCH_THRESHOLD = 0.45   // lower = stricter (0.6 is the library default)
export const MIN_MARGIN = 0.06        // best match must beat the next person by this much

export function distance(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d }
  return Math.sqrt(s)
}

export function validDescriptor(d: any): d is number[] {
  return Array.isArray(d) && d.length === 128 && d.every(n => typeof n === 'number' && Number.isFinite(n))
}

export function bestMatch(probe: number[], profiles: { employeeId: string; descriptors: number[][] }[]) {
  const scores = profiles
    .map(p => ({ employeeId: p.employeeId, dist: Math.min(...p.descriptors.map(d => distance(probe, d))) }))
    .sort((a, b) => a.dist - b.dist)
  const best = scores[0]
  if (!best || best.dist > MATCH_THRESHOLD) return null
  const second = scores[1]
  if (second && second.dist - best.dist < MIN_MARGIN) return null   // too ambiguous
  return best
}
