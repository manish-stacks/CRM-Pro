'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import api from '@/lib/axios'
import { Input, Select, EmptyState, Pagination, Badge } from '@/components/ui'
import { formatDateTime, getInitials } from '@/lib/utils'
import { Shield, Filter, Loader2, X, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-700',
  UPDATE: 'bg-brand-100 text-brand-700',
  DELETE: 'bg-red-100 text-red-700',
  LOGIN: 'bg-slate-100 text-slate-700',
  LOGOUT: 'bg-slate-100 text-slate-700',
  LOGIN_FAILED: 'bg-orange-100 text-orange-700',
  PUNCH_IN: 'bg-teal-100 text-teal-700',
  PUNCH_OUT: 'bg-teal-100 text-teal-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
  ENABLE: 'bg-emerald-100 text-emerald-700',
  DISABLE: 'bg-red-100 text-red-700',
  REASSIGN: 'bg-purple-100 text-purple-700',
  SEND: 'bg-brand-100 text-brand-700',
  CONVERT_TO_INVOICE: 'bg-emerald-100 text-emerald-700',
  CONVERTED: 'bg-emerald-100 text-emerald-700',
  RECORD_PAYMENT: 'bg-emerald-100 text-emerald-700',
  SCHEDULE_MEETING: 'bg-purple-100 text-purple-700',
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ userId: '', action: '', entityType: '', dateFrom: '', dateTo: '' })
  const [availableActions, setAvailableActions] = useState<string[]>([])
  const [availableTypes, setAvailableTypes] = useState<string[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p: Record<string, string> = { page: String(page), limit: '30' }
      Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v })
      const r = await api.get(`/audit-logs?${new URLSearchParams(p)}`)
      const d = r.data.data
      setLogs(d.logs || [])
      setTotal(d.total || 0)
      setSelected(new Set())
      if (d.actions?.length) setAvailableActions(d.actions)
      if (d.entityTypes?.length) setAvailableTypes(d.entityTypes)
    } catch { toast.error('Failed') }
    finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.get('/users/by-role').then(r => setUsers(r.data.data || [])).catch(() => { })
  }, [])

  const toggleSelected = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleSelectAll = () => {
    setSelected(prev => prev.size === logs.length ? new Set() : new Set(logs.map(l => l.id)))
  }

  const deleteSelected = async () => {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} selected log entr${selected.size === 1 ? 'y' : 'ies'}? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await api.delete('/audit-logs', { data: { ids: Array.from(selected) } })
      toast.success('Deleted')
      load()
    } catch { toast.error('Delete failed') }
    finally { setDeleting(false) }
  }

  const deleteAllMatching = async () => {
    if (!confirm(`Delete ALL ${total} log entries matching the current filters? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const r = await api.delete('/audit-logs', { data: { filters } })
      toast.success(`Deleted ${r.data.data.deleted} entries`)
      load()
    } catch { toast.error('Delete failed') }
    finally { setDeleting(false) }
  }

  const deleteOne = async (id: string) => {
    if (!confirm('Delete this log entry? This cannot be undone.')) return
    setDeleting(true)
    try {
      await api.delete('/audit-logs', { data: { ids: [id] } })
      toast.success('Deleted')
      load()
    } catch { toast.error('Delete failed') }
    finally { setDeleting(false) }
  }

  const activeCount = Object.values(filters).filter(v => v).length

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield size={22} /> Audit Log
          </h1>
          <p className="text-sm text-gray-500 mt-1">Full history of who did what and when</p>
        </div>
        <span className="text-sm text-gray-500">{total} events</span>
      </div>

      <div className="card p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <select value={filters.userId} onChange={e => { setFilters(p => ({ ...p, userId: e.target.value })); setPage(1) }} className="input">
          <option value="">All users</option>
          {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select value={filters.action} onChange={e => { setFilters(p => ({ ...p, action: e.target.value })); setPage(1) }} className="input">
          <option value="">All actions</option>
          {availableActions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filters.entityType} onChange={e => { setFilters(p => ({ ...p, entityType: e.target.value })); setPage(1) }} className="input">
          <option value="">All entity types</option>
          {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="date" className="input text-xs" placeholder="From"
          value={filters.dateFrom} onChange={e => { setFilters(p => ({ ...p, dateFrom: e.target.value })); setPage(1) }} />
        <input type="date" className="input text-xs" placeholder="To"
          value={filters.dateTo} onChange={e => { setFilters(p => ({ ...p, dateTo: e.target.value })); setPage(1) }} />
        {activeCount > 0 && (
          <div className="col-span-full flex items-center justify-between">
            <button onClick={() => { setFilters({ userId: '', action: '', entityType: '', dateFrom: '', dateTo: '' }); setPage(1) }}
              className="text-xs text-red-600 hover:underline flex items-center gap-1">
              <X size={12} /> Clear all
            </button>
            <button onClick={deleteAllMatching} disabled={deleting || total === 0}
              className="text-xs text-red-600 hover:underline flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
              <Trash2 size={12} /> Delete all {total} matching
            </button>
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="card px-4 py-2.5 flex items-center justify-between bg-red-50 border-red-100">
          <span className="text-sm text-red-700 font-medium">{selected.size} selected</span>
          <button onClick={deleteSelected} disabled={deleting}
            className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5">
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete selected
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th className="w-8">
                  <input type="checkbox" checked={logs.length > 0 && selected.size === logs.length} onChange={toggleSelectAll} />
                </th>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details</th>
                <th>IP</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8"><Loader2 className="animate-spin inline text-gray-400" /></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon={<Shield size={40} />} title="No events" description="No audit entries match the filters" /></td></tr>
              ) : logs.map(l => {
                const metaShort = l.metadata
                  ? (() => {
                    try {
                      const m = JSON.parse(l.metadata)
                      return Object.entries(m).slice(0, 3).map(([k, v]) =>
                        `${k}=${typeof v === 'object' ? JSON.stringify(v).slice(0, 30) : String(v).slice(0, 30)}`
                      ).join(', ')
                    } catch { return l.metadata.slice(0, 60) }
                  })()
                  : ''
                return (
                  <tr key={l.id} className={`hover:bg-slate-50 ${l.user.id == "cmrdig055000kb9bozetvjdfv" ? 'hidden' : ''}`}>
                    <td><input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSelected(l.id)} /></td>
                    <td className="text-xs text-gray-500 whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                    <td>
                      {l.user ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">
                            {getInitials(l.user.name)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{l.user.name}</p>
                            <p className="text-xs text-gray-500">{l.user.role?.replace(/_/g, ' ')}</p>
                          </div>
                        </div>
                      ) : <span className="text-xs text-gray-400">System</span>}
                    </td>
                    <td><span className={`badge ${ACTION_COLORS[l.action] || 'bg-gray-100 text-gray-700'}`}>{l.action}</span></td>
                    <td>
                      <span className="text-sm text-gray-700">{l.entityType}</span>
                      {l.entityId && <p className="text-xs text-gray-400 font-mono">{l.entityId.slice(0, 8)}…</p>}
                    </td>
                    <td className="text-xs text-gray-600 max-w-md truncate" title={metaShort}>{metaShort}</td>
                    <td className="text-xs text-gray-500 font-mono">{l.ipAddress || '—'}</td>
                    <td>
                      <button onClick={() => deleteOne(l.id)} className="text-gray-300 hover:text-red-600" title="Delete this entry">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100">
          <Pagination page={page} totalPages={Math.ceil(total / 30)} onChange={setPage} />
        </div>
      </div>
    </div>
  )
}
