// src/app/api/mobile/meetings/[id]/route.ts
// Full detail for a single meeting (= a Lead assigned to this marketing exec).
// Mirrors the web /leads/[id] page but shaped for the mobile Meeting Detail screen.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true, phone: true } },
      meetingAssignedTo: { select: { id: true, name: true, phone: true } },
      client: { select: { id: true, clientCode: true } },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { createdBy: { select: { name: true } } },
      },
    },
  })
  if (!lead) return fail('Meeting not found', 404)

  // Only the assigned marketing exec (or whoever owns the lead) can view it
  const isOwner = [lead.assignedToId, lead.meetingAssignedToId, lead.createdById].includes(session.userId)
  if (!isOwner) return fail('Forbidden', 403)

  const addressParts = [lead.address, lead.city, lead.state].filter(Boolean)

  return ok({
    id: lead.id,
    lead_number: lead.leadNumber,
    client_name: lead.clientName,
    company: lead.companyName,
    client_phone: lead.clientPhone,
    client_email: lead.clientEmail,
    status: lead.status,
    address: lead.meetingLocation || addressParts.join(', ') || null,
    meeting_date: lead.meetingDate ? lead.meetingDate.toISOString().slice(0, 10) : null,
    meeting_time: lead.meetingTime || lead.meetingSlot || null,
    notes: lead.meetingNotes || null,
    service_pitched: lead.service || lead.productPitched || null,
    price: lead.price,
    client_id: lead.client?.id || null,
    client_code: lead.client?.clientCode || null,
    is_closed: ['CONVERTED', 'CLOSED', 'NOT_INTERESTED'].includes(lead.status),
    activities: lead.activities.map(a => ({
      id: a.id,
      type: a.type,
      title: a.title,
      description: a.description,
      created_by: a.createdBy?.name || null,
      created_at: a.createdAt,
    })),
  })
}