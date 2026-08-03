// src/middleware.ts
// FIX: Client portal was completely blocked because /client-portal + /api/client-portal
// were not in publicPaths — middleware required an employee 'auth-token'.
// Now the client portal has its own path/cookie tree; middleware handles both.
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './lib/auth'
import { isMobileBrowserUA, isMobileAllowedPath, MOBILE_BLOCK_HTML, MOBILE_BLOCK_MESSAGE } from './lib/mobileGuard'

// Fully public paths (no auth of any kind required)
const publicPaths = [
  '/login',
  '/api/auth/login',
  '/api/auth/verify-login-otp',  // Step 2 of admin login (2FA) — no session exists yet
  '/api/auth/forgot-password',   // send-otp + reset (user is locked out, no session)
  '/api/proposals/view',         // Public "view proposal" PDF (Proposal.shareToken) + its data API — replaces the old /proposal/view HTML page
  '/api/invoices/view',          // Public "view invoice" PDF (Invoice.shareToken) + its data API — replaces the old /invoice/view HTML page
  '/receipt/view',               // Public "view payment receipt" page (Payment.receiptToken)
  '/api/receipts/view',          // ...its data API
  '/id-verify',                  // Public "verify employee ID card" page (QR code on the printed card)
  '/api/id-verify',              // ...its data API
  '/client-portal',              // Client portal page + login form
  '/api/client-portal/login',    // Client login endpoint
  '/api/client-portal/logout',   // Client logout endpoint
  '/api/client-portal/forgot-password', // send-otp + reset (no auth — user is locked out)
  '/api/mobile/auth/login',
  '/api/mobile/auth/forgot-password',   // staff send-otp + reset (no auth)
  '/api/mobile/client-login'
]

// Client-portal protected paths (require client-token, NOT auth-token)
const clientPortalPaths = [
  '/api/client-portal/',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ---- Desktop-only gate -------------------------------------------------
  // Staff must use the mobile app on phones/tablets/iOS — the browser CRM is
  // blocked there (login page included). The RN app, the client portal and
  // public share links are exempt (see MOBILE_ALLOWED_PREFIXES).
  const isAppRequest = req.headers.get('x-client-platform') === 'mobile-app'
  if (!isAppRequest && !isMobileAllowedPath(pathname) && isMobileBrowserUA(req.headers.get('user-agent'))) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: MOBILE_BLOCK_MESSAGE }, { status: 403 })
    }
    return new NextResponse(MOBILE_BLOCK_HTML, {
      status: 403,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  // Fully public paths pass through
  if (publicPaths.some(path => pathname === path || pathname.startsWith(path + '/'))) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/mobile')) {
    const authHeader = req.headers.get('authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    const payload = await verifyToken(token)

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    return NextResponse.next()
  }

  // Client-portal API paths require a client session.
  // Web sends it as a `client-token` cookie; the mobile app sends it as a
  // `Authorization: Bearer <token>` header. Previously only the cookie was
  // accepted here, so every client-portal call from the app was rejected with
  // 401 before it ever reached the route handler — that's why the client side
  // of the app "did nothing" after login. Accept either; the real verification
  // (cookie OR Bearer, both handled) still happens in getClientSession.
  if (clientPortalPaths.some(path => pathname.startsWith(path))) {
    const clientToken = req.cookies.get('client-token')?.value
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
    const hasBearer = authHeader?.startsWith('Bearer ')
    if (!clientToken && !hasBearer) {
      return NextResponse.json({ error: 'Client authentication required' }, { status: 401 })
    }
    return NextResponse.next()  // Actual verification happens in the route handler via getClientSession
  }

  // Everything else requires employee auth-token — accepted either as the
  // web session cookie, or as a Bearer header (mobile app calling a
  // non-/api/mobile employee endpoint directly, e.g. share-link generators).
  let token = req.cookies.get('auth-token')?.value
  if (!token) {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim()
    }
  }

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const payload = await verifyToken(token)
  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const response = NextResponse.redirect(new URL('/login', req.url))
    response.cookies.delete('auth-token')
    return response
  }

  // Redirect root to dashboard
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}