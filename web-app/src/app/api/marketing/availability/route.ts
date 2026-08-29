// src/app/api/marketing/availability/route.ts
// Company-wide meeting-slot board.
//
// /api/marketing/slots answers "which execs in THIS area are free at THIS
// slot" and only exists to power the booking picker inside a single lead.
// This endpoint instead returns the WHOLE grid for a date — every marketing
// executive x every office-hours slot — so admins / telecallers can see who is
// free without opening a lead first.
//
// Query params:
//   date          YYYY-MM-DD (required)
//   area          optional territory filter
//   executiveId   optional single executive
//   search        optional name match
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
  const date = searchParams.get('date')
  const area = searchParams.get('area')?.trim() || ''
  const executiveId = searchParams.get('executiveId')?.trim() || ''
  const search = searchParams.get('search')?.trim() || ''
  if (!date) return errorResponse('date required')

  const [officeStart, officeEnd, slotMinutes] = await Promise.all([
    Settings.meetingOfficeStart(),
    Settings.meetingOfficeEnd(),
    Settings.meetingSlotMinutes(),
  ])
  const slotDefs = generateSlots(officeStart, officeEnd, slotMinutes)

  // ---- Executives -------------------------------------------------------
  const empWhere: any = { user: { role: 'MARKETING_EXECUTIVE', isActive: true } }
  if (area) empWhere.area = area
  if (executiveId) empWhere.user = { ...empWhere.user, id: executiveId }
  if (search) empWhere.user = { ...empWhere.user, name: { contains: search } }

  const employees = await prisma.employee.findMany({
    where: empWhere,
    select: {
      id: true,
      area: true,
      user: { select: { id: true, name: true, avatar: true, phone: true } },
    },
    orderBy: [{ area: 'asc' }],
  })

  if (employees.length === 0) {
    return successResponse({
      date, slots: slotDefs, executives: [], areas: [],
      officeStart, officeEnd, slotMinutes,
      summary: { executives: 0, totalSlots: 0, booked: 0, free: 0 },
    })
  }

  const userIds = employees.map(e => e.user.id)
  const day = dateOnly(date)

  // ---- Meetings booked on that date -------------------------------------
  const booked = await prisma.lead.findMany({
    where: {
      meetingAssignedToId: { in: userIds },
      meetingDate: day,
      status: 'MEETING_SCHEDULED',
    },
    select: {
      id: true, leadNumber: true, clientName: true, companyName: true,
      clientPhone: true, city: true, service: true, price: true,
      meetingSlot: true, meetingTime: true, meetingLocation: true,
      meetingAssignedToId: true,
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  const bookingMap = new Map<string, any>()   // "userId|slotLabel" -> lead
  for (const b of booked) bookingMap.set(`${b.meetingAssignedToId}|${b.meetingSlot}`, b)

  // ---- Who is on approved leave that day (their whole row is unavailable) ----
  const leaves = await prisma.leave.findMany({
    where: {
      status: 'APPROVED',
      employeeId: { in: employees.map(e => e.id) },
      startDate: { lte: day },
      endDate: { gte: day },
    },
    select: { employeeId: true, type: true },
  })
  const leaveMap = new Map(leaves.map(l => [l.employeeId, l.type]))

  // ---- Build the grid ---------------------------------------------------
  let bookedCount = 0
  let freeCount = 0

  const executives = employees.map(e => {
    const onLeave = leaveMap.get(e.id) || null
    const slots = slotDefs.map(s => {
      const lead = bookingMap.get(`${e.user.id}|${s.label}`) || null
      const available = !lead && !onLeave
      if (lead) bookedCount++
      else if (available) freeCount++
      return {
        label: s.label,
        start: s.start,
        end: s.end,
        available,
        lead: lead ? {
          id: lead.id,
          leadNumber: lead.leadNumber,
          clientName: lead.clientName,
          companyName: lead.companyName,
          clientPhone: lead.clientPhone,
          city: lead.city,
          service: lead.service,
          price: lead.price,
          meetingTime: lead.meetingTime,
          meetingLocation: lead.meetingLocation,
          telecaller: lead.assignedTo?.name || lead.createdBy?.name || null,
        } : null,
      }
    })
    return {
      id: e.user.id,
      employeeId: e.id,
      name: e.user.name,
      avatar: e.user.avatar,
      phone: e.user.phone,
      area: e.area || 'No area set',
      onLeave,
      bookedCount: slots.filter(s => s.lead).length,
      freeCount: slots.filter(s => s.available).length,
      slots,
    }
  }).sort((a, b) => a.area.localeCompare(b.area) || a.name.localeCompare(b.name))

  // Every territory that exists (for the filter dropdown), not just the
  // filtered ones — otherwise picking an area empties its own dropdown.
  const allAreas = await prisma.employee.findMany({
    where: { area: { not: null }, user: { role: 'MARKETING_EXECUTIVE', isActive: true } },
    select: { area: true },
    distinct: ['area'],
    orderBy: { area: 'asc' },
  })

  return successResponse({
    date,
    officeStart, officeEnd, slotMinutes,
    slots: slotDefs,
    executives,
    areas: allAreas.map(a => a.area).filter(Boolean),
    summary: {
      executives: executives.length,
      totalSlots: executives.length * slotDefs.length,
      booked: bookedCount,
      free: freeCount,
      onLeave: executives.filter(e => e.onLeave).length,
    },
  })
}
