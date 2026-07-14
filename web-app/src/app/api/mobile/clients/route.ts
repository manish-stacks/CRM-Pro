// src/app/api/mobile/clients/route.ts
// List clients owned by this marketing person + create new client.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { generateClientCode } from '@/lib/idgen'
import { logFromRequest } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { marketingPersonId: session.userId },
        { reportingPersonId: session.userId },
        { telecallerId: session.userId },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, clientCode: true, clientName: true, companyName: true,
      phone: true, email: true, city: true, status: true, createdAt: true,
      _count: { select: { services: true } },
    },
  })

  return ok(clients.map(c => ({
    id: c.id,
    client_code: c.clientCode,
    name: c.clientName,
    company: c.companyName,
    phone: c.phone,
    email: c.email,
    city: c.city,
    status: c.status,
    services_count: c._count.services,
    created_at: c.createdAt,
  })))
}

export async function POST(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  let body: any = {}
  try { body = await req.json() } catch { return fail('Invalid body') }
  const { name, phone, email, company, address } = body

  if (!name?.trim()) return fail('Name is required')
  if (!phone?.trim()) return fail('Phone is required')

  const client = await prisma.client.create({
    data: {
      clientCode: await generateClientCode(),
      clientName: name.trim(),
      companyName: (company || name).trim(),
      phone: phone.trim(),
      email: email?.trim() || null,
      address: address?.trim() || null,
      status: 'ACTIVE',
      marketingPersonId: session.userId,
      reportingPersonId: session.userId,
    },
  })

  await logFromRequest(req, {
    userId: session.userId, action: 'CREATE', entityType: 'Client', entityId: client.id,
    metadata: { via: 'mobile', clientName: client.clientName },
  })

  return ok({
    id: client.id,
    name: client.clientName,
    company: client.companyName,
    phone: client.phone,
    client_code: client.clientCode,
  })
}
