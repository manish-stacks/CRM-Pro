// src/app/api/leads/[id]/assign/route.ts
// Reassign a lead to another user. Manager+ only. Records history entry.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { Notifications } from '@/lib/notify'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'MANAGER')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { toUserId, reason } = await req.json()
  if (!toUserId) return errorResponse('toUserId required')

  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return notFoundResponse('Lead')

  const targetUser = await prisma.user.findUnique({
    where: { id: toUserId },
    select: { id: true, name: true, role: true, isActive: true },
  })
  if (!targetUser) return errorResponse('Target user not found', 404)
  if (!targetUser.isActive) return errorResponse('Cannot assign to a disabled user')

  const fromUserId = lead.assignedToId

  const [updated] = await prisma.$transaction([
    prisma.lead.update({
      where: { id },
      data: { assignedToId: toUserId },
      include: { assignedTo: { select: { name: true, role: true } } },
    }),
    prisma.leadAssignmentHistory.create({
      data: {
        leadId: id,
        fromUserId,
        toUserId,
        assignedById: session.userId,
        reason: reason || null,
      },
    }),
    prisma.leadActivity.create({
      data: {
        leadId: id,
        type: 'ASSIGNMENT',
        title: `Reassigned to ${targetUser.name}`,
        description: reason || null,
        createdById: session.userId,
      },
    }),
  ])

  await logFromRequest(req, {
    userId: session.userId,
    action: 'REASSIGN',
    entityType: 'Lead',
    entityId: id,
    metadata: { fromUserId, toUserId, reason },
  })

  Notifications.leadReassigned(toUserId, lead.leadNumber, id, reason).catch(() => {})

  return successResponse(updated)
}
