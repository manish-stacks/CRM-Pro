// src/app/api/tracking/snap-roads/route.ts
// Turns a raw GPS breadcrumb trail into a road-following route.
//
// This used to be called straight from the browser with the public Maps key.
// Browser keys are almost always locked to the Maps JavaScript API + an HTTP
// referrer, and the Roads API accepts neither — so every call failed and the
// map fell back to straight lines cutting across blocks. Doing it here lets us
// use an unrestricted server key, batch more than 100 points, and fall back to
// the Directions API (which also follows roads) when Roads isn't enabled.
import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api'

export const runtime = 'nodejs'

type Pt = { lat: number; lng: number }

const KEY =
  process.env.GOOGLE_MAPS_SERVER_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  ''

/** Evenly sample a path down to `max` points (keeps the shape, not just the head). */
function downsample(path: Pt[], max: number): Pt[] {
  if (path.length <= max) return path
  const step = (path.length - 1) / (max - 1)
  const out: Pt[] = []
  for (let i = 0; i < max; i++) out.push(path[Math.round(i * step)])
  return out
}

function haversineKm(a: Pt, b: Pt) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Drop points that barely moved — GPS jitter while standing still. */
function dedupe(path: Pt[], minMeters = 12): Pt[] {
  const out: Pt[] = []
  for (const p of path) {
    if (!out.length || haversineKm(out[out.length - 1], p) * 1000 >= minMeters) out.push(p)
  }
  if (out.length < 2 && path.length) return path.slice(0, 2)
  return out
}

function decodePolyline(str: string): Pt[] {
  const out: Pt[] = []
  let index = 0, lat = 0, lng = 0
  while (index < str.length) {
    let b: number, shift = 0, result = 0
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += (result & 1) ? ~(result >> 1) : result >> 1
    shift = 0; result = 0
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lng += (result & 1) ? ~(result >> 1) : result >> 1
    out.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }
  return out
}

/** Roads API — 100 points max per call, so the trail goes out in chunks. */
async function snapToRoads(path: Pt[]): Promise<Pt[] | null> {
  const CHUNK = 100
  const chunks: Pt[][] = []
  for (let i = 0; i < path.length; i += CHUNK - 1) {
    const c = path.slice(i, i + CHUNK)
    if (c.length >= 2) chunks.push(c)
  }
  if (!chunks.length) return null

  const out: Pt[] = []
  for (const c of chunks) {
    const points = c.map(p => `${p.lat},${p.lng}`).join('|')
    const url = `https://roads.googleapis.com/v1/snapToRoads?path=${encodeURIComponent(points)}&interpolate=true&key=${KEY}`
    const res = await fetch(url, { cache: 'no-store' })
    const json = await res.json()
    if (json.error || !json.snappedPoints?.length) {
      console.error('[snap-roads] Roads API:', json?.error?.status, json?.error?.message)
      return null
    }
    for (const p of json.snappedPoints) {
      out.push({ lat: p.location.latitude, lng: p.location.longitude })
    }
  }
  return out.length >= 2 ? dedupe(out, 3) : null
}

/** Directions API — routes through the day's points, following real roads. */
async function routeViaDirections(path: Pt[]): Promise<Pt[] | null> {
  // origin + destination + up to 23 waypoints per request
  const trimmed = downsample(path, 25)
  const origin = trimmed[0]
  const destination = trimmed[trimmed.length - 1]
  const waypoints = trimmed.slice(1, -1)

  const params = new URLSearchParams({
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    mode: 'driving',
    key: KEY,
  })
  if (waypoints.length) {
    params.set('waypoints', waypoints.map(p => `${p.lat},${p.lng}`).join('|'))
  }

  const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`, { cache: 'no-store' })
  const json = await res.json()
  if (json.status !== 'OK' || !json.routes?.length) {
    console.error('[snap-roads] Directions API:', json?.status, json?.error_message)
    return null
  }

  // Step-level polylines give a much denser line than overview_polyline
  const pts: Pt[] = []
  for (const leg of json.routes[0].legs || []) {
    for (const step of leg.steps || []) {
      if (step.polyline?.points) pts.push(...decodePolyline(step.polyline.points))
    }
  }
  if (pts.length < 2 && json.routes[0].overview_polyline?.points) {
    pts.push(...decodePolyline(json.routes[0].overview_polyline.points))
  }

  const distanceKm =
    (json.routes[0].legs || []).reduce((s: number, l: any) => s + (l.distance?.value || 0), 0) / 1000

  return pts.length >= 2 ? (Object.assign(dedupe(pts, 3), { distanceKm }) as any) : null
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, 'MANAGER')
  if (auth instanceof Response) return auth

  if (!KEY) return errorResponse('Google Maps server key not configured', 500)

  const body = await req.json()
  const raw: Pt[] = Array.isArray(body?.path) ? body.path : []
  const clean = dedupe(
    raw.filter(p => typeof p?.lat === 'number' && typeof p?.lng === 'number')
  )
  if (clean.length < 2) return successResponse({ path: clean, mode: 'raw' })

  try {
    // 1) Roads API — highest fidelity, keeps every turn the person actually made
    const snapped = await snapToRoads(downsample(clean, 400))
    if (snapped) return successResponse({ path: snapped, mode: 'roads' })

    // 2) Directions API — still road-following, works on a plain Maps key
    const routed = await routeViaDirections(clean)
    if (routed) {
      return successResponse({
        path: routed,
        mode: 'directions',
        distanceKm: (routed as any).distanceKm ?? null,
      })
    }

    // 3) Give up and let the client draw the raw trail
    return successResponse({ path: clean, mode: 'raw' })
  } catch (e: any) {
    console.error('[snap-roads] failed:', e)
    return successResponse({ path: clean, mode: 'raw' })
  }
}
