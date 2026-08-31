// src/app/api/notifications/web-push-token/route.ts
// Register / unregister this browser for Chrome (web) push.
//
// One row per browser, keyed on the FCM registration token. Re-registering the
// same browser just bumps lastSeen, and re-pointing a token at a different
// user (shared machine) reassigns it instead of creating a duplicate.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  let body: any = {}
  try { body = await req.json() } catch { }
  const token = String(body.token || '').trim()
  if (token.length < 50) return errorResponse('Invalid push token')

  const userAgent = req.headers.get('user-agent')?.slice(0, 500) || null

  await prisma.webPushToken.upsert({
    where: { token },
    update: { userId: session.userId, lastSeen: new Date(), userAgent },
    create: { token, userId: session.userId, userAgent },
  })

  return successResponse({ registered: true })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  let body: any = {}
  try { body = await req.json() } catch { }
  const token = String(body.token || '').trim()

  if (token) await prisma.webPushToken.deleteMany({ where: { token, userId: session.userId } })
  else await prisma.webPushToken.deleteMany({ where: { userId: session.userId } })

  return successResponse({ removed: true })
}
