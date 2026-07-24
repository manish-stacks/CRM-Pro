// src/app/api/mobile/push-test/route.ts
// Fires a test push to the *calling* device and reports exactly what happened.
// The app's Notification Settings screen hits this so push delivery can be
// verified end-to-end without touching the database by hand.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { getClientSession } from '@/lib/clientAuth'
import { sendPush, isFcmConfigured } from '@/lib/push'

export async function POST(req: NextRequest) {
  const select = { fcmToken: true, expoPushToken: true, pushPlatform: true } as const

  let target: { fcmToken: string | null; expoPushToken: string | null } | null = null
  let scope: 'user' | 'client' | null = null

  const staff = await getRequestSession(req)
  if (staff) {
    target = await prisma.user.findUnique({ where: { id: staff.userId }, select })
    scope = 'user'
  } else {
    const client = await getClientSession(req)
    if (client) {
      target = await prisma.client.findUnique({ where: { id: client.clientId }, select })
      scope = 'client'
    }
  }

  if (!target || !scope) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  if (!target.fcmToken && !target.expoPushToken) {
    return NextResponse.json({
      success: false,
      message: 'No push token registered for this device. Allow notifications, then log out and log back in.',
    }, { status: 400 })
  }

  const result = await sendPush([target], {
    title: 'Test Notification',
    body: 'Push notifications are working correctly.',
    data: { screen: 'Notifications', type: 'info', test: '1' },
  })

  return NextResponse.json({
    success: result.sent > 0,
    message: result.sent > 0
      ? 'Test notification sent — it should arrive within a few seconds.'
      : (result.error || 'Delivery failed. Check the server FCM credentials.'),
    data: {
      scope,
      provider: target.fcmToken ? 'fcm' : 'expo',
      fcmConfigured: isFcmConfigured(),
      ...result,
    },
  })
}
