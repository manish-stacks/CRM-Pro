'use client'
// Header "Holiday Calendar" button — every logged-in user can view the PDF
// admin has uploaded. Fetches the current URL lazily on click and opens it
// in a new tab, same pattern as MyIdCardButton.
import { useState } from 'react'
import api from '@/lib/axios'
import { CalendarDays, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export function HolidayCalendarButton() {
  const [loading, setLoading] = useState(false)

  const open = async () => {
    setLoading(true)
    try {
      const r = await api.get('/settings/holiday-calendar')
      const url = r.data.data?.url
      if (!url) { toast.error('Holiday calendar not uploaded yet — ask Admin to add it in Settings.'); return }
      window.open(url, '_blank')
    } catch {
      toast.error('Could not open holiday calendar')
    } finally { setLoading(false) }
  }

  return (
    <button onClick={open} disabled={loading} title="Holiday Calendar"
      className="relative w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600 disabled:opacity-50">
      {loading ? <Loader2 size={18} className="animate-spin" /> : <CalendarDays size={18} />}
    </button>
  )
}
