'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import { getInitials } from '@/lib/utils'
import { Cake, PartyPopper, Sparkles, Calendar, ChevronRight, MessageSquare, CalendarCheck } from 'lucide-react'

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

const confettiColors = ['#e11d48', '#f59e0b', '#8b5cf6', '#10b981', '#3b82f6', '#ec4899', '#fbbf24']
const balloonColors = ['#f43f5e', '#8b5cf6', '#f59e0b', '#22d3ee', '#ec4899']

// Full-viewport confetti overlay — rendered via portal so it rains over the
// WHOLE dashboard (sidebar, header, everything), not just inside one card.
function ConfettiOverlay() {
  return (
    <div className="fixed inset-0 z-[60] pointer-events-none overflow-hidden">
      {Array.from({ length: 50 }).map((_, i) => (
        <span key={'c' + i} className="confetti-piece" style={{
          left: `${Math.random() * 100}%`,
          backgroundColor: confettiColors[i % confettiColors.length],
          animationDuration: `${2.2 + Math.random() * 2}s`,
          animationDelay: `${Math.random() * 1.4}s`,
          borderRadius: i % 3 === 0 ? '50%' : i % 3 === 1 ? '2px' : '0',
          width: `${6 + Math.random() * 4}px`,
          height: `${6 + Math.random() * 4}px`,
        }} />
      ))}
      {Array.from({ length: 8 }).map((_, i) => (
        <span key={'bl' + i} className="balloon-piece" style={{
          left: `${5 + i * 12}%`,
          animationDuration: `${4.5 + Math.random() * 2}s`,
          animationDelay: `${i * 0.35}s`,
        }}>
          <svg width="15" height="19" viewBox="0 0 26 32" fill="none">
            <ellipse cx="13" cy="13" rx="13" ry="15" fill={balloonColors[i % balloonColors.length]} />
            <path d="M13 27 L10 30 L16 30 Z" fill={balloonColors[i % balloonColors.length]} />
          </svg>
        </span>
      ))}
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={'sp' + i} className="sparkle-piece text-amber-400" style={{
          left: `${Math.random() * 100}%`,
          top: `${5 + Math.random() * 70}%`,
          fontSize: `${10 + Math.random() * 8}px`,
          animationDuration: `${1.4 + Math.random() * 1.2}s`,
          animationDelay: `${Math.random() * 1.5}s`,
        }}>✦</span>
      ))}
    </div>
  )
}

export function CelebrationWidget({ leaveBalance }: { leaveBalance?: any }) {
  const router = useRouter()
  const { user } = useAuth()
  const [data, setData] = useState<Data | null>(null)
  const [showPopup, setShowPopup] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [showConfetti, setShowConfetti] = useState(true)
  const [showCertificate, setShowCertificate] = useState(false)
  const [mounted, setMounted] = useState(false)

  const isEmployee = user?.role === 'EMPLOYEE'

  // Portals need document.body, which only exists client-side after mount
  useEffect(() => { setMounted(true) }, [])

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
      const othersToday =
        d.today.birthdays.filter((b: any) => b.userId !== user?.id).length +
        d.today.anniversaries.filter((a: any) => a.userId !== user?.id).length
      const seenKey = 'celebration_seen_' + new Date().toDateString()
      if (othersToday > 0 && !sessionStorage.getItem(seenKey)) {
        setShowPopup(true)
        sessionStorage.setItem(seenKey, '1')
      }
    }).catch(() => {})
  }, [user?.id])

  useEffect(() => {
    if (!showConfetti || !isEmployee) return
    const t = setTimeout(() => setShowConfetti(false), 7000)
    return () => clearTimeout(t)
  }, [showConfetti, isEmployee])

  if (!data) return null

  const selfBirthday = data.today.birthdays.find(b => b.userId === user?.id)
  const selfAnniversary = data.today.anniversaries.find(a => a.userId === user?.id)
  const isSelfDay = !!(selfBirthday || selfAnniversary)
  const otherBirthdays = data.today.birthdays.filter(b => b.userId !== user?.id)
  const otherAnniversaries = data.today.anniversaries.filter(a => a.userId !== user?.id)
  const todayCount = otherBirthdays.length + otherAnniversaries.length
  const upcomingCount = data.upcoming.birthdays.length + data.upcoming.anniversaries.length

  return (
    <>
      {/* Confetti — rendered via portal so it covers the FULL dashboard, not just this card */}
      {mounted && showConfetti && isEmployee && isSelfDay &&
        createPortal(<ConfettiOverlay />, document.body)}

      {/* Self celebration — employees get the rose/certificate treatment, everyone else keeps the classic gradient */}
      {isSelfDay && isEmployee && (
        <div className="card animate-rise relative overflow-hidden p-6 mb-6 min-h-[150px] bg-rose-50 border-none shadow-sm">
          <div className="relative flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-4xl flex-shrink-0 shadow-sm">
                {selfBirthday ? '🎂' : '🎉'}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {selfBirthday ? "It's your birthday, " : "It's your work anniversary, "}{user?.name?.split(' ')[0]}! 🎉
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {selfBirthday
                    ? 'Wishing you a fantastic year ahead. Enjoy your day!'
                    : selfAnniversary?.years === 0
                      ? 'Welcome to the team!'
                      : `${selfAnniversary?.years} year${selfAnniversary && selfAnniversary.years > 1 ? 's' : ''} with us — thank you for everything!`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {!selfBirthday && (
                <button
                  onClick={() => setShowCertificate(true)}
                  className="px-4 py-2 rounded-full text-sm font-semibold text-rose-500 border border-rose-300 bg-white hover:bg-rose-50 transition-colors whitespace-nowrap"
                >
                  View Certificate
                </button>
              )}
              <div className="w-20 h-20 rounded-full  flex items-center justify-center   hidden sm:flex">
                <img src="/images/award.png" alt="" className="w-18 h-18 object-contain hidden sm:block" />
              </div>
            </div>
          </div>
        </div>
      )}

      {isSelfDay && !isEmployee && (
        <div className="card animate-rise relative overflow-hidden p-6 min-h-[150px] bg-gradient-to-br from-brand-600 via-fuchsia-600 to-rose-600 text-white border-none shadow-lg shadow-fuchsia-900/30">
          <div className="relative flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-4xl flex-shrink-0 animate-bounce">
              {selfBirthday ? '🎂' : '✨'}
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {selfBirthday ? "It's your birthday, " : "It's your work anniversary, "}{user?.name?.split(' ')[0]}! 🎉
              </h2>
              <p className="text-sm text-white/85 mt-0.5">
                {selfBirthday
                  ? 'Wishing you a fantastic year ahead. Enjoy your day!'
                  : selfAnniversary?.years === 0
                    ? 'Welcome to the team!'
                    : `${selfAnniversary?.years} year${selfAnniversary && selfAnniversary.years > 1 ? 's' : ''} with us — thank you for everything!`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Today's celebrations widget on dashboard */}
      {todayCount > 0 && (
        <div className={isEmployee ? 'grid grid-cols-1 md:grid-cols-2 gap-6 items-start' : ''}>
          <div className="card p-5 bg-gradient-to-br from-pink-50 via-white to-rose-50 border-pink-100">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white">
                <PartyPopper size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Today's Celebrations</h3>
                <p className="text-xs text-gray-500">Don't forget to wish!</p>
              </div>
            </div>
            <div className="space-y-2">
              {otherBirthdays.map(b => (
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
              {otherAnniversaries.map(a => (
                <div key={'a'+a.id} className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-rose-100">
                  <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 font-bold relative">
                    {a.avatar ? <img src={a.avatar} className="w-full h-full rounded-full object-cover" /> : getInitials(a.name)}
                    <span className="absolute -top-1 -right-1 text-lg">✨</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{a.name}</p>
                    <p className="text-xs text-gray-500">{a.years === 0 ? '👋 Welcome to the team!' : `🎊 ${a.years} year${a.years > 1 ? 's' : ''} at company`} • {a.department}</p>
                  </div>
                  <button onClick={() => wishNow(a, 'anniversary')}
                    className="text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg px-2.5 py-1.5 flex items-center gap-1 flex-shrink-0">
                    <MessageSquare size={12} /> Wish
                  </button>
                </div>
              ))}
            </div>
          </div>

          {isEmployee && leaveBalance && (
            <div className="card p-5 rounded-2xl bg-white shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
                  <CalendarCheck size={20} className="text-rose-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Paid Leave Balance</p>
                  <p className="text-xs text-gray-500">
                    Carried forward + accrued · max {leaveBalance.maxCap} · {leaveBalance.monthlyAccrual}/month
                    {leaveBalance.wasReset && leaveBalance.countingFrom && <> · from {leaveBalance.countingFrom}</>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-2xl font-bold text-emerald-500">{leaveBalance.available}</p>
                  <p className="text-[11px] text-gray-400">Available</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-700">{leaveBalance.taken}</p>
                  <p className="text-[11px] text-gray-400">Taken</p>
                </div>
                {leaveBalance.lapsed > 0 && (
                  <div>
                    <p className="text-2xl font-bold text-amber-500">{leaveBalance.lapsed}</p>
                    <p className="text-[11px] text-gray-400">Lapsed</p>
                  </div>
                )}
                <a href="/leaves" className="text-xs text-rose-400 hover:underline ml-auto whitespace-nowrap">View Details →</a>
              </div>
            </div>
          )}
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
                  <Sparkles size={12} className="text-rose-500" />
                  <span className="font-medium text-gray-700">{a.name}</span>
                  <span className="text-gray-400">{a.years}yr</span>
                </span>
                <span className="text-rose-600 font-semibold">in {a.daysUntil}d</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Splash popup — shown once per day, rendered via portal to truly cover the full page */}
      {mounted && showPopup && todayCount > 0 && !dismissed && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
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
                {otherBirthdays.map(b => (
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
                {otherAnniversaries.map(a => (
                  <div key={'pa'+a.id} className="flex items-center gap-3 bg-rose-50 rounded-lg p-3">
                    <div className="w-10 h-10 rounded-full bg-rose-200 flex items-center justify-center text-rose-800 font-bold">
                      {getInitials(a.name)}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{a.name}</p>
                      <p className="text-xs text-rose-700">{a.years === 0 ? '👋 Welcome to the team!' : `✨ ${a.years} year${a.years > 1 ? 's' : ''} anniversary`}</p>
                    </div>
                    <button onClick={() => { setShowPopup(false); setDismissed(true); wishNow(a, 'anniversary') }}
                      className="text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg px-3 py-1.5">
                      Wish 💌
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Certificate modal — rendered via portal to truly cover the full page */}
      {mounted && showCertificate && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-center">
            <button
              onClick={() => setShowCertificate(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8"
            >×</button>
            <div className="text-6xl mb-3">🏆</div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Certificate of Appreciation</h2>
            <p className="text-sm text-gray-500 mb-4">
              Awarded to <span className="font-semibold text-gray-700">{user?.name}</span> for{' '}
              {selfAnniversary?.years} year{selfAnniversary && selfAnniversary.years > 1 ? 's' : ''} of dedicated service.
            </p>
            <button
              onClick={() => setShowCertificate(false)}
              className="px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-rose-400 hover:bg-rose-500 transition-colors"
            >
              Close
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}