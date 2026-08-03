// src/lib/googleMaps.ts
// Google Maps helpers: JS API loader (for the Field Tracking map) + reverse geocoding.
// Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Falls back gracefully when absent.

export const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

let mapsPromise: Promise<any> | null = null

/**
 * Load the Google Maps JavaScript API once. Resolves with window.google.
 * Safe to call many times — it reuses the same in-flight/loaded promise.
 */
export function loadGoogleMaps(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'))
  if ((window as any).google?.maps) return Promise.resolve((window as any).google)
  if (mapsPromise) return mapsPromise

  if (!GOOGLE_MAPS_KEY) {
    return Promise.reject(new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'))
  }

  mapsPromise = new Promise((resolve, reject) => {
    const cb = '__initGmaps_' + Date.now()
    ;(window as any)[cb] = () => resolve((window as any).google)
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=geometry&callback=${cb}`
    s.async = true
    s.defer = true
    s.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(s)
  })
  return mapsPromise
}

/**
 * Reverse geocode via Google Geocoding — routed through our own server
 * (src/app/api/geocode/reverse) because Google's REST endpoint has no CORS
 * headers and can't be called directly from browser JS. Returns undefined
 * on any failure or if no Google key is configured server-side (caller
 * should fall back, e.g. to OSM Nominatim).
 */
export async function reverseGeocodeGoogle(lat: number, lng: number): Promise<string | undefined> {
  try {
    const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`)
    if (!res.ok) return undefined
    const data = await res.json()
    return data.address || undefined
  } catch {
    return undefined
  }
}
