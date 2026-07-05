// src/lib/welcomeFlow.ts
// Sends welcome credentials to a newly onboarded client via email + WhatsApp.
// Generates a temporary portal password, bcrypt-hashes it, saves to Client.
import { hash } from 'bcryptjs'
import { prisma } from './prisma'
import { sendMail, wrapEmailHtml } from './mailer'
import { sendWhatsapp } from './whatsapp'

function generatePassword(len = 10): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let pw = ''
  for (let i = 0; i < len; i++) pw += chars[Math.floor(Math.random() * chars.length)]
  return pw
}

/**
 * Activate portal access for a client — generates a temporary password,
 * saves the hash, and fires welcome email + WhatsApp with the credentials.
 * Returns the plaintext password (only accessible immediately post-generation).
 */
export async function activateClientPortal(clientId: string, options: {
  regenerate?: boolean
} = {}): Promise<{ password: string; emailSent: boolean; whatsappSent: boolean }> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true, clientName: true, companyName: true, email: true, phone: true,
      portalPasswordSet: true,
    },
  })
  if (!client) throw new Error('Client not found')

  if (client.portalPasswordSet && !options.regenerate) {
    throw new Error('Portal is already activated. Pass regenerate:true to reset.')
  }

  const password = generatePassword()
  const passwordHash = await hash(password, 10)

  await prisma.client.update({
    where: { id: clientId },
    data: {
      portalPassword: passwordHash,
      portalPasswordSet: true,
    },
  })

  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/client-portal`
  const companyName = client.companyName || client.clientName

  // ============ Email ============
  let emailSent = false
  if (client.email) {
    const body = `
      <p>Hi <b>${client.clientName}</b>,</p>
      <p>Welcome to <b>${process.env.COMPANY_NAME || 'HBS'}</b>! Your client portal has been set up. Use the credentials below to access your account and track services, invoices, payments, and reports:</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 6px;"><b>Portal URL:</b> <a href="${portalUrl}">${portalUrl}</a></p>
        <p style="margin:0 0 6px;"><b>Email:</b> ${client.email}</p>
        <p style="margin:0;"><b>Temporary Password:</b> <code style="background:white;padding:3px 8px;border:1px solid #cbd5e1;border-radius:4px;font-size:14px;">${password}</code></p>
      </div>
      <p style="font-size:12px;color:#64748b;">⚠️ For your security, please change this password immediately after logging in.</p>
      <p>If you need help, contact your account manager.</p>
    `
    const r = await sendMail({
      to: client.email,
      subject: `Welcome to ${process.env.COMPANY_NAME || 'HBS'} — Your Portal Access`,
      html: wrapEmailHtml('Welcome!', body, 'Open Client Portal', portalUrl),
      referenceType: 'CLIENT',
      referenceId: clientId,
    })
    emailSent = r.success
  }

  // ============ WhatsApp ============
  let whatsappSent = false
  if (client.phone) {
    const r = await sendWhatsapp({
      toPhone: client.phone,
      template: 'hbs_client_welcome',
      params: {
        clientName: client.clientName,
        companyName,
        loginEmail: client.email || 'contact your account manager',
        loginPassword: password,
        portalUrl,
      },
      referenceType: 'CLIENT',
      referenceId: clientId,
    })
    whatsappSent = r.success
  }

  return { password, emailSent, whatsappSent }
}
