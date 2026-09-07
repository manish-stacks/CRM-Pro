// src/app/api/proxy-image/route.ts
// Turns a remote image URL into a base64 dataURL so jsPDF can embed it.
// Needed because the agency/client logo is often served from an outside
// website, which blocks cross-origin reads — the browser fetch fails
// silently and the logo never reaches the PDF. No auth required: the public
// SEO-report share link (/seo-report/view/[token]) has to be able to pull
// these images too, since the client opens it without a login. Safe to leave
// open because it only ever returns image bytes, and is already locked down
// with an SSRF block, a content-type check, and a size cap below.
import { NextRequest } from 'next/server'
import { BRAND } from '@/lib/branding'
import { successResponse, errorResponse } from '@/lib/api'

export const runtime = 'nodejs'

const MAX_BYTES = 6 * 1024 * 1024

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return errorResponse('url required')

  let parsed: URL
  try { parsed = new URL(url) } catch { return errorResponse('Invalid url') }
  if (!['http:', 'https:'].includes(parsed.protocol)) return errorResponse('Only http(s) urls')

  // Block SSRF into the local network
  const host = parsed.hostname.toLowerCase()
  if (
    host === 'localhost' || host === '0.0.0.0' || host.endsWith('.local') ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return errorResponse('Blocked host', 400)
  }

  try {
    const res = await fetch(parsed.toString(), {
      headers: { 'User-Agent': `${BRAND.short}-CRM/1.0` },
      cache: 'no-store',
    })
    if (!res.ok) return errorResponse(`Fetch failed (${res.status})`, 400)

    const contentType = res.headers.get('content-type') || 'image/png'
    if (!contentType.startsWith('image/')) return errorResponse('Not an image', 400)

    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength > MAX_BYTES) return errorResponse('Image too large', 400)

    return successResponse({
      dataUrl: `data:${contentType};base64,${buf.toString('base64')}`,
      contentType,
      bytes: buf.byteLength,
    })
  } catch (e: any) {
    return errorResponse(e?.message || 'Proxy failed', 500)
  }
}
