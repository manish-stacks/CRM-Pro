// src/app/api/settings/holiday-calendar/route.ts
// Holiday Calendar PDF — stored locally on disk (public/uploads/holiday-calendar/),
// not Cloudinary. GET is for any logged-in user, POST (upload/replace, deletes
// old file) and DELETE are Admin-only.
import { NextRequest } from 'next/server'
import { writeFile, unlink, mkdir } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { requireAuth, getRequestSession } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { invalidateSetting } from '@/lib/settings'

const DIR = path.join(process.cwd(), 'public', 'uploads', 'holiday-calendar')

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

  const { dataUrl } = await req.json()
  if (!dataUrl || !dataUrl.startsWith('data:application/pdf')) {
    return errorResponse('dataUrl must be a base64 PDF (data:application/pdf;base64,...)')
  }

  const base64 = dataUrl.split(',')[1]
  const buffer = Buffer.from(base64, 'base64')
  if (buffer.byteLength > 10 * 1024 * 1024) return errorResponse('Max 10MB')

  const filename = `holiday-calendar_${Date.now()}.pdf`
  await mkdir(DIR, { recursive: true })
  await writeFile(path.join(DIR, filename), buffer)
  const url = `/uploads/holiday-calendar/${filename}`

  // Delete the previous file so replacing never leaves an orphaned old PDF.
  const oldRow = await prisma.setting.findUnique({ where: { key: 'holiday_calendar_url' } })
  if (oldRow?.value && oldRow.value.startsWith('/uploads/holiday-calendar/')) {
    await unlink(path.join(process.cwd(), 'public', oldRow.value)).catch(() => {})
  }

  await prisma.setting.upsert({
    where: { key: 'holiday_calendar_url' },
    update: { value: url, category: 'company' },
    create: { key: 'holiday_calendar_url', value: url, category: 'company' },
  })
  invalidateSetting('holiday_calendar_url')

  await logFromRequest(req, {
    userId: session.userId, action: 'UPDATE', entityType: 'Settings',
    metadata: { updated: 'holiday_calendar', replaced: !!oldRow?.value },
  })

  return successResponse({ url, replaced: !!oldRow?.value })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const row = await prisma.setting.findUnique({ where: { key: 'holiday_calendar_url' } })
  if (row?.value && row.value.startsWith('/uploads/holiday-calendar/')) {
    await unlink(path.join(process.cwd(), 'public', row.value)).catch(() => {})
  }
  await prisma.setting.deleteMany({ where: { key: 'holiday_calendar_url' } })
  invalidateSetting('holiday_calendar_url')

  await logFromRequest(req, { userId: session.userId, action: 'DELETE', entityType: 'Settings', metadata: { removed: 'holiday_calendar' } })
  return successResponse({ deleted: true })
}
