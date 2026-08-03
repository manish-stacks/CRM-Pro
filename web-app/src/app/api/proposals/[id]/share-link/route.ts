// src/app/api/proposals/[id]/share-link/route.ts
// Returns the public, no-login-required "view proposal" PDF link
// (/api/proposals/view/[token]/pdf). New proposals already get a shareToken
// at creation time (mobile + web create routes), but this lazily generates
// one for any older records that predate that field — same safety-net
// pattern used by the invoice/payment share-link endpoints.
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
    let proposal = await prisma.proposal.findUnique({ where: { id } })
    if (!proposal) return notFoundResponse('Proposal')

    if (!proposal.shareToken) {
      proposal = await prisma.proposal.update({
        where: { id },
        data: { shareToken: randomToken(32) },
      })
    }

    const base = new URL(req.url).origin
    return successResponse({
      token: proposal.shareToken,
      url: `${base}/api/proposals/view/${proposal.shareToken}/pdf`,
    })
  } catch (e: any) {
    console.error('Proposal share-link error:', e)
    return errorResponse('Failed to generate proposal link', 500)
  }
}