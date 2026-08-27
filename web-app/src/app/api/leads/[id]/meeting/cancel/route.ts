// src/app/api/leads/[id]/meeting/cancel/route.ts
// A marketing person (or an Admin/TL) cancels an assigned meeting.
//
// Rules:
//  - A NOTE IS MANDATORY — the whole point is that the telecaller/creator
//    knows *why* it was cancelled before rebooking.
//  - The slot + the assigned executive are cleared, so the area/slot frees up
//    instantly and the lead can be re-assigned to a different marketing person.
//  - The lead drops back to FOLLOW_UP (not CLOSED) — it is still a live lead.
//  - The lead's creator AND its telecaller both get an in-app + push
//    notification asking them to re-assign the meeting.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { notify } from '@/lib/notify'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  let body: any = {}
  try { body = await req.json() } catch { }
  const notes = String(body.notes || body.reason || '').trim()
  if (notes.length < 3) return errorResponse('Please add a note explaining why the meeting is cancelled')

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { meetingAssignedTo: { select: { name: true } } },
  })
  if (!lead) return notFoundResponse('Lead')

  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)
  const isMeetingOwner = lead.meetingAssignedToId === session.userId
  if (!isAdmin && !isMeetingOwner) return errorResponse('Forbidden', 403)

  if (lead.status !== 'MEETING_SCHEDULED' || !lead.meetingAssignedToId) {
    return errorResponse(`No active meeting to cancel (lead is currently ${lead.status})`)
  }

  const cancelledBy = lead.meetingAssignedTo?.name || session.name
  const oldSlot = `${lead.meetingDate ? new Date(lead.meetingDate).toLocaleDateString('en-IN') : ''} ${lead.meetingSlot || lead.meetingTime || ''}`.trim()
  const previousExecId = lead.meetingAssignedToId

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      status: 'FOLLOW_UP',
      meetingDate: null,
      meetingTime: null,
      meetingSlot: null,
      meetingLocation: null,
      meetingLat: null,
      meetingLng: null,
      meetingAssignedToId: null,
      meetingNotes: `[Cancelled by ${cancelledBy}] ${notes}`,
    },
  })

  await prisma.leadActivity.create({
    data: {
      leadId: id,
      type: 'STATUS_CHANGE',
      title: `❌ Meeting cancelled by ${cancelledBy}`,
      description: `${notes}${oldSlot ? `\n\nCancelled slot: ${oldSlot}` : ''}\n\nThis lead needs to be re-assigned to another marketing person.`,
      fromStatus: lead.status,
      toStatus: 'FOLLOW_UP',
      createdById: session.userId,
      metadata: JSON.stringify({ cancelledExecutiveId: previousExecId, oldSlot, notes }),
    },
  })

  // Tell the people who can rebook it: the lead's creator and its telecaller.
  const targets = Array.from(new Set([lead.createdById, lead.assignedToId].filter(Boolean) as string[]))
    .filter(uid => uid !== session.userId)
  if (targets.length) {
    await notify({
      userIds: targets,
      title: '❌ Meeting cancelled — re-assign needed',
      message: `${cancelledBy} cancelled the meeting for ${lead.companyName || lead.clientName}. Reason: ${notes.slice(0, 90)}`,
      type: 'meeting',
      link: `/leads/${id}`,
      metadata: { screen: 'LeadDetail', leadId: id, action: 'reassign_meeting' },
    }).catch(() => { })
  }

  await logFromRequest(req, {
    userId: session.userId,
    action: 'MEETING_CANCELLED',
    entityType: 'Lead',
    entityId: id,
    metadata: { notes, oldSlot, previousExecId },
  })

  return successResponse({ status: updated.status, notes, needsReassign: true })
}
