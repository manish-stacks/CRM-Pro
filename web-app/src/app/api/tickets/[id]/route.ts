// src/app/api/tickets/[id]/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { sendWhatsapp } from '@/lib/whatsapp'
import { Notifications } from '@/lib/notify'

const UPDATABLE = new Set(['subject', 'description', 'priority', 'category', 'departmentId', 'assignedToId', 'status', 'resolution'])

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, clientCode: true, clientName: true, companyName: true, phone: true, email: true } },
      department: { select: { id: true, name: true, color: true } },
      assignedTo: { select: { id: true, name: true, email: true, phone: true, avatar: true } },
      user: { select: { id: true, name: true, email: true, avatar: true, role: true } },
      replies: {
        include: { user: { select: { id: true, name: true, avatar: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!ticket) return notFoundResponse('Ticket')
  return successResponse(ticket)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const body = await req.json()
  const existing = await prisma.supportTicket.findUnique({
    where: { id }, include: { client: { select: { phone: true, clientName: true } } },
  })
  if (!existing) return notFoundResponse('Ticket')

  const data: Record<string, any> = {}
  for (const [k, v] of Object.entries(body)) {
    if (UPDATABLE.has(k)) data[k] = v === '' ? null : v
  }
  if (data.status === 'RESOLVED' || data.status === 'CLOSED') data.resolvedAt = new Date()

  // When routing to a department without an explicit assignee, auto-assign the dept head
  if (data.departmentId && (data.assignedToId === undefined || data.assignedToId === null)) {
    const dept = await prisma.department.findUnique({
      where: { id: data.departmentId },
      include: { manager: { select: { userId: true } } },
    })
    if (dept?.manager?.userId) data.assignedToId = dept.manager.userId
  }

  const updated = await prisma.supportTicket.update({ where: { id }, data })

  await logFromRequest(req, {
    userId: session.userId,
    action: 'UPDATE',
    entityType: 'SupportTicket',
    entityId: id,
    changes: data,
  })

  // Notify newly-assigned staff if assignee changed
  if (data.assignedToId && data.assignedToId !== existing.assignedToId) {
    Notifications.ticketAssigned(
      data.assignedToId, existing.ticketNumber, existing.subject, id
    ).catch(() => {})
  }

  // Fire WhatsApp if resolved
  if (data.status === 'RESOLVED' && existing.client.phone) {
    sendWhatsapp({
      toPhone: existing.client.phone,
      template: 'hbs_ticket_resolved',
      params: {
        clientName: existing.client.clientName,
        ticketNumber: existing.ticketNumber,
      },
      referenceType: 'TICKET',
      referenceId: id,
    }).catch(() => {})
  }
  return successResponse(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  await prisma.supportTicket.delete({ where: { id } })
  await logFromRequest(req, {
    userId: session.userId,
    action: 'DELETE',
    entityType: 'SupportTicket',
    entityId: id,
  })
  return successResponse({ deleted: true })
}
