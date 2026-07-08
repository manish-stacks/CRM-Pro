// src/app/invoice/view/[token]/page.tsx
// Public "view invoice" page — same pattern as /proposal/view/[token].
// No login required; the unguessable share token is the access control.
'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { formatCurrency, formatDate } from '@/lib/utils'
import { XCircle, Printer } from 'lucide-react'

interface InvoiceItem {
  id: string
  serviceName?: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}
interface Payment {
  amount: number
  method: string
  paidAt: string
  reference?: string
}
interface InvoiceData {
  id: string
  invoiceNumber: string
  status: string
  subtotal: number
  discount: number
  discountType?: 'PERCENT' | 'FIXED'
  gstApplicable?: boolean
  gstRate?: number
  gstAmount?: number
  totalAmount: number
  paidAmount: number
  dueAmount: number
  dueDate?: string
  notes?: string
  createdAt: string
  items: InvoiceItem[]
  payments: Payment[]
  client: {
    clientCode?: string
    clientName: string
    companyName?: string
    phone?: string
    email?: string
    address?: string
    city?: string
    gstNo?: string
  }
  company?: { name: string; email: string; phone: string; address: string }
}

export default function InvoiceViewPage() {
  const params = useParams()
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (params.token) {
      fetch(`/api/invoices/view/${params.token}`)
        .then(r => r.json())
        .then(d => {
          if (d.error) setError(d.error)
          else setInvoice(d.data)
        })
        .catch(() => setError('Failed to load invoice'))
        .finally(() => setLoading(false))
    }
  }, [params.token])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-500 animate-pulse">Loading invoice...</div>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
            <XCircle size={28} className="text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Invoice Not Found</h2>
          <p className="text-slate-500">{error || 'This invoice link is invalid.'}</p>
        </div>
      </div>
    )
  }

  const discountAmount = invoice.discountType === 'PERCENT'
    ? invoice.subtotal * (invoice.discount / 100)
    : invoice.discount

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:p-0">
      {/* Screen-only toolbar */}
      <div className="max-w-[210mm] mx-auto mb-4 flex items-center justify-between print:hidden">
        <span className="text-sm text-slate-500">Invoice #{invoice.invoiceNumber}</span>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50"
        >
          <Printer size={15} />
          Print / Save as PDF
        </button>
      </div>

      {/* A4 sheet */}
      <div className="max-w-[210mm] min-h-[297mm] mx-auto bg-white text-slate-900 shadow-sm border border-slate-200 px-10 py-10 print:shadow-none print:border-0 print:w-[210mm] print:min-h-[297mm]">
        <h1 className="text-center text-2xl font-bold tracking-wide text-slate-900 mb-6">TAX INVOICE</h1>

        {/* Company header */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-6">
          <div>
            <h2 className="text-xl font-extrabold text-red-600">{invoice.company?.name || 'Your Company'}</h2>
            {invoice.company?.address && (
              <p className="text-xs text-slate-600 mt-2 max-w-md">{invoice.company.address}</p>
            )}
            <div className="text-xs text-slate-600 mt-1 space-y-0.5">
              {invoice.company?.phone && <p><span className="font-semibold">Contact:</span> {invoice.company.phone}</p>}
              {invoice.company?.email && <p><span className="font-semibold">Email:</span> {invoice.company.email}</p>}
            </div>
          </div>
          <div className="text-right text-xs text-slate-700 space-y-1 shrink-0">
            <p><span className="font-semibold">Invoice No:</span> {invoice.invoiceNumber}</p>
            <p><span className="font-semibold">Date:</span> {formatDate(invoice.createdAt)}</p>
            {invoice.dueDate && <p><span className="font-semibold">Due:</span> {formatDate(invoice.dueDate)}</p>}
            <p>
              <span className="font-semibold">Status:</span>{' '}
              <span className={
                invoice.status === 'PAID' ? 'text-green-600 font-semibold' :
                invoice.status === 'OVERDUE' ? 'text-red-600 font-semibold' :
                'text-blue-600 font-semibold'
              }>{invoice.status}</span>
            </p>
          </div>
        </div>

        {/* Bill To */}
        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Bill To</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <p><span className="font-semibold text-slate-700">Company:</span> {invoice.client.companyName || '-'}</p>
            <p><span className="font-semibold text-slate-700">Contact No:</span> {invoice.client.phone || '-'}</p>
            <p><span className="font-semibold text-slate-700">Client Name:</span> {invoice.client.clientName}</p>
            <p><span className="font-semibold text-slate-700">Email:</span> {invoice.client.email || '-'}</p>
            {invoice.client.gstNo && <p><span className="font-semibold text-slate-700">GSTIN:</span> {invoice.client.gstNo}</p>}
          </div>
        </div>

        {/* Line items */}
        <table className="w-full border border-slate-300 text-sm mb-4">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300">
              <th className="text-left p-2.5 border-r border-slate-300 font-semibold text-slate-700 w-10">Sr No</th>
              <th className="text-left p-2.5 border-r border-slate-300 font-semibold text-slate-700 w-32">Service</th>
              <th className="text-left p-2.5 border-r border-slate-300 font-semibold text-slate-700">Description</th>
              <th className="text-center p-2.5 border-r border-slate-300 font-semibold text-slate-700 w-16">Qty</th>
              <th className="text-right p-2.5 border-r border-slate-300 font-semibold text-slate-700 w-28">Rate</th>
              <th className="text-right p-2.5 font-semibold text-slate-700 w-32">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={item.id} className="border-b border-slate-200">
                <td className="p-2.5 border-r border-slate-200 text-slate-600">{i + 1}</td>
                <td className="p-2.5 border-r border-slate-200 font-medium text-slate-800">{item.serviceName || '—'}</td>
                <td className="p-2.5 border-r border-slate-200 text-slate-600 text-xs">{item.description}</td>
                <td className="p-2.5 border-r border-slate-200 text-center text-slate-600">{item.quantity}</td>
                <td className="p-2.5 border-r border-slate-200 text-right text-slate-600">{formatCurrency(item.unitPrice)}</td>
                <td className="p-2.5 text-right font-medium text-slate-800">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <table className="text-sm border border-slate-300 w-72">
            <tbody>
              <tr className="border-b border-slate-300">
                <td className="p-2 font-semibold text-slate-700 bg-slate-50">Subtotal</td>
                <td className="p-2 text-right">{formatCurrency(invoice.subtotal)}</td>
              </tr>
              {invoice.discount > 0 && (
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-semibold text-slate-700 bg-slate-50">
                    Discount{invoice.discountType === 'PERCENT' ? ` (${invoice.discount}%)` : ''}
                  </td>
                  <td className="p-2 text-right text-red-500">− {formatCurrency(discountAmount)}</td>
                </tr>
              )}
              {invoice.gstApplicable && (
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-semibold text-slate-700 bg-slate-50">GST ({invoice.gstRate}%)</td>
                  <td className="p-2 text-right">{formatCurrency(invoice.gstAmount || 0)}</td>
                </tr>
              )}
              <tr className="bg-slate-100">
                <td className="p-2 font-bold text-slate-800">Grand Total</td>
                <td className="p-2 text-right font-bold text-slate-800">{formatCurrency(invoice.totalAmount)}</td>
              </tr>
              <tr className="border-t border-slate-300">
                <td className="p-2 font-semibold text-slate-700">Paid</td>
                <td className="p-2 text-right text-green-600 font-semibold">{formatCurrency(invoice.paidAmount)}</td>
              </tr>
              <tr>
                <td className="p-2 font-bold text-slate-800">Balance Due</td>
                <td className={`p-2 text-right font-bold ${invoice.dueAmount > 0 ? 'text-red-600' : 'text-green-700'}`}>{formatCurrency(invoice.dueAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {invoice.notes && (
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Notes</h3>
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}

        {invoice.payments?.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Payment History</h3>
            <table className="w-full border border-slate-300 text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="text-left p-2 border-r border-slate-300">Date</th>
                  <th className="text-left p-2 border-r border-slate-300">Method</th>
                  <th className="text-left p-2 border-r border-slate-300">Reference</th>
                  <th className="text-right p-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((p, i) => (
                  <tr key={i} className="border-b border-slate-200">
                    <td className="p-2 border-r border-slate-200">{formatDate(p.paidAt)}</td>
                    <td className="p-2 border-r border-slate-200">{p.method}</td>
                    <td className="p-2 border-r border-slate-200 font-mono">{p.reference || '—'}</td>
                    <td className="p-2 text-right text-green-600 font-medium">{formatCurrency(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end mt-10 mb-4">
          <div className="text-center">
            <p className="text-sm font-semibold text-red-600 mb-6">For {invoice.company?.name || 'Your Company'}</p>
            <p className="text-xs text-slate-500 border-t border-slate-400 pt-1 px-6">Authorised Signatory</p>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-8 pt-4 border-t border-slate-200">
          {invoice.company?.email && `${invoice.company.email}`}
        </p>
      </div>
    </div>
  )
}
