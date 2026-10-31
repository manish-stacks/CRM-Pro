// src/lib/baseUrl.ts
// Public base URL for links sent to users (invoice, receipt, proposal, report).
// `new URL(req.url).origin` is the INTERNAL address behind nginx/PM2
// (e.g. http://localhost:3000), which broke links opened on phones.
// Order: real public env URL -> proxy headers -> request origin.
const isLoopback = (u: string) => /(^|\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(u)

export function getBaseUrl(req?: Request): string {
  const env = (process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '')
  if (env && !isLoopback(env)) return env

  if (req) {
    const h = req.headers
    const host = (h.get('x-forwarded-host') || h.get('host') || '').split(',')[0].trim()
    if (host && !isLoopback(host)) {
      const proto = (h.get('x-forwarded-proto') || '').split(',')[0].trim()
        || (/^(\d|192\.|10\.)/.test(host) ? 'http' : 'https')
      return `${proto}://${host}`
    }
    return new URL(req.url).origin
  }
  return env || 'http://localhost:3008'
}
