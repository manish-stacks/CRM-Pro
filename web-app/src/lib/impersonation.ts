// src/lib/impersonation.ts
const KEY = 'impersonation-token'

export function getImpersonationToken(): string | null {
  if (typeof window === 'undefined') return null
  try { return sessionStorage.getItem(KEY) } catch { return null }
}

export function setImpersonationToken(token: string) {
  try { sessionStorage.setItem(KEY, token) } catch { /* private-browsing storage block — best effort */ }
}

export function clearImpersonationToken() {
  try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
}

/** Spread this into any fetch()'s headers; axios gets it via an interceptor instead. */
export function impersonationHeaders(): Record<string, string> {
  const t = getImpersonationToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}
