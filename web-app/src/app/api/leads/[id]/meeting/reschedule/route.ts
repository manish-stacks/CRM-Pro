// src/app/api/leads/[id]/meeting/reschedule/route.ts
// Marketing person (or Admin/TL) reschedules an existing meeting themselves —
// e.g. the client asked to meet in the evening. This bypasses the normal
// area/slot picker entirely and is restricted to a time AFTER office hours,
// since the slot system already governs the in-office window.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { notify } from '@/lib/notify'
import { Settings } from '@/lib/settings'
import { isAfterOfficeHours } from '@/lib/meetingSlots'
import { dateOnly } from '@/lib/attendanceDate'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { meetingDate, meetingTime, notes } = await req.json()
  if (!meetingDate) return errorResponse('meetingDate required')
  if (!meetingTime) return errorResponse('meetingTime required (HH:mm, after office hours)')

  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return notFoundResponse('Lead')

  const canAny = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)
  const isMeetingOwner = lead.meetingAssignedToId === session.userId
  if (!canAny && !isMeetingOwner) return errorResponse('Forbidden', 403)

  if (!['MEETING_SCHEDULED', 'CALLBACK'].includes(lead.status)) {
    return errorResponse(`Lead must be in MEETING_SCHEDULED or CALLBACK to reschedule (currently ${lead.status})`)
  }

  const officeEnd = await Settings.meetingOfficeEnd()
  if (!isAfterOfficeHours(meetingTime, officeEnd) && !canAny) {
    return errorResponse(`Self-reschedule is only allowed after office hours (${officeEnd} onwards). Ask an Admin/TL to rebook within office hours.`)
  }

  const md = dateOnly(meetingDate)

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      status: 'MEETING_SCHEDULED',
      meetingDate: md,
      meetingTime,
      meetingSlot: 'After Office Hours',
      meetingAssignedToId: lead.meetingAssignedToId || session.userId,
    },
  })

  await prisma.leadActivity.create({
    data: {
      leadId: id,
      type: 'STATUS_CHANGE',
      title: '🔁 Meeting rescheduled (after office hours)',
      description: notes || null,
      fromStatus: lead.status,
      toStatus: 'MEETING_SCHEDULED',
      nextActionDate: md,
      nextActionTime: meetingTime,
      createdById: session.userId,
    },
  })

  const notifyUserId = lead.assignedToId || lead.createdById
  if (notifyUserId && notifyUserId !== session.userId) {
    await notify({
      userIds: notifyUserId,
      title: 'Meeting Rescheduled',
      message: `${lead.companyName || lead.clientName} — new time ${meetingTime} on ${md.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
      type: 'meeting',
      link: `/leads/${id}`,
      metadata: { screen: 'LeadDetail', leadId: id },
    }).catch(() => {})
  }

  await logFromRequest(req, {
    userId: session.userId,
    action: 'MEETING_RESCHEDULE',
    entityType: 'Lead',
    entityId: id,
    metadata: { meetingDate: md, meetingTime },
  })

  return successResponse(updated)
}
