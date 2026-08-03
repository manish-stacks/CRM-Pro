'use client'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { LeadsPageInner } from '../page'

// Dedicated route for "My Leads" (as opposed to /leads = "Team Leads").
// Having a real separate route — instead of /leads?mine=1 on the same
// page — means the two sidebar links never bleed filter state into each
// other and each one loads its own view cleanly.
export default function MyLeadsPage() {
  return (
    <Suspense fallback={<Loader2 className="animate-spin mx-auto mt-12 text-gray-400" />}>
      <LeadsPageInner forceMine />
    </Suspense>
  )
}
