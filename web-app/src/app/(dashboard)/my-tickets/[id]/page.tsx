'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/axios'
import { Button, Select, Textarea, Badge } from '@/components/ui'
import { formatDateTime, getInitials } from '@/lib/utils'
import { ArrowLeft, Send, Loader2, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED']

export default function MyTicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get(`/employee-tickets/${id}`)
      setTicket(r.data.data)
    } catch { router.push('/my-tickets') }
    finally { setLoading(false) }
  }, [id, router])

  useEffect(() => { fetch_() }, [fetch_])

  const submitReply = async () => {
    if (!reply.trim()) return
    setSending(true)
    try {
      await api.post(`/employee-tickets/${id}/replies`, { body: reply })
      setReply('')
      fetch_()
      toast.success('Reply added')
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed') }
    finally { setSending(false) }
  }

  const changeStatus = async (s: string) => {
    await api.patch(`/employee-tickets/${id}`, { status: s })
    fetch_()
    toast.success('Status updated')
  }

  if (loading) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>
  if (!ticket) return null

  return (
    <div className="space-y-5 max-w-4xl">
      <Link href="/my-tickets" className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
        <ArrowLeft size={13} /> Back
      </Link>

      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-mono text-sm text-gray-500">{ticket.ticketNumber}</span>
              <Badge status={ticket.status} />
              <Badge status={ticket.priority} />
              <span className="badge bg-slate-100 text-slate-700 text-xs">{ticket.department?.name}</span>
              {ticket.category && <span className="badge bg-gray-100 text-gray-700 text-xs">{ticket.category}</span>}
            </div>
            <h1 className="text-xl font-bold">{ticket.subject}</h1>
          </div>
          <Select  label="Status" value={ticket.status} onChange={e => changeStatus(e.target.value)} className="max-w-xs" options={STATUSES.map(s => ({ label: s.replace(/_/g, ' '), value: s }))} />
        </div>
      </div>

      {/* Original */}
      <div className="card p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">
            {getInitials(ticket.createdBy?.name || 'X')}
          </div>
          <div>
            <p className="font-medium text-sm">{ticket.createdBy?.name}</p>
            <p className="text-xs text-gray-500">{formatDateTime(ticket.createdAt)}</p>
          </div>
        </div>
        <p className="text-sm text-gray-800 whitespace-pre-wrap mt-2">{ticket.description}</p>
      </div>

      {/* Replies */}
      {ticket.replies?.map((r: any) => (
        <div key={r.id} className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold">
              {getInitials(r.user?.name || 'X')}
            </div>
            <div>
              <p className="font-medium text-sm">{r.user?.name}</p>
              <p className="text-xs text-gray-500">{formatDateTime(r.createdAt)}</p>
            </div>
          </div>
          <p className="text-sm text-gray-800 whitespace-pre-wrap mt-2">{r.body}</p>
        </div>
      ))}

      {/* Reply form */}
      {ticket.status !== 'CLOSED' && (
        <div className="card p-4">
          <Textarea placeholder="Add a reply..." value={reply} onChange={e => setReply(e.target.value)} rows={3} />
          <div className="flex justify-end mt-3">
            <Button onClick={submitReply} loading={sending} disabled={!reply.trim()}>
              <Send size={13} /> Send Reply
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
