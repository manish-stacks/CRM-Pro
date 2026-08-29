'use client'
// src/app/(dashboard)/meeting-slots/page.tsx
// Company-wide meeting slot board.
//
// Before this page, the only way to see whether a marketing person was free
// was to open a lead and start the booking flow. This shows the whole grid at
// once — every marketing executive down the side, every office-hours slot
// across the top — so a telecaller can pick a date, see who is open, and jump
// straight into the lead that's already booked in a cell.
import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Modal, Button } from '@/components/ui'
import {
  CalendarDays, ChevronLeft, ChevronRight, Loader2, RefreshCw,
  MapPin, Phone, Search, X, CalendarCheck, CalendarX, Users2, Building2,
} from 'lucide-react'
import api from '@/lib/axios'
import { formatCurrency } from '@/lib/utils'

const todayStr = () => new Date().toISOString().split('T')[0]
const shift = (d: string, days: number) => {
  const dt = new Date(d + 'T00:00:00')
  dt.setDate(dt.getDate() + days)
  return dt.toISOString().split('T')[0]
}
const pretty = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'short', year: 'numeric',
  })

export default function MeetingSlotsPage() {
  const { user } = useAuth()
  const [date, setDate] = useState(todayStr())
  const [area, setArea] = useState('')
  const [search, setSearch] = useState('')
  const [onlyFree, setOnlyFree] = useState(false)

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<any>(null) // clicked booked cell

  const fetchBoard = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ date })
      if (area) p.set('area', area)
      if (search) p.set('search', search)
      const r = await api.get(`/marketing/availability?${p}`)
      setData(r.data.data)
    } catch {
      setData(null)
    } finally { setLoading(false) }
  }, [date, area, search])

  useEffect(() => {
    const t = setTimeout(fetchBoard, search ? 350 : 0) // debounce the name search
    return () => clearTimeout(t)
  }, [fetchBoard, search])

  const slots = data?.slots || []
  const executives = useMemo(() => {
    const list = data?.executives || []
    return onlyFree ? list.filter((e: any) => e.freeCount > 0) : list
  }, [data, onlyFree])

  // Group by territory so people covering the same area sit together.
  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {}
    for (const e of executives) (g[e.area] = g[e.area] || []).push(e)
    return Object.entries(g)
  }, [executives])

  const s = data?.summary || { executives: 0, booked: 0, free: 0, onLeave: 0 }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ---- Header ---- */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays size={22} className="text-brand-600" />
            Meeting Slot Board
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Marketing team ki availability ek jagah — lead ke andar jaane ki zaroorat nahi.
          </p>
        </div>
        <button onClick={fetchBoard} className="btn-secondary" disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* ---- Date navigator ---- */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setDate(d => shift(d, -1))} className="btn-secondary !px-2" title="Previous day">
            <ChevronLeft size={16} />
          </button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input !w-auto text-sm" />
          <button onClick={() => setDate(d => shift(d, 1))} className="btn-secondary !px-2" title="Next day">
            <ChevronRight size={16} />
          </button>
          <div className="flex gap-1.5 ml-1">
            <button onClick={() => setDate(todayStr())}
              className={`badge ${date === todayStr() ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Today
            </button>
            <button onClick={() => setDate(shift(todayStr(), 1))}
              className={`badge ${date === shift(todayStr(), 1) ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Tomorrow
            </button>
          </div>
          <span className="ml-auto text-sm font-semibold text-gray-700">{pretty(date)}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select value={area} onChange={e => setArea(e.target.value)} className="input !w-auto text-sm">
            <option value="">All areas</option>
            {(data?.areas || []).map((a: string) => <option key={a} value={a}>{a}</option>)}
          </select>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search marketing person..." className="input !w-56 text-sm !pl-8" />
          </div>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={onlyFree} onChange={e => setOnlyFree(e.target.checked)} />
            Only show people with free slots
          </label>
          {(area || search || onlyFree) && (
            <button onClick={() => { setArea(''); setSearch(''); setOnlyFree(false) }}
              className="text-xs text-red-600 hover:underline flex items-center gap-1">
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ---- Summary ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500 flex items-center gap-1"><Users2 size={12} /> Marketing team</p>
          <p className="text-2xl font-bold text-gray-900">{s.executives}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 flex items-center gap-1"><CalendarCheck size={12} /> Booked slots</p>
          <p className="text-2xl font-bold text-red-600">{s.booked}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 flex items-center gap-1"><CalendarDays size={12} /> Free slots</p>
          <p className="text-2xl font-bold text-emerald-600">{s.free}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 flex items-center gap-1"><CalendarX size={12} /> On leave</p>
          <p className="text-2xl font-bold text-amber-600">{s.onLeave || 0}</p>
        </div>
      </div>

      {/* ---- Legend ---- */}
      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block" /> Free
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" /> Booked (click for details)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" /> On leave
        </span>
        <span className="ml-auto">
          Office hours {data?.officeStart || '--'}–{data?.officeEnd || '--'} · {data?.slotMinutes || 0} min slots
        </span>
      </div>

      {/* ---- The grid ---- */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400">
            <Loader2 size={22} className="animate-spin inline" />
          </div>
        ) : executives.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            {data?.summary?.executives === 0
              ? 'Koi active marketing executive nahi mila. Employees page se area set karke add karo.'
              : 'Is filter pe koi result nahi.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky left-0 z-10 bg-gray-50 text-left px-4 py-2.5 text-xs font-semibold text-gray-600 border-b border-gray-200 min-w-[190px]">
                    Marketing Person
                  </th>
                  {slots.map((sl: any) => (
                    <th key={sl.label}
                      className="px-2 py-2.5 text-[11px] font-semibold text-gray-600 border-b border-l border-gray-200 whitespace-nowrap min-w-[120px]">
                      {sl.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grouped.map(([areaName, execs]) => (
                  <Fragment key={areaName}>
                    <tr>
                      <td colSpan={slots.length + 1}
                        className="bg-brand-50/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700 border-b border-gray-200">
                        <span className="flex items-center gap-1.5">
                          <MapPin size={11} /> {areaName}
                          <span className="font-normal normal-case text-brand-600/70">
                            ({execs.length} {execs.length === 1 ? 'person' : 'people'})
                          </span>
                        </span>
                      </td>
                    </tr>
                    {execs.map((e: any) => (
                      <tr key={e.id} className="hover:bg-gray-50/50">
                        <td className="sticky left-0 z-10 bg-white px-4 py-2 border-b border-gray-100">
                          <div className="font-medium text-sm text-gray-900">{e.name}</div>
                          <div className="text-[11px] text-gray-500 flex items-center gap-2">
                            {e.onLeave
                              ? <span className="text-amber-600 font-medium">On leave ({e.onLeave})</span>
                              : <span>{e.freeCount} free · {e.bookedCount} booked</span>}
                            {e.phone && (
                              <a href={`tel:${e.phone}`} className="text-brand-600 hover:underline flex items-center gap-0.5">
                                <Phone size={9} />{e.phone}
                              </a>
                            )}
                          </div>
                        </td>

                        {e.slots.map((sl: any) => {
                          if (e.onLeave) {
                            return (
                              <td key={sl.label} className="border-b border-l border-gray-100 p-1">
                                <div className="bg-amber-50 border border-amber-200 rounded-md h-full min-h-[46px] flex items-center justify-center text-[10px] text-amber-700">
                                  Leave
                                </div>
                              </td>
                            )
                          }
                          if (sl.lead) {
                            return (
                              <td key={sl.label} className="border-b border-l border-gray-100 p-1">
                                <button onClick={() => setDetail({ ...sl.lead, exec: e, slot: sl.label })}
                                  className="w-full text-left bg-red-50 hover:bg-red-100 border border-red-200 rounded-md px-2 py-1.5 min-h-[46px] transition-colors">
                                  <div className="text-[11px] font-semibold text-red-800 truncate">
                                    {sl.lead.companyName || sl.lead.clientName}
                                  </div>
                                  <div className="text-[10px] text-red-600/80 truncate">
                                    {sl.lead.city || sl.lead.leadNumber}
                                  </div>
                                </button>
                              </td>
                            )
                          }
                          return (
                            <td key={sl.label} className="border-b border-l border-gray-100 p-1">
                              <div className="bg-emerald-50 border border-emerald-200 rounded-md min-h-[46px] flex items-center justify-center text-[10px] font-medium text-emerald-700">
                                Free
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Booked slot detail ---- */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Booked Meeting" className="!max-w-md">
        {detail && (
          <div className="space-y-3">
            <div>
              <p className="text-lg font-semibold text-gray-900">
                {detail.companyName || detail.clientName}
              </p>
              <p className="text-xs text-gray-500 font-mono">{detail.leadNumber}</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 space-y-2 text-sm">
              <Row label="Marketing person" value={detail.exec?.name} />
              <Row label="Area" value={detail.exec?.area} />
              <Row label="Slot" value={detail.slot} />
              {detail.meetingTime && <Row label="Time" value={detail.meetingTime} />}
              {detail.clientName && detail.companyName && <Row label="Contact" value={detail.clientName} />}
              {detail.clientPhone && <Row label="Phone" value={detail.clientPhone} />}
              {detail.city && <Row label="City" value={detail.city} />}
              {detail.service && <Row label="Service" value={detail.service} />}
              {detail.price ? <Row label="Value" value={formatCurrency(detail.price)} /> : null}
              {detail.telecaller && <Row label="Booked by" value={detail.telecaller} />}
            </div>

            {detail.meetingLocation && (
              <div className="text-sm text-gray-600 flex items-start gap-1.5">
                <Building2 size={14} className="mt-0.5 shrink-0 text-gray-400" />
                {detail.meetingLocation}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              {detail.clientPhone && (
                <a href={`tel:${detail.clientPhone}`} className="btn-secondary"><Phone size={14} /> Call</a>
              )}
              <Link href={`/leads/${detail.id}`} className="btn-primary">Open Lead</Link>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className="text-gray-900 font-medium text-right">{value}</span>
    </div>
  )
}
