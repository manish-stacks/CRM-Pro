// src/app/api/client-portal/proposals/[id]/respond/route.ts
// Client accepts or rejects a proposal from the app.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientSession } from '@/lib/clientAuth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  let body: any = {}
  try { body = await req.json() } catch {}
  const action = String(body?.action || '').toLowerCase()
  if (action !== 'accept' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be "accept" or "reject"' }, { status: 400 })
  }

  const client = await prisma.client.findUnique({
    where: { id: session.clientId },
    select: { leadId: true },
  })

  // Proposal must belong to this client (directly or via their lead)
  const proposal = await prisma.proposal.findFirst({
    where: {
      id,
      OR: [
        { clientId: session.clientId },
        ...(client?.leadId ? [{ leadId: client.leadId }] : []),
      ],
    },
  })
  if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })

  if (proposal.status === 'ACCEPTED' || proposal.status === 'REJECTED') {
    return NextResponse.json({ error: 'This proposal has already been responded to.' }, { status: 400 })
  }

  const status = action === 'accept' ? 'ACCEPTED' : 'REJECTED'
  await prisma.proposal.update({
    where: { id: proposal.id },
    data: { status, respondedAt: new Date() },
  })

  return NextResponse.json({ success: true, status })
}
