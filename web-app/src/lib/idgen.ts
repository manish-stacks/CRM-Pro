// src/lib/idgen.ts
import { BRAND } from './branding'
// Sequential ID generators for Employee, Lead, Client, Invoice, Proposal, Tickets
// Uses count-based sequential numbers with a prefix.
// NOTE: For high-concurrency production, replace with a transactional counter
// table to eliminate the race window between count() and create().
import { prisma } from './prisma'

const EMPLOYEE_PREFIX = process.env.EMPLOYEE_ID_PREFIX || BRAND.short

export async function generateEmployeeId(): Promise<string> {
  const last = await prisma.employee.findFirst({
    where: { employeeId: { startsWith: EMPLOYEE_PREFIX } },
    orderBy: { employeeId: 'desc' },
    select: { employeeId: true },
  })
  let next = 1
  if (last?.employeeId) {
    const match = last.employeeId.match(/\d+$/)
    if (match) {
      const n = parseInt(match[0], 10)
      if (!isNaN(n)) next = n + 1
    }
  }
  return `${EMPLOYEE_PREFIX}${String(next).padStart(5, '0')}`
}

export async function generateTicketNumber(): Promise<string> {
  const last = await prisma.supportTicket.findFirst({
    orderBy: { ticketNumber: 'desc' },
    select: { ticketNumber: true },
  })
  let next = 1
  if (last?.ticketNumber) {
    const match = last.ticketNumber.match(/\d+$/)
    if (match) {
      const n = parseInt(match[0], 10)
      if (!isNaN(n)) next = n + 1
    }
  }
  return `TCK-${String(next).padStart(6, '0')}`
}

// count()+1 breaks the moment any lead is deleted or bulk-imported (count
// no longer matches the highest existing number), causing a collision with
// an existing leadNumber → unique constraint error on create. Base it on
// the highest existing leadNumber instead. Still has a tiny race window
// under concurrent creates, so the POST route retries once on collision.
export async function generateLeadNumber(): Promise<string> {
  const last = await prisma.lead.findFirst({
    orderBy: { leadNumber: 'desc' },
    select: { leadNumber: true },
  })
  let next = 1
  if (last?.leadNumber) {
    const n = parseInt(last.leadNumber.replace(/^LEAD-/, ''), 10)
    if (!isNaN(n)) next = n + 1
  }
  return `LEAD-${String(next).padStart(6, '0')}`
}

// Same fix as generateLeadNumber — see comment above.
export async function generateClientCode(): Promise<string> {
  const last = await prisma.client.findFirst({
    orderBy: { clientCode: 'desc' },
    select: { clientCode: true },
  })
  let next = 1
  if (last?.clientCode) {
    const n = parseInt(last.clientCode.replace(/^CLT-/, ''), 10)
    if (!isNaN(n)) next = n + 1
  }
  return `CLT-${String(next).padStart(6, '0')}`
}

export async function generateProposalNumber(): Promise<string> {
  const now = new Date()
  const y = String(now.getFullYear()).slice(2)
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `PROP-${y}${m}-`
  const last = await prisma.proposal.findFirst({
    where: { proposalNumber: { startsWith: prefix } },
    orderBy: { proposalNumber: 'desc' },
    select: { proposalNumber: true },
  })
  let next = 1
  if (last?.proposalNumber) {
    const match = last.proposalNumber.match(/\d+$/)
    if (match) {
      const n = parseInt(match[0], 10)
      if (!isNaN(n)) next = n + 1
    }
  }
  return `${prefix}${String(next).padStart(4, '0')}`
}

export async function generateInvoiceNumber(docType: 'INVOICE' | 'RECEIPT' = 'INVOICE'): Promise<string> {
  const now = new Date()
  const y = String(now.getFullYear()).slice(2)
  const m = String(now.getMonth() + 1).padStart(2, '0')
  // Counted together (not per-prefix) so switching a draft between Invoice/Receipt
  // before saving can never collide with a number already issued that month.
  const invPrefix = `INV-${y}${m}-`
  const rcptPrefix = `RCPT-${y}${m}-`
  const [lastInv, lastRcpt] = await Promise.all([
    prisma.invoice.findFirst({
      where: { invoiceNumber: { startsWith: invPrefix } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    }),
    prisma.invoice.findFirst({
      where: { invoiceNumber: { startsWith: rcptPrefix } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    }),
  ])
  let maxSeq = 0
  for (const item of [lastInv, lastRcpt]) {
    if (item?.invoiceNumber) {
      const match = item.invoiceNumber.match(/\d+$/)
      if (match) {
        const n = parseInt(match[0], 10)
        if (!isNaN(n) && n > maxSeq) maxSeq = n
      }
    }
  }
  const prefix = docType === 'RECEIPT' ? 'RCPT' : 'INV'
  return `${prefix}-${y}${m}-${String(maxSeq + 1).padStart(4, '0')}`
}

export async function generateSupportTicketNumber(): Promise<string> {
  return generateTicketNumber()
}

export async function generateEmployeeTicketNumber(): Promise<string> {
  const last = await prisma.employeeTicket.findFirst({
    orderBy: { ticketNumber: 'desc' },
    select: { ticketNumber: true },
  })
  let next = 1
  if (last?.ticketNumber) {
    const match = last.ticketNumber.match(/\d+$/)
    if (match) {
      const n = parseInt(match[0], 10)
      if (!isNaN(n)) next = n + 1
    }
  }
  return `ETK-${String(next).padStart(6, '0')}`
}

export async function generateSeoReportNumber(): Promise<string> {
  const last = await prisma.seoReport.findFirst({
    orderBy: { reportNumber: 'desc' },
    select: { reportNumber: true },
  })
  let next = 1
  if (last?.reportNumber) {
    const match = last.reportNumber.match(/\d+$/)
    if (match) {
      const n = parseInt(match[0], 10)
      if (!isNaN(n)) next = n + 1
    }
  }
  let reportNumber = `SEO-${String(next).padStart(6, '0')}`
  while (await prisma.seoReport.findUnique({ where: { reportNumber }, select: { id: true } })) {
    next++
    reportNumber = `SEO-${String(next).padStart(6, '0')}`
  }
  return reportNumber
}

/** Generate a random URL-safe token (for share links, password reset etc) */
export function randomToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}
