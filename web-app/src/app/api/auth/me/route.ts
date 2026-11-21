// src/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectiveAccess } from '@/lib/permissions.server'

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      employee: { include: { department: true } },
      appRole: { select: { id: true, key: true, name: true, baseRole: true } },
    }
  })

  if (!user || !user.isActive) {
    return NextResponse.json({ error: 'User not found or account has been disabled' }, { status: 401 })
  }

  // Effective permission list — the custom role if one is attached, otherwise
  // the built-in defaults. The client uses this for can() checks.
  const access = await getEffectiveAccess(user.id, user.role)

  const { password: _, ...safeUser } = user
  return NextResponse.json({
    ...safeUser,
    baseRole: access.baseRole,
    dataScope: access.dataScope,
    appRole: access.appRole,
    appRoles: access.appRoles,
    customPermissions: access.customPermissions,
    permissions: access.permissions,
    impersonatedBy: session.impersonatedBy || null,
    impersonatedByName: session.impersonatedByName || null,
  })
}
