// src/app/api/mobile/meetings/schedule/route.ts
// Slot-by-slot view of the marketing person's own day(s) in the app, so they
// can see the whole schedule at once instead of scrolling a flat list and
// guessing which slot is which.
import { NextRequest } from 'next/server'
import { requireMobileEmployee, ok } from '@/lib/mobileAuth'
import { buildSchedule } from '@/lib/marketingSchedule'

export async function GET(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const days = Math.min(7, Math.max(1, Number(searchParams.get('days') || 1)))

  const result = await buildSchedule(session.userId, date, days)
  return ok({
    days: result.days,
    office_start: result.officeStart,
    office_end: result.officeEnd,
    slot_minutes: result.slotMinutes,
  })
}
