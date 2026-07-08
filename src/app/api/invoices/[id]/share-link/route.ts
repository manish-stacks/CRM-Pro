// src/app/api/invoices/[id]/share-link/route.ts
// Returns a public, no-login-required "view invoice" link — same idea as
// Proposal.shareToken (/proposal/view/[token]). Generates the token the
// first time it's requested, then reuses it. Usable by the web dashboard
// (window.open) and the mobile app (Linking.openURL) alike, since the
// destination page itself requires no session.
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
    let invoice = await prisma.invoice.findUnique({ where: { id } })
    if (!invoice) return notFoundResponse('Invoice')

    if (!invoice.shareToken) {
      invoice = await prisma.invoice.update({
        where: { id },
        data: { shareToken: randomToken(32) },
      })
    }

    const base = new URL(req.url).origin
    return successResponse({
      token: invoice.shareToken,
      url: `${base}/invoice/view/${invoice.shareToken}`,
    })
  } catch (e: any) {
    console.error('Invoice share-link error:', e)
    return errorResponse('Failed to generate invoice link. If this just started, run `npx prisma migrate dev` and restart the server (the shareToken column may be missing).', 500)
  }
}