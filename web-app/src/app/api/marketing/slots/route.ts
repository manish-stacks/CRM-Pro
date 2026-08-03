// src/app/api/marketing/slots/route.ts
// For a given territory (area) + date, returns every office-hours slot with
// which marketing executives (of that area) are free vs already booked —
// so the telecaller can pick a free person directly. A slot only shows as
// fully booked when EVERY exec in that area already has a meeting in it.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api'
import { Settings } from '@/lib/settings'
import { generateSlots } from '@/lib/meetingSlots'
import { dateOnly } from '@/lib/attendanceDate'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const area = searchParams.get('area')
  const date = searchParams.get('date')
  const excludeLeadId = searchParams.get('excludeLeadId') // when rebooking the same lead, ignore its own current slot

  if (!area) return errorResponse('area required')
  if (!date) return errorResponse('date required')

  const [officeStart, officeEnd, slotMinutes] = await Promise.all([
    Settings.meetingOfficeStart(),
    Settings.meetingOfficeEnd(),
    Settings.meetingSlotMinutes(),
  ])
  const slotDefs = generateSlots(officeStart, officeEnd, slotMinutes)

  const execs = await prisma.employee.findMany({
    where: { area, user: { role: 'MARKETING_EXECUTIVE', isActive: true } },
    select: { user: { select: { id: true, name: true, avatar: true } } },
  })
  const execUsers = execs.map(e => e.user)

  if (execUsers.length === 0) {
    return successResponse({ slots: [], executiveCount: 0 })
  }

  const day = dateOnly(date)
  const booked = await prisma.lead.findMany({
    where: {
      meetingAssignedToId: { in: execUsers.map(u => u.id) },
      meetingDate: day,
      status: 'MEETING_SCHEDULED',
      ...(excludeLeadId ? { id: { not: excludeLeadId } } : {}),
    },
    select: { meetingAssignedToId: true, meetingSlot: true },
  })

  const bookedSet = new Set(booked.map(b => `${b.meetingAssignedToId}|${b.meetingSlot}`))

  const slots = slotDefs.map(s => {
    const free = execUsers.filter(u => !bookedSet.has(`${u.id}|${s.label}`))
    const busy = execUsers.filter(u => bookedSet.has(`${u.id}|${s.label}`))
    return {
      ...s,
      available: free.length > 0,
      freeExecutives: free,
      busyExecutives: busy,
    }
  })

  return successResponse({ slots, executiveCount: execUsers.length })
}
