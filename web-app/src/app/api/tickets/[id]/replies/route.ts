// src/app/api/tickets/[id]/replies/route.ts
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

  const { body, isInternal = false, attachmentUrl, attachmentType } = await req.json()
  if (!body?.trim()) return errorResponse('Reply body required')

  const ticket = await prisma.supportTicket.findUnique({ where: { id } })
  if (!ticket) return notFoundResponse('Ticket')

  const reply = await prisma.supportTicketReply.create({
    data: {
      ticketId: id,
      userId: session.userId,
      body,
      isInternal: !!isInternal,
      attachmentUrl: attachmentUrl || null,
      attachmentType: attachmentType || null,
    },
    include: { user: { select: { name: true, avatar: true, role: true } } },
  })

  // Auto-progress OPEN → IN_PROGRESS on first reply
  if (ticket.status === 'OPEN') {
    await prisma.supportTicket.update({ where: { id }, data: { status: 'IN_PROGRESS' } })
  }

  await logFromRequest(req, {
    userId: session.userId, action: 'REPLY', entityType: 'SupportTicket', entityId: id,
  })

  // Notify the assignee always; the creator (client-user) only on non-internal replies
  const recipients = new Set<string>()
  if (ticket.assignedToId) recipients.add(ticket.assignedToId)
  if (!isInternal && ticket.userId) recipients.add(ticket.userId)
  recipients.delete(session.userId)
  if (recipients.size) {
    Notifications.supportTicketReply(Array.from(recipients), ticket.ticketNumber, id).catch(() => {})
  }

  return successStatusResponse(reply, 201)
}
