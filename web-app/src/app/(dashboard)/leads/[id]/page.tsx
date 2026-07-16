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
  History, Send, RotateCcw
} from 'lucide-react'
import toast from 'react-hot-toast'
import Swal from "sweetalert2";

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  RINGING: 'bg-amber-100 text-amber-700',
  FOLLOW_UP: 'bg-yellow-100 text-yellow-700',
  CALLBACK: 'bg-cyan-100 text-cyan-700',
  MEETING_SCHEDULED: 'bg-purple-100 text-purple-700',
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

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isAtLeast } = useAuth()
  const canAdmin = isAtLeast('ADMIN')

  const id = params.id as string
  const [lead, setLead] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [modal, setModal] = useState<'none' | 'activity' | 'meeting' | 'reassign' | 'convert' | 'lost' | 'notInterested'>('none')
  const [saving, setSaving] = useState(false)

  const [executives, setExecutives] = useState<any[]>([])
  const [telecallers, setTelecallers] = useState<any[]>([])

  // Activity form
  const [actForm, setActForm] = useState({
    type: 'CALL', title: '', description: '', nextActionDate: '', nextActionTime: '',
  })
  // Meeting form
  const [meetForm, setMeetForm] = useState({
    marketingExecId: '', meetingDate: '', meetingTime: '', meetingSlot: '', meetingLocation: '', meetingNotes: '',
  })
  // Reassign form
  const [reassignForm, setReassignForm] = useState({ toUserId: '', reason: '' })
  // Close forms
  const [closeForm, setCloseForm] = useState({ reason: '', note: '' })

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
    if (canAdmin) {
      api.get('/users/by-role?roles=TELECALLER,MARKETING_EXECUTIVE')
        .then(r => setTelecallers(r.data.data || []))
        .catch(() => { })
    }
  }, [canAdmin])

  const openActivity = (type = 'CALL') => {
    setActForm({ type, title: '', description: '', nextActionDate: '', nextActionTime: '' })
    setModal('activity')
  }
  const openMeeting = () => {
    setMeetForm({
      marketingExecId: '',
      meetingDate: lead?.meetingDate?.split('T')[0] || '',
      meetingTime: lead?.meetingTime || '',
      meetingSlot: lead?.meetingSlot || '',
      meetingLocation: lead?.meetingLocation || '',
      meetingNotes: lead?.meetingNotes || '',
    })
    setModal('meeting')
  }
  const openReassign = () => {
    setReassignForm({ toUserId: '', reason: '' })
    setModal('reassign')
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



  const closeAction = async (action: string) => {
    setSaving(true);

    try {
      const r = await api.post(`/leads/${id}/close`, {
        action,
        ...closeForm,
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

  const isClosed = ['CONVERTED', 'CLOSED', 'NOT_INTERESTED'].includes(lead.status)

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
                <Link href={`/clients/${lead.client.id}`} className="badge bg-blue-50 text-blue-700 hover:bg-blue-100">
                  → Client {lead.client.clientCode}
                </Link>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{lead.clientName}</h1>
            {lead.companyName && <p className="text-sm text-gray-600 flex items-center gap-1 mt-1"><Building2 size={12} /> {lead.companyName}</p>}
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-600 flex-wrap">
              <a href={`tel:${lead.clientPhone}`} className="flex items-center gap-1 hover:text-blue-600"><Phone size={12} /> {lead.clientPhone}</a>
              {lead.clientEmail && <a href={`mailto:${lead.clientEmail}`} className="flex items-center gap-1 hover:text-blue-600"><Mail size={12} /> {lead.clientEmail}</a>}
              {lead.link && <a href={lead.link} target="_blank" className="flex items-center gap-1 hover:text-blue-600"><Globe size={12} /> {lead.link.replace(/^https?:\/\//, '')} <ExternalLink size={9} /></a>}
              {lead.city && <span className="flex items-center gap-1"><MapPin size={12} /> {lead.city}{lead.state ? `, ${lead.state}` : ''}</span>}
            </div>
          </div>
          {!isClosed && (
            <div className="flex items-center gap-2 flex-wrap">
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
            </div>
          )}
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
            <button onClick={() => setModal('convert')} disabled={saving}
              className="badge bg-emerald-600 text-white hover:bg-emerald-700">
              <CheckCircle2 size={11} /> Deal Done
            </button>
            <button onClick={() => setModal('lost')} disabled={saving}
              className="badge bg-slate-600 text-white hover:bg-slate-700">
              <XCircle size={11} /> Lost
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
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
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
                          isStatus ? 'bg-blue-100 text-blue-600' :
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
          <Select label="Assign to Marketing Executive *" value={meetForm.marketingExecId} onChange={e => setMeetForm(p => ({ ...p, marketingExecId: e.target.value }))}
            options={[{ value: '', label: 'Select person...' }].concat(executives.map((e: any) => ({ value: e.id, label: `${e.name} (${e.role.replace(/_/g, ' ')})` })))}>
            <option value="">Select person...</option>
            {executives.map((e: any) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.role.replace(/_/g, ' ')}) — {e._count?.meetingLeads || 0} open
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Meeting Date *" type="date" value={meetForm.meetingDate} onChange={e => setMeetForm(p => ({ ...p, meetingDate: e.target.value }))} />
            <Input label="Time" type="time" value={meetForm.meetingTime} onChange={e => setMeetForm(p => ({ ...p, meetingTime: e.target.value }))} />
          </div>
          <Input label="Time Slot" value={meetForm.meetingSlot} onChange={e => setMeetForm(p => ({ ...p, meetingSlot: e.target.value }))} placeholder="e.g. 10:00 - 11:00 AM" />
          <Input label="Location" value={meetForm.meetingLocation || lead.address} onChange={e => setMeetForm(p => ({ ...p, meetingLocation: e.target.value }))} placeholder="Client office / online / etc." />
          <Textarea label="Notes for Marketing Exec" value={meetForm.meetingNotes} onChange={e => setMeetForm(p => ({ ...p, meetingNotes: e.target.value }))} rows={3} placeholder="Client's key points, service to pitch, questions raised..." />
          <p className="text-xs text-gray-500">📲 An automated WhatsApp will be sent to the client with meeting details + marketing person's contact.</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button onClick={scheduleMeeting} loading={saving}>Schedule</Button>
          </div>
        </div>
      </Modal>

      {/* Reassign Modal */}
      <Modal open={modal === 'reassign'} onClose={() => setModal('none')} title="Reassign Lead">
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
            <p className="font-semibold text-blue-900">Currently assigned to:</p>
            <p className="text-blue-700">{lead.assignedTo?.name || 'Unassigned'}</p>
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

      {/* Convert (Deal Done) Modal */}
      <Modal open={modal === 'convert'} onClose={() => setModal('none')} title="🎉 Deal Done — Convert to Client">
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-900">
            This will mark the lead <b>CONVERTED</b> and create a Client record with the lead's details. You'll be able to complete client onboarding, add services, and generate proposals from the Clients page.
          </div>
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
