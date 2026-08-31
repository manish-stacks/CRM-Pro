// src/lib/fcm.ts
// Firebase Cloud Messaging — HTTP v1 API sender.
// No extra npm package required: the OAuth2 access token is minted locally from
// the service-account private key using Node's built-in `crypto`.
//
// ENV (any ONE of these three ways to supply the service account):
//   1) FIREBASE_SERVICE_ACCOUNT_JSON = '{"project_id":"...","client_email":"...","private_key":"..."}'
//   2) FIREBASE_SERVICE_ACCOUNT_PATH = './credential/firebase-service-account.json'
//   3) FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
//
// The legacy `fcm.googleapis.com/fcm/send` + server key API is DEAD (retired by
// Google in 2024) — this file uses the v1 endpoint, which is the only one that
// still works.

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'

export interface FcmMessage {
  title: string
  body: string
  data?: Record<string, any>
}

export interface FcmSendResult {
  sent: number
  failed: number
  /** Tokens FCM told us are permanently dead — caller should delete them. */
  invalidTokens: string[]
  error?: string
}

type ServiceAccount = {
  project_id: string
  client_email: string
  private_key: string
}

// ---------------------------------------------------------------------------
// Service account loading (cached)
// ---------------------------------------------------------------------------
let cachedAccount: ServiceAccount | null | undefined
let loadReason = 'not attempted'
let loadSource = 'none'

function loadServiceAccount(): ServiceAccount | null {
  if (cachedAccount !== undefined) return cachedAccount

  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    if (raw && raw.trim().startsWith('{')) {
      const j = JSON.parse(raw)
      cachedAccount = normalize(j)
      loadSource = 'FIREBASE_SERVICE_ACCOUNT_JSON'
      loadReason = cachedAccount ? 'ok' : 'JSON is missing project_id / client_email / private_key'
      return cachedAccount
    }

    const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    if (filePath) {
      const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath)
      loadSource = `FIREBASE_SERVICE_ACCOUNT_PATH (${abs})`
      if (fs.existsSync(abs)) {
        const j = JSON.parse(fs.readFileSync(abs, 'utf8'))
        cachedAccount = normalize(j)
        loadReason = cachedAccount
          ? 'ok'
          : 'File found but it is not a service-account key (needs project_id, client_email, private_key). google-services.json will NOT work here.'
        return cachedAccount
      }
      loadReason = `File not found at ${abs}`
      cachedAccount = null
      return null
    }

    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
    if (projectId && clientEmail && privateKey) {
      cachedAccount = normalize({
        project_id: projectId,
        client_email: clientEmail,
        private_key: privateKey,
      })
      loadSource = 'FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY'
      loadReason = cachedAccount ? 'ok' : 'One of the three variables is empty'
      return cachedAccount
    }
  } catch (e: any) {
    loadReason = `Could not parse the service account: ${e?.message || e}`
    console.error('[FCM] Failed to load service account:', e)
  }

  if (loadReason === 'not attempted') {
    loadReason = 'No Firebase env var is set. Set FIREBASE_SERVICE_ACCOUNT_PATH (or _JSON) in .env and restart the server.'
  }
  cachedAccount = null
  return null
}

function normalize(j: any): ServiceAccount | null {
  const project_id = j.project_id || j.projectId
  const client_email = j.client_email || j.clientEmail
  let private_key = j.private_key || j.privateKey
  if (!project_id || !client_email || !private_key) return null
  // .env files store the key with literal \n — convert to real newlines.
  private_key = String(private_key).replace(/\\n/g, '\n').trim()
  return { project_id, client_email, private_key }
}

export function isFcmConfigured(): boolean {
  return !!loadServiceAccount()
}

/** Why FCM is / isn't usable — shown by the admin health-check endpoint. */
export function fcmConfigStatus() {
  const acc = loadServiceAccount()
  return {
    configured: !!acc,
    source: loadSource,
    reason: loadReason,
    projectId: acc?.project_id || null,
    clientEmail: acc?.client_email || null,
  }
}

export function fcmProjectId(): string | null {
  return loadServiceAccount()?.project_id || null
}

// ---------------------------------------------------------------------------
// OAuth2 access token (cached ~55 min)
// ---------------------------------------------------------------------------
let accessToken: { value: string; expiresAt: number } | null = null

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function getAccessToken(): Promise<string | null> {
  const acc = loadServiceAccount()
  if (!acc) return null

  const now = Date.now()
  if (accessToken && accessToken.expiresAt > now + 60_000) return accessToken.value

  try {
    const iat = Math.floor(now / 1000)
    const exp = iat + 3600
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const claims = b64url(
      JSON.stringify({
        iss: acc.client_email,
        scope: FCM_SCOPE,
        aud: GOOGLE_TOKEN_URL,
        iat,
        exp,
      }),
    )
    const unsigned = `${header}.${claims}`
    const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(acc.private_key)
    const assertion = `${unsigned}.${b64url(signature)}`

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    })

    if (!res.ok) {
      console.error('[FCM] OAuth token request failed:', res.status, await res.text().catch(() => ''))
      return null
    }

    const json: any = await res.json()
    if (!json?.access_token) return null

    accessToken = {
      value: json.access_token,
      expiresAt: now + (Number(json.expires_in || 3600) - 300) * 1000,
    }
    return accessToken.value
  } catch (e) {
    console.error('[FCM] Failed to mint access token:', e)
    return null
  }
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

/** FCM v1 requires every data value to be a string. */
function stringifyData(data?: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {}
  if (!data) return out
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue
    out[k] = typeof v === 'string' ? v : (() => { try { return JSON.stringify(v) } catch { return String(v) } })()
  }
  return out
}

/** An FCM registration token is a long opaque string — never an Expo token. */
export function isFcmToken(t?: string | null): t is string {
  if (!t || typeof t !== 'string') return false
  if (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken[')) return false
  return t.length >= 100
}

function buildPayload(token: string, msg: FcmMessage) {
  const data = stringifyData(msg.data)
  return {
    message: {
      token,
      // `notification` makes Android/iOS render the tray notification even when
      // the app is killed. `data` is what the tap handler reads for routing.
      notification: { title: msg.title, body: msg.body },
      data,
      android: {
        priority: 'HIGH',
        notification: {
          channel_id: 'default',
          sound: 'default',
          default_vibrate_timings: true,
        },
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: { aps: { sound: 'default', 'content-available': 1 } },
      },
      // Browser (Chrome/Edge/Firefox) delivery. Mobile clients ignore this
      // block, so it's safe to send on every message.
      webpush: {
        headers: { Urgency: 'high', TTL: '86400' },
        notification: {
          title: msg.title,
          body: msg.body,
          icon: '/icons/icon-192.png',
          badge: '/icons/badge-72.png',
          requireInteraction: false,
        },
        // Where the browser navigates when the notification is clicked.
        fcm_options: {
          link: data?.link ? `${process.env.NEXT_PUBLIC_APP_URL || ''}${data.link}` : (process.env.NEXT_PUBLIC_APP_URL || '/'),
        },
      },
    },
  }
}

/**
 * Send one push per token. FCM v1 has no multicast REST endpoint, so we fan out
 * in parallel and report which tokens are permanently dead.
 */
export async function sendFcmPush(
  tokens: (string | null | undefined)[],
  msg: FcmMessage,
): Promise<FcmSendResult> {
  const valid = Array.from(new Set(tokens.filter(isFcmToken)))
  if (valid.length === 0) return { sent: 0, failed: 0, invalidTokens: [] }

  const acc = loadServiceAccount()
  if (!acc) {
    console.warn('[FCM] Not configured — set FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY).')
    return { sent: 0, failed: valid.length, invalidTokens: [], error: 'FCM not configured' }
  }

  const bearer = await getAccessToken()
  if (!bearer) {
    return { sent: 0, failed: valid.length, invalidTokens: [], error: 'Could not obtain FCM access token' }
  }

  const url = `https://fcm.googleapis.com/v1/projects/${acc.project_id}/messages:send`
  const invalidTokens: string[] = []
  let sent = 0
  let failed = 0
  let lastError: string | undefined

  const results = await Promise.allSettled(
    valid.map(async (token) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bearer}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildPayload(token, msg)),
      })

      if (res.ok) return { ok: true as const, token }

      const text = await res.text().catch(() => '')
      let errCode = ''
      try {
        const j = JSON.parse(text)
        errCode =
          j?.error?.details?.find((d: any) => d?.errorCode)?.errorCode ||
          j?.error?.status ||
          ''
      } catch {}

      // 404 UNREGISTERED / 400 INVALID_ARGUMENT => the device token is dead.
      const dead =
        res.status === 404 ||
        errCode === 'UNREGISTERED' ||
        errCode === 'INVALID_ARGUMENT' ||
        (res.status === 400 && /registration token|not a valid FCM/i.test(text))

      return { ok: false as const, token, dead, status: res.status, text }
    }),
  )

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.ok) {
      sent++
    } else {
      failed++
      if (r.status === 'fulfilled') {
        if (r.value.dead) invalidTokens.push(r.value.token)
        lastError = `HTTP ${r.value.status} ${String(r.value.text).slice(0, 300)}`
      } else {
        lastError = String(r.reason).slice(0, 300)
      }
    }
  }

  if (failed) console.error(`[FCM] ${failed}/${valid.length} push failed. Last error: ${lastError}`)

  return { sent, failed, invalidTokens, error: lastError }
}
