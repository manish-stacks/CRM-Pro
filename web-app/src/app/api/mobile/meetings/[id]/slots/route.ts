// src/app/api/mobile/meetings/[id]/slots/route.ts
// Mobile mirror of /api/leads/[id]/meeting/slots — the marketing person picks
// a date in the app and sees exactly which of their own office-hours slots are
// free, same as the telecaller sees on the web when booking.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { Settings } from '@/lib/settings'
import { generateSlots } from '@/lib/meetingSlots'
import { dateOnly } from '@/lib/attendanceDate'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  if (!date) return fail('date required')

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { id: true, meetingAssignedToId: true },
  })
  if (!lead) return fail('Meeting not found', 404)
  if (lead.meetingAssignedToId !== session.userId) return fail('Forbidden', 403)

  const [officeStart, officeEnd, slotMinutes] = await Promise.all([
    Settings.meetingOfficeStart(),
    Settings.meetingOfficeEnd(),
    Settings.meetingSlotMinutes(),
  ])
  const slotDefs = generateSlots(officeStart, officeEnd, slotMinutes)

  const day = dateOnly(date)
  const booked = await prisma.lead.findMany({
    where: {
      meetingAssignedToId: session.userId,
      meetingDate: day,
      status: 'MEETING_SCHEDULED',
      id: { not: id },
    },
    select: { meetingSlot: true, clientName: true, companyName: true },
  })
  const bookedMap = new Map(booked.map(b => [b.meetingSlot, b]))

  const slots = slotDefs.map(s => {
    const clash = bookedMap.get(s.label)
    return {
      label: s.label,
      start: s.start,
      end: s.end,
      available: !clash,
      booked_with: clash ? (clash.companyName || clash.clientName) : null,
    }
  })

  const nextAvailable = slots.find(s => s.available)?.label || null

  return ok({
    date,
    office_start: officeStart,
    office_end: officeEnd,
    slot_minutes: slotMinutes,
    // `is_next_available` powers the "Next free slot" one-tap shortcut.
    slots: slots.map(s => ({ ...s, is_next_available: s.label === nextAvailable })),
    next_available: nextAvailable,
    free_count: slots.filter(s => s.available).length,
  })
}
