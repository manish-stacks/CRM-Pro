// src/lib/geolocation.ts
// Client-side browser geolocation.
//
// WHY IT'S BUILT THIS WAY:
//  * The first fix a browser hands back is usually the cached, low-accuracy one,
//    so we use watchPosition and keep the BEST reading instead of the first.
//  * But on a desktop PC there is no GPS — the fix comes from Wi-Fi/IP lookup and
//    will NEVER get better, so waiting 20s just makes punch-in slow for nothing.
//    Hence `settleMs`: once a fix arrives, we only wait a few more seconds for a
//    better one, then go with what we have.
//  * Reverse geocoding is NOT done here by default any more — it added seconds to
//    every punch. The server resolves the address from lat/lng instead.
import { reverseGeocodeGoogle } from './googleMaps'

export interface GeoResult {
  latitude: number
  longitude: number
  accuracy?: number        // metres (radius). Lower = better.
  lowAccuracy?: boolean    // accuracy worse than `warnAccuracyM`
  ipLevel?: boolean        // accuracy so poor it's clearly a Wi-Fi/IP guess
  address?: string
  error?: string
}

export interface GeoOptions {
  reverseGeocode?: boolean    // default FALSE — let the server do it
  timeoutMs?: number          // hard cap, default 10s
  settleMs?: number           // extra wait after the first fix, default 2.5s
  highAccuracy?: boolean      // default true
  desiredAccuracyM?: number   // stop immediately at/below this, default 100m
  warnAccuracyM?: number      // flag lowAccuracy above this, default 500m
  ipLevelAccuracyM?: number   // above this it's an IP guess, default 5000m
  maxAgeMs?: number           // cached-fix age allowed, default 0 (none)
}

function getBestPosition(opts: GeoOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation not supported by this browser'))
      return
    }

    const hardTimeout = opts.timeoutMs ?? 10000
    const settleMs = opts.settleMs ?? 2500
    const desired = opts.desiredAccuracyM ?? 100

    let best: GeolocationPosition | null = null
    let watchId: number | null = null
    let settleTimer: any = null
    let done = false

    const acc = (p: GeolocationPosition | null) => p?.coords?.accuracy ?? Number.MAX_SAFE_INTEGER

    const finish = (err?: any) => {
      if (done) return
      done = true
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
      clearTimeout(hardTimer)
      clearTimeout(settleTimer)
      if (best) resolve(best)
      else reject(err || Object.assign(new Error('Location request timed out. Try again.'), { code: 3 }))
    }

    const hardTimer = setTimeout(() => finish(), hardTimeout)

    watchId = navigator.geolocation.watchPosition(
      pos => {
        const improved = acc(pos) < acc(best)
        if (improved) best = pos
        // Good enough → done straight away
        if (acc(best) <= desired) return finish()
        // Otherwise give it a short window to improve, then take what we have.
        // (On desktop it never improves, so this is what keeps punch-in fast.)
        if (improved || !settleTimer) {
          clearTimeout(settleTimer)
          settleTimer = setTimeout(() => finish(), settleMs)
        }
      },
      err => { if (!best) finish(err) },
      {
        enableHighAccuracy: opts.highAccuracy ?? true,
        timeout: hardTimeout,
        maximumAge: opts.maxAgeMs ?? 0,
      }
    )
  })
}

/** Google (via our own server) → OSM Nominatim fallback. Client-side; slow — avoid on punch. */
async function reverseGeocode(lat: number, lng: number): Promise<string | undefined> {
  const g = await reverseGeocodeGoogle(lat, lng)
  if (g) return g
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
    if (!res.ok) return undefined
    const data = await res.json()
    return data.display_name as string | undefined
  } catch {
    return undefined
  }
}

export async function getCurrentGeo(opts: GeoOptions = {}): Promise<GeoResult> {
  try {
    const pos = await getBestPosition(opts)
    const { latitude, longitude, accuracy } = pos.coords
    const lowAccuracy = (accuracy ?? 0) > (opts.warnAccuracyM ?? 500)
    const ipLevel = (accuracy ?? 0) > (opts.ipLevelAccuracyM ?? 5000)

    let address: string | undefined
    if (opts.reverseGeocode === true) {
      address = await reverseGeocode(latitude, longitude)
    }
    return { latitude, longitude, accuracy, lowAccuracy, ipLevel, address }
  } catch (e: any) {
    let msg = 'Unable to get location'
    if (e?.code === 1) msg = 'Location permission denied. Please enable location access.'
    else if (e?.code === 2) msg = 'Location unavailable. Turn on GPS / Wi-Fi and try again.'
    else if (e?.code === 3) msg = 'Location request timed out. Try again.'
    else if (e?.message) msg = e.message
    return { latitude: 0, longitude: 0, error: msg }
  }
}

/** "Sector 44, Gurugram (±38m)" — makes a bad fix obvious in reports. */
export function withAccuracy(address: string | undefined, accuracy?: number): string | undefined {
  if (!address) return address
  if (!accuracy || !isFinite(accuracy)) return address
  return `${address} (±${Math.round(accuracy)}m)`
}
