'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import { Input, Select, EmptyState, Pagination, Badge } from '@/components/ui'
import { formatDate, formatCurrency } from '@/lib/utils'
import { FileText, Plus, Search, Eye, Loader2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUSES = ['DRAFT', 'PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED']

export default function InvoicesPage() {
  const { user } = useAuth()
  const canCreate = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MARKETING_EXECUTIVE'].includes(user?.role || '')

  const [invoices, setInvoices] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ search: '', status: '', dateFrom: '', dateTo: '' })

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const p: Record<string, string> = { page: String(page), limit: '20' }
      Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v })
      const r = await api.get(`/invoices?${new URLSearchParams(p)}`)
      setInvoices(r.data.data || [])
      setTotal(r.data.total || 0)
    } catch { toast.error('Failed') }
    finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { fetch_() }, [fetch_])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">Bill clients, track payments, manage dues</p>
        </div>
        {canCreate && <Link href="/invoices/new" className="btn-primary"><Plus size={14} /> New Invoice</Link>}
      </div>

      <div className="card">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" className="input pl-9 text-sm" placeholder="Search invoice# or client"
              value={filters.search}
              onChange={e => { setFilters(p => ({...p, search: e.target.value})); setPage(1) }} />
          </div>
          <select value={filters.status} onChange={e => { setFilters(p => ({...p, status: e.target.value})); setPage(1) }} className="max-w-xs input">
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="date" className="input text-xs" placeholder="From"
            value={filters.dateFrom} onChange={e => { setFilters(p => ({...p, dateFrom: e.target.value})); setPage(1) }} />
          <input type="date" className="input text-xs" placeholder="To"
            value={filters.dateTo} onChange={e => { setFilters(p => ({...p, dateTo: e.target.value})); setPage(1) }} />
          <span className="text-xs text-gray-500 ml-auto">{total} total</span>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Invoice#</th>
                <th>Client</th>
                <th className="text-right">Total</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Due</th>
                <th>Status</th>
                <th>Due Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8"><Loader2 className="animate-spin inline text-gray-400" /></td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon={<FileText size={40} />} title="No invoices" description="Create one to bill a client" /></td></tr>
              ) : invoices.map((inv: any) => {
                const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== 'PAID' && inv.status !== 'CANCELLED'
                return (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="font-mono text-xs">{inv.invoiceNumber}</td>
                    <td>
                      <p className="font-medium text-sm">{inv.client?.clientName}</p>
                      <p className="text-xs text-gray-500">{inv.client?.companyName}</p>
                    </td>
                    <td className="text-right font-bold tabular-nums">{formatCurrency(inv.totalAmount)}</td>
                    <td className="text-right tabular-nums text-emerald-600">{formatCurrency(inv.paidAmount)}</td>
                    <td className="text-right tabular-nums text-red-600">{formatCurrency(inv.dueAmount)}</td>
                    <td>
                      <Badge status={inv.status} />
                      {isOverdue && <span className="badge bg-red-100 text-red-700 ml-1"><AlertCircle size={10} /> Overdue</span>}
                    </td>
                    <td className="text-xs text-gray-500">{inv.dueDate ? formatDate(inv.dueDate) : '—'}</td>
                    <td className="text-right">
                      <Link href={`/invoices/${inv.id}`} className="btn-ghost btn-sm !p-1.5"><Eye size={13} /></Link>
                    </td>
                  </tr>
                )
              })}
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
