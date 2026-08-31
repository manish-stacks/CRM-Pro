// src/app/api/leads/[id]/meeting/no-answer/route.ts
// Marketing person (or Admin/TL) marks that the client didn't pick up / was
// unavailable for the scheduled meeting. Clears the meeting assignment so the
// slot becomes free again immediately (availability is computed live from
// active MEETING_SCHEDULED leads — no separate slot table to clean up), and
// drops the lead back to CALLBACK for the telecaller to re-attempt.
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
  try { body = await req.json() } catch {}
  const { reason } = body

  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return notFoundResponse('Lead')

  const canAny = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)
  const isMeetingOwner = lead.meetingAssignedToId === session.userId
  if (!canAny && !isMeetingOwner) return errorResponse('Forbidden', 403)

  if (lead.status !== 'MEETING_SCHEDULED') {
    return errorResponse(`Lead must be in MEETING_SCHEDULED (currently ${lead.status})`)
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      status: 'CALLBACK',
      // The SLOT is freed (date/time/slot cleared) so the calendar opens up,
      // but the meeting STAYS ASSIGNED to the same marketing person.
      //
      // Clearing meetingAssignedToId here was the bug: the moment they marked
      // "didn't pick up", they stopped being the owner — the meeting vanished
      // from their list and re-opening it returned 403 Forbidden. Only
      // Cancel Meeting un-assigns; everything else keeps it with them so they
      // can rebook it themselves.
      meetingDate: null,
      meetingTime: null,
      meetingSlot: null,
      meetingLat: null,
      meetingLng: null,
    },
  })

  await prisma.leadActivity.create({
    data: {
      leadId: id,
      type: 'STATUS_CHANGE',
      title: '📵 No answer at meeting slot',
      description: reason || 'Client did not pick up / was unavailable — slot freed for reassignment.',
      fromStatus: lead.status,
      toStatus: 'CALLBACK',
      createdById: session.userId,
    },
  })

  const notifyTargets = Array.from(new Set([lead.assignedToId, lead.createdById].filter(Boolean) as string[]))
    .filter(uid => uid !== session.userId)
  if (notifyTargets.length) {
    await notify({
      userIds: notifyTargets,
      title: 'No answer at meeting',
      message: `${lead.companyName || lead.clientName} didn't pick up — slot freed, needs a re-attempt`,
      type: 'meeting',
      link: `/leads/${id}`,
      metadata: { screen: 'LeadDetail', leadId: id },
    }).catch(() => {})
  }

  await logFromRequest(req, {
    userId: session.userId,
    action: 'MEETING_NO_ANSWER',
    entityType: 'Lead',
    entityId: id,
  })

  return successResponse(updated)
}
