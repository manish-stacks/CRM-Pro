'use client'
// Floating "Tech Support" button — shown on every dashboard page so an
// employee facing a CRM/software problem can message the Super Admin
// directly or raise a ticket in one click, without hunting through menus.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import { LifeBuoy, X, Send, Loader2, ListChecks } from 'lucide-react'
import toast from 'react-hot-toast'

export function TechSupportWidget() {
  const { user } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('HIGH')
  const [sending, setSending] = useState(false)

  if (!user || user.role === 'CLIENT') return null

  const submit = async () => {
    if (!description.trim()) { toast.error('Please describe the issue'); return }
    setSending(true)
    try {
      const r = await api.post('/employee-tickets/tech-support', { subject, description, priority })
      toast.success(`Ticket ${r.data.data.ticketNumber} sent to Admin`)
      setSubject(''); setDescription(''); setPriority('HIGH'); setOpen(false)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to send')
    } finally { setSending(false) }
  }

  return (
    <>
      {/* Floating action button */}
      <button
        onClick={() => setOpen(true)}
        title="Report a CRM / tech problem"
        className="fixed bottom-6 right-6 z-40 w-13 h-13 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 flex items-center justify-center transition-transform hover:scale-105"
        style={{ width: 52, height: 52 }}
      >
        <LifeBuoy size={22} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-6 bg-black/30" onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="bg-white w-full sm:w-96 rounded-t-2xl sm:rounded-2xl shadow-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center"><LifeBuoy size={18} /></div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Tech Support</h3>
                  <p className="text-xs text-gray-400">Report a CRM issue — goes straight to Admin</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="space-y-3">
              <input
                className="input text-sm"
                placeholder="Short subject (optional)"
                value={subject}
                onChange={e => setSubject(e.target.value)}
              />
              <textarea
                className="input text-sm min-h-[90px]"
                placeholder="What's going wrong? Be as specific as you can — page, steps, error message..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
              <select className="input text-sm" value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="LOW">Low priority</option>
                <option value="MEDIUM">Medium priority</option>
                <option value="HIGH">High priority</option>
                <option value="URGENT">Urgent — blocking my work</option>
              </select>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => { setOpen(false); router.push('/my-tickets') }}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <ListChecks size={13} /> View my tickets
                </button>
                <button
                  onClick={submit}
                  disabled={sending}
                  className="btn-primary btn-sm flex items-center gap-1.5 disabled:opacity-60"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Send to Admin
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
