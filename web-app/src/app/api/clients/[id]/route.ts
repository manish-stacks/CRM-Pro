// src/app/api/clients/[id]/route.ts
// Rich client detail — services, invoices, payments, reports (Phase 5),
// tickets, plus assigned personnel.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { deleteFile, publicIdFromUrl } from '@/lib/cloudinary'

const CLIENT_UPDATABLE = new Set([
  'companyName', 'clientName', 'phone', 'altPhone', 'email',
  'address', 'state', 'city', 'pincode',
  'gstApplicable', 'gstNo',
  'onboardingDate', 'status', 'image',
  'assignedToId', 'telecallerId', 'marketingPersonId', 'reportingPersonId',
])
const LEGACY_ALIAS: Record<string, string> = {
  salesPersonId: 'marketingPersonId',
  telesalesId: 'telecallerId',
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      telecaller: { select: { id: true, name: true, email: true, phone: true, avatar: true } },
      marketingPerson: { select: { id: true, name: true, email: true, phone: true, avatar: true } },
      reportingPerson: { select: { id: true, name: true, email: true, phone: true, avatar: true } },
      assignedTo: { select: { id: true, name: true, email: true, phone: true, avatar: true } },
      lead: { select: { id: true, leadNumber: true, status: true } },
      services: {
        include: { department: { select: { name: true, color: true } } },
        orderBy: { startDate: 'desc' },
      },
      proposals: {
        select: { id: true, proposalNumber: true, title: true, finalAmount: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
      invoices: {
        select: { id: true, invoiceNumber: true, totalAmount: true, paidAmount: true, dueAmount: true, status: true, dueDate: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
      supportTickets: {
        select: { id: true, ticketNumber: true, subject: true, status: true, priority: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      _count: {
        select: {
          services: true, invoices: true, proposals: true, supportTickets: true, reports: true,
        },
      },
    },
  })
  if (!client) return notFoundResponse('Client')

  // Stats
  const totalPaid = client.invoices.reduce((s, i) => s + i.paidAmount, 0)
  const totalDue = client.invoices.reduce((s, i) => s + i.dueAmount, 0)
  const activeServices = client.services.filter(s => s.status === 'ACTIVE').length

  // Expiring services (in 30 days)
  const now = new Date()
  const in30 = new Date(now); in30.setDate(now.getDate() + 30)
  const expiringServices = client.services.filter(s =>
    s.status === 'ACTIVE' && s.expiryDate && s.expiryDate <= in30 && s.expiryDate >= now
  )

  return successResponse({
    ...client,
    stats: { totalPaid, totalDue, activeServices, expiringSoon: expiringServices.length },
    expiringServices,
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'MANAGER')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const body = await req.json()
  const { services, ...rest } = body

  const data: Record<string, any> = {}
  for (const [k, v] of Object.entries(rest)) {
    const key = LEGACY_ALIAS[k] || k
    if (!CLIENT_UPDATABLE.has(key)) continue
    data[key] = v === '' ? null : v
  }
  if (data.onboardingDate) data.onboardingDate = new Date(data.onboardingDate)
  if (data.email) data.email = String(data.email).toLowerCase()
  if (data.gstApplicable !== undefined) {
    data.gstApplicable = data.gstApplicable === true || data.gstApplicable === 'true'
  }

  // If the logo/image is being replaced or cleared, remember the old R2 file
  // so we can delete it after the update succeeds (best-effort cleanup).
  let oldImageUrl: string | null = null
  if ('image' in data) {
    const current = await prisma.client.findUnique({ where: { id }, select: { image: true } })
    if (current?.image && current.image !== data.image) oldImageUrl = current.image
  }

  try {
    const client = await prisma.client.update({ where: { id }, data })
    if (oldImageUrl) {
      const publicId = publicIdFromUrl(oldImageUrl)
      if (publicId) deleteFile(publicId).catch(() => {})
    }
    await logFromRequest(req, {
      userId: session.userId,
      action: 'UPDATE',
      entityType: 'Client',
      entityId: id,
      changes: data,
    })
    return successResponse(client)
  } catch (e: any) {
    return errorResponse(e.message || 'Update failed')
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const c = await prisma.client.findUnique({ where: { id } })
  if (!c) return notFoundResponse('Client')

  // Any report files that will cascade-delete with the client — clean those
  // up from R2 too, not just the client's own logo/GMB screenshot.
  const reports = await prisma.clientReport.findMany({ where: { clientId: id }, select: { fileUrl: true } })
  const filesToDelete = [c.image, c.gmbScreenshot, ...reports.map(r => r.fileUrl)].filter(Boolean) as string[]

  try {
    await prisma.client.delete({ where: { id } })
    for (const url of filesToDelete) {
      const publicId = publicIdFromUrl(url)
      if (publicId) deleteFile(publicId).catch(() => {})
    }
    await logFromRequest(req, {
      userId: session.userId,
      action: 'DELETE',
      entityType: 'Client',
      entityId: id,
      metadata: { clientCode: c.clientCode },
    })
    return successResponse({ deleted: true })
  } catch (e: any) {
    return errorResponse('Cannot delete: ' + e.message)
  }
}
