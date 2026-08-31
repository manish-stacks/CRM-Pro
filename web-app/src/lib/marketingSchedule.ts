// src/lib/marketingSchedule.ts
// Builds a marketing person's day, slot by slot: every office-hours slot for a
// date, with the meeting sitting in it (or null if free).
//
// Both the web `/marketing` page and the mobile Meetings screen render this,
// so the logic lives here rather than being duplicated in two route handlers.
import { prisma } from '@/lib/prisma'
import { Settings } from '@/lib/settings'
import { generateSlots } from '@/lib/meetingSlots'
import { dateOnly } from '@/lib/attendanceDate'

export interface ScheduleDay {
  date: string
  weekday: string
  slots: {
    label: string
    start: string
    end: string
    available: boolean
    lead: any | null
  }[]
  bookedCount: number
  freeCount: number
  nextAvailableSlot: string | null
}

export async function buildSchedule(
  userId: string,
  startDate: string,
  days = 1,
  opts: { excludeLeadId?: string } = {}
): Promise<{ days: ScheduleDay[]; officeStart: string; officeEnd: string; slotMinutes: number }> {
  const [officeStart, officeEnd, slotMinutes] = await Promise.all([
    Settings.meetingOfficeStart(),
    Settings.meetingOfficeEnd(),
    Settings.meetingSlotMinutes(),
  ])
  const slotDefs = generateSlots(officeStart, officeEnd, slotMinutes)

  const start = dateOnly(startDate)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + Math.max(1, days) - 1)
  const endOfLast = new Date(end.getTime() + 86400000 - 1)

  const meetings = await prisma.lead.findMany({
    where: {
      meetingAssignedToId: userId,
      meetingDate: { gte: start, lte: endOfLast },
      status: 'MEETING_SCHEDULED',
      ...(opts.excludeLeadId ? { id: { not: opts.excludeLeadId } } : {}),
    },
    select: {
      id: true, leadNumber: true, clientName: true, companyName: true,
      clientPhone: true, city: true, service: true, price: true, status: true,
      meetingDate: true, meetingSlot: true, meetingTime: true,
      meetingLocation: true, meetingLat: true, meetingLng: true, meetingNotes: true,
      assignedTo: { select: { name: true, phone: true } },
      createdBy: { select: { name: true } },
    },
  })

  // "YYYY-MM-DD|slot label" -> meeting
  const map = new Map<string, any>()
  for (const m of meetings) {
    const key = `${m.meetingDate?.toISOString().slice(0, 10)}|${m.meetingSlot}`
    map.set(key, m)
  }

  const out: ScheduleDay[] = []
  for (let i = 0; i < Math.max(1, days); i++) {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + i)
    const ymd = d.toISOString().slice(0, 10)

    const slots = slotDefs.map(sl => {
      const lead = map.get(`${ymd}|${sl.label}`) || null
      return {
        label: sl.label,
        start: sl.start,
        end: sl.end,
        available: !lead,
        lead: lead ? {
          id: lead.id,
          lead_number: lead.leadNumber,
          client_name: lead.clientName,
          company: lead.companyName,
          phone: lead.clientPhone,
          city: lead.city,
          service: lead.service,
          price: lead.price,
          status: lead.status,
          meeting_time: lead.meetingTime,
          address: lead.meetingLocation,
          lat: lead.meetingLat,
          lng: lead.meetingLng,
          notes: lead.meetingNotes,
          telecaller: lead.assignedTo?.name || lead.createdBy?.name || null,
          telecaller_phone: lead.assignedTo?.phone || null,
        } : null,
      }
    })

    // Meetings booked outside the fixed slots (an after-office-hours
    // reschedule) still belong to the day — surface them at the end so they
    // aren't invisible.
    const extras = meetings
      .filter(m => m.meetingDate?.toISOString().slice(0, 10) === ymd)
      .filter(m => !slotDefs.some(sl => sl.label === m.meetingSlot))
      .map(m => ({
        label: m.meetingSlot || m.meetingTime || 'After office hours',
        start: m.meetingTime || '',
        end: '',
        available: false,
        lead: {
          id: m.id,
          lead_number: m.leadNumber,
          client_name: m.clientName,
          company: m.companyName,
          phone: m.clientPhone,
          city: m.city,
          service: m.service,
          price: m.price,
          status: m.status,
          meeting_time: m.meetingTime,
          address: m.meetingLocation,
          lat: m.meetingLat,
          lng: m.meetingLng,
          notes: m.meetingNotes,
          telecaller: m.assignedTo?.name || m.createdBy?.name || null,
          telecaller_phone: m.assignedTo?.phone || null,
        },
      }))

    const all = [...slots, ...extras]
    out.push({
      date: ymd,
      weekday: d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }),
      slots: all,
      bookedCount: all.filter(x => x.lead).length,
      freeCount: slots.filter(x => x.available).length,
      nextAvailableSlot: slots.find(x => x.available)?.label || null,
    })
  }

  return { days: out, officeStart, officeEnd, slotMinutes }
}
