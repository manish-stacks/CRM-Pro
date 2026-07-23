// src/app/receipt/view/[token]/page.tsx
// Public "view payment receipt" page — same pattern as /invoice/view/[token]
// and /proposal/view/[token]. No login required; the unguessable receipt
// token is the access control.
'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CheckCircle2, XCircle, Printer } from 'lucide-react'

interface ReceiptData {
  id: string
  amount: number
  method: string
  reference?: string
  paidAt: string
  notes?: string
  invoice: {
    invoiceNumber: string
    totalAmount: number
    paidAmount: number
    dueAmount: number
    status: string
    client: {
      clientName: string
      companyName?: string
      phone?: string
      email?: string
      address?: string
      city?: string
      gstNo?: string
    }
  }
  company?: { name: string; email: string; phone: string; address: string }
}

export default function ReceiptViewPage() {
  const params = useParams()
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (params.token) {
      fetch(`/api/receipts/view/${params.token}`)
        .then(r => r.json())
        .then(d => {
          if (d.error) setError(d.error)
          else setReceipt(d.data)
        })
        .catch(() => setError('Failed to load receipt'))
        .finally(() => setLoading(false))
    }
  }, [params.token])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-500 animate-pulse">Loading receipt...</div>
      </div>
    )
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
            <XCircle size={28} className="text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Receipt Not Found</h2>
          <p className="text-slate-500">{error || 'This receipt link is invalid.'}</p>
        </div>
      </div>
    )
  }

  const receiptNo = `RCPT-${receipt.id.slice(-8).toUpperCase()}`

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:p-0">
      {/* Screen-only toolbar */}
      <div className="max-w-[180mm] mx-auto mb-4 flex items-center justify-between print:hidden">
        <span className="text-sm text-slate-500">Receipt #{receiptNo}</span>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50"
        >
          <Printer size={15} />
          Print / Save as PDF
        </button>
      </div>

      {/* Receipt sheet */}
      <div className="max-w-[180mm] mx-auto bg-white text-slate-900 shadow-sm border border-slate-200 px-10 py-10 print:shadow-none print:border-0">
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-6">
          <div>
            <h1 className="text-xl font-extrabold text-red-600">{receipt.company?.name || 'Your Company'}</h1>
            {receipt.company?.address && <p className="text-xs text-slate-600 mt-2 max-w-md">{receipt.company.address}</p>}
            <div className="text-xs text-slate-600 mt-1 space-y-0.5">
              {receipt.company?.phone && <p><span className="font-semibold">Contact:</span> {receipt.company.phone}</p>}
              {receipt.company?.email && <p><span className="font-semibold">Email:</span> {receipt.company.email}</p>}
            </div>
          </div>
          <div className="text-right text-xs text-slate-700 space-y-1 shrink-0">
            <p className="text-lg font-bold text-slate-800">PAYMENT RECEIPT</p>
            <p><span className="font-semibold">Receipt No:</span> {receiptNo}</p>
            <p><span className="font-semibold">Date:</span> {formatDate(receipt.paidAt)}</p>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Received From</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <p><span className="font-semibold text-slate-700">Company:</span> {receipt.invoice.client.companyName || '-'}</p>
            <p><span className="font-semibold text-slate-700">Contact No:</span> {receipt.invoice.client.phone || '-'}</p>
            <p><span className="font-semibold text-slate-700">Client Name:</span> {receipt.invoice.client.clientName}</p>
            <p><span className="font-semibold text-slate-700">Email:</span> {receipt.invoice.client.email || '-'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-5 mb-6">
          <CheckCircle2 size={28} className="text-green-600 shrink-0" />
          <div>
            <p className="text-2xl font-extrabold text-green-700">{formatCurrency(receipt.amount)}</p>
            <p className="text-xs text-green-700">Received successfully via {receipt.method.replace('_', ' ')}</p>
          </div>
        </div>

        <table className="w-full border border-slate-300 text-sm mb-6">
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="p-2.5 bg-slate-50 font-semibold text-slate-700 w-48">Against Invoice</td>
              <td className="p-2.5 font-mono text-brand-700">{receipt.invoice.invoiceNumber}</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="p-2.5 bg-slate-50 font-semibold text-slate-700">Payment Method</td>
              <td className="p-2.5">{receipt.method.replace('_', ' ')}</td>
            </tr>
            {receipt.reference && (
              <tr className="border-b border-slate-200">
                <td className="p-2.5 bg-slate-50 font-semibold text-slate-700">Reference / UTR</td>
                <td className="p-2.5 font-mono">{receipt.reference}</td>
              </tr>
            )}
            <tr className="border-b border-slate-200">
              <td className="p-2.5 bg-slate-50 font-semibold text-slate-700">Invoice Total</td>
              <td className="p-2.5">{formatCurrency(receipt.invoice.totalAmount)}</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="p-2.5 bg-slate-50 font-semibold text-slate-700">Total Paid Till Date</td>
              <td className="p-2.5 text-green-600 font-semibold">{formatCurrency(receipt.invoice.paidAmount)}</td>
            </tr>
            <tr>
              <td className="p-2.5 bg-slate-50 font-semibold text-slate-700">Balance Due</td>
              <td className={`p-2.5 font-bold ${receipt.invoice.dueAmount > 0 ? 'text-red-600' : 'text-green-700'}`}>{formatCurrency(receipt.invoice.dueAmount)}</td>
            </tr>
          </tbody>
        </table>

        {receipt.notes && (
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Notes</h3>
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{receipt.notes}</p>
          </div>
        )}

        <div className="flex justify-end mt-10 mb-4">
          <div className="text-center">
            <p className="text-sm font-semibold text-red-600 mb-6">For {receipt.company?.name || 'Your Company'}</p>
            <p className="text-xs text-slate-500 border-t border-slate-400 pt-1 px-6">Authorised Signatory</p>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-8 pt-4 border-t border-slate-200">
          This is a computer-generated receipt and does not require a signature.
        </p>
      </div>
    </div>
  )
}
