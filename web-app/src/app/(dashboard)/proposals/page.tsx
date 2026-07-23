'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import { Button, Input, Select, EmptyState, Pagination, Badge } from '@/components/ui'
import { formatDate, formatCurrency } from '@/lib/utils'
import { FileText, Plus, Search, Filter, X, Eye, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUSES = ['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED']

export default function ProposalsPage() {
  const { user, isAtLeast } = useAuth()
  // Admin, telecalling head (MANAGER) and Marketing Executive only
  const canCreate = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MARKETING_EXECUTIVE'].includes(user?.role || '')

  const [proposals, setProposals] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ search: '', status: '' })

  const fetchProposals = useCallback(async () => {
    setLoading(true)
    try {
      const p: Record<string, string> = { page: String(page), limit: '20' }
      Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v })
      const r = await api.get(`/proposals?${new URLSearchParams(p)}`)
      setProposals(r.data.data || [])
      setTotal(r.data.total || 0)
    } catch { toast.error('Failed') }
    finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { fetchProposals() }, [fetchProposals])

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proposals</h1>
          <p className="text-sm text-gray-500 mt-1">Create, send, and track proposals with clients</p>
        </div>
        {canCreate && <Link href="/proposals/new" className="btn-primary"><Plus size={14} /> New Proposal</Link>}
      </div>

      <div className="card">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" className="input pl-9 text-sm" placeholder="Search proposal# or title"
              value={filters.search}
              onChange={e => { setFilters(p => ({...p, search: e.target.value})); setPage(1) }} />
          </div>
          <select value={filters.status} onChange={e => { setFilters(p => ({...p, status: e.target.value})); setPage(1) }} className="max-w-xs input">
            <option value="">Status: All</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="text-xs text-gray-500 ml-auto">{total} total</span>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Proposal#</th>
                <th>Title</th>
                <th>Client / Lead</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Valid Until</th>
                <th>Added By</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-8"><Loader2 className="animate-spin inline text-gray-400" /></td></tr>
              ) : proposals.length === 0 ? (
                <tr><td colSpan={9}><EmptyState icon={<FileText size={40} />} title="No proposals" description="Create one to get started" /></td></tr>
              ) : proposals.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="font-mono text-xs">{p.proposalNumber}</td>
                  <td className="font-medium">{p.title}</td>
                  <td className="text-sm">
                    {p.client?.clientName || p.lead?.clientName}
                    <p className="text-xs text-gray-500">{p.client?.companyName || p.lead?.companyName}</p>
                  </td>
                  <td className="font-bold tabular-nums">{formatCurrency(p.finalAmount)}</td>
                  <td><Badge status={p.status} /></td>
                  <td className="text-xs text-gray-500">{p.validUntil ? formatDate(p.validUntil) : '—'}</td>
                  <td className="text-xs">
                    <p className="font-medium text-gray-800">{p.createdBy?.name || '—'}</p>
                    {p.createdBy?.role && (
                      <p className="text-gray-500">{p.createdBy.role.replace(/_/g, ' ')}</p>
                    )}
                  </td>
                  <td className="text-xs text-gray-500">{formatDate(p.createdAt)}</td>
                  <td className="text-right">
                    <Link href={`/proposals/${p.id}`} className="btn-ghost btn-sm !p-1.5"><Eye size={13} /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100">
          <Pagination page={page} totalPages={Math.ceil(total / 20)} onChange={setPage} />
        </div>
      </div>
    </div>
  )
}
