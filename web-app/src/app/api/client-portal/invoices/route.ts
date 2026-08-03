// src/app/api/client-portal/invoices/route.ts
// Client ke invoices + har invoice ka public PDF link (Invoice.shareToken).
// The app/web just opens the link — no client-side file generation.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientSession } from '@/lib/clientAuth'
import { randomToken } from '@/lib/idgen'

export async function GET(req: NextRequest) {
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const invoices = await prisma.invoice.findMany({
    where: { clientId: session.clientId },
    include: {
      items: { orderBy: { order: 'asc' } },
      payments: { orderBy: { paidAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Generate one for those who don't have a shareToken
  await Promise.all(
    invoices.filter(i => !i.shareToken).map(async i => {
      const token = randomToken(32)
      try {
        await prisma.invoice.update({ where: { id: i.id }, data: { shareToken: token } })
        ;(i as any).shareToken = token
      } catch { /* ignore */ }
    })
  )

  const base = new URL(req.url).origin

  const data = invoices.map(i => ({
    ...i,
    share_token: i.shareToken,
    pdf_url: i.shareToken ? `${base}/api/invoices/view/${i.shareToken}/pdf` : null,
    payments: i.payments.map(p => ({
      ...p,
      receipt_url: p.receiptToken ? `${base}/receipt/view/${p.receiptToken}` : null,
    })),
  }))

  return NextResponse.json({ data })
}