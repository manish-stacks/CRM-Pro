// src/lib/settings.ts
// Simple typed helper for the Setting key-value store.
// Supports strings, numbers, booleans, and JSON blobs.
import { prisma } from './prisma'

// In-memory cache — settings rarely change, cheap to re-read
type Cache = { at: number; value: any }
const cache = new Map<string, Cache>()
const TTL_MS = 60_000 // 60s

export async function getSetting<T = string>(key: string, defaultValue?: T): Promise<T | undefined> {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && now - hit.at < TTL_MS) return hit.value

  try {
    const row = await prisma.setting.findUnique({ where: { key } })
    if (!row) {
      if (defaultValue !== undefined) cache.set(key, { at: now, value: defaultValue })
      return defaultValue
    }
    // Try JSON parse; if fails treat as string
    let parsed: any = row.value
    try { parsed = JSON.parse(row.value) } catch { /* keep raw */ }
    cache.set(key, { at: now, value: parsed })
    return parsed as T
  } catch {
    return defaultValue
  }
}

export async function setSetting(key: string, value: any, category = 'general') {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value)
  await prisma.setting.upsert({
    where: { key },
    update: { value: serialized, category },
    create: { key, value: serialized, category },
  })
  cache.set(key, { at: Date.now(), value })
}

export function invalidateSetting(key: string) {
  cache.delete(key)
}

export function invalidateAllSettings() {
  cache.clear()
}

// Convenience getters with sensible defaults
export const Settings = {
  companyName:         () => getSetting<string>('company_name', 'Hover Business Services'),
  companyAddress:      () => getSetting<string>('company_address', ''),
  companyPhone:        () => getSetting<string>('company_phone', ''),
  companyEmail:        () => getSetting<string>('company_email', ''),
  companyGst:          () => getSetting<string>('company_gst', ''),
  companyLogo:         () => getSetting<string>('company_logo_url', ''),
  currency:            () => getSetting<string>('currency', 'INR'),
  currencySymbol:      () => getSetting<string>('currency_symbol', '₹'),
  gstDefaultRate:      () => getSetting<number>('gst_default_rate', 18),
  gstEnabledByDefault: () => getSetting<boolean>('gst_enabled_by_default', false),
  weeklyOffDays:       () => getSetting<number[]>('weekly_off_days', [0]),
  workingHoursPerDay:  () => getSetting<number>('working_hours_per_day', 8),
  halfDayThresholdHours: () => getSetting<number>('half_day_threshold_hours', 4),
  // Attendance office window + late-mark grace
  officeStartTime:     () => getSetting<string>('office_start_time', '10:00'),   // 24h HH:mm
  officeEndTime:       () => getSetting<string>('office_end_time', '18:30'),     // 6:30 PM
  lateGraceMinutes:    () => getSetting<number>('late_grace_minutes', 10),       // grace till 10:10
  // Leave accrual + carry-forward
  leaveMonthlyAccrual: () => getSetting<number>('leave_monthly_accrual', 1),     // paid leaves earned per month
  leaveMaxCarryForward:() => getSetting<number>('leave_max_carryforward', 6),    // max leaves that can accumulate
  invoiceDueDays:      () => getSetting<number>('invoice_due_days', 15),
  invoicePrefix:       () => getSetting<string>('invoice_prefix', 'INV-'),
  paymentMethods:      () => getSetting<string[]>('payment_methods', ['UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD']),
  timezone:            () => getSetting<string>('timezone', 'Asia/Kolkata'),
}