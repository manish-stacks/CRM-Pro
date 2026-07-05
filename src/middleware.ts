// src/middleware.ts
// FIX: Client portal was completely blocked because /client-portal + /api/client-portal
// were not in publicPaths — middleware required an employee 'auth-token'.
// Now the client portal has its own path/cookie tree; middleware handles both.
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './lib/auth'

// Fully public paths (no auth of any kind required)
const publicPaths = [
  '/login',
  '/api/auth/login',
  '/proposal/view',
  '/client-portal',              // Client portal page + login form
  '/api/client-portal/login',    // Client login endpoint
  '/api/client-portal/logout',   // Client logout endpoint
]

// Client-portal protected paths (require client-token, NOT auth-token)
const clientPortalPaths = [
  '/api/client-portal/',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Fully public paths pass through
  if (publicPaths.some(path => pathname === path || pathname.startsWith(path + '/'))) {
    return NextResponse.next()
  }

  // Client-portal API paths require client-token (NOT employee auth-token)
  if (clientPortalPaths.some(path => pathname.startsWith(path))) {
    const clientToken = req.cookies.get('client-token')?.value
    if (!clientToken) {
      return NextResponse.json({ error: 'Client authentication required' }, { status: 401 })
    }
    return NextResponse.next()  // Actual verification happens in the route handler via getClientSession
  }

  // Everything else requires employee auth-token
  const token = req.cookies.get('auth-token')?.value

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
