// src/app/api/client-portal/reports/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientSession } from '@/lib/clientAuth'

export async function GET(req: NextRequest) {
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const reports = await prisma.clientReport.findMany({
    where: { clientId: session.clientId },
    include: {
      uploadedBy: { select: { name: true, avatar: true, role: true } },
      clientService: { select: { serviceName: true } },
    },
    orderBy: { reportDate: 'desc' },
  })
  return NextResponse.json({ data: reports })
}
