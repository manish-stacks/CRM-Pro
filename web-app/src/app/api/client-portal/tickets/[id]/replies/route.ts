// src/app/api/client-portal/tickets/[id]/replies/route.ts
// Client posts a reply on their own ticket.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientSession } from '@/lib/clientAuth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { body } = await req.json()
  if (!body?.trim()) return NextResponse.json({ error: 'Body required' }, { status: 400 })

  // Verify ticket belongs to this client
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, clientId: session.clientId },
  })
  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

  // Client replies get logged under ticket.userId (their client creator user)
  const reply = await prisma.supportTicketReply.create({
    data: {
      ticketId: id,
      userId: ticket.userId,   // The staff user this client is linked through — client's replies show as "from client"
      body: `[FROM CLIENT] ${body}`,
      isInternal: false,
    },
  })

  // Reopen if closed/resolved
  if (['RESOLVED', 'CLOSED'].includes(ticket.status)) {
    await prisma.supportTicket.update({ where: { id }, data: { status: 'REOPENED' } })
  }
  return NextResponse.json({ data: reply })
}
