import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientSession } from '@/lib/clientAuth'

export async function GET(req: NextRequest) {
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tickets = await prisma.supportTicket.findMany({ where: { clientId: session.clientId }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ data: tickets })
}

export async function POST(req: NextRequest) {
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { subject, description, priority } = await req.json()
  if (!subject || !description) return NextResponse.json({ error: 'Subject and description required' }, { status: 400 })

  const client = await prisma.client.findUnique({ where: { id: session.clientId } })
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Need a userId for the ticket — use client's assigned user or a system user
  const systemUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
  if (!systemUser) return NextResponse.json({ error: 'No admin found' }, { status: 500 })

  const ticket = await prisma.supportTicket.create({
    data: { clientId: session.clientId, userId: systemUser.id, subject, description, priority: priority || 'MEDIUM', status: 'OPEN' },
  })
  return NextResponse.json({ data: ticket })
}
