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
import { isAfterOfficeHours, generateSlots } from '@/lib/meetingSlots'
import { dateOnly } from '@/lib/attendanceDate'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  // Two ways to reschedule:
  //   1. meetingSlot — pick a free office-hours slot (same slot system the
  //      telecaller books through). This is the normal path now.
  //   2. meetingTime — a free-form time, still restricted to AFTER office
  //      hours for non-admins, for "client wants to meet in the evening".
  const { meetingDate, meetingTime, meetingSlot, notes } = await req.json()
  if (!meetingDate) return errorResponse('meetingDate required')
  if (!meetingSlot && !meetingTime) return errorResponse('Pick a slot, or give a time after office hours')

  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return notFoundResponse('Lead')

  const canAny = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)
  const isMeetingOwner = lead.meetingAssignedToId === session.userId
  if (!canAny && !isMeetingOwner) return errorResponse('Forbidden', 403)

  if (!['MEETING_SCHEDULED', 'CALLBACK'].includes(lead.status)) {
    return errorResponse(`Lead must be in MEETING_SCHEDULED or CALLBACK to reschedule (currently ${lead.status})`)
  }

  const md = dateOnly(meetingDate)
  // A marketing executive rescheduling can only ever move the meeting within
  // their OWN calendar — never onto a colleague. Handing a lead to someone
  // else goes through Cancel Meeting, which un-assigns and lets the telecaller
  // rebook it inside office hours.
  const execId = session.role === 'MARKETING_EXECUTIVE'
    ? session.userId
    : (lead.meetingAssignedToId || session.userId)

  let finalSlot = 'After Office Hours'
  let finalTime = meetingTime

  if (meetingSlot) {
    // ---- Slot path: validate it's a real slot AND still free ----
    const [officeStart, officeEnd, slotMinutes] = await Promise.all([
      Settings.meetingOfficeStart(),
      Settings.meetingOfficeEnd(),
      Settings.meetingSlotMinutes(),
    ])
    const def = generateSlots(officeStart, officeEnd, slotMinutes).find(x => x.label === meetingSlot)
    if (!def) return errorResponse('That slot is not a valid office-hours slot')

    const clash = await prisma.lead.findFirst({
      where: {
        meetingAssignedToId: execId,
        meetingDate: md,
        meetingSlot: def.label,
        status: 'MEETING_SCHEDULED',
        id: { not: id },
      },
      select: { clientName: true, companyName: true },
    })
    if (clash) {
      return errorResponse(`That slot is already booked (${clash.companyName || clash.clientName}). Pick another one.`)
    }
    finalSlot = def.label
    finalTime = def.start
  } else {
    // ---- Free-form time path: after office hours only (non-admins) ----
    const officeEnd = await Settings.meetingOfficeEnd()
    if (!isAfterOfficeHours(meetingTime, officeEnd) && !canAny) {
      return errorResponse(`Without picking a slot, self-reschedule is only allowed after office hours (${officeEnd} onwards).`)
    }
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      status: 'MEETING_SCHEDULED',
      meetingDate: md,
      meetingTime: finalTime,
      meetingSlot: finalSlot,
      meetingAssignedToId: execId,
    },
  })

  await prisma.leadActivity.create({
    data: {
      leadId: id,
      type: 'STATUS_CHANGE',
      title: `🔁 Meeting rescheduled to ${finalSlot === 'After Office Hours' ? finalTime : finalSlot}`,
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
    metadata: { meetingDate: md, meetingTime: finalTime, meetingSlot: finalSlot },
  })

  return successResponse(updated)
}
