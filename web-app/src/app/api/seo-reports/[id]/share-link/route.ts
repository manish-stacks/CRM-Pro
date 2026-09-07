// src/app/api/seo-reports/[id]/share-link/route.ts
// Returns a public, no-login-required "view report" link
// (/seo-report/view/[token]) — mirrors /api/invoices/[id]/share-link.
// Generates the token the first time it's requested, then reuses it.
//
// The base URL is taken from the caller's own `?origin=` query param
// (window.location.origin, sent by the frontend) instead of req.url's
// origin. Behind some dev-proxy setups the server sees a different
// internal host/port than what's in the browser's address bar, which was
// producing links with the wrong port — the browser always knows its own
// real address, so we trust that first.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, notFoundResponse, unauthorizedResponse, errorResponse } from '@/lib/api'
import { randomToken } from '@/lib/idgen'

function safeOrigin(raw: string | null, fallback: string): string {
  if (!raw) return fallback
  try {
    const u = new URL(raw)
    if (!['http:', 'https:'].includes(u.protocol)) return fallback
    return u.origin
  } catch { return fallback }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  try {
    let report = await prisma.seoReport.findUnique({ where: { id } })
    if (!report) return notFoundResponse('Report')

    if (!report.shareToken) {
      report = await prisma.seoReport.update({
        where: { id },
        data: { shareToken: randomToken(32) },
      })
    }

    const reqOrigin = new URL(req.url).origin
    const base = safeOrigin(req.nextUrl.searchParams.get('origin'), reqOrigin)
    return successResponse({
      token: report.shareToken,
      url: `${base}/seo-report/view/${report.shareToken}`,
    })
  } catch (e: any) {
    console.error('SEO report share-link error:', e)
    return errorResponse('Failed to generate report link. If this just started, run `npx prisma db push` and restart the server (the shareToken column may be missing).', 500)
  }
}

