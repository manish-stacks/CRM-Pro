// src/lib/push.ts
// Send push notifications via the Expo Push API (which delivers through FCM on
// Android and APNs on iOS). Store `expoPushToken` on User/Client from the app.
// Best-effort: never throws to the caller.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

export interface PushMessage {
  title: string
  body: string
  data?: Record<string, any>
}

// Basic sanity check for an Expo token
function isExpoToken(t?: string | null): t is string {
  return !!t && (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['))
}

export async function sendExpoPush(tokens: (string | null | undefined)[], msg: PushMessage) {
  const valid = Array.from(new Set(tokens.filter(isExpoToken)))
  if (valid.length === 0) return { sent: 0 }

  const messages = valid.map(to => ({
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
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    })
    if (!res.ok) {
      console.error('Expo push failed:', res.status, await res.text().catch(() => ''))
      return { sent: 0 }
    }
    return { sent: valid.length }
  } catch (e) {
    console.error('Expo push error:', e)
    return { sent: 0 }
  }
}
