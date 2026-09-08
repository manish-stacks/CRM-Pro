// src/app/api/mobile/meetings/[id]/close/route.ts
// "Deal Done" (convert to client) / "Lost" / "Not Interested" from the mobile
// Meeting Detail screen — mirrors web's /api/leads/[id]/close exactly, so a
// deal closed on mobile shows up identically in the web CRM.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { logFromRequest } from '@/lib/audit'
import { generateClientCode } from '@/lib/idgen'
import { completeVisitForLead, CloseOutcome } from '@/lib/visitSync'
import { Notifications } from '@/lib/notify'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  let body: any = {}
  try { body = await req.json() } catch { return fail('Invalid body') }
  const { action, reason, note, followUpDate, followUpTime } = body

  const lead = await prisma.lead.findUnique({ where: { id }, include: { client: true } })
  if (!lead) return fail('Meeting not found', 404)

  const isOwner = [lead.assignedToId, lead.meetingAssignedToId, lead.createdById].includes(session.userId)
  if (!isOwner) return fail('Forbidden', 403)

  let newStatus: string
  if (action === 'convert') newStatus = 'CONVERTED'
  else if (action === 'lost') newStatus = 'CLOSED'
  else if (action === 'not_interested') newStatus = 'NOT_INTERESTED'
  // Not every client converts right after the meeting — some want pricing,
  // some need to think it over. This parks the lead in FOLLOW_UP instead of
  // forcing an immediate Convert/Lost call, so the telecaller follows up.
  else if (action === 'followup') newStatus = 'FOLLOW_UP'
  else return fail('Invalid action. Use: convert | lost | not_interested | followup')

  if (newStatus === 'CONVERTED' && lead.status !== 'MEETING_DONE') {
    return fail(`Mark the meeting as done first before closing the deal (currently ${lead.status})`)
  }
  if (newStatus === 'FOLLOW_UP' && !followUpDate) {
    return fail('Pick a follow-up date')
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
        newStatus === 'CONVERTED'  ? '🎉 Deal Done — Lead Converted! (via app)' :
        newStatus === 'CLOSED'     ? 'Lead Closed (Lost) — via app' :
        newStatus === 'FOLLOW_UP'  ? `📅 Follow-up scheduled after meeting (via app)${reason ? ` — ${reason}` : ''}` :
                                      'Lead Marked Not Interested — via app',
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
      metadata: { via: 'mobile', fromStatus: lead.status, reason, followUpDate, followUpTime },
    })
    return ok({ status: updated.status })
  }

  let clientId: string | null = lead.client?.id || null
  if (newStatus === 'CONVERTED' && !lead.client) {
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

  // ---- Visit sheet auto-complete (same helper the web uses) ----
  const outcome: CloseOutcome =
    newStatus === 'CONVERTED' ? 'DEAL_DONE' :
    newStatus === 'CLOSED'    ? 'LOST' : 'NOT_INTERESTED'

  const visit = await completeVisitForLead({
    leadId: id,
    userId: lead.meetingAssignedToId || session.userId,
    clientName: lead.companyName || lead.clientName,
    clientId,
    outcome,
    note: note || reason || null,
  })

  await logFromRequest(req, {
    userId: session.userId,
    action: newStatus,
    entityType: 'Lead',
    entityId: id,
    metadata: { via: 'mobile', fromStatus: lead.status, reason, clientId, visitId: visit?.id, outcome },
  })

  return ok({ status: updated.status, clientId, visitId: visit?.id || null })
}