'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import { Button, Input, Select, Textarea, Modal, Badge } from '@/components/ui'
import { formatDate, formatDateTime, getInitials } from '@/lib/utils'
import {
  ArrowLeft, Phone, Mail, MapPin, Globe, Calendar, User,
  Loader2, MessageSquare, PhoneCall, CalendarClock, ArrowRightLeft,
  CheckCircle2, XCircle, Ban, Video, Building2, FileText, ExternalLink,
  History, Send, RotateCcw, Plus, IndianRupee, Pencil
} from 'lucide-react'
import toast from 'react-hot-toast'
import Swal from "sweetalert2";

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-brand-100 text-brand-700',
  RINGING: 'bg-amber-100 text-amber-700',
  FOLLOW_UP: 'bg-yellow-100 text-yellow-700',
  CALLBACK: 'bg-cyan-100 text-cyan-700',
  MEETING_SCHEDULED: 'bg-purple-100 text-purple-700',
  MEETING_DONE: 'bg-teal-100 text-teal-700',
  CONVERTED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-slate-100 text-slate-700',
  NOT_INTERESTED: 'bg-red-100 text-red-700',
}

const ACTIVITY_ICONS: Record<string, any> = {
  CALL: PhoneCall,
  REMARK: MessageSquare,
  FOLLOWUP_SCHEDULED: CalendarClock,
  STATUS_CHANGE: RotateCcw,
  MEETING_SCHEDULED: Video,
  ASSIGNMENT: ArrowRightLeft,
  NOTE: FileText,
  EMAIL: Mail,
  WHATSAPP: MessageSquare,
}

const CHANGEABLE_STATUSES = ['NEW', 'RINGING', 'FOLLOW_UP', 'CALLBACK', 'NOT_INTERESTED']
const SOURCES = ['WEBSITE', 'REFERRAL', 'SOCIAL_MEDIA', 'COLD_CALL', 'EMAIL', 'WALKIN', 'OTHER']

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isAtLeast } = useAuth()
  const canAdmin = isAtLeast('ADMIN')
  const canTL = isAtLeast('MANAGER') // Admin + telecalling head (TL)

  const id = params.id as string
  const [lead, setLead] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [modal, setModal] = useState<'none' | 'activity' | 'meeting' | 'reassign' | 'convert' | 'lost' | 'notInterested' | 'edit' | 'noAnswer' | 'reschedule' | 'cancelMeeting'>('none')
  const [saving, setSaving] = useState(false)

  const [executives, setExecutives] = useState<any[]>([])
  const [telecallers, setTelecallers] = useState<any[]>([])

  // Activity form
  const [actForm, setActForm] = useState({
    type: 'CALL', title: '', description: '', nextActionDate: '', nextActionTime: '',
  })
  // Meeting form — area + date -> pick a free slot -> pick a free exec in that slot
  const [meetForm, setMeetForm] = useState({
    area: '', marketingExecId: '', meetingDate: '', meetingTime: '', meetingSlot: '', meetingLocation: '', meetingNotes: '',
  })
  const [areas, setAreas] = useState<any[]>([])
  const [slots, setSlots] = useState<any[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  // Reschedule / No-answer forms
  const [rescheduleForm, setRescheduleForm] = useState({ meetingDate: '', meetingTime: '', notes: '' })
  const [cancelNotes, setCancelNotes] = useState('')
  const [noAnswerReason, setNoAnswerReason] = useState('')
  // Reassign form
  const [reassignForm, setReassignForm] = useState({ toUserId: '', reason: '' })
  const [editForm, setEditForm] = useState({
    companyName: '', clientName: '', clientPhone: '', clientEmail: '', alternatePhone: '',
    link: '', address: '', city: '', state: '', source: '', service: '', productPitched: '',
    price: '', remark: '', notes: '',
  })
  // Close forms
  const [closeForm, setCloseForm] = useState({ reason: '', note: '', createClient: true })

  const fetchLead = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get(`/leads/${id}`)
      setLead(r.data.data)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to load')
      router.push('/leads')
    } finally { setLoading(false) }
  }, [id, router])

  useEffect(() => { fetchLead() }, [fetchLead])

  useEffect(() => {
    api.get('/marketing/executives').then(r => setExecutives(r.data.data || [])).catch(() => { })
    api.get('/marketing/areas').then(r => setAreas(r.data.data || [])).catch(() => { })
    if (canAdmin) {
      api.get('/users/by-role?roles=TELECALLER')
        .then(r => setTelecallers(r.data.data || []))
        .catch(() => { })
    }
  }, [canAdmin])

  // Fetch slot availability whenever the picked area/date changes in the meeting modal
  useEffect(() => {
    if (modal !== 'meeting' || !meetForm.area || !meetForm.meetingDate) { setSlots([]); return }
    setSlotsLoading(true)
    api.get(`/marketing/slots?area=${encodeURIComponent(meetForm.area)}&date=${meetForm.meetingDate}&excludeLeadId=${id}`)
      .then(r => setSlots(r.data.data?.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [modal, meetForm.area, meetForm.meetingDate, id])

  const openActivity = (type = 'CALL') => {
    setActForm({ type, title: '', description: '', nextActionDate: '', nextActionTime: '' })
    setModal('activity')
  }
  const openMeeting = () => {
    setMeetForm({
      area: '',
      marketingExecId: '',
      meetingDate: lead?.meetingDate?.split('T')[0] || '',
      meetingTime: lead?.meetingTime || '',
      meetingSlot: lead?.meetingSlot || '',
      meetingLocation: lead?.meetingLocation || '',
      meetingNotes: lead?.meetingNotes || '',
    })
    setSlots([])
    setModal('meeting')
  }
  const openReassign = () => {
    setReassignForm({ toUserId: '', reason: '' })
    setModal('reassign')
  }
  const openEdit = () => {
    if (!lead) return
    setEditForm({
      companyName: lead.companyName || '', clientName: lead.clientName || '', clientPhone: lead.clientPhone || '',
      clientEmail: lead.clientEmail || '', alternatePhone: lead.alternatePhone || '', link: lead.link || '',
      address: lead.address || '', city: lead.city || '', state: lead.state || '', source: lead.source || '',
      service: lead.service || '', productPitched: lead.productPitched || '',
      price: lead.price != null ? String(lead.price) : '', remark: lead.remark || '', notes: lead.notes || '',
    })
    setModal('edit')
  }
  const saveEdit = async () => {
    if (!editForm.clientName.trim() || !editForm.clientPhone.trim()) {
      toast.error('Client name and phone required'); return
    }
    setSaving(true)
    try {
      await api.patch(`/leads/${id}`, editForm)
      toast.success('Lead updated')
      setModal('none')
      fetchLead()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const changeStatus = async (newStatus: string) => {
    setSaving(true)
    try {
      await api.patch(`/leads/${id}`, { status: newStatus })
      toast.success(`Status → ${newStatus.replace(/_/g, ' ')}`)
      fetchLead()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const addActivity = async () => {
    if (!actForm.title.trim()) { toast.error('Title required'); return }
    setSaving(true)
    try {
      await api.post(`/leads/${id}/activities`, actForm)
      toast.success('Activity logged')
      setModal('none')
      fetchLead()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const scheduleMeeting = async () => {
    if (!meetForm.marketingExecId || !meetForm.meetingDate) {
      toast.error('Marketing exec + date required')
      return
    }
    setSaving(true)
    try {
      await api.post(`/leads/${id}/meeting`, meetForm)
      toast.success('Meeting scheduled — WhatsApp sent to client')
      setModal('none')
      fetchLead()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  // Cancel the assigned meeting. The note is mandatory — it goes straight to
  // the lead's creator + telecaller so they can re-assign the meeting to a
  // different marketing person.
  const cancelMeeting = async () => {
    if (cancelNotes.trim().length < 3) {
      toast.error('Please write why the meeting is being cancelled')
      return
    }
    setSaving(true)
    try {
      await api.post(`/leads/${id}/meeting/cancel`, { notes: cancelNotes.trim() })
      toast.success('Meeting cancelled — telecaller notified to re-assign')
      setModal('none')
      setCancelNotes('')
      fetchLead()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const markNoAnswer = async () => {
    setSaving(true)
    try {
      await api.post(`/leads/${id}/meeting/no-answer`, { reason: noAnswerReason })
      toast.success('Marked no answer — slot freed')
      setModal('none')
      setNoAnswerReason('')
      fetchLead()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const openReschedule = () => {
    setRescheduleForm({ meetingDate: lead?.meetingDate?.split('T')[0] || '', meetingTime: '', notes: '' })
    setModal('reschedule')
  }

  const doReschedule = async () => {
    if (!rescheduleForm.meetingDate || !rescheduleForm.meetingTime) {
      toast.error('New date + time required'); return
    }
    setSaving(true)
    try {
      await api.post(`/leads/${id}/meeting/reschedule`, rescheduleForm)
      toast.success('Meeting rescheduled')
      setModal('none')
      fetchLead()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const reassign = async () => {
    if (!reassignForm.toUserId) { toast.error('Select a user'); return }
    setSaving(true)
    try {
      await api.post(`/leads/${id}/assign`, reassignForm)
      toast.success('Lead reassigned')
      setModal('none')
      fetchLead()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }



  const markMeetingDone = async () => {
    setSaving(true)
    try {
      await api.post(`/leads/${id}/meeting/done`)
      toast.success('Meeting marked done')
      fetchLead()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const closeAction = async (action: string) => {
    setSaving(true);

    try {
      const r = await api.post(`/leads/${id}/close`, {
        action,
        reason: closeForm.reason,
        note: closeForm.note,
        autoCreateClient: closeForm.createClient,
      });

      const title = action === "convert" ? "🎉 Deal Done!" : "Lead closed";
      toast.success(title);

      setModal("none");

      if (action === "convert" && r.data.data?.clientId) {
        setTimeout(async () => {
          const result = await Swal.fire({
            title: "Client Created!",
            text: "Client has been created successfully. Do you want to open the client detail page?",
            icon: "success",
            showCancelButton: true,
            confirmButtonText: "Yes, Open",
            cancelButtonText: "Stay Here",
            confirmButtonColor: "#16a34a",
            cancelButtonColor: "#6b7280",
          });

          if (result.isConfirmed) {
            router.push(`/clients/${r.data.data.clientId}`);
          }
        }, 500);
      }

      fetchLead();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>
  if (!lead) return null

  // NOT_INTERESTED is reversible by Admin/TL (customer can change their mind) —
  // only CONVERTED/CLOSED are truly terminal.
  const isTerminal = ['CONVERTED', 'CLOSED'].includes(lead.status)
  const isClosed = isTerminal || (lead.status === 'NOT_INTERESTED' && !canTL)

  return (
    <div className="space-y-5">
      {/* Back */}
      <Link href="/leads" className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
        <ArrowLeft size={13} /> Back to leads
      </Link>

      {/* Header */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 text-xs">
              <span className="font-mono text-gray-500">{lead.leadNumber}</span>
              <span className={`badge ${STATUS_COLORS[lead.status]}`}>{lead.status.replace(/_/g, ' ')}</span>
              {lead.client && (
                <Link href={`/clients/${lead.client.id}`} className="badge bg-brand-50 text-brand-700 hover:bg-blue-100">
                  → Client {lead.client.clientCode}
                </Link>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{lead.clientName}</h1>
            {lead.companyName && <p className="text-sm text-gray-600 flex items-center gap-1 mt-1"><Building2 size={12} /> {lead.companyName}</p>}
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-600 flex-wrap">
              <a href={`tel:${lead.clientPhone}`} className="flex items-center gap-1 hover:text-brand-600"><Phone size={12} /> {lead.clientPhone}</a>
              {lead.clientEmail && <a href={`mailto:${lead.clientEmail}`} className="flex items-center gap-1 hover:text-brand-600"><Mail size={12} /> {lead.clientEmail}</a>}
              {lead.link && <a href={lead.link} target="_blank" className="flex items-center gap-1 hover:text-brand-600"><Globe size={12} /> {lead.link.replace(/^https?:\/\//, '')} <ExternalLink size={9} /></a>}
              {lead.city && <span className="flex items-center gap-1"><MapPin size={12} /> {lead.city}{lead.state ? `, ${lead.state}` : ''}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(canTL || lead.assignedToId === user?.id || lead.meetingAssignedToId === user?.id) && (
              <button onClick={openEdit} className="btn-secondary btn-sm">
                <Pencil size={13} /> Edit
              </button>
            )}
            {!isClosed && (
              <>
                <button onClick={() => openActivity('CALL')} className="btn-secondary btn-sm">
                  <PhoneCall size={13} /> Log Call
                </button>
                <button onClick={() => openActivity('FOLLOWUP_SCHEDULED')} className="btn-secondary btn-sm">
                  <CalendarClock size={13} /> Follow Up
                </button>
                <button onClick={openMeeting} className="btn-secondary btn-sm border-purple-300 text-purple-700">
                  <Video size={13} /> Schedule Meeting
                </button>
                {canAdmin && (
                  <button onClick={openReassign} className="btn-secondary btn-sm">
                    <ArrowRightLeft size={13} /> Reassign
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Quick actions row */}
        {!isClosed && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 uppercase mr-1">Quick status:</span>
            {CHANGEABLE_STATUSES.filter(s => s !== lead.status).map(s => (
              <button key={s} onClick={() => changeStatus(s)} disabled={saving}
                className={`badge hover:opacity-80 ${STATUS_COLORS[s]}`}>
                → {s.replace(/_/g, ' ')}
              </button>
            ))}
            <div className="flex-1" />
            {lead.status === 'MEETING_SCHEDULED' && (canAdmin || lead.meetingAssignedToId === user?.id) && (
              <button onClick={markMeetingDone} disabled={saving}
                className="badge bg-teal-600 text-white hover:bg-teal-700">
                <CheckCircle2 size={11} /> Mark Meeting Done
              </button>
            )}
            {lead.status === 'MEETING_SCHEDULED' && (canTL || lead.meetingAssignedToId === user?.id) && (
              <button onClick={() => setModal('noAnswer')} disabled={saving}
                className="badge bg-amber-600 text-white hover:bg-amber-700">
                <Ban size={11} /> No Answer
              </button>
            )}
            {lead.status === 'MEETING_SCHEDULED' && (canTL || lead.meetingAssignedToId === user?.id) && (
              <button onClick={openReschedule} disabled={saving}
                className="badge bg-indigo-600 text-white hover:bg-indigo-700">
                <RotateCcw size={11} /> Reschedule
              </button>
            )}
            {lead.status === 'MEETING_SCHEDULED' && (canTL || lead.meetingAssignedToId === user?.id) && (
              <button onClick={() => { setCancelNotes(''); setModal('cancelMeeting') }} disabled={saving}
                className="badge bg-red-600 text-white hover:bg-red-700">
                <Ban size={11} /> Cancel Meeting
              </button>
            )}
            {(lead.status === 'MEETING_DONE' || canTL || lead.assignedToId === user?.id) && (
              <button onClick={() => { setCloseForm(p => ({ ...p, createClient: true })); setModal('convert') }} disabled={saving}
                className="badge bg-emerald-600 text-white hover:bg-emerald-700">
                <CheckCircle2 size={11} /> Deal Done
              </button>
            )}
            <button onClick={() => setModal('lost')} disabled={saving}
              className="badge bg-slate-600 text-white hover:bg-slate-700">
              <XCircle size={11} /> {lead.status === 'MEETING_DONE' ? 'Reject' : 'Lost'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT: Assignments + Meeting + Details */}
        <div className="lg:col-span-1 space-y-5">
          {/* Assignments card */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Assignments</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Created By</p>
                <p className="font-medium">{lead.createdBy?.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Currently Assigned To</p>
                {lead.assignedTo ? (
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">
                      {getInitials(lead.assignedTo.name)}
                    </div>
                    <div>
                      <p className="font-medium">{lead.assignedTo.name}</p>
                      <p className="text-xs text-gray-500">{lead.assignedTo.role?.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                ) : <p className="text-gray-400">Unassigned</p>}
              </div>
              {lead.meetingAssignedTo && (
                <div>
                  <p className="text-xs text-gray-500">Meeting Person</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
                      {getInitials(lead.meetingAssignedTo.name)}
                    </div>
                    <div>
                      <p className="font-medium">{lead.meetingAssignedTo.name}</p>
                      <p className="text-xs text-gray-500">{lead.meetingAssignedTo.phone}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Proposals card — telecaller creates, marketing person can view for context */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                <FileText size={14} className="text-indigo-600" /> Proposals
              </h3>
              {!isClosed && (
                <Link href={`/proposals/new?leadId=${lead.id}`} className="btn-secondary btn-sm">
                  <Plus size={12} /> New
                </Link>
              )}
            </div>
            {(!lead.proposals || lead.proposals.length === 0) ? (
              <p className="text-xs text-gray-400 text-center py-4">No proposals yet</p>
            ) : (
              <div className="space-y-2">
                {lead.proposals.map((p: any) => (
                  <Link key={p.id} href={`/proposals/${p.id}`}
                    className="block rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 p-2.5 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.title}</p>
                        <p className="text-xs text-gray-400 font-mono">{p.proposalNumber}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-900 flex items-center gap-0.5"><IndianRupee size={11} />{p.finalAmount?.toLocaleString('en-IN')}</p>
                        <span className="badge text-[10px]">{p.status}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Meeting details card */}
          {lead.status === 'MEETING_SCHEDULED' && lead.meetingDate && (
            <div className="card p-5 bg-purple-50 border-purple-100">
              <h3 className="font-semibold text-purple-900 text-sm mb-3 flex items-center gap-2">
                <Video size={14} /> Meeting Scheduled
              </h3>
              <div className="space-y-2 text-sm">
                <p><b>Date:</b> {formatDate(lead.meetingDate)}</p>
                {lead.meetingSlot && <p><b>Slot:</b> {lead.meetingSlot}</p>}
                {!lead.meetingSlot && lead.meetingTime && <p><b>Time:</b> {lead.meetingTime}</p>}
                {lead.meetingLocation && <p><b>Location:</b> {lead.meetingLocation}</p>}
                {lead.meetingNotes && <p className="text-xs text-purple-800 mt-2">{lead.meetingNotes}</p>}
              </div>
            </div>
          )}

          {/* Follow-up card */}
          {lead.followUpDate && lead.status !== 'MEETING_SCHEDULED' && (
            <div className="card p-5 bg-yellow-50 border-yellow-100">
              <h3 className="font-semibold text-yellow-900 text-sm mb-2 flex items-center gap-2">
                <CalendarClock size={14} /> Follow-up
              </h3>
              <p className="text-sm">{formatDate(lead.followUpDate)}{lead.followUpTime ? ` at ${lead.followUpTime}` : ''}</p>
            </div>
          )}

          {/* Details */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Details</h3>
            <div className="space-y-2 text-sm">
              {lead.source && <p><span className="text-gray-500 text-xs">Source:</span> {lead.source.replace(/_/g, ' ')}</p>}
              {lead.service && <p><span className="text-gray-500 text-xs">Service:</span> {lead.service}</p>}
              {lead.price && <p><span className="text-gray-500 text-xs">Est. Price:</span> ₹{lead.price.toLocaleString('en-IN')}</p>}
              {lead.alternatePhone && <p><span className="text-gray-500 text-xs">Alt Phone:</span> {lead.alternatePhone}</p>}
              {lead.address && <p><span className="text-gray-500 text-xs">Address:</span><br />{lead.address}</p>}
              {lead.remark && <p><span className="text-gray-500 text-xs">Remark:</span><br />{lead.remark}</p>}
            </div>
          </div>

          {/* Assignment history */}
          {lead.assignmentHistory && lead.assignmentHistory.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
                <History size={13} /> Assignment History
              </h3>
              <div className="space-y-3">
                {lead.assignmentHistory.map((h: any) => (
                  <div key={h.id} className="text-xs border-l-2 border-gray-200 pl-3">
                    <p className="font-medium text-gray-900">
                      {h.fromUser?.name ? `${h.fromUser.name} → ` : ''}<b>{h.toUser.name}</b>
                    </p>
                    <p className="text-gray-500">
                      by {h.assignedBy?.name || 'System'} • {formatDate(h.createdAt)}
                    </p>
                    {h.reason && <p className="text-gray-600 mt-0.5 italic">"{h.reason}"</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Activity Timeline */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Activity Timeline</h3>
            {!isClosed && (
              <button onClick={() => openActivity('REMARK')} className="btn-secondary btn-sm">
                <Send size={12} /> Add Remark
              </button>
            )}
          </div>
          {(!lead.activities || lead.activities.length === 0) ? (
            <p className="text-sm text-gray-400 text-center py-8">No activity yet</p>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-100" />
              <div className="space-y-4">
                {lead.activities.map((a: any) => {
                  const Icon = ACTIVITY_ICONS[a.type] || MessageSquare
                  const isMeeting = a.type === 'MEETING_SCHEDULED'
                  const isStatus = a.type === 'STATUS_CHANGE'
                  return (
                    <div key={a.id} className="relative flex gap-3">
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center border-2 border-white shadow z-10 ${isMeeting ? 'bg-purple-100 text-purple-600' :
                          isStatus ? 'bg-brand-100 text-brand-600' :
                            'bg-gray-100 text-gray-600'
                        }`}>
                        <Icon size={13} />
                      </div>
                      <div className="flex-1 pb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-gray-900 text-sm">{a.title}</p>
                          <span className="text-xs text-gray-400">by {a.createdBy?.name}</span>
                        </div>
                        <p className="text-xs text-gray-500">{formatDateTime(a.createdAt)}</p>
                        {a.description && <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{a.description}</p>}
                        {a.nextActionDate && (
                          <p className="text-xs text-yellow-700 mt-1 bg-yellow-50 inline-block px-2 py-0.5 rounded">
                            📅 Next: {formatDate(a.nextActionDate)}{a.nextActionTime ? ` at ${a.nextActionTime}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Activity Modal */}
      <Modal open={modal === 'activity'} onClose={() => setModal('none')} title="Log Activity">
        <div className="space-y-3">
          <Select label="Type" value={actForm.type} onChange={e => setActForm(p => ({ ...p, type: e.target.value }))} options={[
            { value: 'CALL', label: '📞 Call' },
            { value: 'REMARK', label: '💬 Remark' },
            { value: 'FOLLOWUP_SCHEDULED', label: '📅 Schedule Follow-up' },
            { value: 'NOTE', label: '📝 Note' },
            { value: 'EMAIL', label: '📧 Email' },
            { value: 'WHATSAPP', label: '💚 WhatsApp' }
          ]} />
          <Input label="Title" value={actForm.title} onChange={e => setActForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Client asked to call tomorrow" />
          <Textarea label="Description" value={actForm.description} onChange={e => setActForm(p => ({ ...p, description: e.target.value }))} rows={3} />
          {(actForm.type === 'FOLLOWUP_SCHEDULED' || actForm.type === 'CALL') && (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Next Action Date" type="date" value={actForm.nextActionDate} onChange={e => setActForm(p => ({ ...p, nextActionDate: e.target.value }))} />
              <Input label="Next Action Time" type="time" value={actForm.nextActionTime} onChange={e => setActForm(p => ({ ...p, nextActionTime: e.target.value }))} />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button onClick={addActivity} loading={saving}>Log Activity</Button>
          </div>
        </div>
      </Modal>

      {/* Meeting Modal */}
      <Modal open={modal === 'meeting'} onClose={() => setModal('none')} title="Schedule Meeting">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Area *" value={meetForm.area}
              onChange={e => setMeetForm(p => ({ ...p, area: e.target.value, marketingExecId: '', meetingSlot: '', meetingTime: '' }))}
              options={[{ value: '', label: 'Select area...' }].concat(areas.map((a: any) => ({ value: a.area, label: `${a.area} (${a.executives.length})` })))} />
            <Input label="Meeting Date *" type="date" value={meetForm.meetingDate}
              onChange={e => setMeetForm(p => ({ ...p, meetingDate: e.target.value, marketingExecId: '', meetingSlot: '', meetingTime: '' }))} />
          </div>

          {meetForm.area && meetForm.meetingDate && (
            <div>
              <label className="label">Available Slots *</label>
              {slotsLoading ? (
                <div className="py-3 text-center text-gray-400 text-sm"><Loader2 size={14} className="animate-spin inline mr-1" /> Checking availability...</div>
              ) : slots.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">No marketing executives assigned to this area yet. Set their "Marketing Area" on the Employee profile.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {slots.map((s: any) => {
                    const active = meetForm.meetingSlot === s.label
                    return (
                      <button key={s.label} type="button" disabled={!s.available}
                        onClick={() => setMeetForm(p => ({ ...p, meetingSlot: s.label, meetingTime: s.start, marketingExecId: '' }))}
                        className={`text-left rounded-lg border px-3 py-2 text-xs transition-colors ${
                          !s.available ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed' :
                          active ? 'bg-brand-600 border-blue-600 text-white' :
                          'bg-white border-gray-200 hover:border-brand-400 text-gray-700'
                        }`}>
                        <div className="font-semibold">{s.label}</div>
                        <div className={active ? 'text-blue-100' : 'text-gray-400'}>
                          {s.available ? `${s.freeExecutives.length} free` : 'Fully booked'}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {meetForm.meetingSlot && (() => {
            const s = slots.find((x: any) => x.label === meetForm.meetingSlot)
            if (!s) return null
            return (
              <div>
                <label className="label">Assign to (free in this slot) *</label>
                <div className="flex flex-wrap gap-2">
                  {s.freeExecutives.map((u: any) => (
                    <button key={u.id} type="button"
                      onClick={() => setMeetForm(p => ({ ...p, marketingExecId: u.id }))}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                        meetForm.marketingExecId === u.id ? 'bg-brand-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-brand-400'
                      }`}>
                      {u.name}
                    </button>
                  ))}
                </div>
                {s.busyExecutives.length > 0 && (
                  <p className="text-[11px] text-gray-400 mt-1.5">Already booked this slot: {s.busyExecutives.map((u: any) => u.name).join(', ')}</p>
                )}
              </div>
            )
          })()}

          <Input label="Location" value={meetForm.meetingLocation || lead.address} onChange={e => setMeetForm(p => ({ ...p, meetingLocation: e.target.value }))} placeholder="Client office / online / etc." />
          <Textarea label="Notes for Marketing Exec" value={meetForm.meetingNotes} onChange={e => setMeetForm(p => ({ ...p, meetingNotes: e.target.value }))} rows={3} placeholder="Client's key points, service to pitch, questions raised..." />
          <p className="text-xs text-gray-500">📲 An automated WhatsApp will be sent to the client with meeting details + marketing person's contact.</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button onClick={scheduleMeeting} loading={saving} disabled={!meetForm.marketingExecId}>Schedule</Button>
          </div>
        </div>
      </Modal>

      {/* No Answer Modal */}
      <Modal open={modal === 'noAnswer'} onClose={() => setModal('none')} title="Client Did Not Pick Up">
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
            This frees up the meeting slot immediately and moves the lead to <b>CALLBACK</b> for a re-attempt.
          </div>
          <Textarea label="Reason (optional)" value={noAnswerReason} onChange={e => setNoAnswerReason(e.target.value)} rows={2} placeholder="e.g. Phone switched off, no response after 3 tries..." />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button onClick={markNoAnswer} loading={saving} className="!bg-amber-600 hover:!bg-amber-700">Confirm No Answer</Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Meeting Modal */}
      <Modal open={modal === 'cancelMeeting'} onClose={() => setModal('none')} title="Cancel Meeting">
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-900">
            This un-assigns <b>{lead.meetingAssignedTo?.name || 'the marketing person'}</b>, frees the slot,
            and moves the lead back to <b>FOLLOW UP</b>. The telecaller who added this lead gets your note
            and can re-assign the meeting to another marketing person.
          </div>
          <Textarea
            label="Reason / notes *"
            value={cancelNotes}
            onChange={e => setCancelNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Client postponed indefinitely / marketing person on leave / area changed"
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModal('none')}>Back</Button>
            <Button onClick={cancelMeeting} loading={saving} className="!bg-red-600 hover:!bg-red-700">
              Cancel Meeting & Notify
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reschedule Modal */}
      <Modal open={modal === 'reschedule'} onClose={() => setModal('none')} title="Reschedule Meeting">
        <div className="space-y-3">
          <div className="bg-brand-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            {canTL
              ? 'As Admin/TL you can reschedule to any time.'
              : 'Self-reschedule is only allowed AFTER office hours — for daytime slots, ask the telecaller/Admin to rebook through the area picker.'}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="New Date *" type="date" value={rescheduleForm.meetingDate} onChange={e => setRescheduleForm(p => ({ ...p, meetingDate: e.target.value }))} />
            <Input label="New Time *" type="time" value={rescheduleForm.meetingTime} onChange={e => setRescheduleForm(p => ({ ...p, meetingTime: e.target.value }))} />
          </div>
          <Textarea label="Notes (optional)" value={rescheduleForm.notes} onChange={e => setRescheduleForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="e.g. Client asked to meet in the evening" />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button onClick={doReschedule} loading={saving}>Confirm Reschedule</Button>
          </div>
        </div>
      </Modal>

      {/* Reassign Modal */}
      <Modal open={modal === 'reassign'} onClose={() => setModal('none')} title="Reassign Lead">
        <div className="space-y-3">
          <div className="bg-brand-50 border border-blue-200 rounded-lg p-3 text-xs">
            <p className="font-semibold text-blue-900">Currently assigned to:</p>
            <p className="text-brand-700">{lead.assignedTo?.name || 'Unassigned'}</p>
          </div>
          <Select label="Reassign to *" value={reassignForm.toUserId} onChange={e => setReassignForm(p => ({ ...p, toUserId: e.target.value }))}
            options={[{ value: '', label: 'Select user...' }].concat(telecallers.map((u: any) => ({ value: u.id, label: `${u.name} (${u.role.replace(/_/g, ' ')})` })))} />

          <Textarea label="Reason (recorded in history)" value={reassignForm.reason} onChange={e => setReassignForm(p => ({ ...p, reason: e.target.value }))}
            placeholder="e.g. Original telecaller on leave; passing to Shivani" rows={2} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button onClick={reassign} loading={saving}>Reassign</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Lead Modal */}
      <Modal open={modal === 'edit'} onClose={() => setModal('none')} title="Edit Lead">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Company Name" value={editForm.companyName} onChange={e => setEditForm(p => ({ ...p, companyName: e.target.value }))} />
            <Input label="Client Name *" value={editForm.clientName} onChange={e => setEditForm(p => ({ ...p, clientName: e.target.value }))} />
            <Input label="Client Phone *" value={editForm.clientPhone} onChange={e => setEditForm(p => ({ ...p, clientPhone: e.target.value }))} placeholder="+91 9999999999" />
            <Input label="Alternate Phone" value={editForm.alternatePhone} onChange={e => setEditForm(p => ({ ...p, alternatePhone: e.target.value }))} />
            <Input label="Client Email" type="email" value={editForm.clientEmail} onChange={e => setEditForm(p => ({ ...p, clientEmail: e.target.value }))} />
            <Input label="Website / Link" value={editForm.link} onChange={e => setEditForm(p => ({ ...p, link: e.target.value }))} />
          </div>
          <Textarea label="Address" value={editForm.address} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} rows={2} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" value={editForm.city} onChange={e => setEditForm(p => ({ ...p, city: e.target.value }))} />
            <Input label="State" value={editForm.state} onChange={e => setEditForm(p => ({ ...p, state: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Source" value={editForm.source} onChange={e => setEditForm(p => ({ ...p, source: e.target.value }))}
              options={[{ value: '', label: 'Select source...' }].concat(SOURCES.map(s => ({ value: s, label: s.replace(/_/g, ' ') })))} />
            <Input label="Price" type="number" value={editForm.price} onChange={e => setEditForm(p => ({ ...p, price: e.target.value }))} />
            <Input label="Service" value={editForm.service} onChange={e => setEditForm(p => ({ ...p, service: e.target.value }))} />
            <Input label="Product Pitched" value={editForm.productPitched} onChange={e => setEditForm(p => ({ ...p, productPitched: e.target.value }))} />
          </div>
          <Textarea label="Remark" value={editForm.remark} onChange={e => setEditForm(p => ({ ...p, remark: e.target.value }))} rows={2} />
          <Textarea label="Notes" value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button onClick={saveEdit} loading={saving}>Save Changes</Button>
          </div>
        </div>
      </Modal>

      {/* Convert (Deal Done) Modal */}
      <Modal open={modal === 'convert'} onClose={() => setModal('none')} title="🎉 Deal Done — Convert to Client">
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-900">
            This will mark the lead <b>CONVERTED</b>{closeForm.createClient ? ' and create a Client record with the lead\'s details. You\'ll be able to complete client onboarding, add services, and generate proposals from the Clients page.' : '. No Client record will be created — you can convert it to a client later from the Leads page.'}
          </div>
          <label className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3 cursor-pointer">
            <input type="checkbox" checked={closeForm.createClient} onChange={e => setCloseForm(p => ({ ...p, createClient: e.target.checked }))} />
            <span className="text-sm text-gray-700">Also create a Client record</span>
          </label>
          <Textarea label="Notes (optional)" value={closeForm.note} onChange={e => setCloseForm(p => ({ ...p, note: e.target.value }))} rows={3}
            placeholder="Any final notes about the deal..." />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button onClick={() => closeAction('convert')} loading={saving} className="!bg-emerald-600 hover:!bg-emerald-700">
              <CheckCircle2 size={14} /> Confirm Deal Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Lost Modal */}
      <Modal open={modal === 'lost'} onClose={() => setModal('none')} title="Close Lead as Lost">
        <div className="space-y-3">
          <Input label="Reason" value={closeForm.reason} onChange={e => setCloseForm(p => ({ ...p, reason: e.target.value }))} placeholder="e.g. Client chose competitor, budget issue" />
          <Textarea label="Notes" value={closeForm.note} onChange={e => setCloseForm(p => ({ ...p, note: e.target.value }))} rows={2} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button variant="danger" onClick={() => closeAction('lost')} loading={saving}>Close as Lost</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
