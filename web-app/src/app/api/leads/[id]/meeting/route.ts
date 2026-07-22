// src/app/api/leads/[id]/meeting/route.ts
// Schedule a meeting for a lead. Sets status = MEETING_SCHEDULED.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { sendWhatsapp } from '@/lib/whatsapp'
import { Notifications } from '@/lib/notify'
import { syncVisitForMeeting } from '@/lib/visitSync'
import { geocodeAddress } from '@/lib/distance'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { marketingExecId, meetingDate, meetingTime, meetingSlot, meetingLocation, meetingNotes } = await req.json()

  if (!marketingExecId) return errorResponse('marketingExecId required')
  if (!meetingDate) return errorResponse('meetingDate required')

  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return notFoundResponse('Lead')

  const canScheduleAny = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)
  const isOwner = lead.assignedToId === session.userId || lead.createdById === session.userId
  if (!canScheduleAny && !isOwner) return errorResponse('Forbidden', 403)

  const marketingExec = await prisma.user.findUnique({
    where: { id: marketingExecId },
    select: { id: true, name: true, role: true, phone: true, isActive: true },
  })
  if (!marketingExec) return errorResponse('Marketing person not found', 404)
  if (!marketingExec.isActive) return errorResponse('Cannot assign to a disabled user')
  if (!['MARKETING_EXECUTIVE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(marketingExec.role)) {
    return errorResponse('Assignee must be a MARKETING_EXECUTIVE (or higher)')
  }

  const md = new Date(meetingDate)

  // Geocode the meeting location once and store it — ETA/distance in the app ("you're 8 km, ~24 min from here") is calculated from this lat/lng.
  const geoSource = meetingLocation || [lead.address, lead.city, lead.state].filter(Boolean).join(', ')
  const locationChanged = (meetingLocation || null) !== (lead.meetingLocation || null)
  let geo: { lat: number; lng: number } | null = null
  if (geoSource && (locationChanged || lead.meetingLat == null)) {
    geo = await geocodeAddress(geoSource)
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      status: 'MEETING_SCHEDULED',
      meetingDate: md,
      meetingTime: meetingTime || null,
      meetingSlot: meetingSlot || null,
      meetingLocation: meetingLocation || null,
      meetingNotes: meetingNotes || null,
      meetingAssignedToId: marketingExecId,
      ...(geo ? { meetingLat: geo.lat, meetingLng: geo.lng } : {}),
      ...(locationChanged && !geo ? { meetingLat: null, meetingLng: null } : {}),
    },
    include: { meetingAssignedTo: { select: { name: true, phone: true } } },
  })

  await prisma.leadActivity.create({
    data: {
      leadId: id,
      type: 'MEETING_SCHEDULED',
      title: `Meeting scheduled with ${marketingExec.name}`,
      description: meetingNotes || null,
      fromStatus: lead.status,
      toStatus: 'MEETING_SCHEDULED',
      nextActionDate: md,
      nextActionTime: meetingTime || null,
      metadata: JSON.stringify({ slot: meetingSlot, location: meetingLocation, execId: marketingExecId }),
      createdById: session.userId,
    },
  })

  if (lead.clientPhone) {
    sendWhatsapp({
      toPhone: lead.clientPhone,
      template: 'hbs_lead_meeting_scheduled',
      params: {
        clientName: lead.clientName,
        meetingDate: md.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
        meetingTime: meetingTime || meetingSlot || 'TBD',
        marketingPersonName: marketingExec.name,
        marketingPhone: marketingExec.phone || '',
      },
      referenceType: 'LEAD',
      referenceId: id,
    }).catch(() => {})
  }

  // Auto-create / update the visit-sheet entry for this marketing exec
  const visit = await syncVisitForMeeting(
    {
      id: updated.id,
      clientName: updated.clientName,
      companyName: updated.companyName,
      meetingAssignedToId: updated.meetingAssignedToId,
      meetingDate: updated.meetingDate,
      meetingTime: updated.meetingTime,
      meetingSlot: updated.meetingSlot,
      meetingLocation: updated.meetingLocation,
      meetingNotes: updated.meetingNotes,
    },
    session.userId
  )

  // In-app + FCM/Expo push. MUST be awaited — fire-and-forget production will not work because the request is torn down before the push is sent. (The notification is sent in a separate thread, so it can outlive the request.)

  const whenTxt = `${md.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}${meetingSlot ? ` (${meetingSlot})` : meetingTime ? ` (${meetingTime})` : ''}`
  try {
    await Notifications.meetingScheduled(marketingExecId, lead.clientName, whenTxt, id)
    if (visit) await Notifications.visitAssigned(marketingExecId, lead.clientName, whenTxt, visit.id)
  } catch (e) {
    console.error('Meeting notify failed:', e)
  }

  await logFromRequest(req, {
    userId: session.userId,
    action: 'SCHEDULE_MEETING',
    entityType: 'Lead',
    entityId: id,
    metadata: { marketingExecId, meetingDate: md, meetingSlot },
  })

  return successResponse(updated)
}
