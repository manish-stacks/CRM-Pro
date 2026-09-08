// src/app/api/leads/[id]/close/route.ts
// Mark a lead as CONVERTED, CLOSED (lost), or NOT_INTERESTED.
// On CONVERT: stub client entry (full onboarding in Phase 4).
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { generateClientCode } from '@/lib/idgen'
import { completeVisitForLead, CloseOutcome } from '@/lib/visitSync'
import { Notifications } from '@/lib/notify'
import { canSeeBeyondOwn } from '@/lib/permissions'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { action, reason, note, autoCreateClient = true, followUpDate, followUpTime } = await req.json()

  const lead = await prisma.lead.findUnique({ where: { id }, include: { client: true } })
  if (!lead) return notFoundResponse('Lead')

  const canCloseAny = canSeeBeyondOwn(session.role)
  const isOwner = [lead.assignedToId, lead.meetingAssignedToId, lead.createdById].includes(session.userId)
  if (!canCloseAny && !isOwner) return errorResponse('Forbidden', 403)

  let newStatus: string
  if (action === 'convert') newStatus = 'CONVERTED'
  else if (action === 'lost') newStatus = 'CLOSED'
  else if (action === 'not_interested') newStatus = 'NOT_INTERESTED'
  // Client isn't ready to decide right after the meeting (wants price / is
  // thinking it over / etc.) — don't force a hard Convert/Lost call. Park it
  // back in FOLLOW_UP so the telecaller picks it up on the given date instead
  // of every meeting-done lead defaulting to a straight conversion.
  else if (action === 'followup') newStatus = 'FOLLOW_UP'
  else return errorResponse('Invalid action. Use: convert | lost | not_interested | followup')

  if (newStatus === 'CONVERTED' && lead.status !== 'MEETING_DONE') {
    // Admin/TL and the telecaller who owns this lead can close the deal
    // directly without a meeting — the marketing-led flow still requires
    // MEETING_DONE first.
    const canDirectClose = canCloseAny || lead.assignedToId === session.userId
    if (!canDirectClose) {
      return errorResponse(`Mark the meeting as done first before closing the deal (currently ${lead.status})`)
    }
  }

  if (newStatus === 'FOLLOW_UP' && !followUpDate) {
    return errorResponse('Pick a follow-up date')
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      status: newStatus,
      convertedAt: newStatus === 'CONVERTED' ? new Date() : null,
      closedAt: (newStatus !== 'CONVERTED' && newStatus !== 'FOLLOW_UP') ? new Date() : null,
      closeReason: reason || null,
      ...(newStatus === 'FOLLOW_UP' ? {
        followUpDate: new Date(followUpDate),
        followUpTime: followUpTime || null,
        remark: reason || lead.remark,
      } : {}),
    },
  })

  await prisma.leadActivity.create({
    data: {
      leadId: id,
      type: newStatus === 'FOLLOW_UP' ? 'FOLLOWUP_SCHEDULED' : 'STATUS_CHANGE',
      title:
        newStatus === 'CONVERTED'  ? '🎉 Deal Done — Lead Converted!' :
        newStatus === 'CLOSED'     ? 'Lead Closed (Lost)' :
        newStatus === 'FOLLOW_UP'  ? `📅 Follow-up scheduled after meeting${reason ? ` — ${reason}` : ''}` :
                                      'Lead Marked Not Interested',
      description: note || reason || null,
      fromStatus: lead.status,
      toStatus: newStatus,
      nextActionDate: newStatus === 'FOLLOW_UP' ? new Date(followUpDate) : null,
      nextActionTime: newStatus === 'FOLLOW_UP' ? (followUpTime || null) : null,
      createdById: session.userId,
    },
  })

  if (newStatus === 'FOLLOW_UP') {
    const notifyUserId = lead.assignedToId || lead.createdById
    if (notifyUserId && notifyUserId !== session.userId) {
      await Notifications.followUpScheduled(notifyUserId, lead.companyName || lead.clientName, id, followUpDate).catch(() => {})
    }
    await logFromRequest(req, {
      userId: session.userId,
      action: 'FOLLOW_UP',
      entityType: 'Lead',
      entityId: id,
      metadata: { fromStatus: lead.status, reason, followUpDate, followUpTime },
    })
    return successResponse({ lead: updated })
  }

  let clientId: string | null = lead.client?.id || null
  if (newStatus === 'CONVERTED' && autoCreateClient && !lead.client) {
    const c = await prisma.client.create({
      data: {
        clientCode: await generateClientCode(),
        companyName: lead.companyName || lead.clientName,
        clientName: lead.clientName,
        phone: lead.clientPhone,
        altPhone: lead.alternatePhone || null,
        email: lead.clientEmail,
        address: lead.address,
        city: lead.city,
        state: lead.state,
        leadId: lead.id,
        status: 'ACTIVE',
        onboardingDate: new Date(),
        createdById: session.userId,
        marketingPersonId: lead.meetingAssignedToId,
        telecallerId: lead.assignedToId,
        portalPasswordSet: false,
      },
    })
    clientId = c.id
  }

  // ---- Visit sheet auto-complete ----
  const outcome: CloseOutcome =
    newStatus === 'CONVERTED' ? 'DEAL_DONE' :
    newStatus === 'CLOSED'    ? 'LOST' : 'NOT_INTERESTED'

  const visitOwnerId = lead.meetingAssignedToId || session.userId
  const visit = await completeVisitForLead({
    leadId: id,
    userId: visitOwnerId,
    clientName: lead.companyName || lead.clientName,
    clientId,
    outcome,
    note: note || reason || null,
  })

  if (visit && visitOwnerId !== session.userId) {
    await Notifications.visitCompleted(visitOwnerId, lead.companyName || lead.clientName, outcome).catch(() => {})
  }

  await logFromRequest(req, {
    userId: session.userId,
    action: newStatus,
    entityType: 'Lead',
    entityId: id,
    metadata: { fromStatus: lead.status, reason, clientId, visitId: visit?.id, outcome },
  })

  return successResponse({ lead: updated, clientId, visitId: visit?.id || null })
}
