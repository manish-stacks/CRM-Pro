'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button, Badge, Modal, Input, Select, EmptyState, Pagination, SearchInput } from '@/components/ui'
import { formatDate, formatCurrency, getInitials } from '@/lib/utils'
import { Plus, Download, CreditCard, FileText, CheckCircle, Clock, Filter, X, Edit, Trash2, ExternalLink, Receipt } from 'lucide-react'
import api from '@/lib/axios'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
type Tab = 'invoices' | 'payments'

export default function PaymentsPage() {
  const { isAtLeast } = useAuth()
  const [tab, setTab] = useState<Tab>('invoices')
  const [items, setItems] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [dueInvoices, setDueInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ status: '', clientId: '', dateFrom: '', dateTo: '' })
  const [showInvModal, setShowInvModal] = useState(false);
  const [showPmtModal, setShowPmtModal] = useState(false);
  const [showEditInv, setShowEditInv] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [invForm, setInvForm] = useState({ clientId: '', dueDate: '', notes: '', items: [{ description: '', quantity: 1, unitPrice: '', total: 0 }] })
  const [pmtForm, setPmtForm] = useState({ invoiceId: '', amount: '', method: 'UPI', reference: '', paidAt: new Date().toISOString().split('T')[0], nextDueDate: '' })
  const router = useRouter();

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: tab, page: String(page), limit: '20', search, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) })
      const r = await api.get(`/payments?${params}`)
      setItems(r.data.data || [])
      setTotal(r.data.total || 0)
    } finally { setLoading(false) }
  }, [tab, page, search, filters])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { api.get('/clients?limit=200').then(r => setClients(r.data.data || [])).catch(() => { }) }, [])

  // Invoices with a balance due — for the Record Payment dropdown (works from either tab)
  const loadDueInvoices = useCallback(() => {
    api.get('/payments?type=invoices&limit=200')
      .then(r => setDueInvoices((r.data.data || []).filter((i: any) => (i.dueAmount || 0) > 0)))
      .catch(() => { })
  }, [])
  useEffect(() => { loadDueInvoices() }, [loadDueInvoices])

  const invoiceSubtotal = invForm.items.reduce((s, i) => s + (i.total || 0), 0)

  const updateItem = (idx: number, field: string, val: string | number) => {
    setInvForm(prev => {
      const items = [...prev.items]
      items[idx] = { ...items[idx], [field]: val }
      if (field === 'quantity' || field === 'unitPrice') {
        items[idx].total = Number(items[idx].quantity) * Number(items[idx].unitPrice)
      }
      return { ...prev, items }
    })
  }

  const createInvoice = async () => {
    if (!invForm.clientId) { toast.error('Select a client'); return }
    setSaving(true)
    try {
      await api.post('/payments', { type: 'invoice', ...invForm, totalAmount: invoiceSubtotal })
      toast.success('Invoice created!')
      setShowInvModal(false)
      fetchData()
      loadDueInvoices()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed') }
    finally { setSaving(false) }
  }

  const recordPayment = async () => {
    if (!pmtForm.invoiceId || !pmtForm.amount) { toast.error('Invoice and amount required'); return }
    setSaving(true)
    try {
      await api.post('/payments', { type: 'payment', ...pmtForm, amount: Number(pmtForm.amount) })
      toast.success('Payment recorded!')
      setShowPmtModal(false)
      fetchData()
      loadDueInvoices()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed') }
    finally { setSaving(false) }
  }

  const updateInvoiceStatus = async (id: string, status: string) => {
    await api.put(`/payments/${id}`, { status })
    toast.success('Status updated')
    fetchData()
  }

  const downloadInvoice = (id: string) => window.open(`/api/invoices/${id}/pdf`, '_blank')

  // Public, no-login "view invoice" / "view receipt" links (same links the
  // mobile app opens directly). Generated on first request, then reused.
  const shareInvoiceLink = async (id: string) => {
    try {
      const res = await api.get(`/invoices/${id}/share-link`)
      const url = res.data?.data?.url
      if (url) window.open(url, '_blank')
    } catch {
      toast.error('Could not get invoice link')
    }
  }
  const shareReceiptLink = async (paymentId: string) => {
    try {
      const res = await api.get(`/payments/receipt-link/${paymentId}`)
      const url = res.data?.data?.url
      if (url) window.open(url, '_blank')
    } catch {
      toast.error('Could not get receipt link')
    }
  }
  const exportData = () => window.open(`/api/import-export?type=payments&format=csv`, '_blank')

  const pendingInvoices = items.filter((i: any) => tab === 'invoices' && i.dueAmount > 0)

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments & Billing</h1>
          <p className="text-sm text-gray-500">{total} records</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={exportData}><Download size={14} />Export</Button>
          {isAtLeast('MANAGER') && (
            <>
              <Button variant="secondary" onClick={() => setShowPmtModal(true)}><CreditCard size={15} />Record Payment</Button>
              <Button
                variant="primary"
                onClick={() => router.push('/invoices')}
              >
                <Plus size={16} />
                New Invoice
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      {tab === 'invoices' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Invoiced', value: formatCurrency(items.reduce((s: number, i: any) => s + i.totalAmount, 0)), color: 'text-brand-600', bg: 'bg-brand-50' },
            { label: 'Total Paid', value: formatCurrency(items.reduce((s: number, i: any) => s + i.paidAmount, 0)), color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Pending', value: formatCurrency(items.reduce((s: number, i: any) => s + i.dueAmount, 0)), color: 'text-yellow-600', bg: 'bg-yellow-50' },
            { label: 'Overdue', value: items.filter((i: any) => i.status === 'OVERDUE').length, color: 'text-red-600', bg: 'bg-red-50' },
          ].map(s => (
            <div key={s.label} className="card p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                <FileText size={18} className={s.color} />
              </div>
              <div>
                <div className="text-xs text-gray-500">{s.label}</div>
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs + Filter */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['invoices', 'payments'] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); setPage(1) }} className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${tab === t ? 'bg-white shadow text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}>{t}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Search..." />
          <Button variant="secondary" size="sm" onClick={() => setShowFilter(!showFilter)}><Filter size={14} />Filter</Button>
        </div>
      </div>

      {showFilter && (
        <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Select label="Status" value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))} options={[{ value: '', label: 'All' }, { value: 'PENDING', label: 'Pending' }, { value: 'PARTIAL', label: 'Partial' }, { value: 'PAID', label: 'Paid' }, { value: 'OVERDUE', label: 'Overdue' }]} />
          <Select label="Client" value={filters.clientId} onChange={e => setFilters(p => ({ ...p, clientId: e.target.value }))} options={[{ value: '', label: 'All Clients' }, ...clients.map(c => ({ value: c.id, label: c.companyName }))]} />
          <Input label="From Date" type="date" value={filters.dateFrom} onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value }))} />
          <Input label="To Date" type="date" value={filters.dateTo} onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value }))} />
        </div>
      )}

      {/* Invoices */}
      {tab === 'invoices' && (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Invoice</th><th>Client</th><th>Total</th><th>Paid</th><th>Due</th><th>Due Date</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 8 }).map((_, j) => <td key={j}><div className="skeleton h-4 rounded" /></td>)}</tr>)
                : items.length === 0 ? <tr><td colSpan={8}><EmptyState title="No invoices" /></td></tr>
                  : items.map((inv: any) => (
                    <tr key={inv.id}>
                      <td><div className="font-mono text-xs text-brand-600">
                        <a href={`/invoices/${inv.id}`} target="_blank" rel="noreferrer" className="hover:underline">
                          {inv.invoiceNumber}
                        </a>
                      </div><div className="text-xs text-gray-400">{formatDate(inv.createdAt)}</div></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold">{getInitials(inv.client?.companyName || '?')}</div>
                          <div><div className="text-sm font-medium text-gray-900">{inv.client?.companyName}</div><div className="text-xs text-gray-400">{inv.client?.clientName}</div></div>
                        </div>
                      </td>
                      <td className="font-medium">{formatCurrency(inv.totalAmount)}</td>
                      <td className="text-green-600 font-medium">{formatCurrency(inv.paidAmount)}</td>
                      <td className={`font-bold ${inv.dueAmount > 0 ? 'text-red-600' : 'text-gray-400'}`}>{formatCurrency(inv.dueAmount)}</td>
                      <td className="text-xs text-gray-500">{inv.dueDate ? formatDate(inv.dueDate) : '—'}</td>
                      <td><Badge status={inv.status} /></td>
                      <td>
                        <div className="flex gap-1">
                          {isAtLeast('MANAGER') && inv.dueAmount > 0 && <Button variant="success" size="sm" className="p-1.5" onClick={() => { setPmtForm({ invoiceId: inv.id, amount: String(inv.dueAmount), method: 'UPI', reference: '', paidAt: new Date().toISOString().split('T')[0], nextDueDate: '' }); setShowPmtModal(true) }}><CreditCard size={13} /></Button>}
                          <Button variant="ghost" size="sm" className="p-1.5" onClick={() => downloadInvoice(inv.id)}><Download size={13} /></Button>
                          <Button variant="ghost" size="sm" className="p-1.5" onClick={() => shareInvoiceLink(inv.id)} title="Open public invoice link"><ExternalLink size={13} /></Button>
                          {isAtLeast('MANAGER') && (
                            <select className="text-xs border border-gray-200 rounded px-1" value={inv.status} onChange={e => updateInvoiceStatus(inv.id, e.target.value)}>
                              {['PENDING', 'PARTIAL', 'PAID', 'OVERDUE'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'payments' && (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Invoice</th><th>Client</th><th>Amount</th><th>Method</th><th>Ref</th><th>Paid On</th><th>Receipt</th></tr></thead>
            <tbody>
              {loading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j}><div className="skeleton h-4 rounded" /></td>)}</tr>)
                : items.length === 0 ? <tr><td colSpan={7}><EmptyState title="No payments" /></td></tr>
                  : items.map((p: any) => (
                    <tr key={p.id}>
                      <td className="font-mono text-xs text-brand-600">{p.invoice?.invoiceNumber || '—'}</td>
                      <td className="text-sm">{p.invoice?.client?.companyName || '—'}</td>
                      <td className="font-bold text-green-600">{formatCurrency(p.amount)}</td>
                      <td><Badge status={p.method} /></td>
                      <td className="text-xs font-mono text-gray-500">{p.reference || '—'}</td>
                      <td className="text-xs text-gray-500">{formatDate(p.paidAt)}</td>
                      <td><Button variant="ghost" size="sm" className="p-1.5" onClick={() => shareReceiptLink(p.id)} title="Open public receipt link"><Receipt size={13} /></Button></td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />

      {/* Create Invoice */}
      <Modal open={showInvModal} onClose={() => setShowInvModal(false)} title="New Invoice" className="max-w-2xl">
        <div className="space-y-4">
          <div className="form-grid">
            <Select label="Client *" value={invForm.clientId} onChange={e => setInvForm(p => ({ ...p, clientId: e.target.value }))} options={[{ value: '', label: 'Select client...' }, ...clients.map(c => ({ value: c.id, label: c.companyName }))]} />
            <Input label="Due Date" type="date" value={invForm.dueDate} onChange={e => setInvForm(p => ({ ...p, dueDate: e.target.value }))} />
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <label className="label mb-0">Items</label>
              <Button variant="ghost" size="sm" onClick={() => setInvForm(p => ({ ...p, items: [...p.items, { description: '', quantity: 1, unitPrice: '', total: 0 }] }))}>+ Add</Button>
            </div>
            {invForm.items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 mb-2 bg-gray-50 rounded-lg p-2 items-center">
                <input className="input col-span-5 py-1.5 text-sm" placeholder="Description" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} />
                <input className="input col-span-2 py-1.5 text-sm" type="number" min="1" value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} />
                <input className="input col-span-3 py-1.5 text-sm" type="number" placeholder="Price" value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', Number(e.target.value))} />
                <div className="col-span-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-green-600">{formatCurrency(item.total)}</span>
                  {invForm.items.length > 1 && <button onClick={() => setInvForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }))} className="text-red-400 hover:text-red-600 text-xs ml-1">✕</button>}
                </div>
              </div>
            ))}
            <div className="text-right font-bold text-green-600">Total: {formatCurrency(invoiceSubtotal)}</div>
          </div>
          <Input label="Notes" value={invForm.notes} onChange={e => setInvForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes..." />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowInvModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={createInvoice} loading={saving}>Create Invoice</Button>
          </div>
        </div>
      </Modal>

      {/* Record Payment */}
      <Modal open={showPmtModal} onClose={() => setShowPmtModal(false)} title="Record Payment" className="max-w-md">
        <div className="space-y-4">
          <Select label="Invoice *" value={pmtForm.invoiceId} onChange={e => setPmtForm(p => ({ ...p, invoiceId: e.target.value }))}
            options={[{ value: '', label: 'Select invoice...' }, ...dueInvoices.map((i: any) => ({ value: i.id, label: `${i.invoiceNumber || i.id} — ${i.client?.companyName || ''} (Due: ${formatCurrency(i.dueAmount || 0)})` }))]}
          />
          {dueInvoices.length === 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              No pending invoice found (only invoices with balance due are shown). Create a full-amount invoice first to make a part payment.
              <button type="button" onClick={() => { setShowPmtModal(false); setInvForm({ clientId: '', dueDate: '', notes: '', items: [{ description: '', quantity: 1, unitPrice: '', total: 0 }] }); setShowInvModal(true) }}
                className="mt-2 block w-full text-center bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2 text-sm font-medium">
                + New Invoice banao
              </button>
            </div>
          )}
          <div className="form-grid">
            <Input label="Amount *" type="number" value={pmtForm.amount} onChange={e => setPmtForm(p => ({ ...p, amount: e.target.value }))} />
            <Select label="Method" value={pmtForm.method} onChange={e => setPmtForm(p => ({ ...p, method: e.target.value }))} options={['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD'].map(m => ({ value: m, label: m.replace('_', ' ') }))} />
            <Input label="Reference" value={pmtForm.reference} onChange={e => setPmtForm(p => ({ ...p, reference: e.target.value }))} placeholder="UTR/txn ref" />
            <Input label="Date" type="date" value={pmtForm.paidAt} onChange={e => setPmtForm(p => ({ ...p, paidAt: e.target.value }))} />
            <Input label="Balance due date (if any)" type="date" value={(pmtForm as any).nextDueDate || ''} onChange={e => setPmtForm(p => ({ ...p, nextDueDate: e.target.value }))} />
            <div className="flex gap-2">
              {[7, 10, 15, 30].map(d => (
                <button key={d} type="button" onClick={() => setPmtForm(p => ({ ...p, nextDueDate: new Date(Date.now() + d * 864e5).toISOString().split('T')[0] }))}
                  className="text-xs px-2 py-1 rounded-lg border border-gray-200 hover:border-blue-400 hover:text-brand-600">+{d}d</button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowPmtModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={recordPayment} loading={saving}>Record Payment</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}