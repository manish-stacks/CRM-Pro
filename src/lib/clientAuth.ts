import { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-change-in-production')

export async function getClientSession(req: NextRequest): Promise<{ clientId: string } | null> {
  // Cookie (web) first, then Bearer header (mobile app)
  let token = req.cookies.get('client-token')?.value
  if (!token) {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim()
    }
  }
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    if (payload.type !== 'client') return null
    return { clientId: payload.clientId as string }
  } catch { return null }
}
