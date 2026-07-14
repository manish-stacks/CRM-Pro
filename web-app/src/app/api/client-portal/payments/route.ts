import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientSession } from '@/lib/clientAuth'

export async function GET(req: NextRequest) {
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const invoices = await prisma.invoice.findMany({ where: { clientId: session.clientId }, include: { payments: true }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ data: invoices })
}
