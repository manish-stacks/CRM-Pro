// src/app/api/mobile/meetings/[id]/cancel/route.ts
// Mobile mirror of /api/leads/[id]/meeting/cancel — the marketing person
// cancels their own assigned meeting from the field, with a mandatory note.
// The slot is freed and the lead's creator + telecaller are notified so they
// can re-assign the meeting to a different marketing person.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { logFromRequest } from '@/lib/audit'
import { notify } from '@/lib/notify'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  let body: any = {}
  try { body = await req.json() } catch { }
  const notes = String(body.notes || body.reason || '').trim()
  if (notes.length < 3) return fail('Please add a note explaining why you are cancelling this meeting')

  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return fail('Meeting not found', 404)

  if (lead.meetingAssignedToId !== session.userId) return fail('Forbidden', 403)
  if (lead.status !== 'MEETING_SCHEDULED') {
    return fail(`No active meeting to cancel (currently ${lead.status})`)
  }

  const cancelledBy = session.name || 'Marketing person'
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
      title: `❌ Meeting cancelled by ${cancelledBy} (via app)`,
      description: `${notes}${oldSlot ? `\n\nCancelled slot: ${oldSlot}` : ''}\n\nThis lead needs to be re-assigned to another marketing person.`,
      fromStatus: lead.status,
      toStatus: 'FOLLOW_UP',
      createdById: session.userId,
      metadata: JSON.stringify({ cancelledExecutiveId: previousExecId, oldSlot, notes, via: 'mobile' }),
    },
  })

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
    metadata: { via: 'mobile', notes, oldSlot, previousExecId },
  })

  return ok({ status: updated.status, needsReassign: true })
}
