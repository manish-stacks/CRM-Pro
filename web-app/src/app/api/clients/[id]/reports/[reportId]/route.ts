// src/app/api/clients/[id]/reports/[reportId]/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse, unauthorizedResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

const UPDATABLE = new Set([
  'title', 'description', 'reportType', 'fileUrl', 'fileType', 'fileSize',
  'reportPeriod', 'reportDate', 'content', 'clientServiceId',
])

// PUT — edit an existing report (e.g. swap a wrong PDF/image, fix a typo in
// the title/description). Same visibility rule as GET /reports: Admin/TL
// (MANAGER+) can edit any report; other staff only if linked to the client.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; reportId: string }> }) {
  const { id: clientId, reportId } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const existing = await prisma.clientReport.findUnique({ where: { id: reportId } })
  if (!existing || existing.clientId !== clientId) return notFoundResponse('Report')

  if (!hasMinRole(session.role, 'MANAGER')) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { telecallerId: true, marketingPersonId: true },
    })
    const isLinked = client && (client.telecallerId === session.userId || client.marketingPersonId === session.userId)
    if (!isLinked) {
      const isMember = await prisma.projectAssignment.findFirst({
        where: {
          isActive: true,
          OR: [{ managerId: session.userId }, { memberId: session.userId }],
          clientService: { clientId },
        },
      })
      if (!isMember) return errorResponse('Forbidden', 403)
    }
  }

  const body = await req.json()
  const data: Record<string, any> = {}
  for (const [k, v] of Object.entries(body)) {
    if (UPDATABLE.has(k)) data[k] = v === '' ? null : v
  }
  if (data.reportDate) data.reportDate = new Date(data.reportDate)
  if (data.fileSize != null) data.fileSize = Number(data.fileSize)

  const updated = await prisma.clientReport.update({
    where: { id: reportId },
    data,
    include: {
      uploadedBy: { select: { name: true, avatar: true, role: true } },
      clientService: { select: { serviceName: true } },
    },
  })

  const diff: Record<string, { from: any; to: any }> = {}
  for (const k of Object.keys(data)) {
    const before = (existing as any)[k]
    if (JSON.stringify(before) !== JSON.stringify(data[k])) diff[k] = { from: before, to: data[k] }
  }
  await logFromRequest(req, {
    userId: session.userId,
    action: 'UPDATE',
    entityType: 'ClientReport',
    entityId: reportId,
    changes: diff,
  })

  return successResponse(updated)
}

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
