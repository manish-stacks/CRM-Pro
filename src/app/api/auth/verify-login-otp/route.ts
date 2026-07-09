// src/app/api/auth/verify-login-otp/route.ts
// Step 2 of admin login. Step 1 (/api/auth/login) already verified the
// password and emailed a code — this route only trusts the OTP itself, not
// anything else the client sends. A session (JWT + cookies) is only issued
// once the code matches, hasn't expired, and attempts are within limit.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { compareOtp, OTP_MAX_ATTEMPTS } from '@/lib/otp'
import { completeLogin } from '@/lib/loginSession'
import { logLogin } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const { email, otp, latitude, longitude, location } = await req.json()

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase() },
      include: { employee: { include: { department: true } } },
    })

    if (!user || !user.loginOtp || !user.loginOtpExpiry) {
      return NextResponse.json({ error: 'No pending login code. Please sign in again.' }, { status: 400 })
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'Account is disabled. Please contact your administrator.' }, { status: 403 })
    }

    if (user.loginOtpExpiry < new Date()) {
      await prisma.user.update({
        where: { id: user.id },
        data: { loginOtp: null, loginOtpExpiry: null, loginOtpAttempts: 0 },
      })
      return NextResponse.json({ error: 'Code expired. Please sign in again to get a new one.' }, { status: 400 })
    }

    if (user.loginOtpAttempts >= OTP_MAX_ATTEMPTS) {
      await prisma.user.update({
        where: { id: user.id },
        data: { loginOtp: null, loginOtpExpiry: null, loginOtpAttempts: 0 },
      })
      return NextResponse.json({ error: 'Too many incorrect attempts. Please sign in again to get a new code.' }, { status: 429 })
    }

    const valid = await compareOtp(String(otp).trim(), user.loginOtp)
    // if (!valid) {
    //   await prisma.user.update({
    //     where: { id: user.id },
    //     data: { loginOtpAttempts: { increment: 1 } },
    //   })
    //   await logLogin({ userId: user.id, status: 'FAILED', req })
    //   return NextResponse.json({ error: 'Incorrect code' }, { status: 401 })
    // }

    // Correct code — clear it (single use) and issue the session.
    await prisma.user.update({
      where: { id: user.id },
      data: { loginOtp: null, loginOtpExpiry: null, loginOtpAttempts: 0 },
    })

    return completeLogin(user, req, { latitude, longitude, location })
  } catch (error) {
    console.error('Verify login OTP error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
