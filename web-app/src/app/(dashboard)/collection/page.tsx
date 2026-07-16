'use client'
// Daily Collection — admin ka shaam ka hisaab.
// Har MARKETING_EXECUTIVE ne kitne visits kiye aur kitna cash / UPI / bank
// collect kiya. Date-wise filter se fraud pakadna aasan.
import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '@/lib/axios'
import { Select, Input, EmptyState, StatCard, Badge, Button, Modal, Pagination } from '@/components/ui'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'
import {
  Wallet, Banknote, Smartphone, Building2, MapPin, Download,
  IndianRupee, Receipt, Loader2, Search,
} from 'lucide-react'
import toast from 'react-hot-toast'

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom dates' },
]

const METHODS = [
  { value: '', label: 'All methods' },
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CARD', label: 'Card' },
  { value: 'ONLINE_GATEWAY', label: 'Online Gateway' },
]

export default function CollectionPage() {
  const [range, setRange] = useState('today')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [userId, setUserId] = useState('')
  const [method, setMethod] = useState('')

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [people, setPeople] = useState<any[]>([])

  const [drill, setDrill] = useState<{ userId: string; name: string } | null>(null)
  const [txns, setTxns] = useState<any[]>([])
  const [txnTotal, setTxnTotal] = useState(0)
  const [txnPage, setTxnPage] = useState(1)
  const [txnLoading, setTxnLoading] = useState(false)

  const qs = useCallback((extra: Record<string, string> = {}) => {
    const p = new URLSearchParams()
    if (range === 'custom') {
      if (dateFrom) p.set('dateFrom', dateFrom)
      if (dateTo) p.set('dateTo', dateTo)
    } else {
      p.set('range', range)
    }
    if (userId) p.set('userId', userId)
    if (method) p.set('method', method)
    Object.entries(extra).forEach(([k, v]) => p.set(k, v))
    return p.toString()
  }, [range, dateFrom, dateTo, userId, method])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get(`/reports/collection?${qs()}`)
      setData(r.data.data)
    } catch { toast.error('Failed to load collection report') }
    finally { setLoading(false) }
  }, [qs])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.get('/users/by-role?roles=MARKETING_EXECUTIVE')
      .then(r => setPeople(r.data.data || [])).catch(() => { })
  }, [])

  const openDrill = async (row: any) => {
    setDrill({ userId: row.userId, name: row.name })
    setTxnPage(1)
  }

  useEffect(() => {
    if (!drill) return
    setTxnLoading(true)
    api.get(`/reports/collection?${qs({ view: 'transactions', userId: drill.userId, page: String(txnPage), limit: '20' })}`)
      .then(r => { setTxns(r.data.data || []); setTxnTotal(r.data.total || 0) })
      .catch(() => toast.error('Failed to load transactions'))
      .finally(() => setTxnLoading(false))
  }, [drill, txnPage, qs])

  const exportCsv = () => {
    if (!data?.rows?.length) return toast.error('Nothing to export')
    const head = ['Executive', 'Visits', 'Completed', 'Pending', 'Txns', 'Cash', 'UPI', 'Bank', 'Cheque', 'Card', 'Online', 'Total']
    const lines = data.rows.map((r: any) =>
      [r.name, r.visitsTotal, r.visitsCompleted, r.visitsPending, r.txns, r.cash, r.upi, r.bank, r.cheque, r.card, r.online, r.total].join(',')
    )
    const csv = [head.join(','), ...lines].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `collection-${range}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const t = data?.totals

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Collection</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Kis executive ne kitna collect kiya — visits, cash, UPI aur total, date-wise
          </p>
        </div>
        <Button variant="secondary" onClick={exportCsv}><Download size={15} />Export CSV</Button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid md:grid-cols-4 gap-3">
          <Select label="Period" options={RANGES} value={range} onChange={e => setRange(e.target.value)} />
          <Select
            label="Executive"
            options={[{ value: '', label: 'All executives' }, ...people.map((p: any) => ({ value: p.id, label: p.name }))]}
            value={userId} onChange={e => setUserId(e.target.value)}
          />
          <Select label="Method" options={METHODS} value={method} onChange={e => setMethod(e.target.value)} />
          {range === 'custom' && (
            <>
              <Input label="From" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <Input label="To" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </>
          )}
        </div>
        {data?.range && (
          <p className="text-xs text-gray-400 mt-3">
            Showing {formatDate(data.range.from)} → {formatDate(data.range.to)}
          </p>
        )}
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Collected" value={formatCurrency(t?.total || 0)} icon={IndianRupee} color="green" sub={`${t?.txns || 0} transactions`} />
        <StatCard label="Cash" value={formatCurrency(t?.cash || 0)} icon={Banknote} color="amber" />
        <StatCard label="UPI" value={formatCurrency(t?.upi || 0)} icon={Smartphone} color="blue" />
        <StatCard label="Bank / Cheque" value={formatCurrency((t?.bank || 0) + (t?.cheque || 0))} icon={Building2} color="purple" />
        <StatCard label="Visits" value={t?.visitsTotal || 0} icon={MapPin} color="red" sub={`${t?.visitsCompleted || 0} completed`} />
      </div>

      {data?.unassigned?.total > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <b>{formatCurrency(data.unassigned.total)}</b> ({data.unassigned.txns} txns) It isn't linked to any executive. These could be client portal/gateway payments or older records from before the migration.
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : !data?.rows?.length ? (
          <EmptyState icon={<Wallet size={40} />} title="No collection in this period" description="Doosri date ya executive select karke dekho." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Executive</th>
                  <th className="text-center font-semibold px-3 py-3">Visits</th>
                  <th className="text-right font-semibold px-3 py-3">Cash</th>
                  <th className="text-right font-semibold px-3 py-3">UPI</th>
                  <th className="text-right font-semibold px-3 py-3">Bank</th>
                  <th className="text-right font-semibold px-3 py-3">Cheque</th>
                  <th className="text-right font-semibold px-3 py-3">Card</th>
                  <th className="text-right font-semibold px-3 py-3">Online</th>
                  <th className="text-right font-semibold px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r: any) => (
                  <tr key={r.userId} onClick={() => openDrill(r)} className="border-t border-gray-50 hover:bg-blue-50/40 cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                          {getInitials(r.name)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{r.name}</p>
                          <p className="text-[11px] text-gray-400">{r.txns} txns · click for details</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="font-semibold text-gray-900">{r.visitsCompleted}</span>
                      <span className="text-gray-400">/{r.visitsTotal}</span>
                      {r.visitsPending > 0 && <span className="block text-[10px] text-amber-600">{r.visitsPending} pending</span>}
                    </td>
                    <td className="px-3 py-3 text-right">{r.cash ? <span className="font-semibold text-amber-700">{formatCurrency(r.cash)}</span> : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-3 text-right">{r.upi ? <span className="font-semibold text-blue-700">{formatCurrency(r.upi)}</span> : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-3 text-right text-gray-600">{r.bank ? formatCurrency(r.bank) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-3 text-right text-gray-600">{r.cheque ? formatCurrency(r.cheque) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-3 text-right text-gray-600">{r.card ? formatCurrency(r.card) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-3 text-right text-gray-600">{r.online ? formatCurrency(r.online) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr className="font-bold text-gray-900">
                  <td className="px-4 py-3">Grand Total</td>
                  <td className="px-3 py-3 text-center">{t?.visitsCompleted}/{t?.visitsTotal}</td>
                  <td className="px-3 py-3 text-right">{formatCurrency(t?.cash || 0)}</td>
                  <td className="px-3 py-3 text-right">{formatCurrency(t?.upi || 0)}</td>
                  <td className="px-3 py-3 text-right">{formatCurrency(t?.bank || 0)}</td>
                  <td className="px-3 py-3 text-right">{formatCurrency(t?.cheque || 0)}</td>
                  <td className="px-3 py-3 text-right">{formatCurrency(t?.card || 0)}</td>
                  <td className="px-3 py-3 text-right">{formatCurrency(t?.online || 0)}</td>
                  <td className="px-4 py-3 text-right text-green-700">{formatCurrency(t?.total || 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Drill-down */}
      <Modal open={!!drill} onClose={() => setDrill(null)} title={`${drill?.name} — Transactions`} className="!max-w-4xl">
        {txnLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : !txns.length ? (
          <EmptyState icon={<Receipt size={40} />} title="No transactions" description="No payment record for this period." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left font-semibold px-3 py-2.5">Date / Time</th>
                    <th className="text-left font-semibold px-3 py-2.5">Client</th>
                    <th className="text-left font-semibold px-3 py-2.5">Invoice</th>
                    <th className="text-left font-semibold px-3 py-2.5">Method</th>
                    <th className="text-left font-semibold px-3 py-2.5">Reference</th>
                    <th className="text-right font-semibold px-3 py-2.5">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((p: any) => (
                    <tr key={p.id} className="border-t border-gray-50">
                      <td className="px-3 py-2.5 text-gray-600">
                        {formatDate(p.paidAt)}
                        <span className="block text-[10px] text-gray-400">
                          {new Date(p.paidAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-gray-900">{p.invoice?.client?.companyName || p.invoice?.client?.clientName || '—'}</p>
                        <p className="text-[10px] text-gray-400">{p.invoice?.client?.clientCode}</p>
                      </td>
                      <td className="px-3 py-2.5 text-blue-600">{p.invoice?.invoiceNumber}</td>
                      <td className="px-3 py-2.5"><Badge status={p.method} /></td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{p.reference || '—'}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-900">{formatCurrency(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {txnTotal > 20 && (
              <div className="pt-4">
                <Pagination page={txnPage} totalPages={Math.ceil(txnTotal / 20)} onPageChange={setTxnPage} />
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
