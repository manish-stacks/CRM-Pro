// src/lib/device.ts
// Parse User-Agent + extract IP from Next.js request headers
import { UAParser } from 'ua-parser-js'
import { NextRequest } from 'next/server'
import { headers } from 'next/headers'

export interface DeviceInfo {
  ip: string | null
  userAgent: string | null
  browser: string | null   // "Chrome 130"
  os: string | null        // "Windows 11", "macOS 15", "Android 14"
  device: string | null    // "Desktop", "Mobile", "Tablet"
}

function classifyDeviceType(deviceType?: string): string {
  const t = (deviceType || '').toLowerCase()
  if (t === 'mobile') return 'Mobile'
  if (t === 'tablet') return 'Tablet'
  if (t === 'smarttv') return 'SmartTV'
  if (t === 'wearable') return 'Wearable'
  return 'Desktop'
}

function extractIp(headerBag: Headers | Record<string, string | null | undefined>): string | null {
  const get = (k: string) => headerBag instanceof Headers ? headerBag.get(k) : (headerBag as any)[k]

  // Standard proxy headers, first match wins
  const candidates = [
    get('x-forwarded-for'),
    get('x-real-ip'),
    get('cf-connecting-ip'),
    get('true-client-ip'),
  ]
  for (const c of candidates) {
    if (c) {
      const first = c.split(',')[0].trim()
      if (first) return first
    }
  }
  return null
}

/** Parse a UA string into device info */
export function parseUA(userAgent: string | null | undefined): Omit<DeviceInfo, 'ip' | 'userAgent'> {
  if (!userAgent) return { browser: null, os: null, device: null }
  const parser = new UAParser(userAgent)
  const ua = parser.getResult()
  const browser = ua.browser.name ? `${ua.browser.name}${ua.browser.version ? ' ' + ua.browser.version.split('.')[0] : ''}` : null
  const os = ua.os.name ? `${ua.os.name}${ua.os.version ? ' ' + ua.os.version : ''}`.trim() : null
  const device = classifyDeviceType(ua.device.type)
  return { browser, os, device }
}

/** Extract full device info from a NextRequest (route handler) */
export function deviceFromRequest(req: NextRequest): DeviceInfo {
  const ua = req.headers.get('user-agent')
  return {
    ip: extractIp(req.headers),
    userAgent: ua,
    ...parseUA(ua),
  }
}

/** Extract device info in Server Components / server actions (uses `headers()`) */
export async function deviceFromHeaders(): Promise<DeviceInfo> {
  const h = await headers()
  const ua = h.get('user-agent')
  return {
    ip: extractIp(h),
    userAgent: ua,
    ...parseUA(ua),
  }
}
