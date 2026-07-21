// src/app/api/mobile/meetings/[id]/done/route.ts
// Mirrors /api/leads/[id]/meeting/done for the mobile app — marketing
// person marks the meeting as done from their phone.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { logFromRequest } from '@/lib/audit'
import { Notifications } from '@/lib/notify'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  let body: any = {}
  try { body = await req.json() } catch {}
  const { notes } = body

  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return fail('Meeting not found', 404)

  const isMeetingOwner = lead.meetingAssignedToId === session.userId
  if (!isMeetingOwner) return fail('Forbidden', 403)

  if (lead.status !== 'MEETING_SCHEDULED') {
    return fail(`Lead must be in MEETING_SCHEDULED to mark the meeting done (currently ${lead.status})`)
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: { status: 'MEETING_DONE' },
  })

  await prisma.leadActivity.create({
    data: {
      leadId: id,
      type: 'STATUS_CHANGE',
      title: '✅ Meeting Done (via app)',
      description: notes || null,
      fromStatus: lead.status,
      toStatus: 'MEETING_DONE',
      createdById: session.userId,
    },
  })

  const notifyUserId = lead.assignedToId || lead.createdById
  if (notifyUserId && notifyUserId !== session.userId) {
    await Notifications.meetingDone(notifyUserId, lead.companyName || lead.clientName, id).catch(() => {})
  }

  await logFromRequest(req, {
    userId: session.userId,
    action: 'MEETING_DONE',
    entityType: 'Lead',
    entityId: id,
    metadata: { via: 'mobile' },
  })

  return ok({ status: updated.status })
}
