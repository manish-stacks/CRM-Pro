'use client'
// Header search — searches Clients, Leads, Employees and Invoices together
// (via /api/search/global) and shows a grouped dropdown. Was previously a
// dead decorative input with no logic behind it.
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/axios'
import { Search, Loader2, Users2, Target, UserCheck, CreditCard, CalendarDays } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const GROUPS = [
  { key: 'clients', label: 'Clients', icon: Users2 },
  { key: 'leads', label: 'Leads', icon: Target },
  { key: 'employees', label: 'Employees', icon: UserCheck },
  { key: 'invoices', label: 'Invoices', icon: CreditCard },
  { key: 'leaves', label: 'My Leaves', icon: CalendarDays },
] as const

export function GlobalSearch() {
  const { user } = useAuth()
  // Plain employees can only look up their own leaves
  const isPlainEmployee = user?.role === 'EMPLOYEE'
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Record<string, any[]>>({})
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const search = useCallback((q: string) => {
    if (q.trim().length < 2) { setResults({}); setLoading(false); return }
    setLoading(true)
    api.get(`/search/global?q=${encodeURIComponent(q)}`)
      .then(r => setResults(r.data.data || {}))
      .catch(() => setResults({}))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query), 300)
    return () => clearTimeout(t)
  }, [query, search])

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', esc) }
  }, [open])

  const goTo = (link: string) => {
    setOpen(false)
    setQuery('')
    setResults({})
    router.push(link)
  }

  const hasAny = GROUPS.some(g => (results[g.key] || []).length > 0)

  return (
    <div ref={ref} className="relative hidden md:block w-72">
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3.5 py-2 focus-within:border-brand-300 focus-within:bg-white transition-colors">
        <Search size={15} className="text-gray-400 flex-shrink-0" />
        <input
          className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none w-full"
          placeholder={isPlainEmployee ? 'Search your leaves...' : 'Search clients, leads, employees, invoices...'}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
        />
        {loading && <Loader2 size={13} className="animate-spin text-gray-400 flex-shrink-0" />}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 top-full mt-1 w-[26rem] max-h-[70vh] overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-2xl z-50">
          {loading && !hasAny ? (
            <div className="p-6 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Searching…
            </div>
          ) : !hasAny ? (
            <div className="p-6 text-center text-sm text-gray-400">No results for "{query}"</div>
          ) : (
            GROUPS.map(g => {
              const items = results[g.key] || []
              if (!items.length) return null
              return (
                <div key={g.key} className="border-b border-gray-100 last:border-0">
                  <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
                    <g.icon size={11} /> {g.label}
                  </p>
                  {items.map((it: any) => (
                    <button key={it.id} onClick={() => goTo(it.link)}
                      className="w-full text-left px-3 py-2 hover:bg-brand-50 flex flex-col">
                      <span className="text-sm text-gray-900 font-medium truncate">{it.label || '—'}</span>
                      {it.sub && <span className="text-xs text-gray-500 truncate">{it.sub}</span>}
                    </button>
                  ))}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
