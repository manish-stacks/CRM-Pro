import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientSession } from '@/lib/clientAuth'

export async function GET(req: NextRequest) {
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await prisma.client.findUnique({ where: { id: session.clientId } })
  if (!client) return NextResponse.json({ data: [] })

  // Get the assigned/reporting user id
  const partnerId = client.reportingPersonId || client.assignedToId
  if (!partnerId) return NextResponse.json({ data: [] })

  // Find messages between client user and partner
  const clientUser = client.userId
  const messages = clientUser ? await prisma.message.findMany({
    where: { OR: [{ senderId: clientUser, receiverId: partnerId }, { senderId: partnerId, receiverId: clientUser }] },
    include: { sender: { select: { name: true, role: true } } },
    orderBy: { createdAt: 'asc' },
    take: 100,
  }) : []

  // Mark isFromClient for UI
  const enriched = messages.map(m => ({ ...m, isFromClient: m.senderId === clientUser }))
  return NextResponse.json({ data: enriched })
}

export async function POST(req: NextRequest) {
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { content } = await req.json()
  if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 })

  const client = await prisma.client.findUnique({ where: { id: session.clientId } })
  if (!client?.userId) return NextResponse.json({ error: 'Client has no user account' }, { status: 400 })

  const partnerId = client.reportingPersonId || client.assignedToId
  if (!partnerId) return NextResponse.json({ error: 'No assigned person to chat with' }, { status: 400 })

  const msg = await prisma.message.create({
    data: { senderId: client.userId, receiverId: partnerId, content },
    include: { sender: { select: { name: true } } },
  })
  return NextResponse.json({ data: { ...msg, isFromClient: true } })
}
