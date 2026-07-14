// src/app/api/client-portal/create-order/route.ts
// Creates a Razorpay order for an invoice's due amount.
// Env: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientSession } from '@/lib/clientAuth'

export async function POST(req: NextRequest) {
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { invoice_id } = await req.json()
  if (!invoice_id) return NextResponse.json({ error: 'invoice_id required' }, { status: 400 })

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoice_id, clientId: session.clientId },
  })
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (invoice.dueAmount <= 0) return NextResponse.json({ error: 'Nothing due on this invoice' }, { status: 400 })

  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 })
  }

  const amountPaise = Math.round(invoice.dueAmount * 100)
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

  const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      receipt: invoice.invoiceNumber,
      notes: { invoiceId: invoice.id, clientId: session.clientId },
    }),
  })

  if (!rzpRes.ok) {
    const err = await rzpRes.text()
    return NextResponse.json({ error: 'Failed to create order', detail: err }, { status: 502 })
  }

  const order = await rzpRes.json()
  return NextResponse.json({
    success: true,
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    key_id: keyId,
    invoice_number: invoice.invoiceNumber,
  })
}
