'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/axios'
import { Button, Input, Select, Textarea, Modal, Badge } from '@/components/ui'
import { formatDate, formatCurrency } from '@/lib/utils'
import {
  ArrowLeft, Send, Loader2, DollarSign, Plus, CreditCard, Building2, Check, AlertCircle, Download
} from 'lucide-react'
import toast from 'react-hot-toast'

const METHODS = ['UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE_GATEWAY']

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'none' | 'send' | 'pay'>('none')
  const [saving, setSaving] = useState(false)

  const [payForm, setPayForm] = useState({
    amount: '', method: 'UPI', reference: '', notes: '',
    paidAt: new Date().toISOString().split('T')[0],
  })

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get(`/invoices/${id}`)
      setInvoice(r.data.data)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
      router.push('/invoices')
    } finally { setLoading(false) }
  }, [id, router])

  useEffect(() => { fetch_() }, [fetch_])

  const send = async () => {
    setSaving(true)
    try {
      await api.post(`/invoices/${id}/send`, { viaEmail: true, viaWhatsapp: true })
      toast.success('Sent via email + WhatsApp')
      setModal('none')
      fetch_()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const recordPayment = async () => {
    const amt = Number(payForm.amount)
    if (!amt || amt <= 0) { toast.error('Enter valid amount'); return }
    if (amt > invoice.dueAmount) { toast.error(`Cannot exceed due amount (₹${invoice.dueAmount})`); return }
    setSaving(true)
    try {
      await api.post('/payments', {
        invoiceId: id,
        amount: amt,
        method: payForm.method,
        reference: payForm.reference,
        notes: payForm.notes,
        paidAt: payForm.paidAt,
      })
      toast.success('Payment recorded')
      setModal('none')
      fetch_()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const openPay = () => {
    setPayForm({
      amount: String(invoice.dueAmount),
      method: 'UPI', reference: '', notes: '',
      paidAt: new Date().toISOString().split('T')[0],
    })
    setModal('pay')
  }

  const downloadPdf = () => {
    // Real server-rendered PDF (with company letterhead header/footer on
    // every page) opens directly in the browser's PDF viewer — same "view
    // first, download after" flow as letters/payments/payroll.
    window.open(`/api/invoices/${id}/pdf`, '_blank')
  }

  if (loading) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>
  if (!invoice) return null

  const isOverdue = invoice.dueDate && new Date(invoice.dueDate) < new Date() && invoice.status !== 'PAID' && invoice.status !== 'CANCELLED'

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <Link href="/invoices" className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
        <ArrowLeft size={13} /> Back
      </Link>

      <div className="card p-5 flex items-start justify-between flex-wrap gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-sm text-gray-500">{invoice.invoiceNumber}</span>
            <Badge status={invoice.status} />
            {isOverdue && <span className="badge bg-red-100 text-red-700"><AlertCircle size={10} /> Overdue</span>}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{invoice.client?.clientName}</h1>
          <p className="text-sm text-gray-600 flex items-center gap-1 mt-1"><Building2 size={12} /> {invoice.client?.companyName}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
            <span>Issued: {formatDate(invoice.createdAt)}</span>
            {invoice.dueDate && <span>Due: {formatDate(invoice.dueDate)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
            <button onClick={openPay} className="btn-primary btn-sm !bg-emerald-600 hover:!bg-emerald-700">
              <DollarSign size={13} /> Record Payment
            </button>
          )}
          <button onClick={() => setModal('send')} className="btn-secondary btn-sm">
            <Send size={13} /> Send to Client
          </button>
          <button onClick={downloadPdf} className="btn-secondary btn-sm">
            <Download size={13} /> PDF
          </button>
        </div>
      </div>

      {/* Amount stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-xl font-bold tabular-nums">{formatCurrency(invoice.totalAmount)}</p>
        </div>
        <div className="card p-4 bg-emerald-50">
          <p className="text-xs text-emerald-700">Paid</p>
          <p className="text-xl font-bold text-emerald-700 tabular-nums">{formatCurrency(invoice.paidAmount)}</p>
        </div>
        <div className={`card p-4 ${invoice.dueAmount > 0 ? 'bg-red-50' : ''}`}>
          <p className="text-xs">{invoice.dueAmount > 0 ? 'Due' : 'Cleared'}</p>
          <p className={`text-xl font-bold tabular-nums ${invoice.dueAmount > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
            {formatCurrency(invoice.dueAmount)}
          </p>
        </div>
      </div>

      {/* Items */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Line Items</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Service</th><th>Description</th>
                <th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((it: any, idx: number) => (
                <tr key={it.id}>
                  <td>{idx + 1}</td>
                  <td className="font-medium">{it.serviceName || '—'}</td>
                  <td className="text-sm text-gray-600">{it.description}</td>
                  <td className="text-right tabular-nums">{it.quantity}</td>
                  <td className="text-right tabular-nums">{formatCurrency(it.unitPrice)}</td>
                  <td className="text-right font-medium tabular-nums">{formatCurrency(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span className="tabular-nums">{formatCurrency(invoice.subtotal)}</span></div>
            {invoice.discount > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span className="tabular-nums">−{formatCurrency(invoice.discountType === 'PERCENT' ? invoice.subtotal * (invoice.discount / 100) : invoice.discount)}</span></div>}
            {invoice.gstApplicable && <div className="flex justify-between text-gray-600"><span>GST ({invoice.gstRate}%)</span><span className="tabular-nums">{formatCurrency(invoice.gstAmount)}</span></div>}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200"><span>Total</span><span className="tabular-nums">{formatCurrency(invoice.totalAmount)}</span></div>
          </div>
        </div>
      </div>

      {/* Payments history */}
      {invoice.payments?.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Payment History</h3>
          <div className="space-y-2">
            {invoice.payments.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <Check size={13} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{formatCurrency(p.amount)} · {p.method}</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(p.paidAt)}
                    {p.reference && <> · Ref: {p.reference}</>}
                    {p.source === 'CLIENT_PORTAL' && <> · <span className="text-brand-600">via Client Portal</span></>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(invoice.notes || invoice.terms) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {invoice.notes && <div className="card p-5"><h3 className="font-semibold text-sm mb-2">Notes</h3><p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p></div>}
          {invoice.terms && <div className="card p-5"><h3 className="font-semibold text-sm mb-2">Terms</h3><p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.terms}</p></div>}
        </div>
      )}

      {/* Record Payment Modal */}
      <Modal open={modal === 'pay'} onClose={() => setModal('none')} title="Record Payment">
        <div className="space-y-3">
          <div className="bg-brand-50 border border-blue-200 rounded-lg p-3 text-sm">
            <p><b>Invoice:</b> {invoice.invoiceNumber}</p>
            <p><b>Amount Due:</b> {formatCurrency(invoice.dueAmount)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount *" type="number" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} />
            <div>
              <label className="block text-sm text-gray-700">Method *</label>
              <select value={payForm.method} onChange={e => setPayForm(p => ({ ...p, method: e.target.value }))} className="input">
                {METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Reference / Transaction ID" value={payForm.reference} onChange={e => setPayForm(p => ({ ...p, reference: e.target.value }))}
              placeholder={payForm.method === 'UPI' ? 'UPI Ref' : payForm.method === 'CHEQUE' ? 'Cheque #' : 'Ref#'} />
            <Input label="Paid On" type="date" value={payForm.paidAt} onChange={e => setPayForm(p => ({ ...p, paidAt: e.target.value }))} />
          </div>
          <Textarea label="Notes" value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
          <p className="text-xs text-gray-500">📲 WhatsApp confirmation will be sent to client.</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button onClick={recordPayment} loading={saving} className="!bg-emerald-600 hover:!bg-emerald-700">
              <DollarSign size={13} /> Record Payment
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'send'} onClose={() => setModal('none')} title="Send Invoice">
        <div className="space-y-4">
          <div className="bg-brand-50 border border-blue-200 rounded-lg p-3 text-sm">
            <p>Send invoice <b>{invoice.invoiceNumber}</b> to <b>{invoice.client?.clientName}</b> via email + WhatsApp.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button onClick={send} loading={saving}><Send size={13} /> Send</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
