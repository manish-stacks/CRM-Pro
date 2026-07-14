// src/app/api/mobile/packages/route.ts
// Service catalog for the "assign package" step.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok } from '@/lib/mobileAuth'

export async function GET(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res

  const packages = await prisma.serviceCatalog.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, basePrice: true, billingCycle: true, category: true },
  })

  return ok(packages.map(p => ({
    id: p.id,
    package_name: p.name,
    price: p.basePrice,
    billing_cycle: p.billingCycle,
    category: p.category,
  })))
}
