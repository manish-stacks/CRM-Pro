// src/lib/mobileGuard.ts
// Blocks the employee web app (CRM) from being used on phones / tablets / iOS.
// Staff are expected to use the React Native app on mobile; the browser app is
// desktop-only. Edge-safe: plain regex, no ua-parser-js (middleware runtime).

const MOBILE_UA =
  /Android|iPhone|iPad|iPod|iOS|webOS|BlackBerry|BB10|IEMobile|Windows Phone|Opera Mini|Opera Mobi|Mobile Safari|CriOS|FxiOS|EdgiOS|Silk|Kindle|Nokia|SymbianOS|PlayBook|Tablet|Mobile\/|Fennec/i

// iPadOS 13+ lies and sends a desktop macOS UA. It still has "Mobile/" or touch,
// so we catch what we can here and the client-side guard covers the rest.
const IPADOS_UA = /Macintosh;.*(Mobile\/|Version\/[\d.]+ Mobile)/i

/** true when the request looks like a phone / tablet / iOS browser */
export function isMobileBrowserUA(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return MOBILE_UA.test(userAgent) || IPADOS_UA.test(userAgent)
}

/**
 * Paths that MUST keep working from a phone:
 *  - the React Native app's own API surface
 *  - the client portal (customers, not staff)
 *  - public share links (invoice / proposal / receipt / ID verify)
 */
export const MOBILE_ALLOWED_PREFIXES = [
  '/api/mobile',
  '/client-portal',
  '/api/client-portal',
  '/receipt/view',
  '/api/receipts/view',
  '/proposal/view',
  '/api/proposals/view',
  '/api/invoices/view',
  '/id-verify',
  '/api/id-verify',
  '/api/geocode',
  '/_next',
]

export function isMobileAllowedPath(pathname: string): boolean {
  return MOBILE_ALLOWED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p))
}

export const MOBILE_BLOCK_MESSAGE =
  'This portal can only be used on a desktop or laptop. Please use the mobile app on your phone.'

export const MOBILE_BLOCK_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Desktop only</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px}
  .c{max-width:380px;text-align:center;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px 24px}
  h1{font-size:19px;margin:0 0 10px;color:#0f172a}
  p{font-size:14px;line-height:1.6;color:#475569;margin:0}
  .i{width:52px;height:52px;border-radius:50%;background:#fee2e2;color:#dc2626;display:flex;
     align-items:center;justify-content:center;margin:0 auto 16px;font-size:24px}
</style></head>
<body><div class="c"><div class="i">&#9888;</div>
<h1>Desktop access only</h1>
<p>${MOBILE_BLOCK_MESSAGE}</p></div></body></html>`