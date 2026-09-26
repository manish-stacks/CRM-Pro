'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/axios'
import { useAuth } from '@/hooks/useAuth'
import { Button, Input, Select, Textarea, Modal, Badge } from '@/components/ui'
import { formatDate, formatCurrency } from '@/lib/utils'
import {
  ArrowLeft, Send, Loader2, DollarSign, Plus, CreditCard, Building2, Check, AlertCircle, Download,
  Link2, Copy, MessageCircle, Mail, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'

const METHODS = ['UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE_GATEWAY']

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { isAtLeast } = useAuth()

  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'none' | 'send' | 'pay'>('none')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)
  const [lastSendResult, setLastSendResult] = useState<{ emailSent: boolean; whatsappSent: boolean } | null>(null)

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
      const r = await api.post(`/invoices/${id}/send`, { viaEmail: true, viaWhatsapp: true })
      const { emailSent, whatsappSent } = r.data.data || {}
      setLastSendResult({ emailSent, whatsappSent })
      if (emailSent && whatsappSent) toast.success('Sent via email + WhatsApp')
      else if (emailSent) toast.success('Sent via email — WhatsApp did not go through')
      else if (whatsappSent) toast.success('Sent via WhatsApp — email did not go through')
      else toast.error('Could not send via email or WhatsApp. Use the links below to send manually.')
      fetch_()
    } catch (e: any) {
      setLastSendResult({ emailSent: false, whatsappSent: false })
      toast.error(e.response?.data?.error || 'Failed to send — use the links below to send manually.')
    } finally { setSaving(false) }
  }

  // Fetches (and caches) the public no-login share link for this document —
  // same link used for the "PDF" preview, WhatsApp/email fallback, and Copy Link.
  const getShareLink = async (): Promise<string> => {
    if (shareUrl) return shareUrl
    setLinkLoading(true)
    try {
      const r = await api.get(`/invoices/${id}/share-link`)
      const url = r.data.data.url as string
      setShareUrl(url)
      return url
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Could not generate link')
      return ''
    } finally { setLinkLoading(false) }
  }

  const copyLink = async () => {
    const url = await getShareLink()
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy — link: ' + url)
    }
  }

  const openWhatsappManually = async () => {
    const url = await getShareLink()
    if (!url) return
    const kind = invoice.docType === 'RECEIPT' ? 'receipt' : 'invoice'
    const phone = String(invoice.client?.phone || '').replace(/[^0-9]/g, '')
    const msg = `Hi ${invoice.client?.clientName || ''}, your ${kind} ${invoice.invoiceNumber} for ₹${invoice.totalAmount.toLocaleString('en-IN')} is ready: ${url}`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const openEmailManually = async () => {
    const url = await getShareLink()
    if (!url) return
    const kind = invoice.docType === 'RECEIPT' ? 'Receipt' : 'Invoice'
    const subject = `${kind} ${invoice.invoiceNumber}`
    const body = `Hi ${invoice.client?.clientName || ''},\n\nYour ${kind.toLowerCase()} ${invoice.invoiceNumber} for ₹${invoice.totalAmount.toLocaleString('en-IN')} is ready. You can view/download it here:\n${url}\n\nThanks.`
    window.location.href = `mailto:${invoice.client?.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const deleteInvoice = async () => {
    const kind = invoice.docType === 'RECEIPT' ? 'receipt' : 'invoice'
    if (!confirm(`Delete this ${kind} (${invoice.invoiceNumber})? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await api.delete(`/invoices/${id}`)
      toast.success(`${kind === 'receipt' ? 'Receipt' : 'Invoice'} deleted`)
      router.push('/invoices')
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Delete failed')
      setDeleting(false)
    }
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
            {invoice.docType === 'RECEIPT' && <span className="badge bg-purple-100 text-purple-700">Receipt</span>}
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
          <button onClick={copyLink} disabled={linkLoading} className="btn-secondary btn-sm">
            {linkLoading ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />} Copy Link
          </button>
          <button onClick={downloadPdf} className="btn-secondary btn-sm">
            <Download size={13} /> PDF
          </button>
          {isAtLeast('ADMIN') && (
            <button onClick={deleteInvoice} disabled={deleting} className="btn-secondary btn-sm !text-red-600 hover:!bg-red-50">
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
            </button>
          )}
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

      <Modal open={modal === 'send'} onClose={() => { setModal('none'); setLastSendResult(null) }} title={invoice.docType === 'RECEIPT' ? 'Send Receipt' : 'Send Invoice'}>
        <div className="space-y-4">
          <div className="bg-brand-50 border border-blue-200 rounded-lg p-3 text-sm">
            <p>Send {invoice.docType === 'RECEIPT' ? 'receipt' : 'invoice'} <b>{invoice.invoiceNumber}</b> to <b>{invoice.client?.clientName}</b> via email + WhatsApp.</p>
          </div>

          {lastSendResult && (
            <div className={`rounded-lg p-3 text-xs space-y-1 ${lastSendResult.emailSent || lastSendResult.whatsappSent ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
              <p>Email: {lastSendResult.emailSent ? '✓ Sent' : '✗ Not sent'}</p>
              <p>WhatsApp: {lastSendResult.whatsappSent ? '✓ Sent' : '✗ Not sent'}</p>
              {!(lastSendResult.emailSent && lastSendResult.whatsappSent) && (
                <p className="pt-1">If a channel isn't set up (SMTP/WhatsApp API), use the manual buttons below to send the link yourself instead.</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setModal('none'); setLastSendResult(null) }}>Close</Button>
            <Button onClick={send} loading={saving}><Send size={13} /> Send via server</Button>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500 mb-2">Or send the link manually:</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={copyLink} disabled={linkLoading} className="btn-secondary btn-sm">
                <Link2 size={13} /> Copy Link
              </button>
              <button onClick={openWhatsappManually} disabled={linkLoading || !invoice.client?.phone} className="btn-secondary btn-sm !text-green-700">
                <MessageCircle size={13} /> Open WhatsApp
              </button>
              <button onClick={openEmailManually} disabled={linkLoading || !invoice.client?.email} className="btn-secondary btn-sm !text-blue-700">
                <Mail size={13} /> Open Email
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
