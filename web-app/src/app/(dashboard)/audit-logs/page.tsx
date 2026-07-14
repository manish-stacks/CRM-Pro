'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import api from '@/lib/axios'
import { Input, Select, EmptyState, Pagination, Badge } from '@/components/ui'
import { formatDateTime, getInitials } from '@/lib/utils'
import { Shield, Filter, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-700',
  UPDATE: 'bg-blue-100 text-blue-700',
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
  SEND: 'bg-blue-100 text-blue-700',
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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p: Record<string, string> = { page: String(page), limit: '30' }
      Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v })
      const r = await api.get(`/audit-logs?${new URLSearchParams(p)}`)
      const d = r.data.data
      setLogs(d.logs || [])
      setTotal(d.total || 0)
      if (d.actions?.length) setAvailableActions(d.actions)
      if (d.entityTypes?.length) setAvailableTypes(d.entityTypes)
    } catch { toast.error('Failed') }
    finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.get('/users/by-role').then(r => setUsers(r.data.data || [])).catch(() => {})
  }, [])

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
        <select value={filters.userId} onChange={e => { setFilters(p => ({...p, userId: e.target.value})); setPage(1) }} className="input">
          <option value="">All users</option>
          {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select value={filters.action} onChange={e => { setFilters(p => ({...p, action: e.target.value})); setPage(1) }} className="input">
          <option value="">All actions</option>
          {availableActions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filters.entityType} onChange={e => { setFilters(p => ({...p, entityType: e.target.value})); setPage(1) }} className="input">
          <option value="">All entity types</option>
          {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="date" className="input text-xs" placeholder="From"
          value={filters.dateFrom} onChange={e => { setFilters(p => ({...p, dateFrom: e.target.value})); setPage(1) }} />
        <input type="date" className="input text-xs" placeholder="To"
          value={filters.dateTo} onChange={e => { setFilters(p => ({...p, dateTo: e.target.value})); setPage(1) }} />
        {activeCount > 0 && (
          <button onClick={() => { setFilters({ userId: '', action: '', entityType: '', dateFrom: '', dateTo: '' }); setPage(1) }}
            className="text-xs text-red-600 hover:underline flex items-center gap-1 col-span-full">
            <X size={12} /> Clear all
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8"><Loader2 className="animate-spin inline text-gray-400" /></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6}><EmptyState icon={<Shield size={40} />} title="No events" description="No audit entries match the filters" /></td></tr>
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
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="text-xs text-gray-500 whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                    <td>
                      {l.user ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
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
