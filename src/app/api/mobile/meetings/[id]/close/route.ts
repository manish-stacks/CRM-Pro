// src/app/api/mobile/meetings/[id]/close/route.ts
// "Deal Done" (convert to client) / "Lost" / "Not Interested" from the mobile
// Meeting Detail screen — mirrors web's /api/leads/[id]/close exactly, so a
// deal closed on mobile shows up identically in the web CRM.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { logFromRequest } from '@/lib/audit'
import { generateClientCode } from '@/lib/idgen'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  let body: any = {}
  try { body = await req.json() } catch { return fail('Invalid body') }
  const { action, reason, note } = body

  const lead = await prisma.lead.findUnique({ where: { id }, include: { client: true } })
  if (!lead) return fail('Meeting not found', 404)

  const isOwner = [lead.assignedToId, lead.meetingAssignedToId, lead.createdById].includes(session.userId)
  if (!isOwner) return fail('Forbidden', 403)

  let newStatus: string
  if (action === 'convert') newStatus = 'CONVERTED'
  else if (action === 'lost') newStatus = 'CLOSED'
  else if (action === 'not_interested') newStatus = 'NOT_INTERESTED'
  else return fail('Invalid action. Use: convert | lost | not_interested')

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      status: newStatus,
      convertedAt: newStatus === 'CONVERTED' ? new Date() : null,
      closedAt: newStatus !== 'CONVERTED' ? new Date() : null,
      closeReason: reason || null,
    },
  })

  await prisma.leadActivity.create({
    data: {
      leadId: id,
      type: 'STATUS_CHANGE',
      title:
        newStatus === 'CONVERTED' ? '🎉 Deal Done — Lead Converted! (via app)' :
        newStatus === 'CLOSED'    ? 'Lead Closed (Lost) — via app' :
                                    'Lead Marked Not Interested — via app',
      description: note || reason || null,
      fromStatus: lead.status,
      toStatus: newStatus,
      createdById: session.userId,
    },
  })

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

  await logFromRequest(req, {
    userId: session.userId,
    action: newStatus,
    entityType: 'Lead',
    entityId: id,
    metadata: { via: 'mobile', fromStatus: lead.status, reason, clientId },
  })

  return ok({ status: updated.status, clientId })
}