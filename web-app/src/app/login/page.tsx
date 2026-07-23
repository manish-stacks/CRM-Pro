'use client'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Eye, EyeOff, Loader2, ArrowLeft, LayoutGrid, Users, KanbanSquare, CheckCircle2, KeyRound } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const { login, verifyLoginOtp } = useAuth()
  // iPadOS 13+ sends a desktop macOS User-Agent, so the server-side desktop-only
  // gate can't see it. Touch points give it away — block it here.
  const [blockedDevice, setBlockedDevice] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  // Step 2: admin accounts stop here until the emailed code is verified.
  const [otpStage, setOtpStage] = useState(false)
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [otpEmail, setOtpEmail] = useState('')
  const [verifying, setVerifying] = useState(false)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // Forgot-password flow: 'email' -> enter address, 'reset' -> code + new password
  const [forgotStage, setForgotStage] = useState<null | 'email' | 'reset'>(null)
  const [fpEmail, setFpEmail] = useState('')
  const [fpOtp, setFpOtp] = useState('')
  const [fpPwd, setFpPwd] = useState('')
  const [fpPwd2, setFpPwd2] = useState('')
  const [fpBusy, setFpBusy] = useState(false)
  const [fpInfo, setFpInfo] = useState('')

  const resetForgot = () => {
    setForgotStage(null); setFpOtp(''); setFpPwd(''); setFpPwd2(''); setError(''); setFpInfo('')
  }

  const sendResetCode = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!fpEmail.trim()) { setError('Enter your email address'); return }
    setFpBusy(true); setError(''); setFpInfo('')
    try {
      const res = await fetch('/api/auth/forgot-password/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fpEmail.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not send the code'); return }
      setFpInfo(data.message || 'If an account exists for this email, a reset code has been sent.')
      setForgotStage('reset')
    } catch {
      setError('Network error. Please try again.')
    } finally { setFpBusy(false) }
  }

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (fpOtp.trim().length !== 6) { setError('Enter the 6-digit code'); return }
    if (fpPwd.length < 6) { setError('Password must be at least 6 characters'); return }
    if (fpPwd !== fpPwd2) { setError('Passwords do not match'); return }
    setFpBusy(true); setError(''); setFpInfo('')
    try {
      const res = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fpEmail.trim().toLowerCase(), otp: fpOtp.trim(), newPassword: fpPwd }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not reset the password'); return }
      setEmail(fpEmail.trim().toLowerCase())
      setPassword('')
      resetForgot()
      setFpInfo('Password changed. Please log in with your new password.')
    } catch {
      setError('Network error. Please try again.')
    } finally { setFpBusy(false) }
  }

  useEffect(() => {
    if (otpStage) otpRefs.current[0]?.focus()
  }, [otpStage])

  useEffect(() => {
    if (typeof navigator === 'undefined') return
    const ua = navigator.userAgent || ''
    const isTouchMac = /Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1
    const isPhoneUA = /Android|iPhone|iPad|iPod|Mobile|Tablet|BlackBerry|Windows Phone/i.test(ua)
    if (isTouchMac || isPhoneUA) setBlockedDevice(true)
  }, [])

  const otp = otpDigits.join('')

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otpDigits]
    next[index] = digit
    setOtpDigits(next)
    if (digit && index < 5) otpRefs.current[index + 1]?.focus()
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    e.preventDefault()
    const next = ['', '', '', '', '', '']
    pasted.split('').forEach((d, i) => (next[i] = d))
    setOtpDigits(next)
    otpRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await login(email, password)
      if (result.requiresOtp) {
        setOtpEmail(result.email || email)
        setOtpDigits(['', '', '', '', '', ''])
        setOtpStage(true)
      } else if (result.success) {
        router.push('/dashboard')
      } else {
        setError('Invalid credentials')
      }
    } catch (err: any) {
      setError(err.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) { setError('Enter the 6-digit code'); return }
    setVerifying(true)
    setError('')
    try {
      const ok = await verifyLoginOtp(otpEmail, otp)
      if (ok) router.push('/dashboard')
      else setError('Incorrect or expired code')
    } finally {
      setVerifying(false)
    }
  }

  const resendCode = async () => {
    setError('')
    setLoading(true)
    try {
      const result = await login(email, password)
      if (result.requiresOtp) setOtpDigits(['', '', '', '', '', ''])
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { icon: Users, text: 'Manage every contact and account in one place' },
    { icon: KanbanSquare, text: 'Track deals through your sales pipeline' },
    { icon: LayoutGrid, text: 'Automate follow-ups, tasks and reminders' },
  ]

  if (blockedDevice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="max-w-sm w-full text-center bg-white border border-gray-200 rounded-2xl p-8">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 text-2xl">!</div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Desktop access only</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            This portal can only be used on a desktop or laptop. Please use the mobile app on your phone or tablet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left — brand panel */}
      <div className="hidden lg:flex lg:w-[46%] bg-brand-900 relative flex-col justify-between px-12 py-14 text-white overflow-hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-200 h-auto rounded-lg bg-white flex items-center justify-center p-2">
              <img src="https://hoverbusinessservices.com/images/hbs-logo.png" alt="Hover CRM" className="h-14" />
            </div>
           
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-bold leading-tight mb-3">
            Run your business<br />from one dashboard
          </h1>
          <p className="text-indigo-100 text-sm mb-8 max-w-sm">
            Hover Business Services LLP — contacts, deals and tasks, all synced in real time.
          </p>
          <div className="space-y-4">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                  <f.icon size={16} />
                </div>
                <span className="text-sm text-indigo-50">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-indigo-200 text-xs">© {new Date().getFullYear()} Hover Business Services LLP</p>

        <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-white/5" />
        <div className="absolute -right-10 bottom-20 w-40 h-40 rounded-full bg-white/5" />
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-gray-50">
        <div className="w-full max-w-sm">
          {/* mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-200 h-auto rounded-lg bg-white flex items-center justify-center p-2">
              <img src="https://hoverbusinessservices.com/images/hbs-logo.png" alt="Hover CRM" className="h-14" />
            </div>
           
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
            {forgotStage ? (
              <>
                <button
                  type="button"
                  onClick={resetForgot}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
                >
                  <ArrowLeft size={14} /> Back to login
                </button>

                <div className="w-11 h-11 rounded-full bg-brand-50 flex items-center justify-center mb-4">
                  <KeyRound size={19} className="text-brand-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Reset your password</h2>
                <p className="text-sm text-gray-500 mt-1 mb-6">
                  {forgotStage === 'email'
                    ? 'Enter your work email and we will send you a 6-digit code.'
                    : `Enter the code sent to ${fpEmail} and choose a new password.`}
                </p>

                {forgotStage === 'email' ? (
                  <form onSubmit={sendResetCode} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                      <input
                        type="email"
                        placeholder="you@hoverbiz.com"
                        value={fpEmail}
                        onChange={e => setFpEmail(e.target.value)}
                        required
                        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 transition"
                      />
                    </div>

                    {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-sm text-red-600">{error}</div>}
                    {fpInfo && <div className="bg-green-50 border border-green-200 rounded-lg px-3.5 py-2.5 text-sm text-green-700">{fpInfo}</div>}

                    <button type="submit" disabled={fpBusy}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2.5 transition disabled:opacity-60">
                      {fpBusy ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : 'Send reset code'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={submitReset} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">6-digit code</label>
                      <input
                        type="text" inputMode="numeric" maxLength={6}
                        placeholder="000000"
                        value={fpOtp}
                        onChange={e => setFpOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full tracking-[0.5em] text-center rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
                      <input
                        type={showPwd ? 'text' : 'password'}
                        placeholder="At least 6 characters"
                        value={fpPwd}
                        onChange={e => setFpPwd(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm new password</label>
                      <input
                        type={showPwd ? 'text' : 'password'}
                        placeholder="Re-enter password"
                        value={fpPwd2}
                        onChange={e => setFpPwd2(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 transition"
                      />
                    </div>

                    {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-sm text-red-600">{error}</div>}
                    {fpInfo && <div className="bg-green-50 border border-green-200 rounded-lg px-3.5 py-2.5 text-sm text-green-700">{fpInfo}</div>}

                    <button type="submit" disabled={fpBusy}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2.5 transition disabled:opacity-60">
                      {fpBusy ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Reset password'}
                    </button>

                    <p className="text-center text-sm text-gray-500">
                      Didn't get a code?{' '}
                      <button type="button" onClick={() => sendResetCode()} disabled={fpBusy}
                        className="font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50">Resend</button>
                    </p>
                  </form>
                )}
              </>
            ) : !otpStage ? (
              <>
                <h2 className="text-xl font-semibold text-gray-900">Log in to your account</h2>
                <p className="text-sm text-gray-500 mt-1 mb-6">Welcome back, enter your details below.</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                    <input
                      type="email"
                      placeholder="you@hoverbiz.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-gray-700">Password</label>
                      <button
                        type="button"
                        onClick={() => { setFpEmail(email); setForgotStage('email'); setError(''); setFpInfo('') }}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPwd ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 pr-10 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label={showPwd ? 'Hide password' : 'Show password'}
                      >
                        {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {fpInfo && !error && (
                    <div className="bg-green-50 border border-green-200 rounded-lg px-3.5 py-2.5 text-sm text-green-700">
                      {fpInfo}
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-sm text-red-600">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2.5 mt-2 transition disabled:opacity-60"
                  >
                    {loading ? <><Loader2 size={16} className="animate-spin" /> Logging in...</> : 'Log in'}
                  </button>
                </form>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { setOtpStage(false); setError('') }}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
                >
                  <ArrowLeft size={14} /> Back
                </button>

                <div className="w-11 h-11 rounded-full bg-brand-50 flex items-center justify-center mb-4">
                  <CheckCircle2 size={20} className="text-brand-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Verify your identity</h2>
                <p className="text-sm text-gray-500 mt-1 mb-6">
                  Enter the 6-digit code sent to <span className="font-medium text-gray-700">{otpEmail}</span>
                </p>

                <form onSubmit={handleVerify} className="space-y-5">
                  <div className="flex gap-2 justify-between" onPaste={handleOtpPaste}>
                    {otpDigits.map((digit, i) => (
                      <input
                        key={i}
                        ref={el => { otpRefs.current[i] = el }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        className="w-11 h-12 text-center text-lg font-semibold rounded-lg border border-gray-300 text-gray-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 transition"
                      />
                    ))}
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-sm text-red-600">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={verifying}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2.5 transition disabled:opacity-60"
                  >
                    {verifying ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : 'Verify and log in'}
                  </button>

                  <p className="text-center text-sm text-gray-500">
                    Didn't get a code?{' '}
                    <button
                      type="button"
                      onClick={resendCode}
                      disabled={loading}
                      className="font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
                    >
                      {loading ? 'Sending...' : 'Resend'}
                    </button>
                  </p>
                </form>
              </>
            )}
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Access restricted to authorized Hover Business Services LLP personnel.
          </p>
        </div>
      </div>
    </div>
  )
}