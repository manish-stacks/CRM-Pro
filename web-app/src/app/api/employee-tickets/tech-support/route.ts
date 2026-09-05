// src/app/api/employee-tickets/tech-support/route.ts
// Global "Tech Support" widget (visible on every page) — lets any employee
// report a CRM/software problem and have it land directly with the
// Super Admin(s), without picking a department. Reuses the EmployeeTicket
// table so it shows up in "My Tickets" like any other ticket.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successStatusResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { generateEmployeeTicketNumber } from '@/lib/idgen'
import { logFromRequest } from '@/lib/audit'
import { Notifications } from '@/lib/notify'

const DEPT_SLUG = 'tech-support'

async function getOrCreateTechSupportDept() {
  let dept = await prisma.department.findUnique({ where: { slug: DEPT_SLUG } })
  if (!dept) {
    dept = await prisma.department.create({
      data: {
        name: 'Tech Support',
        slug: DEPT_SLUG,
        description: 'CRM / software issues reported by employees, routed straight to Super Admin.',
        color: 'red',
        icon: 'LifeBuoy',
        isActive: true,
      },
    })
  }
  return dept
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()
  if (session.role === 'CLIENT') return errorResponse('Forbidden', 403)

  const { subject, description, priority = 'HIGH' } = await req.json()
  if (!description || !description.trim()) return errorResponse('Please describe the issue')

  const dept = await getOrCreateTechSupportDept()

  // Direct line to the app owner(s) — every Super Admin gets it.
  const superAdmins = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN', isActive: true },
    select: { id: true },
  })
  const finalAssignee = superAdmins[0]?.id || null

  const ticket = await prisma.employeeTicket.create({
    data: {
      ticketNumber: await generateEmployeeTicketNumber(),
      createdById: session.userId,
      departmentId: dept.id,
      assignedToId: finalAssignee,
      subject: subject?.trim() || 'CRM Tech Support Request',
      description,
      priority,
      category: 'CRM_TECH_SUPPORT',
      status: 'OPEN',
    },
  })

  await logFromRequest(req, {
    userId: session.userId,
    action: 'CREATE',
    entityType: 'EmployeeTicket',
    entityId: ticket.id,
    metadata: { ticketNumber: ticket.ticketNumber, techSupport: true },
  })

  const recipients = superAdmins.map((a: { id: string }) => a.id).filter((id: string) => id !== session.userId)
  if (recipients.length) {
    Notifications.employeeTicketRaised(recipients, ticket.ticketNumber, ticket.subject, ticket.id).catch(() => {})
  }

  return successStatusResponse(ticket, 201)
}
