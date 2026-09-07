// src/app/api/roles/[id]/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { requirePermission, bustRoleCache } from '@/lib/permissions.server'
import { sanitizePermissions, BASE_ROLES } from '@/lib/permissions'
import { logFromRequest } from '@/lib/audit'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requirePermission(req, 'roles.view')
  if (auth instanceof Response) return auth

  const role = await prisma.appRole.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, name: true, email: true, avatar: true, role: true } },
    },
  })
  if (!role) return notFoundResponse('Role')

  return successResponse({
    ...role,
    permissions: (() => { try { return JSON.parse(role.permissions || '[]') } catch { return [] } })(),
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requirePermission(req, 'roles.manage')
  if (auth instanceof Response) return auth
  const { session } = auth

  const role = await prisma.appRole.findUnique({ where: { id } })
  if (!role) return notFoundResponse('Role')

  const { name, description, baseRole, permissions, isActive } = await req.json()

  const data: any = {}
  if (name !== undefined) {
    if (!name.trim()) return errorResponse('Role name is required')
    // The key is the stable identifier other rows point at — renaming a system
    // preset changes only its display name.
    data.name = name.trim()
  }
  if (description !== undefined) data.description = description?.trim() || null
  if (baseRole !== undefined && BASE_ROLES.includes(baseRole)) data.baseRole = baseRole
  if (isActive !== undefined) data.isActive = !!isActive
  if (permissions !== undefined) data.permissions = JSON.stringify(sanitizePermissions(permissions))

  if (!Object.keys(data).length) return errorResponse('Nothing to update')

  const updated = await prisma.appRole.update({ where: { id }, data })
  bustRoleCache()

  await logFromRequest(req, {
    userId: session.userId, action: 'UPDATE', entityType: 'AppRole', entityId: id,
    metadata: { name: updated.name },
  })

  return successResponse({
    ...updated,
    permissions: (() => { try { return JSON.parse(updated.permissions || '[]') } catch { return [] } })(),
  })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requirePermission(req, 'roles.manage')
  if (auth instanceof Response) return auth
  const { session } = auth

  const role = await prisma.appRole.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  })
  if (!role) return notFoundResponse('Role')
  if (role.isSystem) return errorResponse('Built-in roles cannot be deleted — deactivate it instead', 400)
  if (role._count.users > 0) {
    return errorResponse(`${role._count.users} user(s) still use this role — move them first`, 400)
  }

  await prisma.appRole.delete({ where: { id } })
  bustRoleCache()

  await logFromRequest(req, {
    userId: session.userId, action: 'DELETE', entityType: 'AppRole', entityId: id,
    metadata: { name: role.name },
  })

  return successResponse({ id })
}
