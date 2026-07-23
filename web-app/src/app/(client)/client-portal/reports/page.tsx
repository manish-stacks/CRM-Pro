'use client'
import { useEffect, useMemo, useState } from 'react'
import {
  Sparkles, Download, Search, ArrowDownWideNarrow, ArrowUpNarrowWide,
  ChevronLeft, ChevronRight, Calendar,
} from 'lucide-react'
import { useClientPortal } from '../context'

const PAGE_SIZE = 6

function isImageFile(r: any) {
  if (r.reportType === 'IMAGE') return true
  if (r.fileType && String(r.fileType).toLowerCase().startsWith('image')) return true
  return /\.(jpe?g|png|gif|webp|bmp|svg)(\?.*)?$/i.test(r.fileUrl || '')
}

export default function ReportsPage() {
  const { reports } = useClientPortal()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [serviceFilter, setServiceFilter] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [page, setPage] = useState(1)

  const types = useMemo(
    () => Array.from(new Set(reports.map((r: any) => r.reportType).filter(Boolean))),
    [reports]
  )
  const services = useMemo(
    () => Array.from(new Set(reports.map((r: any) => r.clientService?.serviceName).filter(Boolean))),
    [reports]
  )

  const filtered = useMemo(() => {
    let list = [...reports]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((r: any) =>
        r.title?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.reportPeriod?.toLowerCase().includes(q)
      )
    }
    if (typeFilter !== 'ALL') list = list.filter((r: any) => r.reportType === typeFilter)
    if (serviceFilter !== 'ALL') list = list.filter((r: any) => r.clientService?.serviceName === serviceFilter)
    if (dateFrom) {
      const from = new Date(dateFrom); from.setHours(0, 0, 0, 0)
      list = list.filter((r: any) => new Date(r.reportDate) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999)
      list = list.filter((r: any) => new Date(r.reportDate) <= to)
    }

    list.sort((a: any, b: any) => {
      const da = new Date(a.reportDate).getTime()
      const db = new Date(b.reportDate).getTime()
      return sortOrder === 'newest' ? db - da : da - db
    })

    return list
  }, [reports, search, typeFilter, serviceFilter, dateFrom, dateTo, sortOrder])

  // Any filter change should reset back to page 1
  useEffect(() => { setPage(1) }, [search, typeFilter, serviceFilter, dateFrom, dateTo, sortOrder])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [totalPages])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const clearFilters = () => {
    setSearch(''); setTypeFilter('ALL'); setServiceFilter('ALL'); setDateFrom(''); setDateTo('')
  }
  const hasActiveFilters = search || typeFilter !== 'ALL' || serviceFilter !== 'ALL' || dateFrom || dateTo

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-4">Reports Shared With You</h2>

      {reports.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Search reports..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {types.length > 0 && (
              <select
                className="border border-gray-200 rounded-xl px-2.5 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
              >
                <option value="ALL">All types</option>
                {types.map((t: any) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}

            {services.length > 0 && (
              <select
                className="border border-gray-200 rounded-xl px-2.5 py-2 text-sm focus:outline-none focus:border-indigo-500"
                value={serviceFilter}
                onChange={e => setServiceFilter(e.target.value)}
              >
                <option value="ALL">All services</option>
                {services.map((s: any) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}

            <button
              onClick={() => setSortOrder(o => (o === 'newest' ? 'oldest' : 'newest'))}
              className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              {sortOrder === 'newest' ? <ArrowDownWideNarrow size={14} /> : <ArrowUpNarrowWide size={14} />}
              {sortOrder === 'newest' ? 'Latest first' : 'Oldest first'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 pl-1"><Calendar size={13} /> Date range</div>
            <input
              type="date"
              className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={e => setDateFrom(e.target.value)}
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={e => setDateTo(e.target.value)}
            />
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-indigo-600 hover:underline ml-1">Clear filters</button>
            )}
          </div>
        </div>
      )}

      {reports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400"><Sparkles size={34} className="mx-auto mb-2 text-gray-300" />No reports shared yet</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400"><Search size={30} className="mx-auto mb-2 text-gray-300" />No reports match your filters</div>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((r: any) => (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-semibold text-gray-900">{r.title}</p>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{r.reportType}</span>
                  {r.reportPeriod && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{r.reportPeriod}</span>}
                  {r.clientService && <span className="text-[10px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded">{r.clientService.serviceName}</span>}
                </div>
                {r.description && <p className="text-sm text-gray-600 mt-1">{r.description}</p>}
                {r.content && <div className="text-sm text-gray-800 mt-2 whitespace-pre-wrap bg-slate-50 p-3 rounded-xl">{r.content}</div>}
                {/* {r.fileUrl && isImageFile(r) && (
                  <a href={r.fileUrl} target="_blank" rel="noreferrer" className="block mt-2">
                    <img src={r.fileUrl} alt={r.title} className="max-h-72 w-auto rounded-xl border border-gray-100 object-cover" loading="lazy" />
                  </a>
                )} */}
                {r.fileUrl && (
                  <a href={r.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline mt-2 inline-flex items-center gap-1"><Download size={13} /> View attachment</a>
                )}
                <p className="text-xs text-gray-400 mt-2">By {r.uploadedBy?.name} · {new Date(r.reportDate).toLocaleDateString('en-IN')}</p>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-gray-600 font-medium">Page {page} of {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}