// src/app/api/roles/assign/route.ts
// Attach (or clear) custom permission roles and direct permissions on one or more users.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'
import { requirePermission, bustRoleCache } from '@/lib/permissions.server'
import { sanitizePermissions } from '@/lib/permissions'
import { logFromRequest } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'roles.manage')
  if (auth instanceof Response) return auth
  const { session } = auth

  const body = await req.json()
  const { userIds, roleId, roleIds, customPermissions } = body
  const ids: string[] = Array.isArray(userIds) ? userIds : [userIds].filter(Boolean)
  if (!ids.length) return errorResponse('Select at least one user')

  const parsedRoleIds: string[] = Array.isArray(roleIds)
    ? Array.from(new Set(roleIds.filter(Boolean)))
    : (roleId ? [roleId] : [])

  let baseRole: string | null = null
  if (parsedRoleIds.length > 0) {
    const roles = await prisma.appRole.findMany({
      where: { id: { in: parsedRoleIds } },
      select: { baseRole: true },
    })
    // If any assigned role has a higher data-scope tier like ADMIN or MANAGER, map to it
    const roleHierarchy = ['ADMIN', 'MANAGER', 'MARKETING_EXECUTIVE', 'TELECALLER', 'EMPLOYEE']
    for (const h of roleHierarchy) {
      if (roles.some(r => r.baseRole === h)) {
        baseRole = h
        break
      }
    }
  }

  // Never let anyone strip a super admin of their own access
  const targets = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, role: true },
  })
  const blocked = targets.filter(u => u.role === 'SUPER_ADMIN').map(u => u.id)
  const allowed = targets.filter(u => u.role !== 'SUPER_ADMIN').map(u => u.id)
  if (!allowed.length) return errorResponse('Super admins cannot be assigned a restricted role', 400)

  const primaryRoleId = parsedRoleIds[0] || null
  const assignedRoleIdsJson = parsedRoleIds.length > 0 ? JSON.stringify(parsedRoleIds) : null
  const customPermissionsJson = customPermissions !== undefined
    ? (Array.isArray(customPermissions) ? JSON.stringify(sanitizePermissions(customPermissions)) : null)
    : undefined

  await prisma.user.updateMany({
    where: { id: { in: allowed } },
    data: {
      appRoleId: primaryRoleId,
      assignedRoleIds: assignedRoleIdsJson,
      ...(customPermissionsJson !== undefined ? { customPermissions: customPermissionsJson } : {}),
      ...(baseRole ? { role: baseRole } : {}),
    },
  })

  bustRoleCache()
  await logFromRequest(req, {
    userId: session.userId, action: 'UPDATE', entityType: 'User',
    entityId: allowed.join(','),
    metadata: {
      action: 'ASSIGN_ROLES',
      roleIds: parsedRoleIds,
      customPermissionsCount: Array.isArray(customPermissions) ? customPermissions.length : undefined,
      count: allowed.length,
    },
  })

  return successResponse({ updated: allowed.length, skipped: blocked })
}
