'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/axios'
import { getInitials } from '@/lib/utils'
import { Cake, PartyPopper, Sparkles, Calendar, ChevronRight, MessageSquare } from 'lucide-react'

interface Data {
  today: {
    birthdays: any[]
    anniversaries: any[]
  }
  upcoming: {
    birthdays: any[]
    anniversaries: any[]
  }
}

export function CelebrationWidget() {
  const router = useRouter()
  const [data, setData] = useState<Data | null>(null)
  const [showPopup, setShowPopup] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Wish → open /chat, auto-create DIRECT chat with the person and send a wish message
  const wishNow = (person: any, type: 'birthday' | 'anniversary') => {
    if (!person?.userId) return
    const q = new URLSearchParams({ wish: person.userId, name: person.name || '', type })
    router.push(`/chat?${q.toString()}`)
  }

  useEffect(() => {
    api.get('/dashboard/celebrations').then(r => {
      const d = r.data.data
      setData(d)
      const hasToday = (d.today.birthdays.length + d.today.anniversaries.length) > 0
      const seenKey = 'celebration_seen_' + new Date().toDateString()
      if (hasToday && !sessionStorage.getItem(seenKey)) {
        setShowPopup(true)
        sessionStorage.setItem(seenKey, '1')
      }
    }).catch(() => {})
  }, [])

  if (!data) return null

  const todayCount = data.today.birthdays.length + data.today.anniversaries.length
  const upcomingCount = data.upcoming.birthdays.length + data.upcoming.anniversaries.length

  return (
    <>
      {/* Today's celebrations widget on dashboard */}
      {todayCount > 0 && (
        <div className="card p-5 bg-gradient-to-br from-pink-50 via-white to-purple-50 border-pink-100">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-white">
              <PartyPopper size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Today's Celebrations</h3>
              <p className="text-xs text-gray-500">Don't forget to wish!</p>
            </div>
          </div>
          <div className="space-y-2">
            {data.today.birthdays.map(b => (
              <div key={'b'+b.id} className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-pink-100">
                <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-700 font-bold relative">
                  {b.avatar ? <img src={b.avatar} className="w-full h-full rounded-full object-cover" /> : getInitials(b.name)}
                  <span className="absolute -top-1 -right-1 text-lg">🎂</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{b.name}</p>
                  <p className="text-xs text-gray-500">🎉 Happy Birthday • {b.department}</p>
                </div>
                <button onClick={() => wishNow(b, 'birthday')}
                  className="text-xs font-semibold text-pink-600 hover:bg-pink-50 rounded-lg px-2.5 py-1.5 flex items-center gap-1 flex-shrink-0">
                  <MessageSquare size={12} /> Wish
                </button>
              </div>
            ))}
            {data.today.anniversaries.map(a => (
              <div key={'a'+a.id} className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-purple-100">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold relative">
                  {a.avatar ? <img src={a.avatar} className="w-full h-full rounded-full object-cover" /> : getInitials(a.name)}
                  <span className="absolute -top-1 -right-1 text-lg">✨</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{a.name}</p>
                  <p className="text-xs text-gray-500">{a.years === 0 ? '👋 Welcome to the team!' : `🎊 ${a.years} year${a.years > 1 ? 's' : ''} at company`} • {a.department}</p>
                </div>
                <button onClick={() => wishNow(a, 'anniversary')}
                  className="text-xs font-semibold text-purple-600 hover:bg-purple-50 rounded-lg px-2.5 py-1.5 flex items-center gap-1 flex-shrink-0">
                  <MessageSquare size={12} /> Wish
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming (next 7 days) */}
      {upcomingCount > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={16} className="text-slate-600" />
            <h3 className="font-semibold text-gray-900 text-sm">Coming Up (7 days)</h3>
          </div>
          <div className="space-y-2 text-sm">
            {data.upcoming.birthdays.map(b => (
              <div key={'ub'+b.id} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <Cake size={12} className="text-pink-500" />
                  <span className="font-medium text-gray-700">{b.name}</span>
                  <span className="text-gray-400">({b.department})</span>
                </span>
                <span className="text-pink-600 font-semibold">in {b.daysUntil}d</span>
              </div>
            ))}
            {data.upcoming.anniversaries.map(a => (
              <div key={'ua'+a.id} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <Sparkles size={12} className="text-purple-500" />
                  <span className="font-medium text-gray-700">{a.name}</span>
                  <span className="text-gray-400">{a.years}yr</span>
                </span>
                <span className="text-purple-600 font-semibold">in {a.daysUntil}d</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Splash popup — shown once per day */}
      {showPopup && todayCount > 0 && !dismissed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => { setShowPopup(false); setDismissed(true) }}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8"
            >×</button>
            <div className="text-center">
              <div className="text-6xl mb-3">🎉</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Celebrations Today!</h2>
              <p className="text-sm text-gray-500 mb-5">Take a moment to send wishes</p>
              <div className="space-y-2 text-left">
                {data.today.birthdays.map(b => (
                  <div key={'pb'+b.id} className="flex items-center gap-3 bg-pink-50 rounded-lg p-3">
                    <div className="w-10 h-10 rounded-full bg-pink-200 flex items-center justify-center text-pink-800 font-bold">
                      {getInitials(b.name)}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{b.name}</p>
                      <p className="text-xs text-pink-700">🎂 Birthday</p>
                    </div>
                    <button onClick={() => { setShowPopup(false); setDismissed(true); wishNow(b, 'birthday') }}
                      className="text-xs font-semibold text-white bg-pink-500 hover:bg-pink-600 rounded-lg px-3 py-1.5">
                      Wish 💌
                    </button>
                  </div>
                ))}
                {data.today.anniversaries.map(a => (
                  <div key={'pa'+a.id} className="flex items-center gap-3 bg-purple-50 rounded-lg p-3">
                    <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center text-purple-800 font-bold">
                      {getInitials(a.name)}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{a.name}</p>
                      <p className="text-xs text-purple-700">{a.years === 0 ? '👋 Welcome to the team!' : `✨ ${a.years} year${a.years > 1 ? 's' : ''} anniversary`}</p>
                    </div>
                    <button onClick={() => { setShowPopup(false); setDismissed(true); wishNow(a, 'anniversary') }}
                      className="text-xs font-semibold text-white bg-purple-500 hover:bg-purple-600 rounded-lg px-3 py-1.5">
                      Wish 💌
                    </button>
                  </div>
                ))}
              </div>
              {/* <button
                onClick={() => { setShowPopup(false); setDismissed(true) }}
                className="mt-5 w-full py-2.5 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:opacity-95"
              >
                Sent Wishes! 💌
              </button> */}
            </div>
          </div>
        </div>
      )}
    </>
  )
}