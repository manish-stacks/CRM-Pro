// src/app/api/payments/route.ts
// Dual-purpose endpoint used by the Payments & Billing page (tabs: invoices | payments).
//   GET  ?type=invoices  -> list invoices (+ filters)
//   GET  ?type=payments  -> list payments  (+ filters)   [default]
//   POST { type:'invoice', ... } -> create an invoice
//   POST { type:'payment', ... } -> record a payment (auto-updates invoice status)
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, successStatusResponse, errorResponse, unauthorizedResponse, getPaginationParams } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { sendWhatsapp } from '@/lib/whatsapp'
import { Notifications } from '@/lib/notify'
import { generateInvoiceNumber } from '@/lib/idgen'

const METHODS = ['UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE_GATEWAY']

// Client-scope filter for non-admin roles (telecaller/marketing see own clients only)
function clientScope(role: string, userId: string): any | null {
  if (role === 'TELECALLER') return { telecallerId: userId }
  if (role === 'MARKETING_EXECUTIVE') return { marketingPersonId: userId }
  return null
}

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const { skip, limit } = getPaginationParams(searchParams)
  const type = searchParams.get('type') || 'payments'
  const invoiceId = searchParams.get('invoiceId')
  const clientId = searchParams.get('clientId')
  const method = searchParams.get('method')
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  // Employees never see billing
  if (session.role === 'EMPLOYEE') return successResponse([], 0)

  const scope = clientScope(session.role, session.userId)

  // ---------------- INVOICES ----------------
  if (type === 'invoices') {
    const where: any = {}
    if (clientId) where.clientId = clientId
    if (status) where.status = status
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59')
    }
    if (scope) where.client = scope
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { client: { companyName: { contains: search } } },
        { client: { clientName: { contains: search } } },
      ]
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where, skip, take: limit,
        include: {
          client: { select: { id: true, clientCode: true, clientName: true, companyName: true } },
          _count: { select: { payments: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.count({ where }),
    ])
    return successResponse(invoices, total)
  }

  // ---------------- PAYMENTS ----------------
  const where: any = {}
  if (invoiceId) where.invoiceId = invoiceId
  if (method) where.method = method
  if (dateFrom || dateTo) {
    where.paidAt = {}
    if (dateFrom) where.paidAt.gte = new Date(dateFrom)
    if (dateTo) where.paidAt.lte = new Date(dateTo + 'T23:59:59')
  }

  const invoiceFilter: any = {}
  if (clientId) invoiceFilter.clientId = clientId
  if (scope) invoiceFilter.client = scope
  if (search) {
    invoiceFilter.OR = [
      { invoiceNumber: { contains: search } },
      { client: { companyName: { contains: search } } },
      { client: { clientName: { contains: search } } },
    ]
  }
  if (Object.keys(invoiceFilter).length) where.invoice = invoiceFilter

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where, skip, take: limit,
      include: {
        invoice: {
          select: {
            id: true, invoiceNumber: true, totalAmount: true, status: true,
            client: { select: { id: true, clientCode: true, clientName: true, companyName: true } },
          },
        },
      },
      orderBy: { paidAt: 'desc' },
    }),
    prisma.payment.count({ where }),
  ])
  return successResponse(payments, total)
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  if (!hasMinRole(session.role, 'MARKETING_EXECUTIVE')) {
    return errorResponse('Forbidden', 403)
  }

  const body = await req.json()
  const type = body.type || 'payment'

  // ---------------- CREATE INVOICE ----------------
  if (type === 'invoice') {
    const { clientId, dueDate, notes, items = [] } = body
    if (!clientId) return errorResponse('Select a client')
    if (!Array.isArray(items) || items.length === 0) return errorResponse('At least one line item required')

    const lineItems = items.map((it: any, idx: number) => {
      const quantity = Number(it.quantity) || 1
      const unitPrice = Number(it.unitPrice) || 0
      return {
        serviceName: it.serviceName || null,
        description: it.description || '',
        quantity,
        unitPrice,
        total: quantity * unitPrice,
        order: idx,
      }
    })
    const subtotal = lineItems.reduce((s, i) => s + i.total, 0)

    try {
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: await generateInvoiceNumber(),
          clientId,
          subtotal,
          totalAmount: subtotal,
          paidAmount: 0,
          dueAmount: subtotal,
          status: 'PENDING',
          dueDate: dueDate ? new Date(dueDate) : null,
          notes: notes || null,
          items: { create: lineItems },
        },
        include: { items: true, client: { select: { clientName: true, companyName: true } } },
      })

      await logFromRequest(req, {
        userId: session.userId,
        action: 'CREATE',
        entityType: 'Invoice',
        entityId: invoice.id,
        metadata: { invoiceNumber: invoice.invoiceNumber, totalAmount: subtotal },
      })
      return successStatusResponse(invoice, 201)
    } catch (e: any) {
      console.error('Invoice create error:', e)
      return errorResponse('Failed: ' + (e.message || 'Unknown'))
    }
  }

  // ---------------- RECORD PAYMENT ----------------
  const { invoiceId, amount, method, reference, paidAt, notes, gatewayName, gatewayRef, nextDueDate } = body

  if (!invoiceId) return errorResponse('invoiceId required')
  if (!amount || Number(amount) <= 0) return errorResponse('Valid amount required')
  if (!method || !METHODS.includes(method)) return errorResponse('Valid method required')

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: true },
  })
  if (!invoice) return errorResponse('Invoice not found', 404)

  const payAmount = Number(amount)
  const newPaid = invoice.paidAmount + payAmount
  const newDue = Math.max(0, invoice.totalAmount - newPaid)
  const newStatus =
    newPaid >= invoice.totalAmount ? 'PAID' :
    newPaid > 0                    ? 'PARTIAL' :
                                     'PENDING'

  const [payment] = await prisma.$transaction([
    prisma.payment.create({
      data: {
        invoiceId,
        clientId: invoice.clientId,
        // For the collection report: who collected the payment. If admin is entering on someone else's behalf, they can send body.collectedById, otherwise it defaults to themselves.
        collectedById:
          body.collectedById ||
          (session.role === 'MARKETING_EXECUTIVE' ? session.userId : invoice.client.marketingPersonId || session.userId),
        amount: payAmount,
        method,
        reference: reference || null,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        notes: notes || null,
        source: 'MANUAL',
        gatewayName: gatewayName || null,
        gatewayRef: gatewayRef || null,
      },
    }),
    prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: newPaid,
        dueAmount: newDue,
        status: newStatus,
        // Part payment: if there's a remaining balance and a balance-due-date is given, set it
        ...(newDue > 0 && nextDueDate ? { dueDate: new Date(nextDueDate) } : {}),
      },
    }),
  ])

  if (invoice.client.phone) {
    sendWhatsapp({
      toPhone: invoice.client.phone,
      template: 'hbs_payment_received',
      params: {
        clientName: invoice.client.clientName,
        amount: `₹${payAmount.toLocaleString('en-IN')}`,
        invoiceNumber: invoice.invoiceNumber,
        paymentMethod: method,
      },
      referenceType: 'PAYMENT',
      referenceId: payment.id,
    }).catch(() => {})
  }

  await logFromRequest(req, {
    userId: session.userId,
    action: 'RECORD_PAYMENT',
    entityType: 'Payment',
    entityId: payment.id,
    metadata: { invoiceId, amount: payAmount, method, newStatus },
  })

  const staffIds = [
    invoice.client.telecallerId,
    invoice.client.marketingPersonId,
    invoice.client.reportingPersonId,
  ].filter(Boolean) as string[]
  if (staffIds.length) {
    Notifications.paymentReceived(
      Array.from(new Set(staffIds)),
      invoice.invoiceNumber, payAmount, invoiceId
    ).catch(() => {})
  }

  return successStatusResponse(payment, 201)
}