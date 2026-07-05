// src/app/api/services/route.ts
// Service catalog (ServiceCatalog table) — CRUD by admin
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, successStatusResponse, errorResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const isActive = searchParams.get('isActive')
  const search = searchParams.get('search')

  const where: any = {}
  if (category) where.category = category
  if (isActive !== null && isActive !== undefined && isActive !== '') {
    where.isActive = isActive === 'true'
  }
  if (search) where.name = { contains: search }

  const services = await prisma.serviceCatalog.findMany({
    where,
    orderBy: { name: 'asc' },
  })
  return successResponse(services, services.length)
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { name, description, category, departmentId, basePrice, billingCycle } = await req.json()
  if (!name) return errorResponse('Name required')

  const slug = slugify(name)
  const existing = await prisma.serviceCatalog.findFirst({
    where: { OR: [{ name }, { slug }] },
  })
  if (existing) return errorResponse('Service with this name already exists')

  const service = await prisma.serviceCatalog.create({
    data: {
      slug, name,
      description: description || null,
      category: category || null,
      departmentId: departmentId || null,
      basePrice: Number(basePrice) || 0,
      billingCycle: billingCycle || 'ONE_TIME',
      isActive: true,
    },
  })

  await logFromRequest(req, {
    userId: session.userId, action: 'CREATE', entityType: 'ServiceCatalog', entityId: service.id,
  })

  return successStatusResponse(service, 201)
}
