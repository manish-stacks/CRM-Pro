// src/app/api/auth/logout/route.ts
// Phase 2: closes the LoginActivity record (sets logoutAt)
import { NextRequest, NextResponse } from 'next/server'
import { logLogout } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const activityId = req.cookies.get('login-activity-id')?.value
  if (activityId) {
    await logLogout(activityId)
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('auth-token')
  res.cookies.delete('login-activity-id')
  return res
}
