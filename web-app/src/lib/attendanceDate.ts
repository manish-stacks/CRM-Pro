// src/lib/attendanceDate.ts
// Timezone-safe "today" for @db.Date columns (Attendance.date).
//
// BUG THIS FIXES: `new Date(); d.setHours(0,0,0,0)` sets *local* midnight.
// In IST (UTC+5:30) that instant's UTC calendar date is the PREVIOUS day,
// so MySQL's DATE column (which Prisma writes/reads using UTC parts) can
// end up storing a different date than the one used moments later to look
// the record back up — causing "No punch-in found for today" right after
// punching in, and the Punch In button reappearing after a refresh.
//
// Fix: keep the *local* calendar day (getFullYear/getMonth/getDate use
// local time), but build the Date with Date.UTC so its UTC representation
// is midnight of that same y-m-d. This is stable no matter what timezone
// the Node process or the MySQL connection is running in.
// IMPORTANT: never use ambient local Date getters (getFullYear/getMonth/getDate)
// for "today" — the server process's OS/container timezone is not guaranteed to
// be IST (could be UTC or anything else depending on host), which was causing
// Attendance/Celebrations/etc. to show the wrong date. We always resolve
// "today" explicitly in Asia/Kolkata via Intl, regardless of server timezone.
const IST_TZ = 'Asia/Kolkata'

function istYMD(d: Date): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value)
  return { y: get('year'), m: get('month') - 1, day: get('day') }
}

export function todayDateOnly(): Date {
  const { y, m, day } = istYMD(new Date())
  return new Date(Date.UTC(y, m, day))
}

// Alias: "now" resolved as today's IST calendar date, held as a UTC-midnight
// instant. Use getUTCMonth()/getUTCDate()/getUTCFullYear() on the result —
// those are then correct IST day/month/year regardless of server timezone.
export const nowIST = todayDateOnly

// Same normalization for an arbitrary date (e.g. filters, follow-up dates).
// A plain "YYYY-MM-DD" string is treated literally (no timezone math needed).
export function dateOnly(input: Date | string): Date {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, day] = input.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, day))
  }
  const { y, m, day } = istYMD(new Date(input))
  return new Date(Date.UTC(y, m, day))
}

// Get IST calendar-day parts for any instant (used by celebrations/dashboards
// that need month/day comparisons or "today"/"tomorrow" boundaries in IST).
export function getISTDateParts(d: Date = new Date()): { year: number; month: number; day: number } {
  const { y, m, day } = istYMD(d)
  return { year: y, month: m, day }
}

// ---------------------------------------------------------------------------
// LATE MARK helpers
// ---------------------------------------------------------------------------
// Given a punch instant, return how many minutes AFTER the office start time
// it is, evaluated in the given timezone (default IST = UTC+5:30 = 330 min).
// Negative = punched in early. Server/DB timezone-independent (uses UTC parts).
export function minutesAfterOfficeStart(
  punchAt: Date,
  officeStart = '10:00',
  tzOffsetMin = 330,
): number {
  const [h, m] = officeStart.split(':').map(Number)
  const utcMin = punchAt.getUTCHours() * 60 + punchAt.getUTCMinutes()
  const localMin = (((utcMin + tzOffsetMin) % 1440) + 1440) % 1440
  return localMin - (h * 60 + m)
}

// Decide late status from a punch instant using office start + grace minutes.
export function computeLate(
  punchAt: Date,
  officeStart = '10:00',
  graceMinutes = 10,
  tzOffsetMin = 330,
): { isLate: boolean; lateBy: number } {
  const after = minutesAfterOfficeStart(punchAt, officeStart, tzOffsetMin)
  const isLate = after > graceMinutes
  return { isLate, lateBy: isLate ? after : 0 }
}

// Is `at` within [officeStart, officeEnd) on the same local day?
export function isWithinOfficeWindow(
  at: Date,
  officeStart = '10:00',
  officeEnd = '18:30',
  tzOffsetMin = 330,
): boolean {
  const [sh, sm] = officeStart.split(':').map(Number)
  const [eh, em] = officeEnd.split(':').map(Number)
  const utcMin = at.getUTCHours() * 60 + at.getUTCMinutes()
  const localMin = (((utcMin + tzOffsetMin) % 1440) + 1440) % 1440
  const startMin = sh * 60 + sm
  const endMin = eh * 60 + em
  return localMin >= startMin && localMin < endMin
}

// ---------------------------------------------------------------------------
// Day-range helper for REAL timestamp fields (recordedAt, createdAt, etc — as
// opposed to @db.Date columns, which use todayDateOnly/dateOnly above).
// Returns the [start, end] UTC instants that bound one IST calendar day.
// `dateStr` is an optional "YYYY-MM-DD"; defaults to today (IST).
// ---------------------------------------------------------------------------
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

export function istDayRange(dateStr?: string | null): { start: Date; end: Date } {
  let y: number, m: number, d: number
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    ;[y, m, d] = dateStr.split('-').map(Number)
    m -= 1
  } else {
    const parts = getISTDateParts(new Date())
    y = parts.year; m = parts.month; d = parts.day
  }
  const start = new Date(Date.UTC(y, m, d) - IST_OFFSET_MS)
  const end = new Date(Date.UTC(y, m, d + 1) - IST_OFFSET_MS - 1)
  return { start, end }
}