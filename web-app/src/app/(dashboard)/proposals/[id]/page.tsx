'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/axios'
import { Button, Modal, Badge } from '@/components/ui'
import { formatDate, formatCurrency } from '@/lib/utils'
import {
  ArrowLeft, Send, Copy, Loader2, ExternalLink,
  ArrowRight, Building2
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function ProposalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [proposal, setProposal] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'none' | 'send' | 'convert'>('none')
  const [saving, setSaving] = useState(false)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get(`/proposals/${id}`)
      setProposal(r.data.data)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
      router.push('/proposals')
    } finally { setLoading(false) }
  }, [id, router])

  useEffect(() => { fetch_() }, [fetch_])

  const send = async () => {
    setSaving(true)
    try {
      const r = await api.post(`/proposals/${id}/send`, { viaEmail: true, viaWhatsapp: true })
      const { emailSent, whatsappSent } = r.data.data
      toast.success(`Sent via ${[emailSent && 'email', whatsappSent && 'WhatsApp'].filter(Boolean).join(' + ') || 'none — check logs'}`)
      setModal('none')
      fetch_()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const convert = async () => {
    setSaving(true)
    try {
      const r = await api.post(`/proposals/${id}/convert-to-invoice`, { dueDays: 15 })
      toast.success('Invoice created!')
      router.push(`/invoices/${r.data.data.id}`)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const copyShareLink = () => {
    const url = `${window.location.origin}/api/proposals/view/${proposal.shareToken}/pdf`
    navigator.clipboard.writeText(url)
    toast.success('Share link copied')
  }

  if (loading) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>
  if (!proposal) return null

  const isDraft = proposal.status === 'DRAFT'
  const canConvert = ['ACCEPTED', 'VIEWED', 'SENT'].includes(proposal.status)
  const personName = proposal.client?.clientName || proposal.lead?.clientName
  const companyName = proposal.client?.companyName || proposal.lead?.companyName

  return (
    <div className="space-y-5">
      <Link href="/proposals" className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
        <ArrowLeft size={13} /> Back
      </Link>

      <div className="card p-5 flex items-start justify-between flex-wrap gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-sm text-gray-500">{proposal.proposalNumber}</span>
            <Badge status={proposal.status} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{proposal.title}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-600 flex-wrap">
            <span className="flex items-center gap-1"><Building2 size={12} />{companyName}</span>
            <span>Contact: {personName}</span>
            {proposal.validUntil && <span>Valid until: {formatDate(proposal.validUntil)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isDraft && (
            <button onClick={() => setModal('send')} className="btn-primary btn-sm">
              <Send size={13} /> Send to Client
            </button>
          )}
          {canConvert && (
            <button onClick={() => setModal('convert')} className="btn-primary btn-sm !bg-emerald-600 hover:!bg-emerald-700">
              <ArrowRight size={13} /> Convert to Invoice
            </button>
          )}
          <button onClick={copyShareLink} className="btn-secondary btn-sm" title="Copy share link">
            <Copy size={13} /> Share Link
          </button>
          <a href={`/api/proposals/view/${proposal.shareToken}/pdf`} target="_blank" className="btn-secondary btn-sm">
            <ExternalLink size={13} /> Preview
          </a>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Line Items</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th className="w-8">#</th>
                <th>Service</th>
                <th>Description</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {proposal.items.map((item: any, idx: number) => (
                <tr key={item.id}>
                  <td className="text-gray-500">{idx + 1}</td>
                  <td className="font-medium">{item.serviceName || '—'}</td>
                  <td className="text-sm text-gray-600">{item.description}</td>
                  <td className="text-right tabular-nums">{item.quantity}</td>
                  <td className="text-right tabular-nums">{formatCurrency(item.unitPrice)}</td>
                  <td className="text-right font-medium tabular-nums">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span className="tabular-nums">{formatCurrency(proposal.subtotal)}</span>
            </div>
            {proposal.discount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount</span>
                <span className="tabular-nums">−{formatCurrency(proposal.discountType === 'PERCENT' ? proposal.subtotal * (proposal.discount / 100) : proposal.discount)}</span>
              </div>
            )}
            {proposal.gstApplicable && (
              <div className="flex justify-between text-gray-600">
                <span>GST ({proposal.gstRate}%)</span>
                <span className="tabular-nums">{formatCurrency(proposal.gstAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(proposal.finalAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      {(proposal.notes || proposal.terms) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {proposal.notes && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-2">Notes</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{proposal.notes}</p>
            </div>
          )}
          {proposal.terms && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-2">Terms & Conditions</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{proposal.terms}</p>
            </div>
          )}
        </div>
      )}

      <Modal open={modal === 'send'} onClose={() => setModal('none')} title="Send Proposal">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <p>Sending <b>{proposal.proposalNumber}</b> to <b>{personName}</b></p>
            <p className="text-xs text-blue-700 mt-1">Email + WhatsApp will be delivered with a shareable link.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button onClick={send} loading={saving}><Send size={13} /> Send Now</Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'convert'} onClose={() => setModal('none')} title="Convert to Invoice">
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
            <p>Create an invoice from this proposal with all line items, discount, and GST carried over. Due in 15 days.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button onClick={convert} loading={saving} className="!bg-emerald-600 hover:!bg-emerald-700">
              <ArrowRight size={13} /> Create Invoice
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
