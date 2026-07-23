// src/lib/reverseGeocodeServer.ts
// SERVER-side reverse geocoding, used by the attendance punch route.
//
// Doing this on the server (instead of the browser) is what makes punch-in fast:
// the client only sends lat/lng and returns immediately, and there's no CORS
// problem so Google can be called directly. Every lookup is hard-capped by a
// timeout — a slow geocoder must never hold up a punch.
const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

// Prefer real postal/street results over whatever POI happens to be nearby —
// that's why punches used to be saved as "AIIMS Metro Station".
const TYPE_PRIORITY = [
  'street_address', 'premise', 'subpremise', 'route',
  'sublocality_level_1', 'sublocality', 'neighborhood', 'locality',
]

async function fetchWithTimeout(url: string, ms: number, headers?: Record<string, string>) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { signal: ctrl.signal, headers })
  } finally {
    clearTimeout(t)
  }
}

async function google(lat: number, lng: number, timeoutMs: number): Promise<string | null> {
  if (!GOOGLE_MAPS_KEY) return null
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_KEY}&language=en&region=in`
    const res = await fetchWithTimeout(url, timeoutMs)
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 'OK' || !data.results?.length) return null
    const pick =
      TYPE_PRIORITY.map(t => data.results.find((r: any) => r.types?.includes(t))).find(Boolean) ||
      data.results[0]
    return (pick?.formatted_address as string) || null
  } catch {
    return null
  }
}

async function nominatim(lat: number, lng: number, timeoutMs: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    const res = await fetchWithTimeout(url, timeoutMs, {
      'Accept-Language': 'en',
      'User-Agent': 'HBS-CRM/1.0 (attendance geocoding)',
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data?.display_name as string) || null
  } catch {
    return null
  }
}

/**
 * Resolve an address for a punch. Returns null (never throws) if both providers
 * fail or time out — the punch still saves, just without a street name.
 *
 * `accuracy` (metres) is folded into the label so a bad fix is obvious in reports:
 *   good  -> "Sector 44, Gurugram (±38m)"
 *   bad   -> "Approx. — New Delhi (±12km, Wi-Fi/IP based)"
 */
export async function reverseGeocodeForPunch(
  lat: number,
  lng: number,
  accuracy?: number | null,
  timeoutMs = 3500,
): Promise<string | null> {
  const base = (await google(lat, lng, timeoutMs)) || (await nominatim(lat, lng, timeoutMs))
  if (!base) return null

  if (!accuracy || !isFinite(accuracy)) return base
  if (accuracy > 5000) {
    return `Approx. — ${base} (±${Math.round(accuracy / 1000)}km, Wi-Fi/IP based)`
  }
  return `${base} (±${Math.round(accuracy)}m)`
}
