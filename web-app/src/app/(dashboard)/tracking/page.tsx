'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import api from '@/lib/axios'
import { useAuth } from '@/hooks/useAuth'
import { Select, EmptyState, Badge } from '@/components/ui'
import { getInitials } from '@/lib/utils'
import { MapPin, Navigation, Users2, Loader2, Clock, Battery, RefreshCw, Route } from 'lucide-react'
import toast from 'react-hot-toast'
import { loadGoogleMaps, GOOGLE_MAPS_KEY } from '@/lib/googleMaps'

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
  const [routeLoading, setRouteLoading] = useState(false)
  const [people, setPeople] = useState<any[]>([])

  const mapRef = useRef<any>(null)
  const mapInstance = useRef<any>(null)
  const overlaysRef = useRef<any[]>([])
  const infoRef = useRef<any>(null)

  const clearOverlays = () => {
    overlaysRef.current.forEach((o: any) => o.setMap && o.setMap(null))
    overlaysRef.current = []
  }

  const loadLive = useCallback(async () => {
    try {
      const r = await api.get('/tracking/live')
      setLive(r.data.data || [])
    } catch { toast.error('Failed to load live locations') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    loadLive()
    const t = setInterval(loadLive, 30000) // refresh every 30s
    return () => clearInterval(t)
  }, [loadLive])

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
      const marker = new g.maps.Marker({
        position: pos,
        map: mapInstance.current,
        title: u.name,
        label: { text: getInitials(u.name), color: '#fff', fontSize: '10px', fontWeight: 'bold' },
      })
      marker.addListener('click', () => {
        infoRef.current.setContent(
          `<div style="font-size:13px"><b>${u.name}</b><br/>${u.lastPing.isMoving ? '🚶 Moving' : '📍 Stationary'}<br/>${new Date(u.lastPing.recordedAt).toLocaleTimeString('en-IN')}${u.lastPing.address ? '<br/>' + u.lastPing.address : ''}</div>`
        )
        infoRef.current.open(mapInstance.current, marker)
      })
      overlaysRef.current.push(marker)
      bounds.extend(pos)
    })
    if (withLoc.length > 0) {
      mapInstance.current.fitBounds(bounds, 60)
      if (withLoc.length === 1) mapInstance.current.setZoom(15)
    }
  }, [live, tab, mapsReady])

  const loadRoute = async () => {
    if (!selectedUser) { toast.error('Select a person'); return }
    setRouteLoading(true)
    try {
      const r = await api.get(`/tracking/route-history?userId=${selectedUser}&date=${selectedDate}`)
      setRouteData(r.data.data)
      if (mapInstance.current) {
        const g = (window as any).google
        clearOverlays()
        const pings = r.data.data.pings || []
        if (pings.length > 0) {
          const path = pings.map((p: any) => ({ lat: p.latitude, lng: p.longitude }))
          const line = new g.maps.Polyline({
            path, strokeColor: '#2563eb', strokeWeight: 4, strokeOpacity: 0.75,
            map: mapInstance.current,
          })
          overlaysRef.current.push(line)

          const bounds = new g.maps.LatLngBounds()
          path.forEach((pt: any) => bounds.extend(pt))

          // Start marker (green)
          overlaysRef.current.push(new g.maps.Marker({
            position: path[0], map: mapInstance.current, title: 'Start (Check-in)',
            icon: { path: g.maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#16a34a', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
          }))
          // Latest marker (red)
          overlaysRef.current.push(new g.maps.Marker({
            position: path[path.length - 1], map: mapInstance.current, title: 'Latest',
            icon: { path: g.maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#dc2626', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
          }))
          // Visit markers
          ;(r.data.data.visits || []).forEach((v: any) => {
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
            }
          })
          mapInstance.current.fitBounds(bounds, 60)
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
            className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 ${
              tab === t.key ? 'border-blue-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
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
          <div className="card overflow-hidden">
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
                <p className="text-xs text-gray-500">Auto-refreshes every 30s</p>
              </div>
              {loading ? (
                <div className="card p-8 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>
              ) : live.length === 0 ? (
                <div className="card"><EmptyState icon={<MapPin size={50} />} title="No one checked in" description="Field staff appear here after they check in" /></div>
              ) : live.map(u => (
                <div key={u.userId} className="card p-3">
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
                      Last update: {new Date(u.lastPing.recordedAt).toLocaleTimeString('en-IN')}
                      {u.lastPing.address ? ` · ${u.lastPing.address}` : ''}
                    </p>
                  )}
                </div>
              ))}
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