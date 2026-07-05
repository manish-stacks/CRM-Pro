// src/app/api/client-portal/invoices/[id]/pay/route.ts
// Client records an offline payment (marks as PENDING_VERIFICATION).
// Real online-gateway integration would validate + auto-complete.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientSession } from '@/lib/clientAuth'
import { sendWhatsapp } from '@/lib/whatsapp'

const METHODS = ['UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE_GATEWAY']

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { amount, method, reference, notes } = await req.json()
  if (!amount || Number(amount) <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  if (!METHODS.includes(method)) return NextResponse.json({ error: 'Invalid method' }, { status: 400 })

  const invoice = await prisma.invoice.findFirst({
    where: { id, clientId: session.clientId },
    include: { client: { select: { clientName: true, phone: true } } },
  })
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const payAmount = Math.min(Number(amount), invoice.dueAmount)
  const newPaid = invoice.paidAmount + payAmount
  const newDue = Math.max(0, invoice.totalAmount - newPaid)
  const newStatus =
    newPaid >= invoice.totalAmount ? 'PAID' :
    newPaid > 0 ? 'PARTIAL' : 'PENDING'

  const [payment] = await prisma.$transaction([
    prisma.payment.create({
      data: {
        invoiceId: id,
        clientId: session.clientId,
        amount: payAmount,
        method,
        reference: reference || null,
        notes: notes || 'Recorded via client portal',
        source: 'CLIENT_PORTAL',
        paidAt: new Date(),
      },
    }),
    prisma.invoice.update({
      where: { id },
      data: { paidAmount: newPaid, dueAmount: newDue, status: newStatus },
    }),
  ])

  return NextResponse.json({ data: { payment, invoiceStatus: newStatus } })
}
