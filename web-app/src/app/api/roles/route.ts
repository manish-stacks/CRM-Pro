// src/app/api/roles/route.ts
// Custom permission roles. Only someone with "roles.manage" can touch these —
// which by default means SUPER_ADMIN, so a sub-admin can never widen their own
// access.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, successStatusResponse, errorResponse } from '@/lib/api'
import { requirePermission, bustRoleCache } from '@/lib/permissions.server'
import { sanitizePermissions, PERMISSION_MODULES, DEFAULT_ROLE_PERMISSIONS, BASE_ROLES, SYSTEM_ROLES } from '@/lib/permissions'
import { logFromRequest } from '@/lib/audit'

// BASE_ROLES / SYSTEM_ROLES now live in @/lib/permissions (single source of
// truth) — every built-in role also exists as an editable AppRole row, so
// the list is never empty and an admin can widen/narrow a built-in role
// instead of only cloning it. These are seeded on first load and can be
// edited but not deleted.

async function ensureSystemRoles() {
  const existing = await prisma.appRole.findMany({
    where: { key: { in: SYSTEM_ROLES.map(r => r.key) } },
    select: { key: true },
  })
  const have = new Set(existing.map(r => r.key))
  const missing = SYSTEM_ROLES.filter(r => !have.has(r.key))
  if (!missing.length) return

  await prisma.appRole.createMany({
    data: missing.map(r => ({
      key: r.key,
      name: r.name,
      description: r.description,
      baseRole: r.key === 'SUPER_ADMIN' ? 'ADMIN' : r.key,
      permissions: JSON.stringify(DEFAULT_ROLE_PERMISSIONS[r.key] || []),
      isSystem: true,
    })),
    skipDuplicates: true,
  })
}

const slugify = (s: string) =>
  s.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'roles.view')
  if (auth instanceof Response) return auth

  await ensureSystemRoles()

  const roles = await prisma.appRole.findMany({
    orderBy: [{ isSystem: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { users: true } } },
  })

  // A system role's member count should also include people who still sit on
  // the built-in role string without an AppRole row attached.
  const builtInCounts = await prisma.user.groupBy({
    by: ['role'],
    where: { appRoleId: null, isActive: true },
    _count: { _all: true },
  })
  const builtInByRole: Record<string, number> = Object.fromEntries(
    builtInCounts.map(c => [c.role, c._count._all])
  )

  return successResponse({
    roles: roles.map(r => ({
      ...r,
      permissions: (() => { try { return JSON.parse(r.permissions || '[]') } catch { return [] } })(),
      userCount: r._count.users + (r.isSystem ? (builtInByRole[r.key] || 0) : 0),
    })),
    // The catalog travels with the list so the UI never hardcodes it
    modules: PERMISSION_MODULES,
    baseRoles: BASE_ROLES,
    defaults: DEFAULT_ROLE_PERMISSIONS,
  })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'roles.manage')
  if (auth instanceof Response) return auth
  const { session } = auth

  const { name, description, baseRole, permissions, cloneFrom } = await req.json()
  if (!name?.trim()) return errorResponse('Role name is required')

  const key = slugify(name)
  if (!key) return errorResponse('Role name must contain letters or numbers')

  const exists = await prisma.appRole.findUnique({ where: { key } })
  if (exists) return errorResponse('A role with that name already exists')

  // Start from a built-in role's defaults when the UI asks to clone one
  const perms = permissions
    ? sanitizePermissions(permissions)
    : sanitizePermissions(DEFAULT_ROLE_PERMISSIONS[cloneFrom || baseRole || 'EMPLOYEE'] || [])

  const role = await prisma.appRole.create({
    data: {
      key,
      name: name.trim(),
      description: description?.trim() || null,
      baseRole: BASE_ROLES.includes(baseRole) ? baseRole : 'EMPLOYEE',
      permissions: JSON.stringify(perms),
      createdById: session.userId,
    },
  })

  bustRoleCache()
  await logFromRequest(req, {
    userId: session.userId, action: 'CREATE', entityType: 'AppRole', entityId: role.id,
    metadata: { name: role.name, permissionCount: perms.length },
  })

  return successStatusResponse({ ...role, permissions: perms }, 201)
}
