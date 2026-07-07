// src/app/api/client-portal/forgot-password/send-otp/route.ts
// PUBLIC (no auth): client requests a password-reset OTP by email.
// The OTP is stored hashed with a 10-minute expiry and sent over WhatsApp
// (hbs_password_reset template) + email. Response is intentionally generic so
// we don't reveal which emails are registered.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateOtp, hashOtp, OTP_TTL_MS } from '@/lib/otp'
import { sendWhatsapp } from '@/lib/whatsapp'
import { sendMail, wrapEmailHtml } from '@/lib/mailer'

const GENERIC = { success: true, message: 'If an account exists for this email, a reset code has been sent.' }

export async function POST(req: NextRequest) {
  let body: any = {}
  try { body = await req.json() } catch {}
  const email = String(body?.email || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  const client = await prisma.client.findFirst({ where: { email } })

  // Only send to an existing, active client — but always return the generic message.
  if (client && client.status === 'ACTIVE') {
    const otp = generateOtp()
    await prisma.client.update({
      where: { id: client.id },
      data: {
        resetOtp: await hashOtp(otp),
        resetOtpExpiry: new Date(Date.now() + OTP_TTL_MS),
        resetOtpAttempts: 0,
      },
    })

    // WhatsApp (best-effort) — uses the pre-registered hbs_password_reset template.
    if (client.phone) {
      sendWhatsapp({
        toPhone: client.phone,
        template: 'hbs_password_reset',
        params: { name: client.clientName, resetCode: otp },
        referenceType: 'CLIENT',
        referenceId: client.id,
      }).catch(() => {})
    }

    // Email (best-effort) — free-form branded HTML.
    if (client.email) {
      sendMail({
        to: client.email,
        subject: 'Your HBS password reset code',
        html: wrapEmailHtml(
          'Password Reset Code',
          `<p>Hi ${client.clientName},</p>
           <p>Use this code to reset your portal password:</p>
           <p style="font-size:30px;font-weight:800;letter-spacing:8px;color:#0f172a;">${otp}</p>
           <p>This code is valid for 10 minutes. If you didn't request it, you can safely ignore this email.</p>`
        ),
        referenceType: 'CLIENT',
        referenceId: client.id,
      }).catch(() => {})
    }
  }

  return NextResponse.json(GENERIC)
}
