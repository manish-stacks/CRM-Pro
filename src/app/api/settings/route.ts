// src/app/api/settings/route.ts
// Admin-only. Get all settings + bulk update.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { invalidateAllSettings } from '@/lib/settings'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth

  const rows = await prisma.setting.findMany({ orderBy: [{ category: 'asc' }, { key: 'asc' }] })
  // Group by category for nicer UI
  const grouped: Record<string, Record<string, any>> = {}
  for (const r of rows) {
    let value: any = r.value
    try { value = JSON.parse(r.value) } catch {}
    if (!grouped[r.category]) grouped[r.category] = {}
    grouped[r.category][r.key] = value
  }
  return successResponse({ grouped, raw: rows })
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const body = await req.json()
  const settings: Record<string, { value: any; category?: string }> = body.settings || body
  if (typeof settings !== 'object' || settings === null) return errorResponse('settings object required')

  const ops: any[] = []
  for (const [key, entry] of Object.entries(settings)) {
    const value = (entry as any).value ?? entry
    const category = (entry as any).category || 'general'
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    ops.push(
      prisma.setting.upsert({
        where: { key },
        update: { value: serialized, category },
        create: { key, value: serialized, category },
      })
    )
  }
  await prisma.$transaction(ops)
  invalidateAllSettings()

  await logFromRequest(req, {
    userId: session.userId, action: 'UPDATE', entityType: 'Settings',
    metadata: { updated: Object.keys(settings) },
  })

  return successResponse({ updated: Object.keys(settings).length })
}
