// src/lib/push.ts
// Unified mobile push sender.
//
//  PRIMARY : Firebase Cloud Messaging (HTTP v1)  -> User.fcmToken / Client.fcmToken
//  FALLBACK: Expo Push API                       -> User.expoPushToken / Client.expoPushToken
//
// The app now registers a native FCM registration token. Older installs (and
// iOS builds without a Firebase iOS app) still register an Expo token, so both
// paths stay alive and a device is never double-notified: FCM is tried first,
// Expo is only used when that device has no FCM token.
//
// Everything here is best-effort — it never throws to the caller.

import { prisma } from './prisma'
import { sendFcmPush, isFcmToken, isFcmConfigured } from './fcm'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

export interface PushMessage {
  title: string
  body: string
  data?: Record<string, any>
}

export interface PushTarget {
  fcmToken?: string | null
  expoPushToken?: string | null
}

export interface PushResult {
  sent: number
  failed: number
  viaFcm: number
  viaExpo: number
  error?: string
}

export function isExpoToken(t?: string | null): t is string {
  return !!t && (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['))
}

// ---------------------------------------------------------------------------
// Expo (legacy / iOS fallback)
// ---------------------------------------------------------------------------
export async function sendExpoPush(
  tokens: (string | null | undefined)[],
  msg: PushMessage,
): Promise<{ sent: number; invalidTokens: string[] }> {
  const valid = Array.from(new Set(tokens.filter(isExpoToken)))
  if (valid.length === 0) return { sent: 0, invalidTokens: [] }

  const messages = valid.map((to) => ({
    to,
    sound: 'default',
    title: msg.title,
    body: msg.body,
    data: msg.data || {},
    priority: 'high',
    channelId: 'default',
  }))

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    })

    if (!res.ok) {
      console.error('[Push] Expo push failed:', res.status, await res.text().catch(() => ''))
      return { sent: 0, invalidTokens: [] }
    }

    const json: any = await res.json().catch(() => null)
    const invalidTokens: string[] = []
    const tickets: any[] = Array.isArray(json?.data) ? json.data : []
    tickets.forEach((t, i) => {
      if (t?.status === 'error' && t?.details?.error === 'DeviceNotRegistered') {
        invalidTokens.push(valid[i])
      }
    })

    return { sent: valid.length - invalidTokens.length, invalidTokens }
  } catch (e) {
    console.error('[Push] Expo push error:', e)
    return { sent: 0, invalidTokens: [] }
  }
}

// ---------------------------------------------------------------------------
// Dead-token cleanup
// ---------------------------------------------------------------------------
async function purgeDeadTokens(fcm: string[], expo: string[]) {
  try {
    if (fcm.length) {
      await Promise.all([
        prisma.user.updateMany({ where: { fcmToken: { in: fcm } }, data: { fcmToken: null } }),
        prisma.client.updateMany({ where: { fcmToken: { in: fcm } }, data: { fcmToken: null } }),
        // Browser subscriptions die too (cache cleared, permission revoked).
        prisma.webPushToken.deleteMany({ where: { token: { in: fcm } } }),
      ])
    }
    if (expo.length) {
      await Promise.all([
        prisma.user.updateMany({ where: { expoPushToken: { in: expo } }, data: { expoPushToken: null } }),
        prisma.client.updateMany({ where: { expoPushToken: { in: expo } }, data: { expoPushToken: null } }),
      ])
    }
  } catch (e) {
    console.error('[Push] Dead-token cleanup failed:', e)
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Send a push to a set of devices. Each target is one device row (a User or a
 * Client). FCM is preferred; Expo is used only for targets with no FCM token.
 */
export async function sendPush(targets: PushTarget[], msg: PushMessage): Promise<PushResult> {
  const fcmTokens: string[] = []
  const expoTokens: string[] = []

  for (const t of targets || []) {
    if (isFcmToken(t?.fcmToken)) fcmTokens.push(t.fcmToken as string)
    else if (isExpoToken(t?.expoPushToken)) expoTokens.push(t.expoPushToken as string)
  }

  if (!fcmTokens.length && !expoTokens.length) {
    return { sent: 0, failed: 0, viaFcm: 0, viaExpo: 0 }
  }

  const [fcmRes, expoRes] = await Promise.all([
    fcmTokens.length ? sendFcmPush(fcmTokens, msg) : Promise.resolve({ sent: 0, failed: 0, invalidTokens: [] as string[], error: undefined as string | undefined }),
    expoTokens.length ? sendExpoPush(expoTokens, msg) : Promise.resolve({ sent: 0, invalidTokens: [] as string[] }),
  ])

  if (fcmRes.invalidTokens.length || expoRes.invalidTokens.length) {
    await purgeDeadTokens(fcmRes.invalidTokens, expoRes.invalidTokens)
  }

  return {
    sent: fcmRes.sent + expoRes.sent,
    failed: (fcmRes.failed || 0) + (expoTokens.length - expoRes.sent),
    viaFcm: fcmRes.sent,
    viaExpo: expoRes.sent,
    error: fcmRes.error,
  }
}

/** Push straight to a list of user IDs (looks the tokens up for you). */
export async function sendPushToUsers(userIds: string[], msg: PushMessage): Promise<PushResult> {
  const ids = Array.from(new Set((userIds || []).filter(Boolean)))
  if (!ids.length) return { sent: 0, failed: 0, viaFcm: 0, viaExpo: 0 }

  const [users, clients, browsers] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids }, OR: [{ fcmToken: { not: null } }, { expoPushToken: { not: null } }] },
      select: { fcmToken: true, expoPushToken: true },
    }),
    // A client who logs in through the app has their own device row linked to
    // the same User id — notify that device too.
    prisma.client.findMany({
      where: { userId: { in: ids }, OR: [{ fcmToken: { not: null } }, { expoPushToken: { not: null } }] },
      select: { fcmToken: true, expoPushToken: true },
    }),
    // Every browser this person has granted notification permission in.
    // These are plain FCM tokens, so they ride the same sender — which means
    // EVERY notify() call now reaches Chrome as well as the phone, with no
    // per-event wiring.
    prisma.webPushToken.findMany({
      where: { userId: { in: ids } },
      select: { token: true },
    }),
  ])

  return sendPush(
    [...users, ...clients, ...browsers.map(b => ({ fcmToken: b.token }))],
    msg,
  )
}

/** Push to client-portal devices by Client id. */
export async function sendPushToClients(clientIds: string[], msg: PushMessage): Promise<PushResult> {
  const ids = Array.from(new Set((clientIds || []).filter(Boolean)))
  if (!ids.length) return { sent: 0, failed: 0, viaFcm: 0, viaExpo: 0 }

  const clients = await prisma.client.findMany({
    where: { id: { in: ids }, OR: [{ fcmToken: { not: null } }, { expoPushToken: { not: null } }] },
    select: { fcmToken: true, expoPushToken: true },
  })

  return sendPush(clients, msg)
}

export { isFcmConfigured }
