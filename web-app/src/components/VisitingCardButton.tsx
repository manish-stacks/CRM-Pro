'use client'
// Header "Visiting Card" button — marketing executives only. Share the public card
// link, download a soft copy (PNG / contact file) and share the company profile.
import { useState } from 'react'
import api from '@/lib/axios'
import { useAuth } from '@/hooks/useAuth'
import { Modal } from '@/components/ui'
import { CreditCard, Copy, Download, Share2, Contact, FileText, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { CardData, cardLink, whatsappShareUrl, downloadVCard, downloadCardPng } from '@/lib/visitingCard'

export function VisitingCardButton() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<CardData | null>(null)
  const [loading, setLoading] = useState(false)
  if (user?.role !== 'MARKETING_EXECUTIVE') return null

  const show = async () => {
    setOpen(true)
    if (data) return
    const id = user?.employee?.employeeId
    if (!id) { toast.error('No employee record found'); setOpen(false); return }
    setLoading(true)
    try { setData((await api.get(`/card/${id}`)).data.data) }
    catch { toast.error('Could not load visiting card'); setOpen(false) }
    finally { setLoading(false) }
  }
  const copy = async (text: string, msg: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(msg) } catch { toast.error('Copy failed') }
  }
  const link = data ? cardLink(data.employeeId) : ''
  const profile = data?.company.profileUrl || ''
  const btn = 'btn-secondary btn-sm flex items-center justify-center gap-1.5'

  return (
    <>
      <button onClick={show} title="Visiting Card"
        className="relative w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600">
        <CreditCard size={16} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="My Visiting Card">
        {loading || !data ? <p className="text-sm text-gray-400 py-8 text-center">Loading...</p> : (
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden border border-gray-200">
              <div className="bg-white px-4 py-3 flex items-center gap-3">
                <img src={data.company.logo || '/images/hbs-logo.png'} alt="" className="h-10 object-contain" />
                <p className="text-sm font-bold text-gray-900">{data.company.name}</p>
              </div>
              <div className="bg-gradient-to-br from-[#303030] to-[#111111] text-white p-5 border-t-4 border-[#E53030]">
                <p className="text-xl font-bold">{data.name}</p>
                <p className="text-sm text-[#FF6B6B]">{data.position}</p>
                <div className="text-xs mt-3 space-y-0.5">
                  {data.phone && <p>📞 {data.phone}</p>}
                  {data.email && <p>✉️ {data.email}</p>}
                  {data.company.website && <p>🌐 {data.company.website.replace(/^https?:\/\//, '')}</p>}
                  {data.company.address && <p className="whitespace-pre-line">📍 {data.company.address}</p>}
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">Share with client</p>
              <div className="grid grid-cols-2 gap-2">
                <button className={btn} onClick={() => copy(link, 'Card link copied')}><Copy size={13} /> Copy Link</button>
                <a className={btn} target="_blank" rel="noreferrer"
                  href={whatsappShareUrl(`Hi, this is ${data.name} from ${data.company.name}. My visiting card: ${link}`)}><Share2 size={13} /> WhatsApp</a>
                <button className={btn} onClick={() => downloadCardPng(data).catch(() => toast.error('Could not create card image'))}><Download size={13} /> Card (PNG)</button>
                <button className={btn} onClick={() => downloadVCard(data)}><Contact size={13} /> Contact (.vcf)</button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">Company profile</p>
              {profile ? (
                <div className="grid grid-cols-3 gap-2">
                  <button className={btn} onClick={() => copy(profile, 'Profile link copied')}><Copy size={13} /> Copy</button>
                  <a className={btn} href={profile} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open</a>
                  <a className={btn} href={profile} download target="_blank" rel="noreferrer"><FileText size={13} /> Download</a>
                </div>
              ) : <p className="text-xs text-gray-400">Company profile link is not set yet. Ask an admin to add it in Settings → Company.</p>}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
