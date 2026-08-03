// src/app/api/projects/[id]/route.ts
// Remove an assignment (mark inactive) or delete outright.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, notFoundResponse, errorResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'MANAGER')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const a = await prisma.projectAssignment.findUnique({ where: { id } })
  if (!a) return notFoundResponse('Assignment')

  const { searchParams } = new URL(req.url)
  const hard = searchParams.get('hard') === 'true'

  if (hard) {
    await prisma.projectAssignment.delete({ where: { id } })
  } else {
    await prisma.projectAssignment.update({
      where: { id },
      data: { isActive: false, removedAt: new Date() },
    })
  }

  await logFromRequest(req, {
    userId: session.userId,
    action: hard ? 'DELETE' : 'DEACTIVATE',
    entityType: 'ProjectAssignment',
    entityId: id,
  })

  return successResponse({ ok: true })
}
