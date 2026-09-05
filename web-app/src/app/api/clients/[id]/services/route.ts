// src/app/api/clients/[id]/services/route.ts
// List client's services + add new service to a client.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, successStatusResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { Notifications } from '@/lib/notify'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  const services = await prisma.clientService.findMany({
    where: { clientId: id },
    include: {
      department: { select: { name: true, color: true } },
    },
    orderBy: [{ status: 'asc' }, { expiryDate: 'asc' }],
  })
  return successResponse(services, services.length)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  // Same as invoices/proposals: admin, manager and marketing executives can add services
  if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MARKETING_EXECUTIVE'].includes(session.role)) {
    return errorResponse('Forbidden', 403)
  }

  const {
    serviceName, description, category, departmentId,
    startDate, expiryDate, amount, billingCycle, autoRenew,
    serviceCatalogId,
  } = await req.json()

  if (!serviceName) return errorResponse('Service name required')

  const client = await prisma.client.findUnique({ where: { id } })
  if (!client) return notFoundResponse('Client')

  const svc = await prisma.clientService.create({
    data: {
      clientId: id,
      serviceCatalogId: serviceCatalogId || null,
      serviceName,
      description: description || null,
      category: category || null,
      departmentId: departmentId || null,
      startDate: startDate ? new Date(startDate) : new Date(),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      amount: Number(amount) || 0,
      billingCycle: billingCycle || 'ONE_TIME',
      autoRenew: !!autoRenew,
      status: 'ACTIVE',
    },
  })

  // ---- Auto-assign the department head (TL) as the project manager ----
  // Adding a service to a client immediately creates the project, so the
  // handling department's head becomes the owner without a manual step.
  // Admin can still change the assigned person later from /projects.
  let autoAssigned: any = null
  if (svc.departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: svc.departmentId },
      select: {
        name: true,
        manager: { select: { userId: true, user: { select: { id: true, name: true } } } },
      },
    })
    const headUserId = dept?.manager?.user?.id || dept?.manager?.userId || null

    if (headUserId) {
      autoAssigned = await prisma.projectAssignment.create({
        data: {
          clientServiceId: svc.id,
          managerId: headUserId,
          role: 'MANAGER',
          isActive: true,
        },
        include: { manager: { select: { id: true, name: true, avatar: true, role: true } } },
      })

      if (headUserId !== session.userId) {
        Notifications.projectAssignedManager(
          headUserId, svc.serviceName, client.clientName, id
        ).catch(() => { })
      }
    }
  }

  await logFromRequest(req, {
    userId: session.userId,
    action: 'CREATE',
    entityType: 'ClientService',
    entityId: svc.id,
    metadata: { clientId: id, serviceName, departmentId: svc.departmentId, autoAssignedManagerId: autoAssigned?.managerId || null },
  })

  return successStatusResponse({ ...svc, autoAssigned }, 201)
}