// src/app/api/client-portal/payments/route.ts
// Client can see their invoices + ALL payments made on them (including PARTIAL),
// aur har payment ka public receipt link.
//
//   GET                 -> invoices (payments ke saath, har payment pe receipt_url)
//   GET ?type=payments  -> flat payment list (app ki "Payments Received" list)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientSession } from '@/lib/clientAuth'
import { randomToken } from '@/lib/idgen'

/**  Generate one for payments that don't have a receiptToken — everyone should be able to see the receipt */
async function ensureTokens(payments: { id: string; receiptToken: string | null }[]) {
  const missing = payments.filter(p => !p.receiptToken)
  if (!missing.length) return
  await Promise.all(
    missing.map(async p => {
      const token = randomToken(32)
      try {
        await prisma.payment.update({ where: { id: p.id }, data: { receiptToken: token } })
        p.receiptToken = token
      } catch { /* ignore */ }
    })
  )
}

export async function GET(req: NextRequest) {
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const base = new URL(req.url).origin

  const invoices = await prisma.invoice.findMany({
    where: { clientId: session.clientId },
    include: { payments: { orderBy: { paidAt: 'desc' } } },
    orderBy: { createdAt: 'desc' },
  })

  const allPayments = invoices.flatMap(i => i.payments)
  await ensureTokens(allPayments as any)

  const withUrl = (p: any, invoiceNumber?: string) => ({
    id: p.id,
    invoice_id: p.invoiceId,
    invoice_number: invoiceNumber,
    amount: p.amount,
    method: p.method,
    reference: p.reference,
    paid_at: p.paidAt,
    paidAt: p.paidAt,
    notes: p.notes,
    source: p.source,
    receipt_token: p.receiptToken,
    receipt_url: p.receiptToken ? `${base}/receipt/view/${p.receiptToken}` : null,
    receiptUrl: p.receiptToken ? `${base}/receipt/view/${p.receiptToken}` : null,
  })

  // ---- Flat payment list ----
  if (type === 'payments') {
    const flat = invoices
      .flatMap(i => i.payments.map(p => withUrl(p, i.invoiceNumber)))
      .sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())
    return NextResponse.json({ data: flat })
  }

  // ---- Invoices (default) — har payment pe receipt link chipka ke ----
  const shaped = invoices.map(i => ({
    ...i,
    payments: i.payments.map(p => ({ ...p, ...withUrl(p, i.invoiceNumber) })),
  }))

  return NextResponse.json({ data: shaped })
}
