// src/app/api/settings/holiday-calendar/route.ts
// The Holiday Calendar PDF shown from the header icon. GET is available to
// any logged-in staff member (just the URL — no other settings exposed).
// POST (upload/replace) is Admin-only and deletes the previous Cloudinary
// file first, so replacing the calendar never leaves an orphaned old PDF.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, getRequestSession } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { deleteFile } from '@/lib/cloudinary'
import { invalidateSetting } from '@/lib/settings'

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const row = await prisma.setting.findUnique({ where: { key: 'holiday_calendar_url' } })
  return successResponse({ url: row?.value || '' })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { url, publicId, resourceType } = await req.json()
  if (!url || !publicId) return errorResponse('url and publicId required — upload the PDF via /api/upload first')

  const [oldUrlRow, oldIdRow, oldTypeRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'holiday_calendar_url' } }),
    prisma.setting.findUnique({ where: { key: 'holiday_calendar_public_id' } }),
    prisma.setting.findUnique({ where: { key: 'holiday_calendar_resource_type' } }),
  ])

  // Delete the previous file so a replace never leaves an orphaned PDF sitting in Cloudinary.
  if (oldIdRow?.value && oldIdRow.value !== publicId) {
    await deleteFile(oldIdRow.value, (oldTypeRow?.value as any) || 'image')
  }

  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: 'holiday_calendar_url' },
      update: { value: url, category: 'company' },
      create: { key: 'holiday_calendar_url', value: url, category: 'company' },
    }),
    prisma.setting.upsert({
      where: { key: 'holiday_calendar_public_id' },
      update: { value: publicId, category: 'company' },
      create: { key: 'holiday_calendar_public_id', value: publicId, category: 'company' },
    }),
    prisma.setting.upsert({
      where: { key: 'holiday_calendar_resource_type' },
      update: { value: resourceType || 'image', category: 'company' },
      create: { key: 'holiday_calendar_resource_type', value: resourceType || 'image', category: 'company' },
    }),
  ])

  invalidateSetting('holiday_calendar_url')

  await logFromRequest(req, {
    userId: session.userId,
    action: 'UPDATE',
    entityType: 'Settings',
    metadata: { updated: 'holiday_calendar', replaced: !!oldUrlRow?.value },
  })

  return successResponse({ url, replaced: !!oldUrlRow?.value })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const [idRow, typeRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'holiday_calendar_public_id' } }),
    prisma.setting.findUnique({ where: { key: 'holiday_calendar_resource_type' } }),
  ])
  if (idRow?.value) {
    await deleteFile(idRow.value, (typeRow?.value as any) || 'image')
  }

  await prisma.setting.deleteMany({
    where: { key: { in: ['holiday_calendar_url', 'holiday_calendar_public_id', 'holiday_calendar_resource_type'] } },
  })
  invalidateSetting('holiday_calendar_url')

  await logFromRequest(req, {
    userId: session.userId,
    action: 'DELETE',
    entityType: 'Settings',
    metadata: { removed: 'holiday_calendar' },
  })

  return successResponse({ deleted: true })
}
