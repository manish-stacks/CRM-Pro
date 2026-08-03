// src/app/api/auth/verify-email-otp/route.ts
// Step 2 of email verification — checks the code the user typed against
// the one we emailed them, and marks emailVerified on success.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { compareOtp, OTP_MAX_ATTEMPTS } from '@/lib/otp'

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { otp } = await req.json().catch(() => ({}))
  if (!otp) return errorResponse('Code is required')

  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  if (!user) return errorResponse('User not found', 404)

  // Required for everyone except Admin/Super Admin.
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
    return errorResponse('Email verification is not required for admin accounts', 400)
  }
  if (user.emailVerified) {
    return successResponse({ verified: true, message: 'Email is already verified' })
  }
  if (!user.emailVerifyOtp || !user.emailVerifyOtpExpiry) {
    return errorResponse('No pending verification code. Please request a new one.', 400)
  }
  if (user.emailVerifyOtpExpiry < new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyOtp: null, emailVerifyOtpExpiry: null, emailVerifyOtpAttempts: 0 },
    })
    return errorResponse('Code expired. Please request a new one.', 400)
  }
  if (user.emailVerifyOtpAttempts >= OTP_MAX_ATTEMPTS) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyOtp: null, emailVerifyOtpExpiry: null, emailVerifyOtpAttempts: 0 },
    })
    return errorResponse('Too many incorrect attempts. Please request a new code.', 429)
  }

  const valid = await compareOtp(String(otp).trim(), user.emailVerifyOtp)
  if (!valid) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyOtpAttempts: { increment: 1 } },
    })
    return errorResponse('Incorrect code', 401)
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifyOtp: null,
      emailVerifyOtpExpiry: null,
      emailVerifyOtpAttempts: 0,
    },
  })

  return successResponse({ verified: true, message: 'Email verified!' })
}
