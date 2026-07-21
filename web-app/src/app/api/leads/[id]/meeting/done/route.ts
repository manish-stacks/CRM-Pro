// src/app/api/leads/[id]/meeting/done/route.ts
// Marketing person marks the meeting as done. This is a separate step from
// the deal decision — it just says "the meeting happened", moving the lead
// to MEETING_DONE. The telecaller can then send a proposal, and the deal
// gets closed (Converted / Rejected) via /api/leads/[id]/close afterwards.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { Notifications } from '@/lib/notify'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  let body: any = {}
  try { body = await req.json() } catch {}
  const { notes } = body

  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return notFoundResponse('Lead')

  const canAny = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)
  const isMeetingOwner = lead.meetingAssignedToId === session.userId
  if (!canAny && !isMeetingOwner) return errorResponse('Forbidden', 403)

  if (lead.status !== 'MEETING_SCHEDULED') {
    return errorResponse(`Lead must be in MEETING_SCHEDULED to mark the meeting done (currently ${lead.status})`)
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: { status: 'MEETING_DONE' },
  })

  await prisma.leadActivity.create({
    data: {
      leadId: id,
      type: 'STATUS_CHANGE',
      title: '✅ Meeting Done',
      description: notes || null,
      fromStatus: lead.status,
      toStatus: 'MEETING_DONE',
      createdById: session.userId,
    },
  })

  // Let the telecaller (or lead owner) know the meeting happened, so they
  // can prepare/send the proposal.
  const notifyUserId = lead.assignedToId || lead.createdById
  if (notifyUserId && notifyUserId !== session.userId) {
    await Notifications.meetingDone(notifyUserId, lead.companyName || lead.clientName, id).catch(() => {})
  }

  await logFromRequest(req, {
    userId: session.userId,
    action: 'MEETING_DONE',
    entityType: 'Lead',
    entityId: id,
  })

  return successResponse(updated)
}
