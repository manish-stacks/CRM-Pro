// src/app/api/mobile/meetings/[id]/no-answer/route.ts
// Mirrors /api/leads/[id]/meeting/no-answer for the mobile app — marketing
// person marks "client didn't pick up" right from the field, freeing the
// slot instantly and dropping the lead to CALLBACK for a re-attempt.
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
  try { body = await req.json() } catch {}
  const { reason } = body

  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return fail('Meeting not found', 404)

  const isMeetingOwner = lead.meetingAssignedToId === session.userId
  if (!isMeetingOwner) return fail('Forbidden', 403)

  if (lead.status !== 'MEETING_SCHEDULED') {
    return fail(`Lead must be in MEETING_SCHEDULED (currently ${lead.status})`)
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      status: 'CALLBACK',
      meetingDate: null,
      meetingTime: null,
      meetingSlot: null,
      meetingAssignedToId: null,
      meetingLat: null,
      meetingLng: null,
    },
  })

  await prisma.leadActivity.create({
    data: {
      leadId: id,
      type: 'STATUS_CHANGE',
      title: '📵 No answer at meeting slot (via app)',
      description: reason || 'Client did not pick up / was unavailable — slot freed for reassignment.',
      fromStatus: lead.status,
      toStatus: 'CALLBACK',
      createdById: session.userId,
    },
  })

  const notifyUserId = lead.assignedToId || lead.createdById
  if (notifyUserId && notifyUserId !== session.userId) {
    await notify({
      userIds: notifyUserId,
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
    metadata: { via: 'mobile' },
  })

  return ok({ status: updated.status })
}
