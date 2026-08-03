// src/app/api/client-portal/tickets/route.ts
// Client-side: view + raise tickets
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientSession } from '@/lib/clientAuth'
import { generateTicketNumber } from '@/lib/idgen'

export async function GET(req: NextRequest) {
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tickets = await prisma.supportTicket.findMany({
    where: { clientId: session.clientId },
    include: {
      assignedTo: { select: { name: true, avatar: true } },
      department: { select: { name: true } },
      replies: {
        where: { isInternal: false },
        include: { user: { select: { name: true, avatar: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ data: tickets })
}

export async function POST(req: NextRequest) {
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subject, description, priority = 'MEDIUM', clientServiceId } = await req.json()
  if (!subject || !description) return NextResponse.json({ error: 'Subject + description required' }, { status: 400 })

  const client = await prisma.client.findUnique({
    where: { id: session.clientId },
    select: { id: true, telecallerId: true, marketingPersonId: true, reportingPersonId: true },
  })
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  let service: { id: string, serviceName: string, category: string | null } | null = null
  let assignedToId: string | null = null

  if (clientServiceId) {
    service = await prisma.clientService.findFirst({
      where: { id: clientServiceId, clientId: client.id },
      select: { id: true, serviceName: true, category: true },
    })
    if (service) {
      // Whoever is actually working this service lands the ticket on their
      // dashboard — prefer the team lead/manager over a regular member.
      const assignments = await prisma.projectAssignment.findMany({
        where: { clientServiceId: service.id, isActive: true },
      })
      const lead = assignments.find(a => a.role === 'MANAGER' || a.role === 'LEAD')
      assignedToId = lead?.managerId || lead?.memberId || assignments[0]?.managerId || assignments[0]?.memberId || null
    }
  }

  // Fall back to the client's overall reporting/marketing/telecaller staff
  // if the service has nobody assigned yet (or no service was picked).
  if (!assignedToId) {
    assignedToId = client.reportingPersonId || client.marketingPersonId || client.telecallerId
  }
  // Use client's linked user as "userId" — but since client is not a User, we need to use assignedToId or admin user
  // The schema requires User.id for `userId`. We'll use assignedToId as creator surrogate.
  const creatorUserId = assignedToId
  if (!creatorUserId) return NextResponse.json({ error: 'No staff assigned to client — cannot raise ticket' }, { status: 400 })

  const ticket = await prisma.supportTicket.create({
    data: {
      ticketNumber: await generateTicketNumber(),
      clientId: client.id,
      clientServiceId: service?.id || null,
      userId: creatorUserId,        // proxy — used to link the ticket to a staff-user record
      subject, description,
      priority,
      category: service?.category || service?.serviceName || null,
      assignedToId,
      status: 'OPEN',
    },
  })
  return NextResponse.json({ data: ticket })
}
