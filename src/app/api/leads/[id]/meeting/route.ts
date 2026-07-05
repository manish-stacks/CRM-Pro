// src/app/api/leads/[id]/meeting/route.ts
// Schedule a meeting for a lead. Sets status = MEETING_SCHEDULED.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { sendWhatsapp } from '@/lib/whatsapp'
import { Notifications } from '@/lib/notify'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { marketingExecId, meetingDate, meetingTime, meetingSlot, meetingLocation, meetingNotes } = await req.json()

  if (!marketingExecId) return errorResponse('marketingExecId required')
  if (!meetingDate) return errorResponse('meetingDate required')

  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return notFoundResponse('Lead')

  const canScheduleAny = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)
  const isOwner = lead.assignedToId === session.userId || lead.createdById === session.userId
  if (!canScheduleAny && !isOwner) return errorResponse('Forbidden', 403)

  const marketingExec = await prisma.user.findUnique({
    where: { id: marketingExecId },
    select: { id: true, name: true, role: true, phone: true, isActive: true },
  })
  if (!marketingExec) return errorResponse('Marketing person not found', 404)
  if (!marketingExec.isActive) return errorResponse('Cannot assign to a disabled user')
  if (!['MARKETING_EXECUTIVE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(marketingExec.role)) {
    return errorResponse('Assignee must be a MARKETING_EXECUTIVE (or higher)')
  }

  const md = new Date(meetingDate)

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      status: 'MEETING_SCHEDULED',
      meetingDate: md,
      meetingTime: meetingTime || null,
      meetingSlot: meetingSlot || null,
      meetingLocation: meetingLocation || null,
      meetingNotes: meetingNotes || null,
      meetingAssignedToId: marketingExecId,
    },
    include: { meetingAssignedTo: { select: { name: true, phone: true } } },
  })

  await prisma.leadActivity.create({
    data: {
      leadId: id,
      type: 'MEETING_SCHEDULED',
      title: `Meeting scheduled with ${marketingExec.name}`,
      description: meetingNotes || null,
      fromStatus: lead.status,
      toStatus: 'MEETING_SCHEDULED',
      nextActionDate: md,
      nextActionTime: meetingTime || null,
      metadata: JSON.stringify({ slot: meetingSlot, location: meetingLocation, execId: marketingExecId }),
      createdById: session.userId,
    },
  })

  if (lead.clientPhone) {
    sendWhatsapp({
      toPhone: lead.clientPhone,
      template: 'hbs_lead_meeting_scheduled',
      params: {
        clientName: lead.clientName,
        meetingDate: md.toLocaleDateString('en-IN'),
        meetingTime: meetingTime || meetingSlot || 'TBD',
        marketingPersonName: marketingExec.name,
        marketingPhone: marketingExec.phone || '',
      },
      referenceType: 'LEAD',
      referenceId: id,
    }).catch(() => {})
  }

  // In-app notification to the marketing exec
  Notifications.meetingScheduled(
    marketingExecId,
    lead.clientName,
    `${md.toLocaleDateString('en-IN')}${meetingSlot ? ` (${meetingSlot})` : ''}`,
    id
  ).catch(() => {})

  await logFromRequest(req, {
    userId: session.userId,
    action: 'SCHEDULE_MEETING',
    entityType: 'Lead',
    entityId: id,
    metadata: { marketingExecId, meetingDate: md, meetingSlot },
  })

  return successResponse(updated)
}
