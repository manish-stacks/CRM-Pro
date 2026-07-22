// src/lib/idgen.ts
// Sequential ID generators for Employee, Lead, Client, Invoice, Proposal, Tickets
// Uses count-based sequential numbers with a prefix.
// NOTE: For high-concurrency production, replace with a transactional counter
// table to eliminate the race window between count() and create().
import { prisma } from './prisma'

const EMPLOYEE_PREFIX = process.env.EMPLOYEE_ID_PREFIX || 'HBS'

export async function generateEmployeeId(): Promise<string> {
  const count = await prisma.employee.count()
  return `${EMPLOYEE_PREFIX}${String(count + 1).padStart(5, '0')}`
}

export async function generateTicketNumber(): Promise<string> {
  const count = await prisma.supportTicket.count()
  return `TCK-${String(count + 1).padStart(6, '0')}`
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
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const count = await prisma.proposal.count({ where: { createdAt: { gte: monthStart, lt: nextMonth } } })
  return `PROP-${y}${m}-${String(count + 1).padStart(4, '0')}`
}

export async function generateInvoiceNumber(): Promise<string> {
  const now = new Date()
  const y = String(now.getFullYear()).slice(2)
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const count = await prisma.invoice.count({ where: { createdAt: { gte: monthStart, lt: nextMonth } } })
  return `INV-${y}${m}-${String(count + 1).padStart(4, '0')}`
}

export async function generateSupportTicketNumber(): Promise<string> {
  const count = await prisma.supportTicket.count()
  return `TCK-${String(count + 1).padStart(6, '0')}`
}

export async function generateEmployeeTicketNumber(): Promise<string> {
  const count = await prisma.employeeTicket.count()
  return `ETK-${String(count + 1).padStart(6, '0')}`
}

/** Generate a random URL-safe token (for share links, password reset etc) */
export function randomToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}
