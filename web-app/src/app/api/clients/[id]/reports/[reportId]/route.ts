// src/app/api/clients/[id]/reports/[reportId]/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; reportId: string }> }) {
  const { reportId } = await params
  const auth = await requireAuth(req, 'MANAGER')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const r = await prisma.clientReport.findUnique({ where: { id: reportId } })
  if (!r) return notFoundResponse('Report')

  await prisma.clientReport.delete({ where: { id: reportId } })
  await logFromRequest(req, {
    userId: session.userId,
    action: 'DELETE',
    entityType: 'ClientReport',
    entityId: reportId,
  })
  return successResponse({ deleted: true })
}
