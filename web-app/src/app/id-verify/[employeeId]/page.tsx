// src/app/id-verify/[employeeId]/page.tsx
// Public "verify employee ID card" page — this is where the QR code on the
// printed ID card redirects to. No login required; anyone who scans the
// card (security guard, client, vendor) can confirm the person is a real,
// currently-active HBS employee.
'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { CheckCircle2, XCircle, ShieldCheck, Phone, Mail, Building2, Calendar } from 'lucide-react'

interface VerifyData {
  employeeId: string
  name: string
  avatar?: string | null
  position?: string | null
  department?: string | null
  joiningDate?: string | null
  phone?: string | null
  email?: string | null
  isActive: boolean
  company: { name: string; phone: string; email: string }
}

export default function IdVerifyPage() {
  const params = useParams()
  const [data, setData] = useState<VerifyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (params.employeeId) {
      fetch(`/api/id-verify/${params.employeeId}`)
        .then(r => r.json())
        .then(d => {
          if (d.error) setError(d.error)
          else setData(d.data)
        })
        .catch(() => setError('Failed to verify this ID card'))
        .finally(() => setLoading(false))
    }
  }, [params.employeeId])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-500 animate-pulse">Verifying...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="text-center bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-sm w-full">
          <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
            <XCircle size={28} className="text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Not a Valid ID Card</h2>
          <p className="text-slate-500 text-sm">{error || 'This ID card could not be verified.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Status banner */}
        <div className={`px-5 py-3 flex items-center gap-2 ${data.isActive ? 'bg-green-600' : 'bg-red-600'}`}>
          {data.isActive ? <CheckCircle2 size={18} className="text-white" /> : <XCircle size={18} className="text-white" />}
          <span className="text-white text-sm font-semibold">
            {data.isActive ? 'Verified Active Employee' : 'This employee is no longer active'}
          </span>
        </div>

        <div className="p-6 text-center">
          <div className="w-24 h-24 rounded-full mx-auto overflow-hidden border-4 border-red-100 bg-slate-100">
            {data.avatar
              ? <img src={data.avatar} alt={data.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-red-500">
                  {data.name?.slice(0, 2).toUpperCase()}
                </div>}
          </div>
          <h1 className="text-lg font-bold text-slate-900 mt-3">{data.name}</h1>
          <p className="text-sm text-slate-500">{data.position || 'Employee'}{data.department ? ` · ${data.department}` : ''}</p>
          <p className="text-xs font-mono text-red-600 font-semibold mt-1">{data.employeeId}</p>

          <div className="mt-5 border-t border-slate-100 pt-4 text-left space-y-2.5 text-sm">
            {data.phone && (
              <p className="flex items-center gap-2 text-slate-600"><Phone size={14} className="text-slate-400" /> {data.phone}</p>
            )}
            {data.email && (
              <p className="flex items-center gap-2 text-slate-600"><Mail size={14} className="text-slate-400" /> {data.email}</p>
            )}
            {data.department && (
              <p className="flex items-center gap-2 text-slate-600"><Building2 size={14} className="text-slate-400" /> {data.department}</p>
            )}
            {data.joiningDate && (
              <p className="flex items-center gap-2 text-slate-600"><Calendar size={14} className="text-slate-400" /> Joined {formatDate(data.joiningDate)}</p>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck size={13} /> Issued by {data.company.name}
          </div>
        </div>
      </div>
    </div>
  )
}
