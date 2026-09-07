// src/lib/permissions.server.ts
// Server-only helpers. Resolves a user's effective permission list (custom role
// if one is attached, otherwise the built-in defaults for their role string)
// and gives route handlers a one-line guard.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { checkPermission, DEFAULT_ROLE_PERMISSIONS, sanitizePermissions } from '@/lib/permissions'

export interface EffectiveAccess {
  userId: string
  role: string
  appRole: { id: string; key: string; name: string } | null
  permissions: string[]
}

// Small in-process cache — role permissions change rarely but are read on
// nearly every request. Cleared whenever a role is saved (see bustRoleCache).
const cache = new Map<string, { value: EffectiveAccess; at: number }>()
const TTL_MS = 60_000

export function bustRoleCache() {
  cache.clear()
}

export async function getEffectiveAccess(userId: string, role: string): Promise<EffectiveAccess> {
  const hit = cache.get(userId)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      appRole: { select: { id: true, key: true, name: true, permissions: true, isActive: true } },
    },
  })

  const effectiveRole = user?.role || role
  let permissions: string[]
  let appRole: EffectiveAccess['appRole'] = null

  if (user?.appRole && user.appRole.isActive) {
    appRole = { id: user.appRole.id, key: user.appRole.key, name: user.appRole.name }
    try {
      permissions = sanitizePermissions(JSON.parse(user.appRole.permissions || '[]'))
    } catch {
      permissions = []
    }
  } else {
    // No custom role attached — fall back to the editable system AppRole row
    // for their built-in role (so editing "Manager" in /settings/roles really
    // changes what every manager can do), and only then to the hardcoded
    // defaults if that row hasn't been seeded yet.
    const systemRole = await prisma.appRole.findUnique({
      where: { key: effectiveRole },
      select: { id: true, key: true, name: true, permissions: true, isActive: true, isSystem: true },
    })
    if (systemRole?.isSystem && systemRole.isActive) {
      appRole = { id: systemRole.id, key: systemRole.key, name: systemRole.name }
      try {
        permissions = sanitizePermissions(JSON.parse(systemRole.permissions || '[]'))
      } catch {
        permissions = DEFAULT_ROLE_PERMISSIONS[effectiveRole] || []
      }
    } else {
      permissions = DEFAULT_ROLE_PERMISSIONS[effectiveRole] || []
    }
  }

  // Super admin is never locked out, whatever a custom role says
  if (effectiveRole === 'SUPER_ADMIN') permissions = DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN

  const value: EffectiveAccess = { userId, role: effectiveRole, appRole, permissions }
  cache.set(userId, { value, at: Date.now() })
  return value
}

/**
 * Route guard. Returns { session, access } on success, or a Response (401/403).
 *
 *   const auth = await requirePermission(req, 'clients.create')
 *   if (auth instanceof Response) return auth
 */
export async function requirePermission(req: NextRequest, permission: string) {
  const session = await getRequestSession(req)
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  const access = await getEffectiveAccess(session.userId, session.role)
  if (!checkPermission(access.permissions, permission, access.role)) {
    return new Response(
      JSON.stringify({ error: 'You do not have permission to do that', permission }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return { session, access }
}

/** Non-throwing check, for handlers that branch instead of rejecting. */
export async function userCan(userId: string, role: string, permission: string) {
  const access = await getEffectiveAccess(userId, role)
  return checkPermission(access.permissions, permission, access.role)
}
