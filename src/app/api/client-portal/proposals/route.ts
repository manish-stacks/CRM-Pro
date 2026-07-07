// src/app/api/client-portal/proposals/route.ts
// List proposals visible to the logged-in client: ones linked directly to the
// client, plus ones from the client's originating lead. Drafts are hidden.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientSession } from '@/lib/clientAuth'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(d: Date | null): string {
  if (!d) return '—'
  const dt = new Date(d)
  return `${MONTHS[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`
}
function fmtMoney(n: number): string {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`
}
// Map DB status → the app's compact status set
function mapStatus(s: string): string {
  switch (s) {
    case 'ACCEPTED': return 'accepted'
    case 'REJECTED': return 'rejected'
    case 'EXPIRED': return 'expired'
    default: return 'pending' // SENT, VIEWED
  }
}

export async function GET(req: NextRequest) {
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await prisma.client.findUnique({
    where: { id: session.clientId },
    select: { leadId: true },
  })

  const proposals = await prisma.proposal.findMany({
    where: {
      status: { not: 'DRAFT' },
      OR: [
        { clientId: session.clientId },
        ...(client?.leadId ? [{ leadId: client.leadId }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, proposalNumber: true, title: true,
      finalAmount: true, totalAmount: true, status: true,
      emailSentAt: true, whatsappSentAt: true, createdAt: true, notes: true,
    },
  })

  return NextResponse.json({
    data: proposals.map(p => ({
      id: p.id,
      number: p.proposalNumber,
      title: p.title,
      price: fmtMoney(p.finalAmount || p.totalAmount),
      sent: fmtDate(p.emailSentAt || p.whatsappSentAt || p.createdAt),
      status: mapStatus(p.status),
      desc: p.notes || '',
    })),
  })
}
