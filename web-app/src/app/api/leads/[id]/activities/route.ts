// src/app/api/leads/[id]/activities/route.ts
// Multi-record per lead — call attempts, remarks, follow-up reminders
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, successStatusResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

const VALID_TYPES = ['CALL', 'REMARK', 'FOLLOWUP_SCHEDULED', 'STATUS_CHANGE', 'MEETING_SCHEDULED', 'ASSIGNMENT', 'NOTE', 'EMAIL', 'WHATSAPP']

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const lead = await prisma.lead.findUnique({ where: { id }, select: { id: true, assignedToId: true, meetingAssignedToId: true, createdById: true } })
  if (!lead) return notFoundResponse('Lead')

  const canSeeAny = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)
  const isOwner = [lead.assignedToId, lead.meetingAssignedToId, lead.createdById].includes(session.userId)
  if (!canSeeAny && !isOwner) return errorResponse('Forbidden', 403)

  const activities = await prisma.leadActivity.findMany({
    where: { leadId: id },
    include: { createdBy: { select: { name: true, avatar: true, role: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return successResponse(activities)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return notFoundResponse('Lead')

  const canEditAny = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)
  const isOwner = [lead.assignedToId, lead.meetingAssignedToId, lead.createdById].includes(session.userId)
  if (!canEditAny && !isOwner) return errorResponse('Forbidden', 403)

  const { type, title, description, nextActionDate, nextActionTime, metadata } = await req.json()
  if (!type || !VALID_TYPES.includes(type)) return errorResponse('Invalid activity type')
  if (!title || !title.trim()) return errorResponse('Title required')

  const activity = await prisma.leadActivity.create({
    data: {
      leadId: id,
      type,
      title: title.trim(),
      description: description || null,
      nextActionDate: nextActionDate ? new Date(nextActionDate) : null,
      nextActionTime: nextActionTime || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdById: session.userId,
    },
    include: { createdBy: { select: { name: true, avatar: true } } },
  })

  // Sync lead's followUpDate/Time if this activity schedules one
  const updateLead: any = {}
  if (type === 'FOLLOWUP_SCHEDULED' && nextActionDate) {
    updateLead.followUpDate = new Date(nextActionDate)
    if (nextActionTime) updateLead.followUpTime = nextActionTime
    if (['NEW', 'RINGING'].includes(lead.status)) updateLead.status = 'FOLLOW_UP'
  }
  if (Object.keys(updateLead).length) {
    await prisma.lead.update({ where: { id }, data: updateLead })
  }

  await logFromRequest(req, {
    userId: session.userId,
    action: 'CREATE',
    entityType: 'LeadActivity',
    entityId: activity.id,
    metadata: { leadId: id, type },
  })

  return successStatusResponse(activity, 201)
}
