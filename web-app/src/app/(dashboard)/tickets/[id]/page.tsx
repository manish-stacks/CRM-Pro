'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/axios'
import { useAuth } from '@/hooks/useAuth'
import { Button, Input, Select, Textarea, Badge } from '@/components/ui'
import { formatDateTime, getInitials } from '@/lib/utils'
import {
  ArrowLeft, Send, Loader2, MessageSquare, Building2, Shield,
  CheckCircle2, User, Clock, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED']

export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isAtLeast } = useAuth()
  const id = params.id as string

  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [internal, setInternal] = useState(false)
  const [sending, setSending] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [departments, setDepartments] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [routeForm, setRouteForm] = useState({ departmentId: '', assignedToId: '' })
  const [routing, setRouting] = useState(false)
  const canRoute = isAtLeast('MANAGER')

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get(`/tickets/${id}`)
      setTicket(r.data.data)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
      router.push('/tickets')
    } finally { setLoading(false) }
  }, [id, router])

  useEffect(() => { fetch_() }, [fetch_])

  useEffect(() => {
    if (isAtLeast('MANAGER')) {
      api.get('/departments').then(r => setDepartments(r.data.data || [])).catch(() => { })
      api.get('/users/by-role?roles=EMPLOYEE,MANAGER,ADMIN').then(r => setStaff(r.data.data || [])).catch(() => { })
    }
  }, [isAtLeast])

  // Keep route form in sync with the loaded ticket
  useEffect(() => {
    if (ticket) setRouteForm({ departmentId: ticket.departmentId || ticket.department?.id || '', assignedToId: ticket.assignedToId || ticket.assignedTo?.id || '' })
  }, [ticket])

  const saveRoute = async () => {
    setRouting(true)
    try {
      // Empty assignee + a department => API auto-assigns the dept head
      await api.patch(`/tickets/${id}`, {
        departmentId: routeForm.departmentId || '',
        assignedToId: routeForm.assignedToId || '',
      })
      toast.success('Ticket routed')
      fetch_()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setRouting(false) }
  }

  const submitReply = async () => {
    if (!reply.trim()) return
    setSending(true)
    try {
      await api.post(`/tickets/${id}/replies`, { body: reply, isInternal: internal })
      toast.success(internal ? 'Internal note added' : 'Reply sent')
      setReply('')
      fetch_()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSending(false) }
  }

  const changeStatus = async (status: string) => {
    setUpdating(true)
    try {
      await api.patch(`/tickets/${id}`, { status })
      toast.success(`Status → ${status.replace(/_/g, ' ')}`)
      fetch_()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setUpdating(false) }
  }

  if (loading) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>
  if (!ticket) return null

  return (
    <div className="space-y-5 ">
      <Link href="/tickets" className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
        <ArrowLeft size={13} /> Back to tickets
      </Link>

      {/* Header */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-mono text-sm text-gray-500">{ticket.ticketNumber}</span>
              <Badge status={ticket.status} />
              <Badge status={ticket.priority} />
              {ticket.department && <span className="badge bg-slate-100 text-slate-700 text-xs">{ticket.department.name}</span>}
              {ticket.category && <span className="badge bg-gray-100 text-gray-700 text-xs">{ticket.category}</span>}
            </div>
            <h1 className="text-xl font-bold text-gray-900">{ticket.subject}</h1>
            <Link href={`/clients/${ticket.client.id}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-1">
              <Building2 size={12} /> {ticket.client.clientName} ({ticket.client.companyName})
            </Link>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={ticket.status} onChange={e => changeStatus(e.target.value)} className="max-w-xs input" >
              {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: description + conversation */}
        <div className="lg:col-span-2 space-y-4">
          {/* Original */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                {ticket.user?.avatar ? <img src={ticket.user.avatar} className="w-full h-full rounded-full object-cover" /> : getInitials(ticket.user?.name || 'X')}
              </div>
              <div>
                <p className="font-medium text-sm">{ticket.user?.name}</p>
                <p className="text-xs text-gray-500">{formatDateTime(ticket.createdAt)}</p>
              </div>
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap mt-2">{ticket.description}</p>
          </div>

          {/* Replies */}
          {ticket.replies?.length > 0 && (
            <div className="space-y-3">
              {ticket.replies.map((r: any) => {
                const isInternal = r.isInternal
                const isFromClient = r.body?.startsWith('[FROM CLIENT]')
                const bodyClean = isFromClient ? r.body.replace('[FROM CLIENT] ', '') : r.body
                return (
                  <div key={r.id} className={`card p-4 ${isInternal ? 'bg-yellow-50 border-yellow-200' : isFromClient ? 'bg-blue-50 border-blue-200' : ''}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                        {getInitials(r.user?.name || 'X')}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{isFromClient ? '👤 Client' : r.user?.name}</p>
                          {isInternal && <span className="badge bg-yellow-200 text-yellow-800 text-[10px]">🔒 Internal</span>}
                        </div>
                        <p className="text-xs text-gray-500">{formatDateTime(r.createdAt)}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap mt-2">{bodyClean}</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Reply form */}
          {ticket.status !== 'CLOSED' && (
            <div className="card p-4">
              <Textarea placeholder="Type your reply..." value={reply} onChange={e => setReply(e.target.value)} rows={4} />
              <div className="flex items-center justify-between mt-3">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)} />
                  🔒 Internal note (not visible to client)
                </label>
                <Button onClick={submitReply} loading={sending} disabled={!reply.trim()}>
                  <Send size={13} /> {internal ? 'Add Note' : 'Reply'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right: assigned + client info */}
        <div className="space-y-4">
          {canRoute && (
            <div className="card p-4">
              <h3 className="font-semibold text-sm text-gray-900 mb-3 flex items-center gap-2">
                <Building2 size={14} /> Route / Assign
              </h3>
              <div className="space-y-3">
                <Select
                  label="Department"
                  value={routeForm.departmentId}
                  onChange={e => setRouteForm(p => ({ ...p, departmentId: e.target.value, assignedToId: '' }))}
                  options={[{ value: '', label: '— Unassigned —' }, ...departments.map((d: any) => ({ value: d.id, label: d.name }))]}
                />
                <Select
                  label="Assign to (optional)"
                  value={routeForm.assignedToId}
                  onChange={e => setRouteForm(p => ({ ...p, assignedToId: e.target.value }))}
                  options={[
                    { value: '', label: 'Auto → dept head' },
                    ...staff
                      .filter((u: any) => !routeForm.departmentId || u.employee?.department?.id === routeForm.departmentId || u.role === 'ADMIN' || u.role === 'SUPER_ADMIN')
                      .map((u: any) => ({ value: u.id, label: `${u.name} (${u.role.replace(/_/g, ' ')})` })),
                  ]}
                />
                <Button onClick={saveRoute} loading={routing} className="w-full">
                  <Send size={13} /> Route Ticket
                </Button>
                <p className="text-[11px] text-gray-400">Select a department and leave assignee blank → that department's head will be auto-assigned.</p>
              </div>
            </div>
          )}

          <div className="card p-4">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Assigned To</h3>
            {ticket.assignedTo ? (
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                  {getInitials(ticket.assignedTo.name)}
                </div>
                <div>
                  <p className="font-medium text-sm">{ticket.assignedTo.name}</p>
                  <p className="text-xs text-gray-500">{ticket.assignedTo.email}</p>
                </div>
              </div>
            ) : <p className="text-sm text-gray-400">Unassigned</p>}
          </div>

          <div className="card p-4">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Client Details</h3>
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-500 text-xs">Code:</span> {ticket.client.clientCode}</p>
              <p><span className="text-gray-500 text-xs">Phone:</span> {ticket.client.phone}</p>
              {ticket.client.email && <p><span className="text-gray-500 text-xs">Email:</span> {ticket.client.email}</p>}
            </div>
            <Link href={`/clients/${ticket.client.id}`} className="text-xs text-blue-600 hover:underline mt-2 inline-block">
              View client profile →
            </Link>
          </div>

          {ticket.status === 'RESOLVED' && (
            <div className="card p-4 bg-emerald-50 border-emerald-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <div>
                  <p className="font-semibold text-emerald-900 text-sm">Resolved</p>
                  <p className="text-xs text-emerald-700">{formatDateTime(ticket.resolvedAt)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
