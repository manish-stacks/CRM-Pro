// src/app/api/mobile/clients/[id]/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      services: {
        select: {
          id: true, serviceName: true, status: true,
          amount: true, startDate: true, expiryDate: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      visits: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, status: true, purpose: true, checkInAt: true, scheduledDate: true },
      },
    },
  })
  if (!client) return fail('Client not found', 404)

  return ok({
    id: client.id,
    name: client.clientName,
    company: client.companyName,
    phone: client.phone,
    email: client.email,
    address: client.address,
    city: client.city,
    status: client.status,
    client_code: client.clientCode,
    services: client.services,
    visits: client.visits,
  })
}
