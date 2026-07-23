// src/app/api/proposals/[id]/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

const UPDATABLE = new Set(['title', 'notes', 'terms', 'validUntil', 'status'])

function calculate(items: any[], discount: number, discountType: string, gstApplicable: boolean, gstRate: number) {
  const subtotal = items.reduce((s, i) => s + (Number(i.quantity) * Number(i.unitPrice)), 0)
  const discountAmount = discountType === 'PERCENT' ? subtotal * (discount / 100) : discount
  const afterDiscount = Math.max(0, subtotal - discountAmount)
  const gstAmount = gstApplicable ? afterDiscount * (gstRate / 100) : 0
  const totalAmount = afterDiscount + gstAmount
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    gstAmount: Math.round(gstAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    finalAmount: Math.round(totalAmount * 100) / 100,
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: {
      items: { orderBy: { order: 'asc' } },
      client: { select: { id: true, clientCode: true, clientName: true, companyName: true, phone: true, email: true, gstApplicable: true, gstNo: true, address: true, city: true, state: true } },
      lead: { select: { id: true, leadNumber: true, clientName: true, companyName: true, clientPhone: true, clientEmail: true, address: true, city: true, state: true } },
      createdBy: { select: { id: true, name: true, email: true, role: true } },
    },
  })
  if (!proposal) return notFoundResponse('Proposal')
  return successResponse(proposal)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const body = await req.json()

  const existing = await prisma.proposal.findUnique({ where: { id } })
  if (!existing) return notFoundResponse('Proposal')

  // Only DRAFT proposals can have items/pricing edited
  const items = body.items
  const canEditItems = existing.status === 'DRAFT'

  const data: Record<string, any> = {}
  for (const [k, v] of Object.entries(body)) {
    if (UPDATABLE.has(k)) data[k] = v === '' ? null : v
  }
  if (data.validUntil) data.validUntil = new Date(data.validUntil)

  // Handle items/pricing if allowed
  if (items && canEditItems) {
    const {
      discount = 0, discountType = 'FIXED',
      gstApplicable = false, gstRate = 18,
    } = body
    const totals = calculate(items, Number(discount), discountType, !!gstApplicable, Number(gstRate))

    data.discount = Number(discount) || 0
    data.discountType = discountType
    data.gstApplicable = !!gstApplicable
    data.gstRate = Number(gstRate) || 18
    data.gstAmount = totals.gstAmount
    data.subtotal = totals.subtotal
    data.totalAmount = totals.totalAmount
    data.finalAmount = totals.finalAmount

    // Recreate items
    await prisma.proposalItem.deleteMany({ where: { proposalId: id } })
    await prisma.proposalItem.createMany({
      data: items.map((it: any, idx: number) => ({
        proposalId: id,
        serviceId: it.serviceId || null,
        serviceName: it.serviceName || null,
        description: it.description || '',
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0,
        total: (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
        order: idx,
      })),
    })
  }

  try {
    const updated = await prisma.proposal.update({
      where: { id },
      data,
      include: { items: { orderBy: { order: 'asc' } } },
    })
    await logFromRequest(req, {
      userId: session.userId,
      action: 'UPDATE',
      entityType: 'Proposal',
      entityId: id,
      changes: data,
    })
    return successResponse(updated)
  } catch (e: any) {
    return errorResponse(e.message || 'Update failed')
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'MANAGER')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  try {
    await prisma.proposal.delete({ where: { id } })
    await logFromRequest(req, {
      userId: session.userId, action: 'DELETE', entityType: 'Proposal', entityId: id,
    })
    return successResponse({ deleted: true })
  } catch (e: any) {
    return errorResponse(e.message || 'Delete failed')
  }
}
