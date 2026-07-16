// src/lib/distance.ts
// Zomato-style "kitni door / kitne time me pahunchoge" helper.
// Gets real driving distance + traffic-aware ETA from Google Distance Matrix..
// Key na ho ya API fail ho jaye to haversine (seedhi line) * 1.35 road-factor se
// Falls back to an approximate value — the screen is never left empty.
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

export interface LatLng { lat: number; lng: number }

export interface EtaResult {
  key: string
  distanceMeters: number | null
  distanceText: string | null
  durationSecs: number | null
  durationText: string | null
  approx: boolean          // true = haversine fallback, not real routing
}

const R = 6371000
const rad = (d: number) => (d * Math.PI) / 180

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(x)))
}

export function fmtDistance(m: number): string {
  if (m < 1000) return `${m} m`
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`
}

export function fmtDuration(sec: number): string {
  const mins = Math.round(sec / 60)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} hr ${m} min` : `${h} hr`
}

/** Rough city-traffic fallback: ~22 km/h average + 1.35x road winding factor */
function approxEta(origin: LatLng, dest: LatLng): { meters: number; secs: number } {
  const straight = haversineMeters(origin, dest)
  const meters = Math.round(straight * 1.35)
  const secs = Math.round((meters / 1000 / 22) * 3600)
  return { meters, secs }
}

/** Geocode an address string -> LatLng (used to backfill Lead.meetingLat/Lng) */
export async function geocodeAddress(address: string): Promise<LatLng | null> {
  if (!GOOGLE_KEY || !address?.trim()) return null
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=in&key=${GOOGLE_KEY}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const loc = data?.results?.[0]?.geometry?.location
    if (!loc) return null
    return { lat: loc.lat, lng: loc.lng }
  } catch {
    return null
  }
}

/**
 * One origin -> many destinations. `destinations` me har item ka `key` wapas
 * is returned so it can be mapped on the client side
 * Google Distance Matrix has a limit of 25 destinations/request — so it's chunked.
 */
export async function getEtas(
  origin: LatLng,
  destinations: { key: string; point?: LatLng | null; address?: string | null }[],
  mode: 'driving' | 'walking' | 'bicycling' | 'transit' = 'driving'
): Promise<EtaResult[]> {
  const usable = destinations.filter(d => d.point || d.address)
  const out: EtaResult[] = destinations
    .filter(d => !d.point && !d.address)
    .map(d => ({ key: d.key, distanceMeters: null, distanceText: null, durationSecs: null, durationText: null, approx: true }))

  if (!usable.length) return out

  const fallback = (d: typeof usable[number]): EtaResult => {
    if (!d.point) {
      return { key: d.key, distanceMeters: null, distanceText: null, durationSecs: null, durationText: null, approx: true }
    }
    const a = approxEta(origin, d.point)
    return {
      key: d.key,
      distanceMeters: a.meters,
      distanceText: fmtDistance(a.meters),
      durationSecs: a.secs,
      durationText: fmtDuration(a.secs),
      approx: true,
    }
  }

  if (!GOOGLE_KEY) return [...out, ...usable.map(fallback)]

  const CHUNK = 25
  for (let i = 0; i < usable.length; i += CHUNK) {
    const batch = usable.slice(i, i + CHUNK)
    try {
      const destParam = batch
        .map(d => (d.point ? `${d.point.lat},${d.point.lng}` : encodeURIComponent(d.address as string)))
        .join('|')
      const url =
        `https://maps.googleapis.com/maps/api/distancematrix/json` +
        `?origins=${origin.lat},${origin.lng}` +
        `&destinations=${destParam}` +
        `&mode=${mode}&units=metric&departure_time=now&region=in&key=${GOOGLE_KEY}`

      const res = await fetch(url)
      const data = res.ok ? await res.json() : null
      const elements = data?.rows?.[0]?.elements

      if (!elements || data?.status !== 'OK') {
        out.push(...batch.map(fallback))
        continue
      }

      batch.forEach((d, idx) => {
        const el = elements[idx]
        if (!el || el.status !== 'OK') { out.push(fallback(d)); return }
        // duration_in_traffic is only returned when departure_time=now is passed
        const dur = el.duration_in_traffic || el.duration
        out.push({
          key: d.key,
          distanceMeters: el.distance?.value ?? null,
          distanceText: el.distance?.value != null ? fmtDistance(el.distance.value) : null,
          durationSecs: dur?.value ?? null,
          durationText: dur?.value != null ? fmtDuration(dur.value) : null,
          approx: false,
        })
      })
    } catch {
      out.push(...batch.map(fallback))
    }
  }

  return out
}
