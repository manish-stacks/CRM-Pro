'use client'
// Landing page for the tab opened by "Login as employee". Never rendered
// as real UI — it just moves the token from the URL into this tab's
// sessionStorage (so it's isolated to this tab, unlike a cookie) and
// hands off to the normal dashboard.
import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { setImpersonationToken } from '@/lib/impersonation'
import { Loader2 } from 'lucide-react'

function ImpersonateEntryInner() {
  const params = useSearchParams()

  useEffect(() => {
    const token = params.get('t')
    if (token) setImpersonationToken(token)
    // Hard navigation on purpose — AuthProvider lives once at the root
    // layout and only fetches the user on its own mount. A soft
    // router.replace() wouldn't remount it, so it'd keep showing whatever
    // it fetched a moment ago (before the token above even existed) —
    // the admin's own account, not the impersonated one.
    window.location.href = '/dashboard'
  }, [params])

  return null
}

export default function ImpersonateEntryPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-gray-400" size={28} />
      <Suspense fallback={null}><ImpersonateEntryInner /></Suspense>
    </div>
  )
}
