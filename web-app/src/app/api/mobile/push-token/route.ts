// src/app/api/mobile/push-token/route.ts
// The mobile app registers its device push token here after login.
// Works for both staff (Bearer user token) and clients (Bearer client token).
//
// Body: { token: string, provider?: 'fcm' | 'expo', platform?: 'android' | 'ios' }
//
// `provider` is optional — if the app doesn't send it we auto-detect: anything
// shaped like ExponentPushToken[...] is an Expo token, everything else is
// treated as a native FCM registration token.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { getClientSession } from '@/lib/clientAuth'

function detectProvider(token: string, hinted?: string): 'fcm' | 'expo' {
  if (hinted === 'fcm' || hinted === 'expo') return hinted
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')
    ? 'expo'
    : 'fcm'
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req)
  } catch (e: any) {
    // Surface the real reason instead of an opaque 500. The usual cause is that
    // `npx prisma db push && npx prisma generate` hasn't been run yet, so the
    // fcmToken / pushPlatform / pushTokenAt columns don't exist.
    const msg = String(e?.message || e)
    console.error('[push-token] Registration failed:', msg)
    const missingColumn = /Unknown argument|Unknown column|does not exist in the current database/i.test(msg)
    return NextResponse.json({
      success: false,
      message: missingColumn
        ? 'Push columns missing. Run: npx prisma db push && npx prisma generate, then restart the server.'
        : msg,
    }, { status: 500 })
  }
}

async function handlePost(req: NextRequest) {
  let body: any = {}
  try { body = await req.json() } catch {}

  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  if (!token) {
    return NextResponse.json({ success: false, message: 'token required' }, { status: 400 })
  }

  const provider = detectProvider(token, body?.provider)
  const platform = typeof body?.platform === 'string' ? body.platform.slice(0, 20) : null

  // When the same device re-registers with a different provider, clear the other
  // column so we never send the same notification twice to one phone.
  const data =
    provider === 'fcm'
      ? { fcmToken: token, expoPushToken: null, pushPlatform: platform, pushTokenAt: new Date() }
      : { expoPushToken: token, fcmToken: null, pushPlatform: platform, pushTokenAt: new Date() }

  // Staff first
  const staff = await getRequestSession(req)
  if (staff) {
    // A token can only live on one account: if this phone was previously logged
    // in as somebody else, detach it there first, otherwise the old user keeps
    // receiving this device's notifications.
    await prisma.user.updateMany({
      where: provider === 'fcm' ? { fcmToken: token } : { expoPushToken: token },
      data: provider === 'fcm' ? { fcmToken: null } : { expoPushToken: null },
    }).catch(() => {})
    await prisma.client.updateMany({
      where: provider === 'fcm' ? { fcmToken: token } : { expoPushToken: token },
      data: provider === 'fcm' ? { fcmToken: null } : { expoPushToken: null },
    }).catch(() => {})

    await prisma.user.update({ where: { id: staff.userId }, data })
    return NextResponse.json({ success: true, data: { scope: 'user', provider } })
  }

  // Then client
  const client = await getClientSession(req)
  if (client) {
    await prisma.client.updateMany({
      where: provider === 'fcm' ? { fcmToken: token } : { expoPushToken: token },
      data: provider === 'fcm' ? { fcmToken: null } : { expoPushToken: null },
    }).catch(() => {})
    await prisma.user.updateMany({
      where: provider === 'fcm' ? { fcmToken: token } : { expoPushToken: token },
      data: provider === 'fcm' ? { fcmToken: null } : { expoPushToken: null },
    }).catch(() => {})

    await prisma.client.update({ where: { id: client.clientId }, data })
    return NextResponse.json({ success: true, data: { scope: 'client', provider } })
  }

  return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
}

// Current registration state — used by the app's notification-diagnostics screen.
export async function GET(req: NextRequest) {
  const staff = await getRequestSession(req)
  if (staff) {
    const u = await prisma.user.findUnique({
      where: { id: staff.userId },
      select: { fcmToken: true, expoPushToken: true, pushPlatform: true, pushTokenAt: true },
    })
    return NextResponse.json({
      success: true,
      data: {
        scope: 'user',
        provider: u?.fcmToken ? 'fcm' : u?.expoPushToken ? 'expo' : null,
        registered: !!(u?.fcmToken || u?.expoPushToken),
        platform: u?.pushPlatform || null,
        updatedAt: u?.pushTokenAt || null,
      },
    })
  }

  const client = await getClientSession(req)
  if (client) {
    const c = await prisma.client.findUnique({
      where: { id: client.clientId },
      select: { fcmToken: true, expoPushToken: true, pushPlatform: true, pushTokenAt: true },
    })
    return NextResponse.json({
      success: true,
      data: {
        scope: 'client',
        provider: c?.fcmToken ? 'fcm' : c?.expoPushToken ? 'expo' : null,
        registered: !!(c?.fcmToken || c?.expoPushToken),
        platform: c?.pushPlatform || null,
        updatedAt: c?.pushTokenAt || null,
      },
    })
  }

  return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
}

// Clear on logout
export async function DELETE(req: NextRequest) {
  const cleared = { fcmToken: null, expoPushToken: null, pushPlatform: null, pushTokenAt: null }

  const staff = await getRequestSession(req)
  if (staff) {
    await prisma.user.update({ where: { id: staff.userId }, data: cleared }).catch(() => {})
    return NextResponse.json({ success: true })
  }

  const client = await getClientSession(req)
  if (client) {
    await prisma.client.update({ where: { id: client.clientId }, data: cleared }).catch(() => {})
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ success: false }, { status: 401 })
}
