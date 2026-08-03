// src/app/api/client-portal/forgot-password/reset/route.ts
// PUBLIC (no auth): verify the OTP and set a new portal password.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'
import { compareOtp, OTP_MAX_ATTEMPTS } from '@/lib/otp'

export async function POST(req: NextRequest) {
  let body: any = {}
  try { body = await req.json() } catch {}
  const email = String(body?.email || '').trim().toLowerCase()
  const otp = String(body?.otp || '').trim()
  const newPassword = String(body?.newPassword || body?.new_password || '')

  if (!email || !otp || !newPassword) {
    return NextResponse.json({ error: 'Email, OTP and new password are required' }, { status: 400 })
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })
  }

  const client = await prisma.client.findFirst({ where: { email } })
  if (!client || !client.resetOtp || !client.resetOtpExpiry) {
    return NextResponse.json({ error: 'Invalid or expired code. Please request a new one.' }, { status: 400 })
  }
  if (client.resetOtpExpiry.getTime() < Date.now()) {
    return NextResponse.json({ error: 'This code has expired. Please request a new one.' }, { status: 400 })
  }
  if ((client.resetOtpAttempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Too many attempts. Please request a new code.' }, { status: 429 })
  }

  const valid = await compareOtp(otp, client.resetOtp)
  if (!valid) {
    await prisma.client.update({
      where: { id: client.id },
      data: { resetOtpAttempts: { increment: 1 } },
    })
    return NextResponse.json({ error: 'Incorrect code. Please try again.' }, { status: 400 })
  }

  await prisma.client.update({
    where: { id: client.id },
    data: {
      portalPassword: await hash(newPassword, 10),
      portalPasswordSet: true,
      resetOtp: null,
      resetOtpExpiry: null,
      resetOtpAttempts: 0,
    },
  })

  return NextResponse.json({ success: true, message: 'Password reset successful. You can now log in.' })
}
