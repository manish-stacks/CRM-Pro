// src/app/api/payments/receipt-link/[id]/route.ts
// Returns a public, no-login-required "view receipt" link for a single
// Payment record — same idea as Invoice.shareToken / Proposal.shareToken.
// `id` here is the Payment id (not the Invoice id used elsewhere under
// /api/payments/[id]/...).
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, notFoundResponse, errorResponse } from '@/lib/api'
import { randomToken } from '@/lib/idgen'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  try {
    let payment = await prisma.payment.findUnique({ where: { id } })
    if (!payment) return notFoundResponse('Payment')

    if (!payment.receiptToken) {
      payment = await prisma.payment.update({
        where: { id },
        data: { receiptToken: randomToken(32) },
      })
    }

    const base = new URL(req.url).origin
    return successResponse({
      token: payment.receiptToken,
      url: `${base}/receipt/view/${payment.receiptToken}`,
    })
  } catch (e: any) {
    console.error('Payment receipt-link error:', e)
    return errorResponse('Failed to generate receipt link. If this just started, run `npx prisma migrate dev` and restart the server (the receiptToken column may be missing).', 500)
  }
}