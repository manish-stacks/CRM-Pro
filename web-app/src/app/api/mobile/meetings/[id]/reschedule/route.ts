// src/app/api/mobile/meetings/[id]/reschedule/route.ts
// Mirrors /api/leads/[id]/meeting/reschedule for the mobile app — client asked
// to meet later, marketing person rebooks themselves right from the field.
// Restricted to AFTER office hours (the in-office window is governed by the
// area/slot picker on the web side).
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { logFromRequest } from '@/lib/audit'
import { notify } from '@/lib/notify'
import { Settings } from '@/lib/settings'
import { isAfterOfficeHours } from '@/lib/meetingSlots'
import { dateOnly } from '@/lib/attendanceDate'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  const { meetingDate, meetingTime, notes } = await req.json()
  if (!meetingDate) return fail('meetingDate required')
  if (!meetingTime) return fail('meetingTime required (HH:mm, after office hours)')

  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return fail('Meeting not found', 404)

  const isMeetingOwner = lead.meetingAssignedToId === session.userId
  if (!isMeetingOwner) return fail('Forbidden', 403)

  if (!['MEETING_SCHEDULED', 'CALLBACK'].includes(lead.status)) {
    return fail(`Lead must be in MEETING_SCHEDULED or CALLBACK to reschedule (currently ${lead.status})`)
  }

  const officeEnd = await Settings.meetingOfficeEnd()
  if (!isAfterOfficeHours(meetingTime, officeEnd)) {
    return fail(`Self-reschedule is only allowed after office hours (${officeEnd} onwards). Ask your TL/Admin to rebook within office hours.`)
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
      title: '🔁 Meeting rescheduled (after office hours, via app)',
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
    metadata: { meetingDate: md, meetingTime, via: 'mobile' },
  })

  return ok({ status: updated.status })
}
