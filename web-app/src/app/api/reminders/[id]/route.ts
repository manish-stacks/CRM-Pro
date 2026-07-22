// src/app/api/reminders/[id]/route.ts
// Update (edit fields / toggle done) or delete a single personal reminder.
// Scoped to the owner — you can't touch someone else's reminder.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, unauthorizedResponse, notFoundResponse, errorResponse } from '@/lib/api'

// See src/app/api/reminders/route.ts for why this exists — the datetime-local
// input has no timezone, so it must be parsed as IST explicitly rather than
// relying on the server's own system timezone.
function parseIstLocal(input: string): Date {
  const [datePart, timePart = '00:00'] = input.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  const [hh, mm] = timePart.split(':').map(Number)
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, (hh || 0) - 5, (mm || 0) - 30))
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const existing = await prisma.reminder.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.userId) return notFoundResponse('Reminder')

  const body = await req.json()
  const data: any = {}
  if (body.title !== undefined) {
    if (!body.title.trim()) return errorResponse('Title required')
    data.title = body.title.trim()
  }
  if (body.note !== undefined) data.note = body.note || null
  if (body.remindAt !== undefined) {
    data.remindAt = parseIstLocal(body.remindAt)
    data.notifiedAt = null // date changed — allow the cron to notify again at the new time
  }
  if (body.isDone !== undefined) data.isDone = !!body.isDone

  const updated = await prisma.reminder.update({ where: { id }, data })
  return successResponse(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const existing = await prisma.reminder.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.userId) return notFoundResponse('Reminder')

  await prisma.reminder.delete({ where: { id } })
  return successResponse({ ok: true })
}
