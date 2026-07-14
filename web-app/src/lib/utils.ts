// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}${timestamp}${random}`
}

export function calculateWorkingHours(punchIn: Date, punchOut: Date): number {
  const diff = punchOut.getTime() - punchIn.getTime()
  return Math.round((diff / (1000 * 60 * 60)) * 100) / 100
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function daysUntilExpiry(expiryDate: Date | string): number {
  const now = new Date()
  const expiry = new Date(expiryDate)
  const diff = expiry.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    // Lead (v2)
    NEW:               'bg-blue-100 text-blue-700',
    NOT_INTERESTED:    'bg-gray-200 text-gray-700',
    FOLLOW_UP:         'bg-yellow-100 text-yellow-700',
    RINGING:           'bg-amber-100 text-amber-700',
    MEETING_SCHEDULED: 'bg-purple-100 text-purple-700',
    MEETING:           'bg-purple-100 text-purple-700',
    CALLBACK:          'bg-cyan-100 text-cyan-700',
    PROPOSAL:          'bg-orange-100 text-orange-700',
    CONVERTED:         'bg-emerald-100 text-emerald-700',
    CLOSED:            'bg-slate-200 text-slate-700',
    // Proposal
    DRAFT:    'bg-gray-100 text-gray-700',
    SENT:     'bg-blue-100 text-blue-700',
    VIEWED:   'bg-purple-100 text-purple-700',
    ACCEPTED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
    EXPIRED:  'bg-gray-100 text-gray-700',
    // Leave / Attendance
    PENDING:   'bg-yellow-100 text-yellow-700',
    APPROVED:  'bg-green-100 text-green-700',
    CANCELLED: 'bg-slate-100 text-slate-600',
    PRESENT:   'bg-green-100 text-green-700',
    ABSENT:    'bg-red-100 text-red-700',
    HALF_DAY:  'bg-orange-100 text-orange-700',
    LEAVE:     'bg-blue-100 text-blue-700',
    HOLIDAY:   'bg-teal-100 text-teal-700',
    // Client / Service
    ACTIVE:   'bg-green-100 text-green-700',
    INACTIVE: 'bg-gray-100 text-gray-600',
    CHURNED:  'bg-red-100 text-red-700',
    PAUSED:   'bg-amber-100 text-amber-700',
    RENEWING: 'bg-blue-100 text-blue-700',
    // Payment
    PAID:     'bg-green-100 text-green-700',
    PARTIAL:  'bg-orange-100 text-orange-700',
    OVERDUE:  'bg-red-100 text-red-700',
    // Tickets
    OPEN:         'bg-blue-100 text-blue-700',
    IN_PROGRESS:  'bg-amber-100 text-amber-700',
    RESOLVED:     'bg-green-100 text-green-700',
    REOPENED:     'bg-orange-100 text-orange-700',
    URGENT:       'bg-red-100 text-red-700',
    HIGH:         'bg-orange-100 text-orange-700',
    MEDIUM:       'bg-yellow-100 text-yellow-700',
    LOW:          'bg-slate-100 text-slate-600',
  }
  return colors[status] || 'bg-gray-100 text-gray-700'
}

/** Compute years/months since a date (for anniversaries) */
export function yearsSince(date: Date | string): number {
  const start = new Date(date)
  const now = new Date()
  let years = now.getFullYear() - start.getFullYear()
  const m = now.getMonth() - start.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < start.getDate())) years--
  return years
}

/** Is today the anniversary of the given date (month + day match)? */
export function isAnniversaryToday(date: Date | string | null | undefined): boolean {
  if (!date) return false
  const d = new Date(date)
  const now = new Date()
  return d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

/** Is today the birthday for the given date? */
export function isBirthdayToday(date: Date | string | null | undefined): boolean {
  return isAnniversaryToday(date)
}

export function paginate<T>(items: T[], page: number, limit: number) {
  const total = items.length
  const totalPages = Math.ceil(total / limit)
  const start = (page - 1) * limit
  const data = items.slice(start, start + limit)
  return { data, total, totalPages, page, limit }
}

export async function apiRequest<T>(
  url: string,
  options?: RequestInit
): Promise<{ data?: T; error?: string }> {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
    const json = await res.json()
    if (!res.ok) return { error: json.error || 'Request failed' }
    return { data: json }
  } catch (err) {
    return { error: 'Network error' }
  }
}
