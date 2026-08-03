// src/app/api/auth/send-email-otp/route.ts
// Sends a 6-digit code to the logged-in user's own email to verify it's
// real and reachable. Required for everyone except Admin/Super Admin.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { generateOtp, hashOtp, OTP_TTL_MS } from '@/lib/otp'
import { sendMail, wrapEmailHtml } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  if (!user) return errorResponse('User not found', 404)

  // Required for everyone except Admin/Super Admin.
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
    return errorResponse('Email verification is not required for admin accounts', 400)
  }
  if (user.emailVerified) {
    return successResponse({ alreadyVerified: true, message: 'Email is already verified' })
  }

  const otp = generateOtp()
  const hashed = await hashOtp(otp)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifyOtp: hashed,
      emailVerifyOtpExpiry: new Date(Date.now() + OTP_TTL_MS),
      emailVerifyOtpAttempts: 0,
    },
  })

  const result = await sendMail({
    to: user.email,
    subject: 'Verify your email — HBS CRM',
    html: wrapEmailHtml(
      'Verify your email',
      `<p>Hi ${user.name},</p>
       <p>Use this code to verify your email address. It expires in 10 minutes.</p>
       <p style="font-size:28px;font-weight:700;letter-spacing:4px;color:#0f172a;text-align:center;margin:24px 0;">${otp}</p>
       <p>If you didn't request this, you can safely ignore this email.</p>`
    ),
    referenceType: 'EmailVerification',
    referenceId: user.id,
  })

  if (!result.success) {
    return errorResponse(result.error || 'Failed to send verification email')
  }

  return successResponse({ sent: true, message: 'Verification code sent to your email' })
}
