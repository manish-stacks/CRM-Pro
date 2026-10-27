'use client'
// Admin page: register (or remove) an employee's face for the attendance kiosk.
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import api from '@/lib/axios'
import toast from 'react-hot-toast'
import { Button, Spinner } from '@/components/ui'
import { ScanFace, Trash2, CheckCircle2, Search, Users, UserCheck, UserX, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { loadFaceApi, onFaceProgress, readFace, startCamera, stopCamera, FaceStep } from '@/lib/faceClient'

const NEEDED = 5
const PAGE_SIZE = 20

export default function FaceEnrollPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [employees, setEmployees] = useState<any[]>([])
  const [enrolled, setEnrolled] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DONE' | 'PENDING'>('ALL')
  const [deptFilter, setDeptFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [target, setTarget] = useState<any | null>(null)
  const [camReady, setCamReady] = useState(false)
  const [samples, setSamples] = useState<number[][]>([])
  const [busy, setBusy] = useState(false)
  const [engine, setEngine] = useState<FaceStep>({ msg: 'Waiting to start', pct: 0 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let all: any[] = [], p = 1
      while (true) {
        const r = await api.get(`/employees?status=true&limit=100&page=${p}`)
        const batch = r.data.data || []
        all = all.concat(batch)
        if (all.length >= (r.data.total ?? all.length) || batch.length < 100) break
        p++
      }
      setEmployees(all.filter(e => e.user?.isActive !== false))   // active staff only
    } catch { toast.error('Failed to load employees') }
    try {
      const f = await api.get('/face/enroll')
      setEnrolled(Object.fromEntries((f.data.data || []).map((x: any) => [x.employeeId, x.updatedAt])))
    } catch {
      toast.error('Face data table is missing. Add the FaceProfile model, run "npx prisma db push", then restart the server.')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Start loading the face engine as soon as the page opens, so it is ready (and
  // already warmed up) by the time someone clicks Register.
  useEffect(() => {
    const off = onFaceProgress(setEngine)
    loadFaceApi().catch(() => { })
    return off
  }, [])
  useEffect(() => () => stopCamera(streamRef.current), [])
  useEffect(() => { setPage(1) }, [search, statusFilter, deptFilter])

  const open = async (emp: any) => {
    setTarget(emp); setSamples([]); setCamReady(false)
    loadFaceApi().catch((e: any) => toast.error(e?.message || 'Face engine failed to load'))
    setTimeout(async () => {
      try {
        if (!videoRef.current) return
        streamRef.current = await startCamera(videoRef.current)
        setCamReady(true)
      } catch (e: any) {
        toast.error(e?.name === 'NotAllowedError' ? 'Camera permission is blocked. Allow the camera and try again.' : (e?.message || 'Camera error'))
        setTarget(null)
      }
    }, 50)
  }

  const close = () => { stopCamera(streamRef.current); streamRef.current = null; setTarget(null); setSamples([]); setCamReady(false) }

  const capture = async () => {
    if (!videoRef.current) return
    setBusy(true)
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)))   // let the loader paint first
    try {
      const f = await loadFaceApi()
      const r = await readFace(f, videoRef.current, 0.25)
      if (!r) { toast.error('No clear face found. Move closer and look at the camera.'); return }
      const next = [...samples, r.descriptor]
      setSamples(next)
      if (next.length === NEEDED) {
        await api.post('/face/enroll', { employeeId: target.id, descriptors: next })
        toast.success(`Face saved for ${target.user?.name}`)
        close(); load()
      } else {
        toast.success(`Captured ${next.length} of ${NEEDED}. Turn your head slightly for the next one.`)
      }
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Could not save face') }
    finally { setBusy(false) }
  }

  const remove = async (emp: any) => {
    if (!confirm(`Remove face data for ${emp.user?.name}?`)) return
    try { await api.delete(`/face/enroll?employeeId=${emp.id}`); toast.success('Removed'); load() }
    catch { toast.error('Failed') }
  }

  const departments = useMemo(
    () => Array.from(new Set(employees.map(e => e.department?.name).filter(Boolean))).sort() as string[],
    [employees]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return employees.filter(e => {
      if (q && !((e.user?.name || '').toLowerCase().includes(q) || (e.employeeId || '').toLowerCase().includes(q))) return false
      if (statusFilter === 'DONE' && !enrolled[e.id]) return false
      if (statusFilter === 'PENDING' && enrolled[e.id]) return false
      if (deptFilter !== 'ALL' && e.department?.name !== deptFilter) return false
      return true
    })
  }, [employees, enrolled, search, statusFilter, deptFilter])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const doneCount = employees.filter(e => enrolled[e.id]).length
  const hasFilters = !!search || statusFilter !== 'ALL' || deptFilter !== 'ALL'

  if (loading) return <div className="flex justify-center py-20"><Spinner size={30} /></div>

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Face Attendance</h1>
        <p className="text-xs text-gray-500 mt-0.5">Register employee faces for the front-desk kiosk at <b>/kiosk</b>.</p>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total employees', value: employees.length, icon: Users, color: 'text-gray-700 bg-gray-100', f: 'ALL' },
          { label: 'Registered', value: doneCount, icon: UserCheck, color: 'text-green-700 bg-green-100', f: 'DONE' },
          { label: 'Not registered', value: employees.length - doneCount, icon: UserX, color: 'text-amber-700 bg-amber-100', f: 'PENDING' },
        ].map(c => (
          <button key={c.label} onClick={() => setStatusFilter(c.f as any)}
            className={`text-left bg-white rounded-xl border p-3.5 flex items-center gap-3 transition hover:shadow-sm ${statusFilter === c.f ? 'border-brand-400 ring-1 ring-brand-200' : 'border-gray-200'}`}>
            <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.color}`}><c.icon size={17} /></span>
            <span>
              <span className="block text-xl font-bold text-gray-900 leading-tight">{c.value}</span>
              <span className="block text-[11px] text-gray-500">{c.label}</span>
            </span>
          </button>
        ))}
      </div>

      {/* filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-8 text-sm w-full" placeholder="Search by name or employee ID" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input text-sm w-44" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
          <option value="ALL">All departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="input text-sm w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
          <option value="ALL">All status</option>
          <option value="DONE">Registered</option>
          <option value="PENDING">Not registered</option>
        </select>
        {hasFilters && (
          <button onClick={() => { setSearch(''); setStatusFilter('ALL'); setDeptFilter('ALL') }}
            className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 px-2"><X size={13} /> Clear</button>
        )}
      </div>

      {/* table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Employee</th>
                <th>Employee ID</th>
                <th>Department</th>
                <th>Position</th>
                <th>Face status</th>
                <th>Registered on</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e, i) => (
                <tr key={e.id}>
                  <td className="text-xs text-gray-400">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center overflow-hidden shrink-0">
                        {e.user?.avatar
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={e.user.avatar} alt="" className="w-full h-full object-cover" />
                          : (e.user?.name || '?')[0]}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{e.user?.name}</span>
                    </div>
                  </td>
                  <td className="text-sm text-gray-600">{e.employeeId}</td>
                  <td className="text-sm text-gray-600">{e.department?.name || '—'}</td>
                  <td className="text-sm text-gray-600">{e.position || '—'}</td>
                  <td>
                    {enrolled[e.id]
                      ? <span className="text-[11px] text-green-700 bg-green-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1"><CheckCircle2 size={11} /> Registered</span>
                      : <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Not registered</span>}
                  </td>
                  <td className="text-xs text-gray-500">{enrolled[e.id] ? new Date(enrolled[e.id]).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="secondary" onClick={() => open(e)}><ScanFace size={14} /> {enrolled[e.id] ? 'Re-scan' : 'Register'}</Button>
                      {enrolled[e.id] && <button onClick={() => remove(e)} title="Remove face data" className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={8} className="text-center text-sm text-gray-400 py-10">No employees match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 pr-20 border-t border-gray-100 text-xs text-gray-500">
          <span>Showing {filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40"><ChevronLeft size={15} /></button>
            <span className="px-2">Page {page} of {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40"><ChevronRight size={15} /></button>
          </div>
        </div>
      </div>

      {target && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3">
            <div>
              <h3 className="font-semibold text-gray-900">Register face: {target.user?.name}</h3>
              <p className="text-xs text-gray-500">Good light, no cap or mask. Capture {NEEDED} times and turn the head slightly each time.</p>
            </div>
            <div className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden">
              <video ref={videoRef} muted playsInline className="w-full h-full object-cover -scale-x-100" />
              {!camReady && <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm">Starting camera…</div>}
              {camReady && engine.pct < 100 && (
                <div className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center gap-3 px-8 text-center">
                  <div className="w-9 h-9 rounded-full border-2 border-white/20 border-t-brand-500 animate-spin" />
                  <p className="text-white text-sm font-medium">{engine.msg}</p>
                  <div className="w-full max-w-[220px] h-1.5 rounded-full bg-white/15 overflow-hidden">
                    <div className="h-full bg-brand-500 transition-all duration-300" style={{ width: `${engine.pct}%` }} />
                  </div>
                  <p className="text-slate-400 text-[11px]">First time only. This can take a few seconds.</p>
                </div>
              )}
              {busy && (
                <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-2">
                  <div className="w-9 h-9 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <p className="text-white text-sm">Scanning face…</p>
                </div>
              )}
            </div>
            <div className="flex gap-1">
              {Array.from({ length: NEEDED }).map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full ${i < samples.length ? 'bg-green-500' : 'bg-gray-200'}`} />
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>Cancel</Button>
              <Button onClick={capture} loading={busy} disabled={!camReady || engine.pct < 100}><ScanFace size={14} /> {engine.pct < 100 ? 'Preparing…' : busy ? 'Scanning…' : `Capture (${samples.length}/${NEEDED})`}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
