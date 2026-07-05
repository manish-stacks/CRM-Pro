// src/app/api/employee-tickets/[id]/replies/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successStatusResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { Notifications } from '@/lib/notify'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { body, attachmentUrl, attachmentType } = await req.json()
  if (!body?.trim()) return errorResponse('Reply body required')

  const ticket = await prisma.employeeTicket.findUnique({ where: { id } })
  if (!ticket) return notFoundResponse('Ticket')

  const reply = await prisma.employeeTicketReply.create({
    data: {
      ticketId: id,
      userId: session.userId,
      body,
      attachmentUrl: attachmentUrl || null,
      attachmentType: attachmentType || null,
    },
    include: { user: { select: { name: true, avatar: true, role: true } } },
  })

  if (ticket.status === 'OPEN') {
    await prisma.employeeTicket.update({ where: { id }, data: { status: 'IN_PROGRESS' } })
  }

  await logFromRequest(req, { userId: session.userId, action: 'REPLY', entityType: 'EmployeeTicket', entityId: id })

  // Notify the other party (creator + assignee), minus the replier
  const recipients = new Set<string>()
  if (ticket.createdById) recipients.add(ticket.createdById)
  if (ticket.assignedToId) recipients.add(ticket.assignedToId)
  recipients.delete(session.userId)
  if (recipients.size) {
    Notifications.employeeTicketReply(Array.from(recipients), ticket.ticketNumber, id).catch(() => {})
  }

  return successStatusResponse(reply, 201)
}
