// src/app/api/projects/route.ts
// Project assignments — connect client-service → dept manager → team members
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, successStatusResponse, errorResponse, unauthorizedResponse, getPaginationParams } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { Notifications } from '@/lib/notify'

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const { skip, limit } = getPaginationParams(searchParams)
  const clientId = searchParams.get('clientId')
  const clientServiceId = searchParams.get('clientServiceId')
  const memberId = searchParams.get('memberId')
  const managerId = searchParams.get('managerId')
  const departmentId = searchParams.get('departmentId')
  const isActive = searchParams.get('isActive')

  const where: any = {}
  if (clientServiceId) where.clientServiceId = clientServiceId
  if (memberId) where.memberId = memberId
  if (managerId) where.managerId = managerId
  if (isActive !== null && isActive !== undefined && isActive !== '') where.isActive = isActive === 'true'
  if (clientId) where.clientService = { clientId }
  if (departmentId) where.clientService = { ...(where.clientService || {}), departmentId }

  // Role scope
  if (session.role === 'EMPLOYEE') {
    where.memberId = session.userId
  } else if (session.role === 'MANAGER') {
    where.OR = [
      { managerId: session.userId },
      { memberId: session.userId },
    ]
  } else if (['TELECALLER', 'MARKETING_EXECUTIVE'].includes(session.role) && !hasMinRole(session.role, 'MANAGER')) {
    // Only see projects for their assigned clients
    const clients = await prisma.client.findMany({
      where: session.role === 'TELECALLER'
        ? { telecallerId: session.userId }
        : { marketingPersonId: session.userId },
      select: { id: true },
    })
    where.clientService = { ...(where.clientService || {}), clientId: { in: clients.map(c => c.id) } }
  }

  const [assignments, total] = await Promise.all([
    prisma.projectAssignment.findMany({
      where, skip, take: limit,
      include: {
        clientService: {
          include: {
            client: { select: { id: true, clientCode: true, clientName: true, companyName: true } },
            department: { select: { id: true, name: true, color: true } },
          },
        },
        manager: { select: { id: true, name: true, avatar: true, role: true } },
        member:  { select: { id: true, name: true, avatar: true, role: true } },
      },
      orderBy: { assignedAt: 'desc' },
    }),
    prisma.projectAssignment.count({ where }),
  ])
  return successResponse(assignments, total)
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  if (!hasMinRole(session.role, 'MANAGER')) return errorResponse('Forbidden', 403)

  const body = await req.json()
  const { clientServiceId, managerId, memberIds = [], role = 'MEMBER' } = body

  if (!clientServiceId) return errorResponse('clientServiceId required')
  if (!managerId && memberIds.length === 0) return errorResponse('Either managerId or memberIds required')

  const svc = await prisma.clientService.findUnique({
    where: { id: clientServiceId },
    include: { client: { select: { clientName: true, companyName: true } } },
  })
  if (!svc) return errorResponse('Service not found', 404)

  const created: any[] = []

  // Manager slot
  if (managerId) {
    // Deactivate previous active manager assignment (max 1 active manager per service)
    await prisma.projectAssignment.updateMany({
      where: { clientServiceId, managerId: { not: null }, isActive: true, memberId: null },
      data: { isActive: false, removedAt: new Date() },
    })
    const a = await prisma.projectAssignment.create({
      data: { clientServiceId, managerId, role: 'MANAGER', isActive: true },
      include: {
        manager: { select: { name: true, role: true } },
      },
    })
    created.push(a)
  }

  // Members
  for (const mid of memberIds) {
    // Skip if already active
    const existing = await prisma.projectAssignment.findFirst({
      where: { clientServiceId, memberId: mid, isActive: true },
    })
    if (existing) continue

    const a = await prisma.projectAssignment.create({
      data: { clientServiceId, memberId: mid, role, isActive: true },
      include: {
        member: { select: { name: true, role: true } },
      },
    })
    created.push(a)
  }

  await logFromRequest(req, {
    userId: session.userId,
    action: 'CREATE',
    entityType: 'ProjectAssignment',
    metadata: {
      clientServiceId,
      serviceName: svc.serviceName,
      clientName: svc.client.clientName,
      managerId,
      memberIds,
    },
  })

  // Notify the assigned head + members (skip the person doing the assigning)
  if (managerId && managerId !== session.userId) {
    Notifications.projectAssignedManager(managerId, svc.serviceName, svc.client.clientName, svc.clientId).catch(() => {})
  }
  const memberRecipients = memberIds.filter((m: string) => m && m !== session.userId)
  if (memberRecipients.length) {
    Notifications.projectAssignedMember(memberRecipients, svc.serviceName, svc.client.clientName, svc.clientId).catch(() => {})
  }

  return successStatusResponse({ created, count: created.length }, 201)
}
