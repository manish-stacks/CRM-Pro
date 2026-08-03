'use client'
// Header "Holiday Calendar" link — plain anchor tag pointing at whatever PDF
// URL admin has uploaded (fetched once on mount), same as any other file link.
import { useEffect, useState } from 'react'
import api from '@/lib/axios'
import { CalendarDays } from 'lucide-react'

export function HolidayCalendarButton() {
  const [url, setUrl] = useState('')

  useEffect(() => {
    api.get('/settings/holiday-calendar').then(r => setUrl(r.data.data?.url || '')).catch(() => {})
  }, [])

  if (!url) return null

  return (
    <a href={url} target="_blank" rel="noreferrer" title="Holiday Calendar"
      className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600">
      <CalendarDays size={18} />
    </a>
  )
}
