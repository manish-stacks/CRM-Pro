// src/lib/visitSync.ts
// Single source of truth for keeping ClientVisit (the "Visit Sheet") in sync
// with the Lead/Meeting lifecycle.
//
//  - Meeting assigned to a MARKETING_EXECUTIVE  -> PENDING visit auto-created
//  - Meeting re-scheduled / re-assigned         -> that visit is updated/moved
//  - Deal Done / Lost / Not Interested          -> visit auto-COMPLETED
//
// Everything is best-effort: a failure here must never break the main flow.
import { prisma } from './prisma'

export type CloseOutcome = 'DEAL_DONE' | 'LOST' | 'NOT_INTERESTED'

interface LeadLike {
  id: string
  clientName: string
  companyName?: string | null
  meetingAssignedToId?: string | null
  meetingDate?: Date | null
  meetingTime?: string | null
  meetingSlot?: string | null
  meetingLocation?: string | null
  meetingNotes?: string | null
}

/** Called when a meeting is scheduled / re-scheduled / re-assigned on a lead. */
export async function syncVisitForMeeting(lead: LeadLike, createdById: string) {
  try {
    if (!lead.meetingAssignedToId) return null

    const scheduledDate = lead.meetingDate ? new Date(lead.meetingDate) : new Date()
    const scheduledTime = lead.meetingTime || lead.meetingSlot || null
    const clientName = lead.companyName || lead.clientName

    // Existing auto-visit for this lead that is still open
    const existing = await prisma.clientVisit.findFirst({
      where: { leadId: lead.id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      orderBy: { createdAt: 'desc' },
    })

    if (existing) {
      return await prisma.clientVisit.update({
        where: { id: existing.id },
        data: {
          userId: lead.meetingAssignedToId,
          clientName,
          scheduledDate,
          scheduledTime,
          purpose: lead.meetingNotes || existing.purpose || 'Client meeting',
          checkInAddress: lead.meetingLocation || existing.checkInAddress,
          source: 'MEETING_ASSIGNED',
        },
      })
    }

    return await prisma.clientVisit.create({
      data: {
        userId: lead.meetingAssignedToId,
        leadId: lead.id,
        createdById,
        clientName,
        purpose: lead.meetingNotes || 'Client meeting',
        scheduledDate,
        scheduledTime,
        checkInAddress: lead.meetingLocation || null,
        status: 'PENDING',
        source: 'MEETING_ASSIGNED',
      },
    })
  } catch (e) {
    console.error('syncVisitForMeeting failed:', e)
    return null
  }
}

/**
 * Called when a lead is closed (Deal Done / Lost / Not Interested) from web OR app.
 * Auto-completes the open visit; if none exists, creates one already-completed so
 * the visit sheet always reflects the field activity.
 */
export async function completeVisitForLead(opts: {
  leadId: string
  userId: string            // who closed it (marketing exec)
  clientName: string
  clientId?: string | null
  outcome: CloseOutcome
  note?: string | null
}) {
  try {
    const now = new Date()

    const existing = await prisma.clientVisit.findFirst({
      where: { leadId: opts.leadId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      orderBy: { createdAt: 'desc' },
    })

    if (existing) {
      const checkInAt = existing.checkInAt || now
      const durationMins = existing.checkInAt
        ? Math.max(1, Math.round((now.getTime() - existing.checkInAt.getTime()) / 60000))
        : existing.durationMins ?? null

      return await prisma.clientVisit.update({
        where: { id: existing.id },
        data: {
          status: 'COMPLETED',
          outcome: opts.outcome,
          clientId: opts.clientId || existing.clientId,
          checkInAt,
          checkOutAt: now,
          durationMins,
          notes: opts.note || existing.notes,
        },
      })
    }

    return await prisma.clientVisit.create({
      data: {
        userId: opts.userId,
        leadId: opts.leadId,
        clientId: opts.clientId || null,
        createdById: opts.userId,
        clientName: opts.clientName,
        purpose: 'Client meeting',
        notes: opts.note || null,
        status: 'COMPLETED',
        outcome: opts.outcome,
        source: 'DEAL_DONE',
        scheduledDate: now,
        checkInAt: now,
        checkOutAt: now,
        durationMins: 0,
      },
    })
  } catch (e) {
    console.error('completeVisitForLead failed:', e)
    return null
  }
}
