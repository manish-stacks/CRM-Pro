// src/app/api/services/expiring/route.ts
// Services expiring in the next N days (default 30). Role-scoped:
//   admin/manager sees all; telecaller sees own clients; marketing sees own clients.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, unauthorizedResponse } from '@/lib/api'

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') || '30')

  const now = new Date()
  const cutoff = new Date(now); cutoff.setDate(now.getDate() + days)

  const where: any = {
    status: 'ACTIVE',
    expiryDate: { gte: now, lte: cutoff },
  }

  if (session.role === 'TELECALLER') {
    where.client = { telecallerId: session.userId }
  } else if (session.role === 'MARKETING_EXECUTIVE') {
    where.client = { marketingPersonId: session.userId }
  } else if (session.role === 'EMPLOYEE') {
    return successResponse([], 0)
  }

  const services = await prisma.clientService.findMany({
    where,
    include: {
      client: {
        select: {
          id: true, clientCode: true, clientName: true, companyName: true,
          phone: true, email: true,
          telecaller: { select: { id: true, name: true } },
          marketingPerson: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { expiryDate: 'asc' },
  })

  // Group by urgency
  const urgent: any[] = [], soon: any[] = []
  const in7 = new Date(now); in7.setDate(now.getDate() + 7)
  for (const s of services) {
    if (s.expiryDate! <= in7) urgent.push(s)
    else soon.push(s)
  }

  return successResponse({ urgent, soon, total: services.length, all: services })
}
