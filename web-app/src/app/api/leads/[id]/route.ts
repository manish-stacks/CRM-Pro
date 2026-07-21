// src/app/api/leads/[id]/route.ts
// GET: rich lead detail with activity timeline + assignment history
// PATCH: update basic fields OR change status
// DELETE: admin only
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

const VALID_STATUSES = ['NEW', 'NOT_INTERESTED', 'FOLLOW_UP', 'RINGING', 'MEETING_SCHEDULED', 'MEETING_DONE', 'CALLBACK', 'CONVERTED', 'CLOSED']

// Fields that can be updated on the lead (non-status)
const UPDATABLE = new Set([
  'companyName', 'clientName', 'clientPhone', 'clientEmail', 'alternatePhone',
  'link', 'address', 'city', 'state', 'source', 'service', 'productPitched',
  'price', 'remark', 'notes',
  'followUpDate', 'followUpTime',
])

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true, role: true } },
      assignedTo: { select: { id: true, name: true, email: true, phone: true, role: true } },
      meetingAssignedTo: { select: { id: true, name: true, email: true, phone: true, role: true } },
      proposals: {
        select: { id: true, proposalNumber: true, title: true, finalAmount: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
      client: { select: { id: true, clientCode: true, companyName: true } },
      activities: {
        include: { createdBy: { select: { name: true, avatar: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      assignmentHistory: {
        include: {
          fromUser: { select: { name: true } },
          toUser: { select: { name: true } },
          assignedBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!lead) return notFoundResponse('Lead')

  // Role-based access check
  const canSeeAny = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)
  const isOwner =
    lead.assignedToId === session.userId ||
    lead.meetingAssignedToId === session.userId ||
    lead.createdById === session.userId
  if (!canSeeAny && !isOwner) return errorResponse('Forbidden', 403)

  return successResponse(lead)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const body = await req.json()
  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return notFoundResponse('Lead')

  // Access check
  const canEditAny = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)
  const isOwner =
    lead.assignedToId === session.userId ||
    lead.meetingAssignedToId === session.userId
  if (!canEditAny && !isOwner) return errorResponse('Forbidden', 403)

  const data: Record<string, any> = {}
  for (const [k, v] of Object.entries(body)) {
    if (UPDATABLE.has(k)) data[k] = v === '' ? null : v
  }

  if (data.clientEmail) data.clientEmail = String(data.clientEmail).toLowerCase()
  if (data.followUpDate) data.followUpDate = new Date(data.followUpDate)
  if (data.price !== undefined) data.price = data.price ? Number(data.price) : null

  // Status change is separate — go through PATCH with `status` in body
  const statusChange = body.status && VALID_STATUSES.includes(body.status) && body.status !== lead.status
  if (statusChange) {
    data.status = body.status
    // Clear meeting fields when moving away from MEETING_SCHEDULED
    if (lead.status === 'MEETING_SCHEDULED' && body.status !== 'MEETING_SCHEDULED') {
      // don't clear — meeting history is valuable
    }
    if (body.status === 'CONVERTED') data.convertedAt = new Date()
    if (body.status === 'CLOSED' || body.status === 'NOT_INTERESTED') {
      data.closedAt = new Date()
      if (body.closeReason) data.closeReason = body.closeReason
    }
  }

  try {
    const updated = await prisma.lead.update({ where: { id }, data })

    // Log activity for status change
    if (statusChange) {
      await prisma.leadActivity.create({
        data: {
          leadId: id,
          type: 'STATUS_CHANGE',
          title: `Status changed: ${lead.status} → ${body.status}`,
          description: body.statusNote || null,
          fromStatus: lead.status,
          toStatus: body.status,
          createdById: session.userId,
        },
      })
    }
    // Log follow-up if new followUpDate set
    if (data.followUpDate && (!lead.followUpDate || lead.followUpDate.getTime() !== data.followUpDate.getTime())) {
      await prisma.leadActivity.create({
        data: {
          leadId: id,
          type: 'FOLLOWUP_SCHEDULED',
          title: 'Follow-up scheduled',
          description: body.remark || null,
          nextActionDate: data.followUpDate,
          nextActionTime: data.followUpTime || null,
          createdById: session.userId,
        },
      })
    }

    await logFromRequest(req, {
      userId: session.userId,
      action: statusChange ? 'STATUS_CHANGE' : 'UPDATE',
      entityType: 'Lead',
      entityId: id,
      changes: data,
    })

    return successResponse(updated)
  } catch (e: any) {
    console.error('Lead patch error:', e)
    return errorResponse(e.message || 'Update failed')
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return notFoundResponse('Lead')

  try {
    await prisma.lead.delete({ where: { id } })
    await logFromRequest(req, {
      userId: session.userId,
      action: 'DELETE',
      entityType: 'Lead',
      entityId: id,
      metadata: { leadNumber: lead.leadNumber },
    })
    return successResponse({ deleted: true })
  } catch (e: any) {
    return errorResponse(e.message || 'Delete failed')
  }
}
