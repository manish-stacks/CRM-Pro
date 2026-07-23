// src/app/api/auth/forgot-password/send-otp/route.ts
// PUBLIC (no auth): web "Forgot password?" step 1 — email a reset OTP.
// Same logic/model as the mobile flow so a code works on either surface.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateOtp, hashOtp, OTP_TTL_MS } from '@/lib/otp'
import { sendWhatsapp } from '@/lib/whatsapp'
import { sendMail, wrapEmailHtml } from '@/lib/mailer'

// Always the same response so this endpoint can't be used to probe which
// email addresses exist.
const GENERIC = { success: true, message: 'If an account exists for this email, a reset code has been sent.' }

export async function POST(req: NextRequest) {
  let body: any = {}
  try { body = await req.json() } catch {}
  const email = String(body?.email || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email } })

  if (user && user.isActive) {
    const otp = generateOtp()
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetOtp: await hashOtp(otp),
        resetOtpExpiry: new Date(Date.now() + OTP_TTL_MS),
        resetOtpAttempts: 0,
      },
    })

    if (user.phone) {
      sendWhatsapp({
        toPhone: user.phone,
        template: 'hbs_password_reset',
        params: { name: user.name, resetCode: otp },
        referenceType: 'USER',
        referenceId: user.id,
      }).catch(() => {})
    }

    if (user.email) {
      sendMail({
        to: user.email,
        subject: 'Your HBS password reset code',
        html: wrapEmailHtml(
          'Password Reset Code',
          `<p>Hi ${user.name},</p>
           <p>Use this code to reset your password:</p>
           <p style="font-size:30px;font-weight:800;letter-spacing:8px;color:#0f172a;">${otp}</p>
           <p>This code is valid for 10 minutes. If you didn't request it, you can safely ignore this email.</p>`
        ),
        referenceType: 'USER',
        referenceId: user.id,
      }).catch(() => {})
    }
  }

  return NextResponse.json(GENERIC)
}
