// src/lib/axios.ts
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// Only bounce to /login on a REAL auth failure.
// Previously ANY 401 (including a flaky/aborted request, or a 401 coming from
// an endpoint the user simply isn't allowed to touch) hard-redirected the whole
// app to /login — which is what made the CRM feel like it "randomly logs out".
// Now: verify the session with /auth/me first, and only redirect if that also
// fails. Network errors never redirect.
let verifying: Promise<boolean> | null = null

async function sessionIsDead(): Promise<boolean> {
  if (!verifying) {
    verifying = fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' })
      .then(r => !r.ok)
      .catch(() => false) // network blip — assume session is fine
      .finally(() => { setTimeout(() => { verifying = null }, 2000) })
  }
  return verifying
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status
    const url: string = err.config?.url || ''
    if (
      status === 401 &&
      typeof window !== 'undefined' &&
      !window.location.pathname.startsWith('/login') &&
      !url.includes('/auth/me') &&
      !url.includes('/auth/login')
    ) {
      if (await sessionIsDead()) window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
