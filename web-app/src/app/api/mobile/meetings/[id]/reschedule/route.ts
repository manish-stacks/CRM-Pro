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
import { isAfterOfficeHours, generateSlots } from '@/lib/meetingSlots'
import { dateOnly } from '@/lib/attendanceDate'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  // Two paths, same as the web route:
  //   1. meetingSlot — a free office-hours slot from
  //      GET /api/mobile/meetings/[id]/slots?date=... (the normal path now;
  //      the marketing person rebooks exactly like the telecaller does)
  //   2. meetingTime — free-form, still after office hours only
  const { meetingDate, meetingTime, meetingSlot, notes } = await req.json()
  if (!meetingDate) return fail('meetingDate required')
  if (!meetingSlot && !meetingTime) return fail('Pick a free slot, or give a time after office hours')

  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return fail('Meeting not found', 404)

  const isMeetingOwner = lead.meetingAssignedToId === session.userId
  if (!isMeetingOwner) return fail('Forbidden', 403)

  if (!['MEETING_SCHEDULED', 'CALLBACK'].includes(lead.status)) {
    return fail(`Lead must be in MEETING_SCHEDULED or CALLBACK to reschedule (currently ${lead.status})`)
  }

  const md = dateOnly(meetingDate)

  let finalSlot = 'After Office Hours'
  let finalTime = meetingTime

  if (meetingSlot) {
    const [officeStart, officeEnd, slotMinutes] = await Promise.all([
      Settings.meetingOfficeStart(),
      Settings.meetingOfficeEnd(),
      Settings.meetingSlotMinutes(),
    ])
    const def = generateSlots(officeStart, officeEnd, slotMinutes).find(x => x.label === meetingSlot)
    if (!def) return fail('That slot is not a valid office-hours slot')

    // Re-check availability at submit time — someone else may have taken the
    // slot between loading the picker and tapping Confirm.
    const clash = await prisma.lead.findFirst({
      where: {
        meetingAssignedToId: session.userId,
        meetingDate: md,
        meetingSlot: def.label,
        status: 'MEETING_SCHEDULED',
        id: { not: id },
      },
      select: { clientName: true, companyName: true },
    })
    if (clash) {
      return fail(`That slot just got booked (${clash.companyName || clash.clientName}). Pick another one.`)
    }
    finalSlot = def.label
    finalTime = def.start
  } else {
    const officeEnd = await Settings.meetingOfficeEnd()
    if (!isAfterOfficeHours(meetingTime, officeEnd)) {
      return fail(`Without picking a slot, reschedule is only allowed after office hours (${officeEnd} onwards).`)
    }
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      status: 'MEETING_SCHEDULED',
      meetingDate: md,
      meetingTime: finalTime,
      meetingSlot: finalSlot,
      // A marketing person rescheduling ALWAYS keeps the meeting on their own
      // calendar — they can never hand it to a colleague from here. Passing a
      // lead to someone else is the telecaller's job, and only happens via
      // Cancel Meeting (which un-assigns and asks the telecaller to rebook).
      meetingAssignedToId: session.userId,
    },
  })

  await prisma.leadActivity.create({
    data: {
      leadId: id,
      type: 'STATUS_CHANGE',
      title: `🔁 Meeting rescheduled to ${finalSlot === 'After Office Hours' ? finalTime : finalSlot} (via app)`,
      description: notes || null,
      fromStatus: lead.status,
      toStatus: 'MEETING_SCHEDULED',
      nextActionDate: md,
      nextActionTime: finalTime,
      createdById: session.userId,
    },
  })

  // Everyone who could rebook or needs to know the new time: the telecaller
  // AND whoever created the lead. Previously only one of them was told, so a
  // confirmed reschedule often reached nobody.
  const notifyTargets = Array.from(new Set([lead.assignedToId, lead.createdById].filter(Boolean) as string[]))
    .filter(uid => uid !== session.userId)
  if (notifyTargets.length) {
    await notify({
      userIds: notifyTargets,
      title: 'Meeting Rescheduled',
      message: `${lead.companyName || lead.clientName} — now ${finalSlot === 'After Office Hours' ? finalTime : finalSlot} on ${md.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
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
    metadata: { meetingDate: md, meetingTime: finalTime, meetingSlot: finalSlot, via: 'mobile' },
  })

  return ok({ status: updated.status })
}
