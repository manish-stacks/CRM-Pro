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
 * Reverse geocode via Google Geocoding REST API. Returns a formatted address.
 * No JS API needed. Returns undefined on any failure (caller should fall back).
 */
export async function reverseGeocodeGoogle(lat: number, lng: number): Promise<string | undefined> {
  if (!GOOGLE_MAPS_KEY) return undefined
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_KEY}`
    const res = await fetch(url)
    if (!res.ok) return undefined
    const data = await res.json()
    if (data.status === 'OK' && data.results?.length) {
      return data.results[0].formatted_address as string
    }
    return undefined
  } catch {
    return undefined
  }
}
