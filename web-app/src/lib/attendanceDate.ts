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
export function todayDateOnly(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

// Same normalization for an arbitrary date (e.g. filters, follow-up dates).
export function dateOnly(input: Date | string): Date {
  const d = new Date(input)
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
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