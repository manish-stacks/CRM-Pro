// src/app/proposal/view/[token]/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CheckCircle, XCircle, Printer } from 'lucide-react'
import toast from 'react-hot-toast'

interface Proposal {
  id: string
  proposalNumber: string
  title: string
  status: string
  subtotal: number
  totalAmount: number
  discount: number
  discountType?: 'PERCENT' | 'FLAT'
  gstApplicable?: boolean
  gstRate?: number
  gstAmount?: number
  finalAmount: number
  validUntil?: string
  notes?: string
  terms?: string
  createdAt: string
  lead?: { clientName: string; companyName?: string; clientPhone?: string; clientEmail?: string }
  client?: { companyName: string; clientName: string; phone: string; email?: string }
  items: { id: string; serviceName?: string; description: string; quantity: number; unitPrice: number; total: number }[]
  createdBy: { name: string }
  company?: {
    name: string
    email: string
    phone: string
    address: string
    logoUrl?: string
  }
}

export default function ProposalViewPage() {
  const params = useParams()
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (params.token) {
      fetch(`/api/proposals/view/${params.token}`)
        .then(r => r.json())
        .then(d => {
          if (d.error) setError(d.error)
          else setProposal(d.data)
        })
        .catch(() => setError('Failed to load proposal'))
        .finally(() => setLoading(false))
    }
  }, [params.token])

  const respond = async (action: 'accept' | 'reject') => {
    if (!proposal) return
    setResponding(true)
    try {
      const res = await fetch(`/api/proposals/view/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(action === 'accept' ? 'Proposal accepted! We will contact you shortly.' : 'Proposal declined.')
      setProposal(prev => prev ? { ...prev, status: action === 'accept' ? 'ACCEPTED' : 'REJECTED' } : null)
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed')
    } finally {
      setResponding(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-500 animate-pulse">Loading proposal...</div>
      </div>
    )
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
            <XCircle size={28} className="text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Proposal Not Found</h2>
          <p className="text-slate-500">{error || 'This proposal link is invalid or has expired.'}</p>
        </div>
      </div>
    )
  }

  const isExpired = proposal.validUntil && new Date(proposal.validUntil) < new Date()
  const canRespond = proposal.status === 'SENT' || proposal.status === 'VIEWED'
  const clientName = proposal.lead?.clientName || proposal.client?.clientName || '-'
  const clientCompany = proposal.lead?.companyName || proposal.client?.companyName || '-'
  const clientPhone = proposal.lead?.clientPhone || proposal.client?.phone
  const clientEmail = proposal.lead?.clientEmail || proposal.client?.email

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:p-0">
      {/* Screen-only toolbar */}
      {canRespond && !isExpired && (
        <div className="max-w-[210mm] mx-auto mb-4 flex items-center justify-between print:hidden">
          <span className="text-sm text-slate-500">Proposal #{proposal.proposalNumber}</span>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50"
          >
            <Printer size={15} />
            Print / Save as PDF
          </button>
        </div>
      )}

      {/* A4 sheet */}
      <div className="max-w-[210mm] min-h-[297mm] mx-auto bg-white text-slate-900 shadow-sm border border-slate-200 px-10 py-10 print:shadow-none print:border-0 print:w-[210mm] print:min-h-[297mm]">
        {/* Title */}
        <h1 className="text-center text-2xl font-bold tracking-wide text-slate-900 mb-6">PROPOSAL</h1>

        {/* Company header */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              {proposal.company?.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={proposal.company.logoUrl} alt="" className="h-10 w-10 object-contain" />
              )}
              <h2 className="text-xl font-extrabold text-red-600">{proposal.company?.name || 'Your Company'}</h2>
            </div>
            {proposal.company?.address && (
              <p className="text-xs text-slate-600 mt-2 max-w-md">{proposal.company.address}</p>
            )}
            <div className="text-xs text-slate-600 mt-1 space-y-0.5">
              {proposal.company?.phone && <p><span className="font-semibold">Contact:</span> {proposal.company.phone}</p>}
              {proposal.company?.email && <p><span className="font-semibold">Email:</span> {proposal.company.email}</p>}
            </div>
          </div>
          <div className="text-right text-xs text-slate-700 space-y-1 shrink-0">
            <p><span className="font-semibold">Proposal No:</span> {proposal.proposalNumber}</p>
            <p><span className="font-semibold">Date:</span> {formatDate(proposal.createdAt)}</p>
            {proposal.validUntil && (
              <p className={isExpired ? 'text-red-600 font-semibold' : ''}>
                <span className="font-semibold text-slate-700">{isExpired ? 'Expired' : 'Valid Until'}:</span>{' '}
                {formatDate(proposal.validUntil)}
              </p>
            )}
            <p>
              <span className="font-semibold">Status:</span>{' '}
              <span className={
                proposal.status === 'ACCEPTED' ? 'text-green-600 font-semibold' :
                proposal.status === 'REJECTED' ? 'text-red-600 font-semibold' :
                'text-blue-600 font-semibold'
              }>{proposal.status}</span>
            </p>
          </div>
        </div>

        {/* Prepared For */}
        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Prepared For</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <p><span className="font-semibold text-slate-700">Client Name:</span> {clientName}</p>
            <p><span className="font-semibold text-slate-700">Contact No:</span> {clientPhone || '-'}</p>
            <p><span className="font-semibold text-slate-700">Company Name:</span> {clientCompany}</p>
            <p><span className="font-semibold text-slate-700">Email ID:</span> {clientEmail || '-'}</p>
          </div>
        </div>

        <p className="text-base font-semibold text-slate-800 mb-3">{proposal.title}</p>

        {/* Line items table */}
        <table className="w-full border border-slate-300 text-sm mb-4">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300">
              <th className="text-left p-2.5 border-r border-slate-300 font-semibold text-slate-700 w-10">Sr No</th>
              <th className="text-left p-2.5 border-r border-slate-300 font-semibold text-slate-700 w-32">Service</th>
              <th className="text-left p-2.5 border-r border-slate-300 font-semibold text-slate-700">Description</th>
              <th className="text-center p-2.5 border-r border-slate-300 font-semibold text-slate-700 w-16">Qty</th>
              <th className="text-right p-2.5 border-r border-slate-300 font-semibold text-slate-700 w-28">Rate</th>
              <th className="text-right p-2.5 font-semibold text-slate-700 w-32">Net Amount</th>
            </tr>
          </thead>
          <tbody>
            {proposal.items.map((item, i) => (
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

        {/* Totals box, right aligned like the reference */}
        <div className="flex justify-end mb-6">
          <table className="text-sm border border-slate-300 w-72">
            <tbody>
              <tr className="border-b border-slate-300">
                <td className="p-2 font-semibold text-slate-700 bg-slate-50">Subtotal</td>
                <td className="p-2 text-right">{formatCurrency(proposal.subtotal)}</td>
              </tr>
              {proposal.discount > 0 && (
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-semibold text-slate-700 bg-slate-50">
                    Discount{proposal.discountType === 'PERCENT' ? ` (${proposal.discount}%)` : ''}
                  </td>
                  <td className="p-2 text-right text-red-500">
                    − {formatCurrency(proposal.discountType === 'PERCENT' ? proposal.subtotal * (proposal.discount / 100) : proposal.discount)}
                  </td>
                </tr>
              )}
              {proposal.gstApplicable && (
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-semibold text-slate-700 bg-slate-50">GST ({proposal.gstRate}%)</td>
                  <td className="p-2 text-right">{formatCurrency(proposal.gstAmount || 0)}</td>
                </tr>
              )}
              <tr className="bg-slate-100">
                <td className="p-2 font-bold text-slate-800">Grand Total</td>
                <td className="p-2 text-right font-bold text-green-700">{formatCurrency(proposal.finalAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Notes / Terms */}
        {(proposal.notes || proposal.terms) && (
          <div className="grid grid-cols-2 gap-6 mb-6">
            {proposal.notes && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Notes</h3>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{proposal.notes}</p>
              </div>
            )}
            {proposal.terms && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Terms & Conditions</h3>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{proposal.terms}</p>
              </div>
            )}
          </div>
        )}

        {/* Signature line, mirrors reference layout */}
        <div className="flex justify-end mt-10 mb-4">
          <div className="text-center">
            <p className="text-sm font-semibold text-red-600 mb-6">For {proposal.company?.name || 'Your Company'}</p>
            <p className="text-xs text-slate-500 border-t border-slate-400 pt-1 px-6">Authorised Signatory</p>
          </div>
        </div>

        {/* Response status banners */}
        {proposal.status === 'ACCEPTED' && (
          <div className="border border-green-300 bg-green-50 rounded-lg p-4 text-center mb-4 print:hidden">
            <CheckCircle size={28} className="text-green-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-green-700">Proposal Accepted</p>
            <p className="text-xs text-slate-500 mt-1">Thank you! We will reach out to you soon to proceed.</p>
          </div>
        )}
        {proposal.status === 'REJECTED' && (
          <div className="border border-red-300 bg-red-50 rounded-lg p-4 text-center mb-4 print:hidden">
            <XCircle size={28} className="text-red-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-red-700">Proposal Declined</p>
            <p className="text-xs text-slate-500 mt-1">Thank you for your response. Feel free to reach out if you change your mind.</p>
          </div>
        )}

        {/* Action buttons, hidden on print */}
        {canRespond && !isExpired && (
          <div className="border border-slate-200 rounded-lg p-5 mt-4 print:hidden">
            <p className="text-sm font-semibold text-slate-800 mb-1">Your Response</p>
            <p className="text-xs text-slate-500 mb-4">Please review the proposal and let us know your decision.</p>
            <div className="flex gap-4">
              <button
                disabled={responding}
                onClick={() => respond('reject')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-300 bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium text-sm disabled:opacity-50"
              >
                <XCircle size={16} />
                Decline
              </button>
              <button
                disabled={responding}
                onClick={() => respond('accept')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors font-medium text-sm disabled:opacity-50"
              >
                <CheckCircle size={16} />
                Accept Proposal
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-[11px] text-slate-400 mt-8 pt-4 border-t border-slate-200">
          Prepared by {proposal.createdBy?.name} · {formatDate(proposal.createdAt)}
          {proposal.company?.email && ` · ${proposal.company.email}`}
        </p>
      </div>
    </div>
  )
}