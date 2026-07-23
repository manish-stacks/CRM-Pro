// src/app/api/geocode/reverse/route.ts
// Server-side proxy for Google reverse geocoding.
//
// Why this exists: Google's Geocoding REST API (maps.googleapis.com/maps/api/geocode/json)
// does not return CORS headers, so a direct `fetch()` from browser JS always fails
// (blocked / "Failed to fetch"). That's why web punch-in/out never got a Google address
// while the mobile app (which uses the device's native geocoder, no CORS involved) did.
// Calling Google from our own server has no CORS restriction, so we proxy it here.
//
// If NEXT_PUBLIC_GOOGLE_MAPS_API_KEY isn't set, this returns { address: null } and the
// client falls back to OSM Nominatim exactly like it does today — behavior is unchanged
// when no key is configured.
import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/auth'
import { getClientSession } from '@/lib/clientAuth'

const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

export async function GET(req: NextRequest) {
  // Allow either a staff session (CRM attendance page) or a client-portal
  // session (client mobile/web) — this endpoint has no side effects, it's
  // just a geocoding lookup, so either logged-in party can use it.
  const staffSession = await getRequestSession(req)
  const clientSession = staffSession ? null : await getClientSession(req)
  if (!staffSession && !clientSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  }

  if (!GOOGLE_MAPS_KEY) {
    // No key configured — let the client fall back to Nominatim, same as before.
    return NextResponse.json({ address: null })
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_KEY}&language=en&region=in`
    const res = await fetch(url)
    if (!res.ok) return NextResponse.json({ address: null })
    const data = await res.json()
    if (data.status === 'OK' && data.results?.length) {
      // Google returns results[0] as whatever it thinks is "best" — very often a
      // nearby POI (a temple, a metro station), which is why saved addresses looked
      // wrong even when the coordinates were fine. Prefer real postal/street results.
      const PRIORITY = [
        'street_address', 'premise', 'subpremise', 'route',
        'sublocality_level_1', 'sublocality', 'neighborhood', 'locality',
      ]
      const pick =
        PRIORITY.map(t => data.results.find((r: any) => r.types?.includes(t))).find(Boolean) ||
        data.results[0]
      return NextResponse.json({ address: pick.formatted_address as string })
    }
    return NextResponse.json({ address: null })
  } catch (e) {
    console.error('Reverse geocode proxy error:', e)
    return NextResponse.json({ address: null })
  }
}