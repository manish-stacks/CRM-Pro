// src/app/api/mobile/assign-service/route.ts
// Assign a service/package to a client (creates a ClientService).
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { logFromRequest } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  let body: any = {}
  try { body = await req.json() } catch { return fail('Invalid body') }
  const { client_id, package_id, price, duration } = body

  if (!client_id) return fail('client_id required')
  if (!package_id) return fail('package_id required')

  const pkg = await prisma.serviceCatalog.findUnique({ where: { id: package_id } })
  if (!pkg) return fail('Package not found', 404)

  const client = await prisma.client.findUnique({ where: { id: client_id } })
  if (!client) return fail('Client not found', 404)

  // Compute expiry from billing cycle if a duration in months is given
  const start = new Date()
  let expiry: Date | null = null
  const months = duration ? parseInt(String(duration)) : (
    pkg.billingCycle === 'MONTHLY' ? 1 :
    pkg.billingCycle === 'QUARTERLY' ? 3 :
    pkg.billingCycle === 'YEARLY' ? 12 : 0
  )
  if (months > 0) {
    expiry = new Date(start)
    expiry.setMonth(expiry.getMonth() + months)
  }

  const svc = await prisma.clientService.create({
    data: {
      clientId: client_id,
      serviceName: pkg.name,
      departmentId: pkg.departmentId || null,
      status: 'ACTIVE',
      amount: price != null ? parseFloat(String(price)) : pkg.basePrice,
      startDate: start,
      expiryDate: expiry,
    },
  })

  await logFromRequest(req, {
    userId: session.userId, action: 'CREATE', entityType: 'ClientService', entityId: svc.id,
    metadata: { via: 'mobile', clientId: client_id, package: pkg.name },
  })

  return ok({ id: svc.id, serviceName: svc.serviceName, amount: svc.amount, expiryDate: svc.expiryDate })
}
