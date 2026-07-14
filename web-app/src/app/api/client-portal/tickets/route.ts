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

  const { subject, description, priority = 'MEDIUM', category } = await req.json()
  if (!subject || !description) return NextResponse.json({ error: 'Subject + description required' }, { status: 400 })

  const client = await prisma.client.findUnique({
    where: { id: session.clientId },
    select: { id: true, telecallerId: true, marketingPersonId: true, reportingPersonId: true },
  })
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Auto-assign to reporting person (or marketing/telecaller as fallback)
  const assignedToId = client.reportingPersonId || client.marketingPersonId || client.telecallerId
  // Use client's linked user as "userId" — but since client is not a User, we need to use assignedToId or admin user
  // The schema requires User.id for `userId`. We'll use assignedToId as creator surrogate.
  const creatorUserId = assignedToId
  if (!creatorUserId) return NextResponse.json({ error: 'No staff assigned to client — cannot raise ticket' }, { status: 400 })

  const ticket = await prisma.supportTicket.create({
    data: {
      ticketNumber: await generateTicketNumber(),
      clientId: client.id,
      userId: creatorUserId,        // proxy — used to link the ticket to a staff-user record
      subject, description,
      priority,
      category: category || null,
      assignedToId,
      status: 'OPEN',
    },
  })
  return NextResponse.json({ data: ticket })
}
