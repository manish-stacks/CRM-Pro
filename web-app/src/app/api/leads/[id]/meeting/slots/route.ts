// src/app/api/leads/[id]/meeting/slots/route.ts
// Free/booked office-hours slots for the marketing person who owns THIS
// meeting, on a given date.
//
// /api/marketing/slots answers "who in area X is free" (used when a telecaller
// books a brand-new meeting). This one is scoped to a single lead's assigned
// executive, so the marketing person themselves — or an Admin/TL rebooking on
// their behalf — can reschedule into a real free slot instead of being forced
// to pick a time after office hours.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { Settings } from '@/lib/settings'
import { generateSlots } from '@/lib/meetingSlots'
import { dateOnly } from '@/lib/attendanceDate'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  if (!date) return errorResponse('date required')

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { id: true, meetingAssignedToId: true, meetingAssignedTo: { select: { name: true } } },
  })
  if (!lead) return notFoundResponse('Lead')

  const canAny = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)
  const isOwner = lead.meetingAssignedToId === session.userId
  if (!canAny && !isOwner) return errorResponse('Forbidden', 403)

  // Whose calendar are we checking? The assigned exec, or (if somehow
  // unassigned) whoever is doing the rescheduling.
  const execId = lead.meetingAssignedToId || session.userId

  const [officeStart, officeEnd, slotMinutes] = await Promise.all([
    Settings.meetingOfficeStart(),
    Settings.meetingOfficeEnd(),
    Settings.meetingSlotMinutes(),
  ])
  const slotDefs = generateSlots(officeStart, officeEnd, slotMinutes)

  const day = dateOnly(date)
  const booked = await prisma.lead.findMany({
    where: {
      meetingAssignedToId: execId,
      meetingDate: day,
      status: 'MEETING_SCHEDULED',
      id: { not: id }, // its own current slot doesn't block a reschedule
    },
    select: { id: true, meetingSlot: true, clientName: true, companyName: true },
  })
  const bookedMap = new Map(booked.map(b => [b.meetingSlot, b]))

  const slots = slotDefs.map(s => {
    const clash = bookedMap.get(s.label)
    return {
      ...s,
      available: !clash,
      bookedWith: clash ? (clash.companyName || clash.clientName) : null,
    }
  })

  const nextAvailable = slots.find(s => s.available)?.label || null

  return successResponse({
    date,
    officeStart, officeEnd, slotMinutes,
    executive: lead.meetingAssignedTo?.name || null,
    slots: slots.map(s => ({ ...s, isNextAvailable: s.label === nextAvailable })),
    nextAvailable,
    freeCount: slots.filter(s => s.available).length,
  })
}
