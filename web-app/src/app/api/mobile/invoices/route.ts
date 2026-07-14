// src/app/api/mobile/invoices/route.ts
// Invoice creation for the mobile app — same calc logic as web /api/invoices.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
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
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')

  const where: any = { client: { marketingPersonId: session.userId } }
  if (clientId) where.clientId = clientId

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  })

  return ok(invoices.map(inv => ({
    id: inv.id,
    invoice_number: inv.invoiceNumber,
    status: inv.status,
    total_amount: inv.totalAmount,
    paid_amount: inv.paidAmount,
    due_amount: inv.dueAmount,
    due_date: inv.dueDate,
    created_at: inv.createdAt,
    items: inv.items.map(i => ({
      id: i.id, service_name: i.serviceName, description: i.description,
      quantity: i.quantity, unit_price: i.unitPrice, total: i.total,
    })),
  })))
}

export async function POST(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  let body: any = {}
  try { body = await req.json() } catch { return fail('Invalid body') }
  const {
    clientId, proposalId, notes, dueDate,
    discount = 0, discountType = 'FIXED',
    gstApplicable = false, gstRate = 18,
    items = [],
  } = body

  if (!clientId) return fail('clientId required')
  if (!items.length) return fail('At least one line item required')

  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client) return fail('Client not found', 404)

  const totals = calculate(items, Number(discount) || 0, discountType, !!gstApplicable, Number(gstRate) || 18)

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
        items: {
          create: items.map((it: any, idx: number) => ({
            serviceName: it.serviceName || null,
            description: it.description || it.serviceName || '',
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unitPrice) || 0,
            total: (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
            order: idx,
          })),
        },
      },
      include: { items: true },
    })

    await logFromRequest(req, {
      userId: session.userId, action: 'CREATE', entityType: 'Invoice', entityId: invoice.id,
      metadata: { via: 'mobile', invoiceNumber: invoice.invoiceNumber, totalAmount: totals.totalAmount },
    })

    return ok({ id: invoice.id, invoice_number: invoice.invoiceNumber, total_amount: invoice.totalAmount })
  } catch (e: any) {
    console.error('Mobile invoice create error:', e)
    return fail('Failed: ' + (e.message || 'Unknown'))
  }
}