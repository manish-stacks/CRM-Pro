// src/app/api/mobile/meetings/route.ts
// Meetings assigned to the logged-in marketing executive.
// A "meeting" is a Lead with status MEETING_SCHEDULED whose meetingAssignedToId
// is this user. The mobile Meetings screen lists these and lets the exec open
// the client's address on a map. Matches the web flow (leads/[id] meeting tab).
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok } from '@/lib/mobileAuth'

export async function GET(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  const { searchParams } = new URL(req.url)
  // ?scope=upcoming (default) shows only MEETING_SCHEDULED; ?scope=all includes past/converted
  const scope = searchParams.get('scope') || 'upcoming'

  const where: any = { meetingAssignedToId: session.userId }
  if (scope !== 'all') where.status = 'MEETING_SCHEDULED'

  const leads = await prisma.lead.findMany({
    where,
    orderBy: [{ meetingDate: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    select: {
      id: true,
      leadNumber: true,
      companyName: true,
      clientName: true,
      clientPhone: true,
      clientEmail: true,
      address: true,
      city: true,
      state: true,
      status: true,
      meetingDate: true,
      meetingTime: true,
      meetingSlot: true,
      meetingLocation: true,
      meetingNotes: true,
    },
  })

  return ok(
    leads.map(l => {
      // Prefer the explicit meeting location; fall back to the lead's address.
      const addressParts = [l.address, l.city, l.state].filter(Boolean)
      const mapAddress = l.meetingLocation || addressParts.join(', ') || null
      return {
        id: l.id,
        lead_number: l.leadNumber,
        client_name: l.clientName,
        company: l.companyName,
        client_phone: l.clientPhone,
        client_email: l.clientEmail,
        status: l.status.toLowerCase(),
        meeting_date: l.meetingDate ? l.meetingDate.toISOString().slice(0, 10) : null,
        meeting_time: l.meetingTime || l.meetingSlot || null,
        // `address` is the human-readable string the app opens in Google Maps
        address: mapAddress,
        notes: l.meetingNotes || null,
      }
    })
  )
}
