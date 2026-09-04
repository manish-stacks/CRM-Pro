// src/lib/auth.ts
// JWT signing/verification + Next.js 16 async cookies + role hierarchy
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production'
)

export interface JWTPayload {
  userId: string
  email: string
  role: string
  name: string
  /** Set only on a short-lived impersonation token — the admin who started it. */
  impersonatedBy?: string
  impersonatedByName?: string
  /** epoch seconds — set by jose, present on verified tokens */
  exp?: number
  iat?: number
}

// Session lifetime. Was 7d, which is why users kept getting logged out.
// Now 30d + a sliding refresh in middleware.ts: every request within the
// last REFRESH_WINDOW_DAYS of expiry silently re-issues a fresh 30d token,
// so an active user is effectively never logged out.
export const SESSION_DAYS = 30
export const SESSION_MAX_AGE = 60 * 60 * 24 * SESSION_DAYS
export const REFRESH_WINDOW_DAYS = 20

export async function signToken(payload: JWTPayload): Promise<string> {
  return await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(JWT_SECRET)
}

// Impersonation tokens are deliberately short-lived (4h) and never touch
// the `auth-token` cookie — they're handed to the browser once, kept in
// that tab's sessionStorage, and sent as a Bearer header. See
// getRequestSession below for why the header must win over the cookie.
export async function signImpersonationToken(payload: JWTPayload): Promise<string> {
  return await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('4h')
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

/** Server Component / Server Action session (Next 16: `cookies()` is async) */
export async function getServerSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  return verifyToken(token)
}

/** Route handler session — reads from Authorization: Bearer header OR cookie */
export async function getRequestSession(req: NextRequest): Promise<JWTPayload | null> {
  // Bearer header first. Cookies are shared across every tab of the same
  // browser — they can't tell "admin's own tab" apart from "admin's
  // impersonation tab" opened alongside it. The per-tab impersonation
  // token (sent only as a header, from that one tab's sessionStorage) has
  // to win whenever it's present, or impersonation would just silently
  // show the admin their own account again.
  let token: string | undefined
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim()
  }
  // Cookie (web) fallback — normal tabs never send the header above.
  if (!token) {
    token = req.cookies.get('auth-token')?.value
  }
  if (!token) return null
  const payload = await verifyToken(token)
  // A client-portal token ({ clientId, type:'client' }) is signature-valid but is
  // NOT a staff session. Reject it here so staff-guarded routes (notifications,
  // push-token, etc.) don't treat it as a user with an undefined userId — which
  // previously made `where: { userId: undefined }` match every row.
  if (payload && (payload as any).type === 'client') return null
  return payload
}

export function hasRole(userRole: string, allowedRoles: string[]): boolean {
  return allowedRoles.includes(userRole)
}

export const ROLE_HIERARCHY: Record<string, number> = {
  SUPER_ADMIN:          7,
  ADMIN:                6,
  MANAGER:              5,
  EMPLOYEE:             4,
  TELECALLER:           3,
  MARKETING_EXECUTIVE:  2,
  CLIENT:               1,
}

export function hasMinRole(userRole: string, minRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0)
}

/**
 * Guard helper for route handlers. Returns { session } on success,
 * or a Response on failure (401/403).
 */
export async function requireAuth(req: NextRequest, minRole?: string) {
  const session = await getRequestSession(req)
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (minRole && !hasMinRole(session.role, minRole)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return { session }
}
