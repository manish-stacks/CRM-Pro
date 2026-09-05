'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import api from '@/lib/axios'
import { useAuth } from '@/hooks/useAuth'
import { Select, EmptyState, Badge } from '@/components/ui'
import { getInitials } from '@/lib/utils'
import { MapPin, Navigation, Users2, Loader2, Clock, Battery, RefreshCw, Route } from 'lucide-react'
import toast from 'react-hot-toast'
import { loadGoogleMaps, GOOGLE_MAPS_KEY } from '@/lib/googleMaps'

// Evenly samples a path down to `max` points, instead of truncating to the
// first `max` — a single billed Roads API request still covers the whole
// day's route instead of just its start.
function downsamplePath(path: { lat: number; lng: number }[], max: number) {
  if (path.length <= max) return path
  const step = (path.length - 1) / (max - 1)
  const out: { lat: number; lng: number }[] = []
  for (let i = 0; i < max; i++) out.push(path[Math.round(i * step)])
  return out
}

// Ping coordinates are raw GPS points recorded every so often — connecting
// them with a straight polyline cuts across blocks/parks instead of
// following the street. Google's Roads API snaps + interpolates the path
// onto the real road network so the drawn route looks like an actual drive.
// Falls back to the raw path if the API errors out (e.g. not enabled on the key).
async function snapPathToRoads(path: { lat: number; lng: number }[]): Promise<{ lat: number; lng: number }[] | null> {
  if (path.length < 2) return null
  try {
    // Roads API accepts up to 100 points per request.
    const pointsParam = downsamplePath(path, 100).map(p => `${p.lat},${p.lng}`).join('|')
    const url = `https://roads.googleapis.com/v1/snapToRoads?path=${encodeURIComponent(pointsParam)}&interpolate=true&key=${GOOGLE_MAPS_KEY}`
    const res = await fetch(url)
    const json = await res.json()
    if (json.error) {
      // e.g. "Roads API" not enabled on this key/project, or billing off.
      console.error('Roads API snap failed:', json.error.status, json.error.message)
      return null
    }
    if (!json.snappedPoints?.length) return null
    return json.snappedPoints.map((p: any) => ({ lat: p.location.latitude, lng: p.location.longitude }))
  } catch (e) {
    console.error('Roads API snap request failed:', e)
    return null
  }
}

// Straight-line distance between two points, in km (good enough for a
// breadcrumb trail's total-distance estimate — doesn't need road-accuracy).
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const la1 = a.lat * Math.PI / 180
  const la2 = b.lat * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Relative "X ago" for a timestamp — makes stale pings obvious at a glance
// instead of making the user compare a raw clock time to now themselves.
function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(dateStr).toLocaleDateString('en-IN')
}

// Load Google Maps JS API at runtime
function useGoogleMaps() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    loadGoogleMaps().then(() => setReady(true)).catch((e) => setError(e.message))
  }, [])
  return { ready, error }
}

export default function TrackingPage() {
  const { isAtLeast } = useAuth()
  const { ready: mapsReady, error: mapsError } = useGoogleMaps()

  const [tab, setTab] = useState<'live' | 'route'>('live')
  const [live, setLive] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [routeData, setRouteData] = useState<any>(null)
  const [routeStats, setRouteStats] = useState<any>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [people, setPeople] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [livePaused, setLivePaused] = useState(false)
  const pollRef = useRef<any>(null)
  // Caches route-history responses + their (billed) Roads API snap result,
  // keyed by user+date — revisiting the same day redraws instantly with
  // zero extra backend or Google API calls.
  const routeCacheRef = useRef<Map<string, any>>(new Map())

  const mapRef = useRef<any>(null)
  const mapInstance = useRef<any>(null)
  const overlaysRef = useRef<any[]>([])
  const markersRef = useRef<Record<string, any>>({})
  const infoRef = useRef<any>(null)
  const boundsRef = useRef<any>(null)

  // Quick-glance counts — moving / idle / no-signal — so status is visible
  // without scanning the whole list.
  const movingCount = live.filter(u => u.lastPing?.isMoving).length
  const idleCount = live.filter(u => u.lastPing && !u.lastPing.isMoving).length
  const offlineCount = live.filter(u => !u.lastPing).length

  const filteredLive = live.filter(u => u.name?.toLowerCase().includes(search.toLowerCase()))

  // Pan/zoom the map to a specific person and pop their info window —
  // clicking a card in the list should take you straight to them on the map.
  const focusUser = (userId: string) => {
    const marker = markersRef.current[userId]
    if (!marker || !mapInstance.current) return
    mapInstance.current.panTo(marker.getPosition())
    mapInstance.current.setZoom(16)
    ;(window as any).google.maps.event.trigger(marker, 'click')
  }

  const recenter = () => {
    if (mapInstance.current && boundsRef.current) mapInstance.current.fitBounds(boundsRef.current, 60)
  }

  const clearOverlays = () => {
    overlaysRef.current.forEach((o: any) => o.setMap && o.setMap(null))
    overlaysRef.current = []
    markersRef.current = {}
  }

  const loadLive = useCallback(async () => {
    try {
      const r = await api.get('/tracking/live')
      setLive(r.data.data || [])
    } catch { toast.error('Failed to load live locations') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (tab !== 'live') return // no need to poll /tracking/live while looking at Route History
    const startPolling = () => { pollRef.current = setInterval(loadLive, 30000); setLivePaused(false) }
    const stopPolling = () => { if (pollRef.current) clearInterval(pollRef.current); pollRef.current = null; setLivePaused(true) }
    const handleVisibility = () => {
      if (document.hidden) stopPolling()
      else { loadLive(); startPolling() }
    }
    loadLive()
    startPolling()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => { stopPolling(); document.removeEventListener('visibilitychange', handleVisibility) }
  }, [loadLive, tab])

  // Marketing executives — the only tracked role (for Route-History dropdown)
  useEffect(() => {
    api.get('/users/by-role?roles=MARKETING_EXECUTIVE')
      .then(r => setPeople(r.data.data || []))
      .catch(() => {})
  }, [])

  // Init Google Map when ready
  useEffect(() => {
    if (!mapsReady || !mapRef.current || mapInstance.current) return
    const g = (window as any).google
    mapInstance.current = new g.maps.Map(mapRef.current, {
      center: { lat: 28.6139, lng: 77.209 }, // Delhi default
      zoom: 11,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    })
    infoRef.current = new g.maps.InfoWindow()
  }, [mapsReady])

  // Render live markers
  useEffect(() => {
    if (!mapInstance.current || tab !== 'live') return
    const g = (window as any).google
    clearOverlays()
    const withLoc = live.filter(u => u.lastPing)
    const bounds = new g.maps.LatLngBounds()
    withLoc.forEach(u => {
      const pos = { lat: u.lastPing.latitude, lng: u.lastPing.longitude }
      // Moving staff get a soft brand-colored pulse ring under the pin —
      // a quiet motion cue instead of a static dot for everyone.
      if (u.lastPing.isMoving) {
        overlaysRef.current.push(new g.maps.Circle({
          center: pos, radius: 80, map: mapInstance.current,
          fillColor: '#e11d48', fillOpacity: 0.12, strokeColor: '#e11d48', strokeOpacity: 0.25, strokeWeight: 1,
        }))
      }
      const marker = new g.maps.Marker({
        position: pos,
        map: mapInstance.current,
        title: u.name,
        label: { text: getInitials(u.name), color: '#fff', fontSize: '10px', fontWeight: 'bold' },
        icon: {
          path: g.maps.SymbolPath.CIRCLE, scale: 15,
          fillColor: u.lastPing.isMoving ? '#e11d48' : '#64748b', fillOpacity: 1,
          strokeColor: '#fff', strokeWeight: 2,
        },
      })
      marker.addListener('click', () => {
        infoRef.current.setContent(
          `<div style="font-size:13px"><b>${u.name}</b><br/>${u.lastPing.isMoving ? '🚶 Moving' : '📍 Stationary'}<br/>${new Date(u.lastPing.recordedAt).toLocaleTimeString('en-IN')}${u.lastPing.address ? '<br/>' + u.lastPing.address : ''}</div>`
        )
        infoRef.current.open(mapInstance.current, marker)
      })
      overlaysRef.current.push(marker)
      markersRef.current[u.userId] = marker
      bounds.extend(pos)
    })
    boundsRef.current = withLoc.length > 0 ? bounds : null
    if (withLoc.length > 0) {
      mapInstance.current.fitBounds(bounds, 60)
      if (withLoc.length === 1) mapInstance.current.setZoom(15)
    }
  }, [live, tab, mapsReady])

  const loadRoute = async () => {
    if (!selectedUser) { toast.error('Select a person'); return }
    setRouteLoading(true)
    try {
      const cacheKey = `${selectedUser}|${selectedDate}`
      const cached = routeCacheRef.current.get(cacheKey)
      const data = cached ? cached.data : (await api.get(`/tracking/route-history?userId=${selectedUser}&date=${selectedDate}`)).data.data
      setRouteData(data)
      if (mapInstance.current) {
        const g = (window as any).google
        clearOverlays()
        const pings = data.pings || []
        const visits = data.visits || []
        const bounds = new g.maps.LatLngBounds()
        let anyOverlay = false

        if (pings.length > 0) {
          const path = pings.map((p: any) => ({ lat: p.latitude, lng: p.longitude }))
          const distanceKm = path.slice(1).reduce((sum: number, pt: any, i: number) => sum + haversineKm(path[i], pt), 0)

          // Snap the breadcrumb trail onto actual roads for the drawn line;
          // markers below still use the real recorded points. Skipped for a
          // handful of clustered points (near-stationary day) since snapping
          // wouldn't change the line but still costs a billed API call —
          // and skipped entirely on a cache hit, reusing the prior result.
          let snapped: { lat: number; lng: number }[] | null
          if (cached) {
            snapped = cached.snapped
          } else {
            snapped = (path.length >= 3 && distanceKm > 0.1) ? await snapPathToRoads(path) : null
            routeCacheRef.current.set(cacheKey, { data, snapped })
          }
          const linePath = snapped && snapped.length >= 2 ? snapped : path
          if (!snapped && path.length >= 3 && distanceKm > 0.1) {
            toast('Route line is not road-snapped — check console (Roads API may not be enabled on this key)', { icon: '⚠️', duration: 6000 })
          }
          const line = new g.maps.Polyline({
            path: linePath, strokeColor: '#e11d48', strokeWeight: 5, strokeOpacity: 0.95,
            map: mapInstance.current, zIndex: 2,
          })
          // Soft glow underneath the main line — same trick the delivery-app
          // rider maps use to make the route pop off the street grid.
          const glow = new g.maps.Polyline({
            path: linePath, strokeColor: '#e11d48', strokeWeight: 12, strokeOpacity: 0.18,
            map: mapInstance.current, zIndex: 1,
          })
          overlaysRef.current.push(glow, line)

          path.forEach((pt: any) => bounds.extend(pt))
          anyOverlay = true

          // Start marker — pin styled like a "check-in" flag
          overlaysRef.current.push(new g.maps.Marker({
            position: path[0], map: mapInstance.current, title: 'Start (Check-in)', zIndex: 3,
            icon: {
              path: 'M12 0C7.6 0 4 3.6 4 8c0 6 8 16 8 16s8-10 8-16c0-4.4-3.6-8-8-8z',
              fillColor: '#16a34a', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 1.5,
              scale: 1.1, anchor: new g.maps.Point(12, 24),
            },
          }))
          // Latest position — brand-colored pin so it reads as "where they are now"
          overlaysRef.current.push(new g.maps.Marker({
            position: path[path.length - 1], map: mapInstance.current, title: 'Latest position', zIndex: 4,
            icon: {
              path: 'M12 0C7.6 0 4 3.6 4 8c0 6 8 16 8 16s8-10 8-16c0-4.4-3.6-8-8-8z',
              fillColor: '#e11d48', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 1.5,
              scale: 1.1, anchor: new g.maps.Point(12, 24),
            },
          }))

          // Route summary — distance walked/driven, elapsed time, stops made.
          const firstT = new Date(pings[0].recordedAt)
          const lastT = new Date(pings[pings.length - 1].recordedAt)
          const durationMins = Math.max(0, Math.round((lastT.getTime() - firstT.getTime()) / 60000))
          setRouteStats({
            distanceKm, durationMins,
            stops: visits.length,
            lastUpdate: lastT,
          })
          if (cached) toast('Loaded from cache — no extra API calls made', { icon: '⚡', duration: 2500 })
        } else {
          setRouteStats(visits.length ? { distanceKm: 0, durationMins: 0, stops: visits.length, lastUpdate: null } : null)
        }

        // Visit markers — plotted independently of whether GPS pings exist,
        // so a day with only manual check-ins (no continuous tracking) still
        // shows its visits on the map instead of the map staying empty.
        visits.forEach((v: any) => {
          if (v.checkInLat && v.checkInLng) {
            const vm = new g.maps.Marker({
              position: { lat: v.checkInLat, lng: v.checkInLng },
              map: mapInstance.current,
              title: v.clientName,
              icon: { path: g.maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#22c55e', fillOpacity: 0.9, strokeColor: '#166534', strokeWeight: 2 },
            })
            vm.addListener('click', () => {
              infoRef.current.setContent(`<div style="font-size:13px"><b>${v.clientName}</b><br/>${v.purpose || 'Visit'}<br/>${v.status}</div>`)
              infoRef.current.open(mapInstance.current, vm)
            })
            overlaysRef.current.push(vm)
            bounds.extend({ lat: v.checkInLat, lng: v.checkInLng })
            anyOverlay = true
          }
        })

        if (anyOverlay) {
          mapInstance.current.fitBounds(bounds, 60)
          boundsRef.current = bounds
        } else {
          toast('No location data for this day', { icon: 'ℹ️' })
        }
      }
    } catch { toast.error('Failed to load route') }
    finally { setRouteLoading(false) }
  }

  if (!isAtLeast('MANAGER')) {
    return <div className="p-8"><EmptyState icon={<MapPin size={50} />} title="Access denied" description="Only managers and admins can view tracking" /></div>
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Navigation size={22} /> Field Tracking
          </h1>
          <p className="text-sm text-gray-500 mt-1">Live locations and daily route history of field staff</p>
        </div>
        <button onClick={loadLive} className="btn-secondary btn-sm">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-100">
        {[
          { key: 'live', label: 'Live Map', icon: MapPin },
          { key: 'route', label: 'Route History', icon: Route },
        ].map((t: any) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              tab === t.key ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: map */}
        <div className="lg:col-span-2">
          {tab === 'route' && (
            <div className="card p-3 mb-3 flex items-center gap-2 flex-wrap">
              <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className="max-w-xs input">
                <option value="">{people.length ? 'Select marketing executive...' : 'No marketing executives found'}</option>
                {people.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <input type="date" className="input max-w-[160px] text-sm" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
              <button onClick={loadRoute} className="btn-primary btn-sm" disabled={routeLoading}>
                {routeLoading ? <Loader2 size={13} className="animate-spin" /> : <Route size={13} />} Load Route
              </button>
            </div>
          )}
          <div className="card overflow-hidden relative">
            <div ref={mapRef} style={{ height: '540px', width: '100%', background: '#e5e7eb' }}>
              {!mapsReady && (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-4">
                  {mapsError ? (
                    <>
                      <MapPin size={32} className="text-gray-400" />
                      <p className="text-sm text-gray-500">Failed to load map</p>
                      <p className="text-xs text-gray-400">
                        {!GOOGLE_MAPS_KEY
                          ? 'Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env (enable Maps JavaScript API + restrict the key).'
                          : mapsError}
                      </p>
                    </>
                  ) : (
                    <Loader2 className="animate-spin text-gray-400" />
                  )}
                </div>
              )}
            </div>

            {/* Recenter — snap back to the fitted bounds after panning/zooming around */}
            {mapsReady && (
              <button
                onClick={recenter}
                title="Recenter"
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-gray-600 hover:text-brand-600 hover:border-brand-200 transition-colors"
              >
                <Navigation size={15} />
              </button>
            )}

            {/* Route summary — same weight as a rider-app "arriving in" card,
                tuned to what actually matters for a completed/in-progress route. */}
            {tab === 'route' && routeStats && (
              <div className="absolute left-3 bottom-3 right-3 sm:right-auto sm:min-w-[260px] bg-white/95 backdrop-blur rounded-xl shadow-lg border border-gray-100 px-4 py-3 flex items-center gap-4">
                <div>
                  <p className="text-[11px] text-gray-400 font-medium">Distance covered</p>
                  <p className="text-lg font-bold text-gray-900">{routeStats.distanceKm.toFixed(1)} km</p>
                </div>
                <div className="h-8 w-px bg-gray-100" />
                <div>
                  <p className="text-[11px] text-gray-400 font-medium">Duration</p>
                  <p className="text-lg font-bold text-gray-900">
                    {routeStats.durationMins >= 60
                      ? `${Math.floor(routeStats.durationMins / 60)}h ${routeStats.durationMins % 60}m`
                      : `${routeStats.durationMins}m`}
                  </p>
                </div>
                <div className="h-8 w-px bg-gray-100" />
                <div>
                  <p className="text-[11px] text-gray-400 font-medium">Stops</p>
                  <p className="text-lg font-bold text-gray-900">{routeStats.stops}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: list */}
        <div className="space-y-3">
          {tab === 'live' ? (
            <>
              <div className="card p-4">
                <h3 className="font-semibold text-sm text-gray-900 mb-1 flex items-center gap-2">
                  <Users2 size={15} /> Checked-in Staff ({live.length})
                </h3>
                <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${livePaused ? 'bg-gray-300' : 'bg-emerald-500 animate-pulse'}`} />
                  {livePaused ? 'Paused — resumes when tab is active' : 'Live · refreshes every 30s'}
                </p>
                <div className="flex items-center gap-4 mb-3 pb-3 border-b border-gray-100">
                  <div>
                    <p className="text-[11px] text-gray-400 font-medium">Moving</p>
                    <p className="text-base font-bold text-brand-600">{movingCount}</p>
                  </div>
                  <div className="h-7 w-px bg-gray-100" />
                  <div>
                    <p className="text-[11px] text-gray-400 font-medium">Idle</p>
                    <p className="text-base font-bold text-slate-600">{idleCount}</p>
                  </div>
                  <div className="h-7 w-px bg-gray-100" />
                  <div>
                    <p className="text-[11px] text-gray-400 font-medium">No signal</p>
                    <p className="text-base font-bold text-gray-400">{offlineCount}</p>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Search staff by name..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="card p-3 animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-100 flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-gray-100 rounded w-2/3" />
                          <div className="h-2.5 bg-gray-100 rounded w-1/3" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : live.length === 0 ? (
                <div className="card"><EmptyState icon={<MapPin size={50} />} title="No one checked in" description="Field staff appear here after they check in" /></div>
              ) : filteredLive.length === 0 ? (
                <div className="card p-6 text-center text-sm text-gray-400">No staff match "{search}"</div>
              ) : (
              <div className="space-y-3 lg:max-h-[520px] lg:overflow-y-auto lg:pr-1">
              {filteredLive.map(u => (
                <div key={u.userId} onClick={() => u.lastPing && focusUser(u.userId)} className={`card p-3 ${u.lastPing ? 'cursor-pointer hover:border-brand-200 hover:shadow-sm transition-all' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {u.avatar ? <img src={u.avatar} className="w-full h-full rounded-full object-cover" /> : getInitials(u.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{u.name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock size={10} /> In: {new Date(u.checkInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {u.lastPing ? (
                      <div className="text-right">
                        <span className={`badge text-[10px] ${u.lastPing.isMoving ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600'}`}>
                          {u.lastPing.isMoving ? '🚶 Moving' : '📍 Idle'}
                        </span>
                        {u.lastPing.battery != null && (
                          <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-0.5 justify-end">
                            <Battery size={9} /> {u.lastPing.battery}%
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="badge bg-gray-100 text-gray-500 text-[10px]">No signal</span>
                    )}
                  </div>
                  {u.lastPing && (
                    <p className="text-[10px] text-gray-400 mt-2">
                      Last update: {timeAgo(u.lastPing.recordedAt)} ({new Date(u.lastPing.recordedAt).toLocaleTimeString('en-IN')})
                      {u.lastPing.address ? ` · ${u.lastPing.address}` : ''}
                    </p>
                  )}
                </div>
              ))}
              </div>
              )}
            </>
          ) : (
            routeData && (
              <>
                <div className="card p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
                      {getInitials(routeData.user?.name || 'X')}
                    </div>
                    <div>
                      <p className="font-semibold">{routeData.user?.name}</p>
                      <p className="text-xs text-gray-500">{routeData.date} · {routeData.pingCount} location points</p>
                    </div>
                  </div>
                </div>
                <div className="card p-4">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <MapPin size={14} /> Visits ({routeData.visits?.length || 0})
                  </h3>
                  {routeData.visits?.length === 0 ? (
                    <p className="text-xs text-gray-400">No client visits recorded this day</p>
                  ) : (
                    <div className="space-y-2">
                      {routeData.visits.map((v: any) => (
                        <div key={v.id} className="border border-gray-100 rounded-lg p-2.5">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">{v.clientName}</p>
                            <Badge status={v.status} />
                          </div>
                          {v.purpose && <p className="text-xs text-gray-500 mt-0.5">{v.purpose}</p>}
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                            {v.checkInAt && <span>In: {new Date(v.checkInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
                            {v.durationMins != null && <span>⏱ {v.durationMins} min</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )
          )}
        </div>
      </div>
    </div>
  )
}