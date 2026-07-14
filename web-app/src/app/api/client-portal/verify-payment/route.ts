// src/app/api/client-portal/verify-payment/route.ts
// Verifies Razorpay signature and records the payment on the invoice.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientSession } from '@/lib/clientAuth'
import crypto from 'crypto'
import { sendWhatsapp } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    invoice_id,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = await req.json()

  if (!invoice_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keySecret) return NextResponse.json({ error: 'Gateway not configured' }, { status: 503 })

  // Verify signature
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex')

  if (expected !== razorpay_signature) {
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoice_id, clientId: session.clientId },
    include: { client: { select: { clientName: true, phone: true } } },
  })
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const payAmount = invoice.dueAmount
  const newPaid = invoice.paidAmount + payAmount
  const newStatus = newPaid >= invoice.totalAmount ? 'PAID' : 'PARTIAL'

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        clientId: session.clientId,
        amount: payAmount,
        method: 'ONLINE_GATEWAY',
        reference: razorpay_payment_id,
        notes: `Razorpay order ${razorpay_order_id}`,
        source: 'CLIENT_PORTAL',
        paidAt: new Date(),
      },
    }),
    prisma.invoice.update({
      where: { id: invoice.id },
      data: { paidAmount: newPaid, dueAmount: Math.max(0, invoice.totalAmount - newPaid), status: newStatus },
    }),
  ])

  // WhatsApp receipt (best-effort)
  if (invoice.client.phone) {
    sendWhatsapp({
      toPhone: invoice.client.phone,
      template: 'hbs_payment_received',
      params: {
        clientName: invoice.client.clientName,
        invoiceNumber: invoice.invoiceNumber,
        amount: String(payAmount),
      },
      referenceType: 'INVOICE',
      referenceId: invoice.id,
    }).catch(() => {})
  }

  return NextResponse.json({ success: true, status: newStatus, paid: payAmount })
}
