// src/app/api/departments/route.ts
// Phase 2: full CRUD with manager info + employee count
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, getRequestSession } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

// Slugify a name for URL / lookup use
function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' },
    include: {
      manager: {
        include: {
          user: { select: { id: true, name: true, email: true, avatar: true } },
        },
      },
      _count: { select: { employees: true } },
    },
  })

  return successResponse(departments, departments.length)
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { name, description, color, icon, managerId } = await req.json()
  if (!name) return errorResponse('Department name required')

  const slug = slugify(name)

  const existing = await prisma.department.findFirst({
    where: { OR: [{ name }, { slug }] },
  })
  if (existing) return errorResponse('Department with this name already exists')

  const dept = await prisma.department.create({
    data: {
      name, slug,
      description: description || null,
      color: color || 'blue',
      icon: icon || 'Building2',
      managerId: managerId || null,
    },
    include: {
      manager: { include: { user: { select: { name: true } } } },
      _count: { select: { employees: true } },
    },
  })

  if (managerId) {
    await prisma.departmentManagerHistory.create({
      data: {
        departmentId: dept.id,
        managerId,
        assignedById: session.userId,
        reason: 'Initial assignment on department creation',
      },
    })
  }

  await logFromRequest(req, {
    userId: session.userId,
    action: 'CREATE',
    entityType: 'Department',
    entityId: dept.id,
    metadata: { name, managerId },
  })

  return successResponse(dept)
}
