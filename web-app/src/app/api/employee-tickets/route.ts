// src/app/api/employee-tickets/route.ts
// Internal tickets from employees to dept heads (leave issue, hardware, etc.)
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, successStatusResponse, errorResponse, unauthorizedResponse, getPaginationParams } from '@/lib/api'
import { generateEmployeeTicketNumber } from '@/lib/idgen'
import { logFromRequest } from '@/lib/audit'
import { Notifications } from '@/lib/notify'

// Department ids a user belongs to: own department + any department they head.
// NOTE: Department.managerId references Employee.id (not User.id).
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
  const departmentId = searchParams.get('departmentId')
  const mode = searchParams.get('mode') // 'created' (raised by me) | 'assigned' (assigned to me) | 'all'

  const where: any = {}
  if (status) where.status = status
  if (departmentId) where.departmentId = departmentId

  if (mode === 'created') {
    where.createdById = session.userId
  } else if (mode === 'assigned') {
    where.assignedToId = session.userId
  } else if (!hasMinRole(session.role, 'ADMIN')) {
    // Default / 'all': my tickets + tickets addressed to any department I belong to
    // (dept members + head all see their department's tickets). Admin sees everything.
    const deptIds = await myDeptIds(session.userId)
    where.OR = [
      { createdById: session.userId },
      { assignedToId: session.userId },
      ...(deptIds.length ? [{ departmentId: { in: deptIds } }] : []),
    ]
  }

  const [tickets, total] = await Promise.all([
    prisma.employeeTicket.findMany({
      where, skip, take: limit,
      include: {
        createdBy: { select: { id: true, name: true, avatar: true, role: true } },
        assignedTo: { select: { id: true, name: true, avatar: true, role: true } },
        department: { select: { id: true, name: true, color: true } },
        _count: { select: { replies: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.employeeTicket.count({ where }),
  ])
  return successResponse(tickets, total)
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()
  if (session.role === 'CLIENT') return errorResponse('Forbidden', 403)

  const { subject, description, priority = 'MEDIUM', category, departmentId, assignedToId } = await req.json()

  if (!subject || !description) return errorResponse('Subject + description required')
  if (!departmentId) return errorResponse('departmentId required')

  const dept = await prisma.department.findUnique({
    where: { id: departmentId },
    include: { manager: { include: { user: { select: { id: true, name: true } } } } },
  })
  if (!dept) return errorResponse('Department not found', 404)

  // If no assignee, auto-assign to dept manager
  const finalAssignee = assignedToId || dept.manager?.user.id || null

  const ticket = await prisma.employeeTicket.create({
    data: {
      ticketNumber: await generateEmployeeTicketNumber(),
      createdById: session.userId,
      departmentId,
      assignedToId: finalAssignee,
      subject, description,
      priority,
      category: category || null,
      status: 'OPEN',
    },
    include: {
      department: { select: { name: true } },
      assignedTo: { select: { name: true } },
    },
  })

  await logFromRequest(req, {
    userId: session.userId,
    action: 'CREATE',
    entityType: 'EmployeeTicket',
    entityId: ticket.id,
    metadata: { ticketNumber: ticket.ticketNumber, departmentId },
  })

  // Notify the target department's head (assignee) + all its members, minus the raiser
  const deptMembers = await prisma.employee.findMany({
    where: { departmentId },
    select: { userId: true },
  })
  const recipients = new Set<string>()
  if (finalAssignee) recipients.add(finalAssignee)
  deptMembers.forEach(e => recipients.add(e.userId))
  recipients.delete(session.userId)
  if (recipients.size) {
    Notifications.employeeTicketRaised(Array.from(recipients), ticket.ticketNumber, subject, ticket.id).catch(() => {})
  }

  return successStatusResponse(ticket, 201)
}
