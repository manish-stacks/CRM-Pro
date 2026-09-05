// src/app/api/projects/[id]/route.ts
// Remove an assignment (mark inactive), delete outright, or REASSIGN it to a
// different person. Admin can swap the project head or a member at any time.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hasMinRole } from '@/lib/auth'
import { successResponse, notFoundResponse, errorResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { Notifications } from '@/lib/notify'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'MANAGER')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const a = await prisma.projectAssignment.findUnique({
    where: { id },
    include: {
      clientService: {
        select: {
          id: true, serviceName: true, clientId: true,
          client: { select: { clientName: true, companyName: true } },
        },
      },
    },
  })
  if (!a) return notFoundResponse('Assignment')

  const { managerId, memberId, role, isActive } = await req.json()

  // Only ADMIN+ may swap the project head. A MANAGER can swap members.
  const isHeadRow = !!a.managerId
  if (isHeadRow && managerId !== undefined && !hasMinRole(session.role, 'ADMIN')) {
    return errorResponse('Only an admin can change the project head', 403)
  }

  const data: any = {}

  if (managerId !== undefined && isHeadRow) {
    if (!managerId) return errorResponse('Pick a person')
    // Keep max one active head per service
    await prisma.projectAssignment.updateMany({
      where: {
        clientServiceId: a.clientServiceId,
        memberId: null,
        isActive: true,
        id: { not: id },
      },
      data: { isActive: false, removedAt: new Date() },
    })
    data.managerId = managerId
    data.isActive = true
    data.removedAt = null
    data.assignedAt = new Date()
  }

  if (memberId !== undefined && !isHeadRow) {
    if (!memberId) return errorResponse('Pick a person')
    const clash = await prisma.projectAssignment.findFirst({
      where: { clientServiceId: a.clientServiceId, memberId, isActive: true, id: { not: id } },
      select: { id: true },
    })
    if (clash) return errorResponse('That person is already on this project')
    data.memberId = memberId
    data.isActive = true
    data.removedAt = null
    data.assignedAt = new Date()
  }

  if (role !== undefined) data.role = role
  if (isActive !== undefined) {
    data.isActive = !!isActive
    data.removedAt = isActive ? null : new Date()
  }

  if (!Object.keys(data).length) return errorResponse('Nothing to update')

  const updated = await prisma.projectAssignment.update({
    where: { id },
    data,
    include: {
      manager: { select: { id: true, name: true, avatar: true, role: true } },
      member: { select: { id: true, name: true, avatar: true, role: true } },
    },
  })

  await logFromRequest(req, {
    userId: session.userId,
    action: 'UPDATE',
    entityType: 'ProjectAssignment',
    entityId: id,
    changes: data,
    metadata: {
      serviceName: a.clientService.serviceName,
      clientName: a.clientService.client.clientName,
      previousManagerId: a.managerId,
      previousMemberId: a.memberId,
    },
  })

  // Notify whoever just picked up the project
  const svc = a.clientService
  if (data.managerId && data.managerId !== session.userId) {
    Notifications.projectAssignedManager(data.managerId, svc.serviceName, svc.client.clientName, svc.clientId).catch(() => { })
  }
  if (data.memberId && data.memberId !== session.userId) {
    Notifications.projectAssignedMember([data.memberId], svc.serviceName, svc.client.clientName, svc.clientId).catch(() => { })
  }

  return successResponse(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'MANAGER')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const a = await prisma.projectAssignment.findUnique({ where: { id } })
  if (!a) return notFoundResponse('Assignment')

  const { searchParams } = new URL(req.url)
  const hard = searchParams.get('hard') === 'true'

  if (hard) {
    await prisma.projectAssignment.delete({ where: { id } })
  } else {
    await prisma.projectAssignment.update({
      where: { id },
      data: { isActive: false, removedAt: new Date() },
    })
  }

  await logFromRequest(req, {
    userId: session.userId,
    action: hard ? 'DELETE' : 'DEACTIVATE',
    entityType: 'ProjectAssignment',
    entityId: id,
  })

  return successResponse({ ok: true })
}
