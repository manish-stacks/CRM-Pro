// src/app/api/auth/login/route.ts
// Phase 2: login now records LoginActivity (device/IP/browser/geo)
// Returns loginActivityId which the client stores in a cookie
// so logout can close the activity record.
//
// Admin 2FA: ADMIN / SUPER_ADMIN accounts don't get a session from this
// route directly — after the password checks out, an OTP is emailed and
// the client must call /api/auth/verify-login-otp with that code before a
// session is issued. This way a leaked/guessed password alone can never
// unlock admin data — the inbox on file has to be compromised too.
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { logLogin } from '@/lib/audit'
import { completeLogin } from '@/lib/loginSession'
import { generateOtp, hashOtp, OTP_TTL_MS } from '@/lib/otp'
import { sendMail, wrapEmailHtml } from '@/lib/mailer'
import { isMobileBrowserUA, MOBILE_BLOCK_MESSAGE } from '@/lib/mobileGuard'

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN']

export async function POST(req: NextRequest) {
  try {
    // Desktop-only: phones / tablets / iOS browsers must use the mobile app.
    // (The RN app sends x-client-platform: mobile-app and uses /api/mobile/auth/login.)
    if (req.headers.get('x-client-platform') !== 'mobile-app' && isMobileBrowserUA(req.headers.get('user-agent'))) {
      return NextResponse.json({ error: MOBILE_BLOCK_MESSAGE }, { status: 403 })
    }

    const { email, password, latitude, longitude, location } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        employee: { include: { department: true } },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (!user.isActive) {
      // Log failed attempt for a locked account
      await logLogin({ userId: user.id, status: 'FAILED', req })
      return NextResponse.json({
        error: user.disabledReason
          ? `Account is disabled. Reason: ${user.disabledReason}`
          : 'Account is disabled. Please contact your administrator.',
      }, { status: 403 })
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      await logLogin({ userId: user.id, status: 'FAILED', req })
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Password is correct. Admin roles need a second factor before a
    // session is issued — email an OTP and stop here.
    if (ADMIN_ROLES.includes(user.role)) {
      if (!user.email) {
        return NextResponse.json(
          { error: 'No email on file to send the login code to. Contact a super admin.' },
          { status: 400 }
        )
      }

      const otp = generateOtp()
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginOtp: await hashOtp(otp),
          loginOtpExpiry: new Date(Date.now() + OTP_TTL_MS),
          loginOtpAttempts: 0,
        },
      })
      console.log('Admin login OTP:', otp);
      sendMail({
        to: user.email,
        subject: 'Your admin login code',
        html: wrapEmailHtml(
          'Admin Login Verification',
          `<p>Hi ${user.name},</p>
           <p>Someone is signing in to your admin account. Use this code to complete sign-in:</p>
           <p style="font-size:30px;font-weight:800;letter-spacing:8px;color:#0f172a;">${otp}</p>
           <p>This code is valid for 10 minutes. If this wasn't you, change your password immediately and contact a super admin.</p>`
        ),
        referenceType: 'USER',
        referenceId: user.id,
      }).catch(() => {})

      return NextResponse.json({ requiresOtp: true, email: user.email })
    }

    // Non-admin roles: unchanged, immediate session.
    return completeLogin(user, req, { latitude, longitude, location })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}