// src/app/api/auth/impersonate/route.ts
// SUPER_ADMIN-only. Returns a short-lived token for the target user — the
// frontend opens a NEW TAB and stores this in that tab's sessionStorage
// (never in a cookie, never in localStorage — both are shared across
// every tab and would clobber the admin's own session). Every axios/fetch
// call from that tab then sends it as a Bearer header, which
// getRequestSession() prioritises over the shared cookie.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, signImpersonationToken } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, 'SUPER_ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const body = await req.json().catch(() => null)
  const userId = body?.userId ? String(body.userId) : ''
  if (!userId) return errorResponse('userId is required')
  if (userId === session.userId) return errorResponse("You're already logged in as yourself")

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true, name: true, isActive: true } })
  if (!target) return notFoundResponse('User')
  if (target.role === 'SUPER_ADMIN') return errorResponse('Cannot impersonate another Super Admin')
  if (target.isActive === false) return errorResponse('This account is deactivated')

  const token = await signImpersonationToken({
    userId: target.id,
    email: target.email,
    role: target.role,
    name: target.name,
    impersonatedBy: session.userId,
    impersonatedByName: session.name,
  })

  // Accountability trail — who viewed whose account, and when.
  await logFromRequest(req, {
    userId: session.userId,
    action: 'IMPERSONATE_START',
    entityType: 'User',
    entityId: target.id,
    metadata: { targetName: target.name, targetEmail: target.email },
  })

  return successResponse({ token, targetName: target.name })
}
