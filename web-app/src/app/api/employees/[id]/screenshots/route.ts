// src/app/api/employees/[id]/screenshots/route.ts
// Admin-only viewer for an employee's captured tracker screenshots.
// Restricted to ADMIN / SUPER_ADMIN — managers and the employee themselves
// cannot see these, only the two admin roles.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, forbiddenResponse, getPaginationParams } from '@/lib/api'

const ALLOWED_ROLES = ['ADMIN', 'SUPER_ADMIN']

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session
  if (!ALLOWED_ROLES.includes(session.role)) return forbiddenResponse()

  const { id } = await params
  const employee = await prisma.employee.findUnique({ where: { id } })
  if (!employee) return errorResponse('Employee not found', 404)

  const { searchParams } = new URL(req.url)
  const { page, limit, skip } = getPaginationParams(searchParams)
  const date = searchParams.get('date') // YYYY-MM-DD, optional

  const where: any = { employeeId: id }
  if (date) {
    const start = new Date(`${date}T00:00:00.000Z`)
    const end = new Date(`${date}T23:59:59.999Z`)
    where.capturedAt = { gte: start, lte: end }
  }

  const [screenshots, total] = await Promise.all([
    prisma.trackerScreenshot.findMany({
      where,
      orderBy: { capturedAt: 'desc' },
      skip,
      take: limit,
      select: { id: true, url: true, capturedAt: true, sessionId: true },
    }),
    prisma.trackerScreenshot.count({ where }),
  ])

  return successResponse(screenshots, total)
}