// src/lib/mailer.ts
// Nodemailer SMTP wrapper + EmailLog persistence
import nodemailer, { Transporter } from 'nodemailer'
import { prisma } from './prisma'
import { getSetting } from './settings'

let transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (transporter) return transporter
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  })
  return transporter
}

export interface SendMailOptions {
  to: string | string[]
  cc?: string | string[]
  subject: string
  html: string
  text?: string
  attachments?: Array<{ filename: string; path?: string; content?: Buffer | string }>
  referenceType?: string
  referenceId?: string
}

export interface SendMailResult {
  success: boolean
  messageId?: string
  error?: string
  logId?: string
}

/**
 * Send an email with SMTP; also logs to EmailLog table
 */
export async function sendMail(opts: SendMailOptions): Promise<SendMailResult> {
  const from = `"${process.env.SMTP_FROM_NAME || 'HBS CRM'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`
  const to = Array.isArray(opts.to) ? opts.to.join(', ') : opts.to
  const cc = opts.cc ? (Array.isArray(opts.cc) ? opts.cc.join(', ') : opts.cc) : undefined

  // Create log first
  const log = await prisma.emailLog.create({
    data: {
      toEmail: to,
      ccEmail: cc,
      subject: opts.subject,
      body: opts.html,
      status: 'PENDING',
      referenceType: opts.referenceType,
      referenceId: opts.referenceId,
    },
  })

  // Admin kill-switch — Settings > Notifications > "Email Sending". Checked
  // per-send (not cached long) so toggling off stops messages immediately.
  const emailEnabled = await getSetting<boolean>('email_enabled', true)
  if (!emailEnabled) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'SKIPPED', errorMessage: 'Email sending disabled by admin' },
    })
    return { success: false, error: 'Email sending is disabled by admin', logId: log.id }
  }

  try {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      throw new Error('SMTP not configured. Set SMTP_* env vars.')
    }
    const info = await getTransporter().sendMail({
      from, to, cc,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      attachments: opts.attachments,
    })

    await prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: 'SENT',
        response: info.messageId || JSON.stringify(info),
        sentAt: new Date(),
      },
    })

    return { success: true, messageId: info.messageId, logId: log.id }
  } catch (e: any) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: 'FAILED',
        errorMessage: e?.message || String(e),
      },
    })
    return { success: false, error: e?.message || String(e), logId: log.id }
  }
}

/**
 * Simple HTML wrapper for consistent branded emails
 */
export function wrapEmailHtml(title: string, body: string, ctaText?: string, ctaUrl?: string): string {
  const companyName = process.env.COMPANY_NAME || 'HBS CRM'
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:Arial,sans-serif;background:#f5f7fa;margin:0;padding:0;">
  <div style="max-width:600px;margin:40px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#3b82f6,#1e40af);padding:24px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:22px;">${companyName}</h1>
    </div>
    <div style="padding:32px 28px;color:#334155;line-height:1.6;font-size:14px;">
      <h2 style="color:#0f172a;margin:0 0 16px;font-size:18px;">${title}</h2>
      ${body}
      ${ctaText && ctaUrl ? `
      <div style="text-align:center;margin:28px 0;">
        <a href="${ctaUrl}" style="display:inline-block;background:#3b82f6;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">${ctaText}</a>
      </div>` : ''}
    </div>
    <div style="background:#f8fafc;padding:16px;text-align:center;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;">
      &copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.
    </div>
  </div>
</body>
</html>`
}
