// src/lib/geolocation.ts
// Client-side browser geolocation + reverse geocoding.
// Reverse geocode prefers Google (accurate) and falls back to OSM Nominatim (no key).
// Used by attendance punch-in/out and the field-tracking pinger.
import { reverseGeocodeGoogle } from './googleMaps'

export interface GeoResult {
  latitude: number
  longitude: number
  accuracy?: number
  address?: string
  error?: string
}

export interface GeoOptions {
  reverseGeocode?: boolean    // Fetch address from Nominatim? default true
  timeoutMs?: number          // Geolocation permission timeout, default 10s
  highAccuracy?: boolean      // default true
}

/** Wrap navigator.geolocation.getCurrentPosition in a Promise */
function getCurrentPosition(opts: GeoOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation not supported by this browser'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: opts.highAccuracy ?? true,
      timeout: opts.timeoutMs ?? 15000,
      maximumAge: 15000,
    })
  })
}

/**
 * Reverse geocode: Google Geocoding first (accurate, needs key), else OSM Nominatim.
 */
async function reverseGeocode(lat: number, lng: number): Promise<string | undefined> {
  // Google first
  const g = await reverseGeocodeGoogle(lat, lng)
  if (g) return g
  // Fallback: OpenStreetMap Nominatim (free, no key)
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
    if (!res.ok) return undefined
    const data = await res.json()
    return data.display_name as string | undefined
  } catch {
    return undefined
  }
}

/**
 * Get current position and (optionally) reverse-geocode to an address.
 * Returns { latitude, longitude, address, error }
 */
export async function getCurrentGeo(opts: GeoOptions = {}): Promise<GeoResult> {
  try {
    const pos = await getCurrentPosition(opts)
    const { latitude, longitude, accuracy } = pos.coords
    let address: string | undefined
    if (opts.reverseGeocode !== false) {
      address = await reverseGeocode(latitude, longitude)
    }
    return { latitude, longitude, accuracy, address }
  } catch (e: any) {
    let msg = 'Unable to get location'
    if (e?.code === 1) msg = 'Location permission denied. Please enable location access.'
    else if (e?.code === 2) msg = 'Location unavailable. Check your connection.'
    else if (e?.code === 3) msg = 'Location request timed out. Try again.'
    else if (e?.message) msg = e.message
    return { latitude: 0, longitude: 0, error: msg }
  }
}
