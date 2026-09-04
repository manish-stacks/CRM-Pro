'use client'
// Only ever visible in a tab that has an impersonation token — makes it
// unmistakable that actions in this tab are being taken as someone else's
// account, not the admin's own.
import { useAuth } from '@/hooks/useAuth'
import { Eye, LogOut } from 'lucide-react'

export function ImpersonationBanner() {
  const { user, isImpersonating, exitImpersonation } = useAuth()
  if (!isImpersonating || !user) return null

  return (
    <div className="sticky top-0 z-[90] bg-amber-500 text-white text-sm px-4 py-2 flex items-center justify-center gap-3 flex-wrap">
      <span className="flex items-center gap-1.5 font-medium">
        <Eye size={14} /> Viewing as {user.name} ({user.role})
      </span>
      <span className="text-white/80 text-xs">— opened by {user.impersonatedByName}</span>
      <button onClick={exitImpersonation} className="ml-2 bg-white/20 hover:bg-white/30 rounded-full px-3 py-0.5 text-xs font-medium flex items-center gap-1">
        <LogOut size={12} /> Exit to my account
      </button>
    </div>
  )
}
