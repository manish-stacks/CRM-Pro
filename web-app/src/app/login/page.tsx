'use client'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Briefcase, Eye, EyeOff, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const { login, verifyLoginOtp } = useAuth()
  const [email, setEmail] = useState('admin@hbs.com')
  const [password, setPassword] = useState('123456')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  // Step 2: admin accounts stop here until the emailed code is verified.
  const [otpStage, setOtpStage] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpEmail, setOtpEmail] = useState('')
  const [verifying, setVerifying] = useState(false)
  const otpInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (otpStage) otpInputRef.current?.focus()
  }, [otpStage])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await login(email, password)
      if (result.requiresOtp) {
        setOtpEmail(result.email || email)
        setOtp('')
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
    if (otp.trim().length !== 6) { setError('Enter the 6-digit code'); return }
    setVerifying(true)
    setError('')
    try {
      const ok = await verifyLoginOtp(otpEmail, otp.trim())
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
      if (result.requiresOtp) setOtp('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {!otpStage ? (
            <>
              <div className="text-center mb-8">
                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
                  <Briefcase size={26} className="text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Hover Business Services LLP</h1>
                <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="label">Email Address</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="you@company.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      className="input pr-10"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-2.5 text-base"
                >
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in...</> : 'Sign In'}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-2">Demo Credentials</p>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 font-mono">
                  admin@hbs.com / 123456
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
                  <ShieldCheck size={26} className="text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">Verify it's you</h1>
                <p className="text-gray-500 text-sm mt-1">
                  We emailed a 6-digit code to<br /><span className="font-medium text-gray-700">{otpEmail}</span>
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-5">
                <div>
                  <label className="label">Verification Code</label>
                  <input
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="input text-center text-2xl tracking-[0.5em] font-semibold"
                    placeholder="------"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={verifying}
                  className="btn-primary w-full py-2.5 text-base"
                >
                  {verifying ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : 'Verify & Sign In'}
                </button>

                <div className="flex items-center justify-between text-sm pt-1">
                  <button
                    type="button"
                    onClick={() => { setOtpStage(false); setError('') }}
                    className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button
                    type="button"
                    onClick={resendCode}
                    disabled={loading}
                    className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                  >
                    {loading ? 'Sending...' : 'Resend code'}
                  </button>
                </div>
              </form>

              <p className="text-xs text-gray-400 text-center mt-6 pt-5 border-t border-gray-100">
                Code expires in 10 minutes. Didn't request this? Change your password immediately.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
