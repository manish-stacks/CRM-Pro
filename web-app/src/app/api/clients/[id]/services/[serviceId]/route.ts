// src/app/api/clients/[id]/services/[serviceId]/route.ts
// Stop / pause / resume a client service, or delete it outright.
// Stopping keeps the history (and its reports); deleting removes the service,
// its project assignments and its SEO reports.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hasMinRole } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

const ALLOWED_STATUS = ['ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED']
const EDIT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MARKETING_EXECUTIVE']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
) {
  const { id, serviceId } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session
  if (!EDIT_ROLES.includes(session.role)) return errorResponse('Forbidden', 403)

  const svc = await prisma.clientService.findFirst({ where: { id: serviceId, clientId: id } })
  if (!svc) return notFoundResponse('Service')

  const { status, autoRenew, renewalNote, expiryDate, amount } = await req.json()

  const data: any = {}
  if (status !== undefined) {
    if (!ALLOWED_STATUS.includes(status)) return errorResponse('Invalid status')
    data.status = status
    // Stopping a service should not keep silently renewing it
    if (status !== 'ACTIVE') data.autoRenew = false
  }
  if (autoRenew !== undefined) data.autoRenew = !!autoRenew
  if (renewalNote !== undefined) data.renewalNote = renewalNote || null
  if (expiryDate !== undefined) data.expiryDate = expiryDate ? new Date(expiryDate) : null
  if (amount !== undefined) data.amount = Number(amount) || 0

  if (!Object.keys(data).length) return errorResponse('Nothing to update')

  const updated = await prisma.clientService.update({ where: { id: serviceId }, data })

  // A stopped service should free up its team
  if (data.status && data.status !== 'ACTIVE') {
    await prisma.projectAssignment.updateMany({
      where: { clientServiceId: serviceId, isActive: true },
      data: { isActive: false, removedAt: new Date() },
    })
  }

  await logFromRequest(req, {
    userId: session.userId,
    action: 'UPDATE',
    entityType: 'ClientService',
    entityId: serviceId,
    changes: data,
    metadata: { clientId: id, serviceName: svc.serviceName },
  })

  return successResponse(updated)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
) {
  const { id, serviceId } = await params
  const auth = await requireAuth(req, 'MANAGER')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const svc = await prisma.clientService.findFirst({
    where: { id: serviceId, clientId: id },
    include: { _count: { select: { reports: true, supportTickets: true } } },
  })
  if (!svc) return notFoundResponse('Service')

  // Invoices reference services loosely, but reports/tickets are tied to them —
  // only an admin may wipe a service that already has history.
  const hasHistory = svc._count.reports > 0 || svc._count.supportTickets > 0
  if (hasHistory && !hasMinRole(session.role, 'ADMIN')) {
    return errorResponse('This service has reports/tickets — stop it instead, or ask an admin to delete', 400)
  }

  // Detach anything that points at this service so the delete can go through
  await prisma.$transaction([
    prisma.clientReport.updateMany({ where: { clientServiceId: serviceId }, data: { clientServiceId: null } }),
    prisma.seoReport.updateMany({ where: { clientServiceId: serviceId }, data: { clientServiceId: null } }),
    prisma.supportTicket.updateMany({ where: { clientServiceId: serviceId }, data: { clientServiceId: null } }),
    prisma.projectAssignment.deleteMany({ where: { clientServiceId: serviceId } }),
    prisma.clientService.delete({ where: { id: serviceId } }),
  ])

  await logFromRequest(req, {
    userId: session.userId,
    action: 'DELETE',
    entityType: 'ClientService',
    entityId: serviceId,
    metadata: { clientId: id, serviceName: svc.serviceName },
  })

  return successResponse({ id: serviceId })
}
