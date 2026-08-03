// src/app/api/notifications/test-push/route.ts
// Admin-side push diagnostics.
//
//   GET  -> is FCM configured? how many devices are registered? (health check)
//   POST -> { userId?: string }  send a real test push (defaults to yourself)
//
// This is the fastest way to prove the whole chain works: credentials -> token
// lookup -> FCM -> device.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { sendPushToUsers } from '@/lib/push'
import { isFcmConfigured, fcmProjectId, fcmConfigStatus } from '@/lib/fcm'
import { notify } from '@/lib/notify'

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN']

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })

  const [usersWithFcm, usersWithExpo, clientsWithFcm, clientsWithExpo, me] = await Promise.all([
    prisma.user.count({ where: { fcmToken: { not: null } } }),
    prisma.user.count({ where: { expoPushToken: { not: null } } }),
    prisma.client.count({ where: { fcmToken: { not: null } } }),
    prisma.client.count({ where: { expoPushToken: { not: null } } }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { fcmToken: true, expoPushToken: true, pushPlatform: true, pushTokenAt: true },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      fcm: fcmConfigStatus(),
      devices: {
        usersWithFcm,
        usersWithExpo,
        clientsWithFcm,
        clientsWithExpo,
        total: usersWithFcm + usersWithExpo + clientsWithFcm + clientsWithExpo,
      },
      you: {
        provider: me?.fcmToken ? 'fcm' : me?.expoPushToken ? 'expo' : null,
        registered: !!(me?.fcmToken || me?.expoPushToken),
        platform: me?.pushPlatform || null,
        updatedAt: me?.pushTokenAt || null,
      },
    },
  })
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })

  let body: any = {}
  try { body = await req.json() } catch {}

  // Sending a test to somebody else is an admin-only action.
  const targetUserId: string = body?.userId || session.userId
  if (targetUserId !== session.userId && !ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
  }

  const title = body?.title || 'Test Notification'
  const message = body?.message || 'Push notifications are working correctly.'

  // `withRecord: true` also writes the in-app Notification row, so you can test
  // the bell icon and the device push together.
  if (body?.withRecord) {
    await notify({ userIds: targetUserId, title, message, type: 'info' })
    return NextResponse.json({ success: true, message: 'Notification created and pushed.' })
  }

  const result = await sendPushToUsers([targetUserId], {
    title,
    body: message,
    data: { screen: 'Notifications', type: 'info', test: '1' },
  })

  return NextResponse.json({
    success: result.sent > 0,
    message: result.sent > 0
      ? `Sent to ${result.sent} device(s) (FCM: ${result.viaFcm}, Expo: ${result.viaExpo}).`
      : (result.error || 'No registered device for this user, or delivery failed.'),
    data: { fcmConfigured: isFcmConfigured(), ...result },
  })
}
