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
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
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

/** Route handler session — reads from cookie OR Authorization: Bearer header (mobile) */
export async function getRequestSession(req: NextRequest): Promise<JWTPayload | null> {
  // Cookie (web) first
  let token = req.cookies.get('auth-token')?.value
  // Fallback to Bearer header (mobile app)
  if (!token) {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim()
    }
  }
  if (!token) return null
  return verifyToken(token)
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
