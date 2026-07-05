import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientSession } from '@/lib/clientAuth'

export async function GET(req: NextRequest) {
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const services = await prisma.clientService.findMany({ where: { clientId: session.clientId }, orderBy: { expiryDate: 'asc' } })
  return NextResponse.json({ data: services })
}
