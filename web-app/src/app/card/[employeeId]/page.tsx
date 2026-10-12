// Public digital visiting card — opened from the link a marketing executive shares.
'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Phone, Mail, Globe, MapPin, MessageCircle, Contact, FileText } from 'lucide-react'
import { CardData, downloadVCard } from '@/lib/visitingCard'

export default function VisitingCardPage() {
  const { employeeId } = useParams() as { employeeId: string }
  const [d, setD] = useState<CardData | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch(`/api/card/${employeeId}`).then(r => r.json())
      .then(r => r.error ? setErr(r.error) : setD(r.data))
      .catch(() => setErr('Failed to load visiting card'))
  }, [employeeId])

  if (err) return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-500 px-4">{err}</div>
  if (!d) return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-400 animate-pulse">Loading...</div>

  const wa = (d.phone || '').replace(/\D/g, '')
  const row = 'flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-sm text-slate-800'
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-8">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-white px-5 py-4 flex items-center gap-3 border-b border-slate-100">
          <img src={d.company.logo || '/images/hbs-logo.png'} alt="" className="h-10 object-contain" />
          <p className="text-sm font-bold text-slate-900">{d.company.name}</p>
        </div>
        <div className="bg-gradient-to-br from-[#303030] to-[#111111] text-white p-6 text-center border-t-4 border-[#E53030]">
          <div className="w-24 h-24 rounded-full mx-auto overflow-hidden border-4 border-white/30 bg-white/10 flex items-center justify-center text-3xl font-bold">
            {d.avatar ? <img src={d.avatar} alt={d.name} className="w-full h-full object-cover" /> : d.name[0]}
          </div>
          <h1 className="text-xl font-bold mt-3">{d.name}</h1>
          <p className="text-[#FF6B6B] text-sm">{d.position}</p>
        </div>
        <div className="p-4 space-y-2">
          {d.phone && <a className={row} href={`tel:${d.phone}`}><Phone size={16} className="text-[#E53030]" /> {d.phone}</a>}
          {wa && <a className={row} href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={16} className="text-green-600" /> WhatsApp</a>}
          {d.email && <a className={row} href={`mailto:${d.email}`}><Mail size={16} className="text-[#E53030]" /> {d.email}</a>}
          {d.company.website && <a className={row} href={d.company.website} target="_blank" rel="noreferrer"><Globe size={16} className="text-[#E53030]" /> {d.company.website.replace(/^https?:\/\//, '')}</a>}
          {d.company.address && <div className={row}><MapPin size={16} className="text-[#E53030] flex-shrink-0" /> <span className="whitespace-pre-line">{d.company.address}</span></div>}
          {d.company.profileUrl && <a className={row} href={d.company.profileUrl} target="_blank" rel="noreferrer"><FileText size={16} className="text-[#E53030]" /> Company Profile</a>}
          <button onClick={() => downloadVCard(d)} className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#E53030] text-white text-sm font-semibold hover:bg-[#C42525]">
            <Contact size={16} /> Save Contact
          </button>
        </div>
      </div>
    </div>
  )
}
