// src/app/api/roles/assign/route.ts
// Attach (or clear) a custom permission role on one or more users.
// Passing roleId: null puts the user back on their built-in role defaults.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'
import { requirePermission, bustRoleCache } from '@/lib/permissions.server'
import { logFromRequest } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'roles.manage')
  if (auth instanceof Response) return auth
  const { session } = auth

  const { userIds, roleId } = await req.json()
  const ids: string[] = Array.isArray(userIds) ? userIds : [userIds].filter(Boolean)
  if (!ids.length) return errorResponse('Select at least one user')

  let baseRole: string | null = null
  if (roleId) {
    const role = await prisma.appRole.findUnique({ where: { id: roleId }, select: { baseRole: true } })
    if (!role) return errorResponse('Role not found', 404)
    baseRole = role.baseRole
  }

  // Never let anyone strip a super admin of their own access
  const targets = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, role: true },
  })
  const blocked = targets.filter(u => u.role === 'SUPER_ADMIN').map(u => u.id)
  const allowed = targets.filter(u => u.role !== 'SUPER_ADMIN').map(u => u.id)
  if (!allowed.length) return errorResponse('Super admins cannot be assigned a restricted role', 400)

  await prisma.user.updateMany({
    where: { id: { in: allowed } },
    data: {
      appRoleId: roleId || null,
      // Keep the built-in role in step so existing hierarchy checks and the
      // sidebar's role lists stay coherent with the custom role's scope.
      ...(baseRole ? { role: baseRole } : {}),
    },
  })

  bustRoleCache()
  await logFromRequest(req, {
    userId: session.userId, action: 'UPDATE', entityType: 'User',
    entityId: allowed.join(','),
    metadata: { action: 'ASSIGN_ROLE', roleId: roleId || null, count: allowed.length },
  })

  return successResponse({ updated: allowed.length, skipped: blocked })
}
