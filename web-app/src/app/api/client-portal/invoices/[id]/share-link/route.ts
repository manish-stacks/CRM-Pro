// src/app/api/client-portal/invoices/[id]/share-link/route.ts
// Returns the public, no-login "view invoice/receipt PDF" link
// (/api/invoices/view/[token]/pdf) for one of the logged-in client's own
// invoices — generating the shareToken the first time it's requested.
//
// Why this exists separately from /api/client-portal/invoices/[id]/pdf:
// that route requires the client's session (cookie on web, Bearer token on
// mobile) which works fine opened inside the app/browser tab that already
// holds the session, but NOT when handed to Linking.openURL() on mobile —
// that opens the device's external browser, which has no session at all.
// This route is called from inside the authenticated app first, and returns
// a token-based link that needs no session to open afterwards — the same
// pattern already used for the employee-side share link.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientSession } from '@/lib/clientAuth'
import { successResponse, notFoundResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { randomToken } from '@/lib/idgen'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getClientSession(req)
  if (!session) return unauthorizedResponse()

  try {
    let invoice = await prisma.invoice.findFirst({ where: { id, clientId: session.clientId } })
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
      url: `${base}/api/invoices/view/${invoice.shareToken}/pdf`,
    })
  } catch (e: any) {
    console.error('Client-portal invoice share-link error:', e)
    return errorResponse('Failed to generate link. If this just started, run `npx prisma migrate dev` and restart the server (the shareToken column may be missing).', 500)
  }
}
