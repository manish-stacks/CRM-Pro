// src/app/api/reminders/route.ts
// Personal reminders / to-do — each employee only sees + manages their own.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, unauthorizedResponse, errorResponse } from '@/lib/api'

// The <input type="datetime-local"> sends a plain "YYYY-MM-DDTHH:mm" string with
// no timezone info. `new Date(str)` would parse that using the SERVER's local
// timezone (often UTC in production), which silently shifts the reminder by
// hours vs what the employee actually picked in their (IST) browser. Since
// this app's staff are all IST (Settings default timezone is Asia/Kolkata),
// interpret the picked wall-clock time as IST explicitly.
function parseIstLocal(input: string): Date {
  const [datePart, timePart = '00:00'] = input.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  const [hh, mm] = timePart.split(':').map(Number)
  // IST = UTC+5:30 — build the UTC instant directly so it round-trips correctly
  // regardless of the server's own system timezone.
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, (hh || 0) - 5, (mm || 0) - 30))
}

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // 'pending' | 'done' | omitted = all

  const where: any = { userId: session.userId }
  if (status === 'pending') where.isDone = false
  if (status === 'done') where.isDone = true

  const [items, pendingCount] = await Promise.all([
    prisma.reminder.findMany({ where, orderBy: { remindAt: 'asc' } }),
    prisma.reminder.count({ where: { userId: session.userId, isDone: false } }),
  ])

  return successResponse({ items, pendingCount })
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { title, note, remindAt } = await req.json()
  if (!title || !title.trim()) return errorResponse('Title required')
  if (!remindAt) return errorResponse('Reminder date/time required')

  const reminder = await prisma.reminder.create({
    data: {
      userId: session.userId,
      title: title.trim(),
      note: note || null,
      remindAt: parseIstLocal(remindAt),
    },
  })

  return successResponse(reminder)
}
