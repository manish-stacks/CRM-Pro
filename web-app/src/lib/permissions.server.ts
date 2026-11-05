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
  appRoles: { id: string; key: string; name: string }[]
  customPermissions: string[]
  permissions: string[]
}

// Small in-process cache — role permissions change rarely but are read on
// nearly every request. Cleared whenever a role is saved (see bustRoleCache).
const cache = new Map<string, { value: EffectiveAccess; at: number }>()
const TTL_MS = 60_000

export function bustRoleCache(userId?: string) {
  if (userId) {
    cache.delete(userId)
  } else {
    cache.clear()
  }
}

export async function getEffectiveAccess(userId: string, role: string): Promise<EffectiveAccess> {
  const hit = cache.get(userId)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      appRoleId: true,
      assignedRoleIds: true,
      customPermissions: true,
      appRole: { select: { id: true, key: true, name: true, permissions: true, isActive: true } },
    },
  })

  const effectiveRole = user?.role || role
  const permissionsSet = new Set<string>()
  const appRolesList: { id: string; key: string; name: string }[] = []

  // Parse multi-role IDs
  let multiRoleIds: string[] = []
  if (user?.assignedRoleIds) {
    try {
      const parsed = JSON.parse(user.assignedRoleIds)
      if (Array.isArray(parsed)) multiRoleIds = parsed.filter(Boolean)
    } catch {
      multiRoleIds = []
    }
  }

  // Combine primary appRoleId and any assigned multi-role IDs
  const allRoleIds = Array.from(new Set([user?.appRoleId, ...multiRoleIds].filter(Boolean) as string[]))

  if (allRoleIds.length > 0) {
    const rolesData = await prisma.appRole.findMany({
      where: { id: { in: allRoleIds }, isActive: true },
      select: { id: true, key: true, name: true, permissions: true },
    })

    for (const r of rolesData) {
      appRolesList.push({ id: r.id, key: r.key, name: r.name })
      try {
        const perms = sanitizePermissions(JSON.parse(r.permissions || '[]'))
        for (const p of perms) permissionsSet.add(p)
      } catch { /* ignore malformed JSON */ }
    }
  }

  // If no custom roles attached, fall back to default / system role permissions
  if (appRolesList.length === 0) {
    const systemRole = await prisma.appRole.findUnique({
      where: { key: effectiveRole },
      select: { id: true, key: true, name: true, permissions: true, isActive: true, isSystem: true },
    })
    if (systemRole?.isSystem && systemRole.isActive) {
      appRolesList.push({ id: systemRole.id, key: systemRole.key, name: systemRole.name })
      try {
        const perms = sanitizePermissions(JSON.parse(systemRole.permissions || '[]'))
        for (const p of perms) permissionsSet.add(p)
      } catch {
        for (const p of (DEFAULT_ROLE_PERMISSIONS[effectiveRole] || [])) permissionsSet.add(p)
      }
    } else {
      for (const p of (DEFAULT_ROLE_PERMISSIONS[effectiveRole] || [])) permissionsSet.add(p)
    }
  }

  // Direct extra user permissions
  let directPerms: string[] = []
  if (user?.customPermissions) {
    try {
      directPerms = sanitizePermissions(JSON.parse(user.customPermissions))
      for (const p of directPerms) permissionsSet.add(p)
    } catch {
      directPerms = []
    }
  }

  // Super admin always has all permissions
  let finalPermissions: string[]
  if (effectiveRole === 'SUPER_ADMIN') {
    finalPermissions = DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN
  } else {
    finalPermissions = Array.from(permissionsSet)
  }

  const primaryAppRole = appRolesList[0] || null
  const value: EffectiveAccess = {
    userId,
    role: effectiveRole,
    appRole: primaryAppRole,
    appRoles: appRolesList,
    customPermissions: directPerms,
    permissions: finalPermissions,
  }

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
