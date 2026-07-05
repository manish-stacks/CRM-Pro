// src/app/api/tickets/route.ts
// Support tickets (client-facing) — admin/manager side
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, successStatusResponse, errorResponse, unauthorizedResponse, getPaginationParams } from '@/lib/api'
import { generateTicketNumber } from '@/lib/idgen'
import { logFromRequest } from '@/lib/audit'
import { Notifications } from '@/lib/notify'

// Department ids a user belongs to: own department + any department they head.
async function myDeptIds(userId: string): Promise<string[]> {
  const emp = await prisma.employee.findFirst({
    where: { userId },
    select: { id: true, departmentId: true },
  })
  const ids = new Set<string>()
  if (emp?.departmentId) ids.add(emp.departmentId)
  if (emp?.id) {
    const headed = await prisma.department.findMany({ where: { managerId: emp.id }, select: { id: true } })
    headed.forEach(d => ids.add(d.id))
  }
  return Array.from(ids)
}

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const { skip, limit } = getPaginationParams(searchParams)
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const departmentId = searchParams.get('departmentId')
  const assignedToId = searchParams.get('assignedToId')
  const clientId = searchParams.get('clientId')
  const search = searchParams.get('search')

  const where: any = {}
  if (status) where.status = status
  if (priority) where.priority = priority
  if (departmentId) where.departmentId = departmentId
  if (assignedToId) where.assignedToId = assignedToId
  if (clientId) where.clientId = clientId

  const and: any[] = []
  if (search) {
    and.push({
      OR: [
        { ticketNumber: { contains: search } },
        { subject: { contains: search } },
        { client: { clientName: { contains: search } } },
      ],
    })
  }

  // Role scope:
  // - Admin/Super: sees ALL tickets (triage inbox).
  // - Everyone else: only tickets routed to a department they belong to (member or head),
  //   or tickets assigned directly to them. So "admin triages → assigns dept → that dept handles".
  if (!hasMinRole(session.role, 'ADMIN')) {
    const deptIds = await myDeptIds(session.userId)
    const scope: any[] = [{ assignedToId: session.userId }]
    if (deptIds.length) scope.push({ departmentId: { in: deptIds } })
    and.push({ OR: scope })
  }
  if (and.length) where.AND = and

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where, skip, take: limit,
      include: {
        client: { select: { id: true, clientCode: true, clientName: true, companyName: true } },
        department: { select: { name: true, color: true } },
        assignedTo: { select: { id: true, name: true, avatar: true } },
        _count: { select: { replies: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.supportTicket.count({ where }),
  ])
  return successResponse(tickets, total)
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const body = await req.json()
  const {
    clientId, subject, description, priority = 'MEDIUM',
    category, departmentId, assignedToId,
  } = body

  if (!clientId || !subject || !description) return errorResponse('clientId, subject, description required')

  const ticket = await prisma.supportTicket.create({
    data: {
      ticketNumber: await generateTicketNumber(),
      clientId,
      userId: session.userId,
      subject, description,
      category: category || null,
      departmentId: departmentId || null,
      assignedToId: assignedToId || null,
      priority,
      status: 'OPEN',
    },
    include: {
      client: { select: { clientName: true, companyName: true } },
    },
  })

  await logFromRequest(req, {
    userId: session.userId,
    action: 'CREATE',
    entityType: 'SupportTicket',
    entityId: ticket.id,
    metadata: { ticketNumber: ticket.ticketNumber, clientId },
  })

  // Notify assignee
  if (assignedToId) {
    Notifications.ticketAssigned(assignedToId, ticket.ticketNumber, subject, ticket.id).catch(() => {})
  }
  return successStatusResponse(ticket, 201)
}
