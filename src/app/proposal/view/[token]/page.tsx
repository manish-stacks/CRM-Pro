// src/app/proposal/view/[token]/page.tsx
// Public "view proposal" page — no login required, the unguessable share
// token is the access control. Shows the actual PDF (same file rendered by
// /api/proposals/view/[token]/pdf) embedded directly, instead of duplicating
// the layout as separate HTML — one single source of design/truth. Accept /
// Decline actions live below the embedded document.
'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

interface Proposal {
  id: string
  proposalNumber: string
  status: string
  validUntil?: string
  createdAt: string
}

export default function ProposalViewPage() {
  const params = useParams()
  const token = params.token as string
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (token) {
      fetch(`/api/proposals/view/${token}`)
        .then(r => r.json())
        .then(d => {
          if (d.error) setError(d.error)
          else setProposal(d.data)
        })
        .catch(() => setError('Failed to load proposal'))
        .finally(() => setLoading(false))
    }
  }, [token])

  const respond = async (action: 'accept' | 'reject') => {
    if (!proposal) return
    setResponding(true)
    try {
      const res = await fetch(`/api/proposals/view/${token}`, {
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
  const pdfUrl = `/api/proposals/view/${token}/pdf`

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4">
      <div className="max-w-[900px] mx-auto space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Proposal #{proposal.proposalNumber}</span>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50"
          >
            <ExternalLink size={15} />
            Open in New Tab
          </a>
        </div>

        {/* Embedded PDF — the single source of design, same file the "Open in New Tab" link opens */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <iframe
            src={pdfUrl}
            title={`Proposal ${proposal.proposalNumber}`}
            className="w-full"
            style={{ height: '85vh', border: 'none' }}
          />
        </div>

        {/* Response status banners */}
        {proposal.status === 'ACCEPTED' && (
          <div className="border border-green-300 bg-green-50 rounded-lg p-4 text-center">
            <CheckCircle size={28} className="text-green-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-green-700">Proposal Accepted</p>
            <p className="text-xs text-slate-500 mt-1">Thank you! We will reach out to you soon to proceed.</p>
          </div>
        )}
        {proposal.status === 'REJECTED' && (
          <div className="border border-red-300 bg-red-50 rounded-lg p-4 text-center">
            <XCircle size={28} className="text-red-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-red-700">Proposal Declined</p>
            <p className="text-xs text-slate-500 mt-1">Thank you for your response. Feel free to reach out if you change your mind.</p>
          </div>
        )}
        {isExpired && canRespond === false && proposal.status !== 'ACCEPTED' && proposal.status !== 'REJECTED' && (
          <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 text-center">
            <p className="text-sm font-semibold text-amber-700">This proposal has expired</p>
          </div>
        )}

        {/* Action buttons */}
        {canRespond && !isExpired && (
          <div className="border border-slate-200 bg-white rounded-lg p-5">
            <p className="text-sm font-semibold text-slate-800 mb-1">Your Response</p>
            <p className="text-xs text-slate-500 mb-4">Please review the proposal above and let us know your decision.</p>
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

        <p className="text-center text-[11px] text-slate-400 pt-2 pb-6">
          Received {formatDate(proposal.createdAt)}
        </p>
      </div>
    </div>
  )
}
