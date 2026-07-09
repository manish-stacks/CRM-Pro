// src/app/api/letters/[id]/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from '@/lib/api'
import { logActivity } from '@/lib/audit'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()
  if (!hasMinRole(session.role, 'ADMIN')) return forbiddenResponse()

  const letter = await prisma.letter.findUnique({
    where: { id },
    include: {
      employee: { include: { user: { select: { name: true, email: true } }, department: { select: { name: true } } } },
      generatedBy: { select: { name: true } },
    },
  })
  if (!letter) return notFoundResponse('Letter')
  return successResponse(letter)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()
  if (!hasMinRole(session.role, 'ADMIN')) return forbiddenResponse()

  const letter = await prisma.letter.findUnique({ where: { id } })
  if (!letter) return notFoundResponse('Letter')

  await prisma.letter.delete({ where: { id } })

  await logActivity({
    userId: session.userId,
    action: 'DELETE',
    entityType: 'Letter',
    entityId: id,
    changes: { type: letter.type },
  })

  return successResponse({ deleted: true })
}
