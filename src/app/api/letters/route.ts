// src/app/api/letters/route.ts
// HR Letters — Offer Letter, Salary Revision Letter, Relieving & Experience Letter.
// Only ADMIN/SUPER_ADMIN can generate or list these.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, getPaginationParams } from '@/lib/api'
import { logActivity } from '@/lib/audit'

export const LETTER_TYPES = ['OFFER', 'SALARY_REVISION', 'RELIEVING_EXPERIENCE'] as const

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()
  if (!hasMinRole(session.role, 'ADMIN')) return forbiddenResponse()

  const { searchParams } = new URL(req.url)
  const { skip, limit } = getPaginationParams(searchParams)
  const employeeId = searchParams.get('employeeId') || undefined
  const type = searchParams.get('type') || undefined
  const search = searchParams.get('search') || undefined

  const where: any = {}
  if (employeeId) where.employeeId = employeeId
  if (type) where.type = type
  if (search) {
    where.employee = {
      OR: [
        { user: { name: { contains: search } } },
        { user: { email: { contains: search } } },
        { employeeId: { contains: search } },
      ],
    }
  }

  const [letters, total] = await Promise.all([
    prisma.letter.findMany({
      where,
      include: {
        employee: { include: { user: { select: { name: true, email: true } }, department: { select: { name: true } } } },
        generatedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.letter.count({ where }),
  ])

  return successResponse(letters, total)
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()
  if (!hasMinRole(session.role, 'ADMIN')) return forbiddenResponse()

  const body = await req.json()
  const { employeeId, type, fields } = body || {}

  if (!employeeId) return errorResponse('employeeId is required')
  if (!type || !LETTER_TYPES.includes(type)) return errorResponse('A valid letter type is required')
  if (!fields || typeof fields !== 'object') return errorResponse('fields is required')

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: { select: { name: true, email: true } }, department: { select: { name: true } } },
  })
  if (!employee) return errorResponse('Employee not found', 404)

  // Minimal per-type validation of the admin-entered fields.
  if (type === 'OFFER') {
    for (const k of ['designation', 'department', 'placeOfPosting', 'monthlySalary', 'joiningDate', 'reportingManagerName']) {
      if (fields[k] === undefined || fields[k] === '') return errorResponse(`Field "${k}" is required for an Offer Letter`)
    }
  }
  if (type === 'SALARY_REVISION') {
    for (const k of ['effectiveDate', 'previousSalary', 'revisedSalary']) {
      if (fields[k] === undefined || fields[k] === '') return errorResponse(`Field "${k}" is required for a Salary Revision Letter`)
    }
  }
  if (type === 'RELIEVING_EXPERIENCE') {
    for (const k of ['fromDate', 'toDate', 'designation', 'department', 'placeOfPosting', 'fixedCTC']) {
      if (fields[k] === undefined || fields[k] === '') return errorResponse(`Field "${k}" is required for a Relieving & Experience Letter`)
    }
  }

  const letter = await prisma.letter.create({
    data: {
      employeeId,
      type,
      data: JSON.stringify(fields),
      generatedById: session.userId,
    },
  })

  await logActivity({
    userId: session.userId,
    action: 'CREATE',
    entityType: 'Letter',
    entityId: letter.id,
    changes: { type, employee: employee.user.name },
  })

  return successResponse(letter)
}
