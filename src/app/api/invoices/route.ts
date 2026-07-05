// src/app/api/invoices/route.ts
// List + create invoices (Invoician-style)
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, successStatusResponse, errorResponse, unauthorizedResponse, getPaginationParams } from '@/lib/api'
import { generateInvoiceNumber } from '@/lib/idgen'
import { logFromRequest } from '@/lib/audit'

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
  }
}

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const { skip, limit } = getPaginationParams(searchParams)
  const status = searchParams.get('status')
  const clientId = searchParams.get('clientId')
  const search = searchParams.get('search')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  const where: any = {}
  if (status) where.status = status
  if (clientId) where.clientId = clientId
  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search } },
      { client: { clientName: { contains: search } } },
      { client: { companyName: { contains: search } } },
    ]
  }
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = new Date(dateFrom)
    if (dateTo)   where.createdAt.lte = new Date(dateTo + 'T23:59:59')
  }

  // Role visibility
  if (session.role === 'TELECALLER') {
    where.client = { telecallerId: session.userId }
  } else if (session.role === 'MARKETING_EXECUTIVE') {
    where.client = { marketingPersonId: session.userId }
  } else if (session.role === 'EMPLOYEE') {
    return successResponse([], 0)
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where, skip, take: limit,
      include: {
        client: { select: { id: true, clientCode: true, clientName: true, companyName: true, phone: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoice.count({ where }),
  ])
  return successResponse(invoices, total)
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MARKETING_EXECUTIVE'].includes(session.role)) {
    return errorResponse('Forbidden', 403)
  }

  const body = await req.json()
  const {
    clientId, proposalId, notes, terms, dueDate,
    discount = 0, discountType = 'FIXED',
    gstApplicable = false, gstRate = 18,
    items = [],
  } = body

  if (!clientId) return errorResponse('clientId required')
  if (!items.length) return errorResponse('At least one line item required')

  const totals = calculate(items, Number(discount), discountType, !!gstApplicable, Number(gstRate))

  try {
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: await generateInvoiceNumber(),
        clientId,
        proposalId: proposalId || null,
        subtotal: totals.subtotal,
        discount: Number(discount) || 0,
        discountType,
        gstApplicable: !!gstApplicable,
        gstRate: Number(gstRate) || 18,
        gstAmount: totals.gstAmount,
        totalAmount: totals.totalAmount,
        paidAmount: 0,
        dueAmount: totals.totalAmount,
        status: 'PENDING',
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes || null,
        terms: terms || null,
        items: {
          create: items.map((it: any, idx: number) => ({
            serviceName: it.serviceName || null,
            description: it.description || '',
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unitPrice) || 0,
            total: (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
            order: idx,
          })),
        },
      },
      include: { items: true, client: { select: { clientName: true, companyName: true } } },
    })

    await logFromRequest(req, {
      userId: session.userId,
      action: 'CREATE',
      entityType: 'Invoice',
      entityId: invoice.id,
      metadata: { invoiceNumber: invoice.invoiceNumber, totalAmount: totals.totalAmount },
    })

    return successStatusResponse(invoice, 201)
  } catch (e: any) {
    console.error('Invoice create error:', e)
    return errorResponse('Failed: ' + (e.message || 'Unknown'))
  }
}
