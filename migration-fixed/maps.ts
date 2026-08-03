// migration/lib/maps.ts
// All "old value -> new value" decisions live here so they're easy to tweak
// without touching the migration logic itself.

// Old `departments.id` -> new Department `slug` (matches seed.ts DEPARTMENTS)
// NOTE: new schema merged 'website-seo' + 'gmb-seo' into a single 'seo' dept,
// and dropped 'sales-person' entirely (old id 16 -> no match, departmentId
// will end up null for those employees; reassign manually if needed).
export const DEPARTMENT_SLUG_MAP: Record<number, string> = {
  2: 'sales-consultant',
  3: 'web-developer',
  4: 'marketing',
  5: 'seo',    // was 'website-seo'
  6: 'seo',    // was 'gmb-seo' -> merged into same 'seo' dept
  7: 'ads',
  8: 'gmb-optimization',
  10: 'smo',
  13: 'graphics-designer',
  // 16: 'sales-person' -> department removed in new schema, left unmapped
}

// Old `users.isadmin` (0=admin, 1=employee, 2=manager) -> new User.role
export function mapUserRole(isadmin: number, oldUserId: number): string {
  if (oldUserId === 1) return 'SUPER_ADMIN' // matches prisma/seed.ts super admin
  if (isadmin === 0) return 'ADMIN'
  if (isadmin === 2) return 'MANAGER'
  return 'EMPLOYEE'
}

// Old `lead_statuses.name` -> new Lead.status
export const LEAD_STATUS_MAP: Record<string, string> = {
  Callback: 'CALLBACK',
  'Meeting Schedule': 'MEETING_SCHEDULED',
  Ringing: 'RINGING',
  FollowUp: 'FOLLOW_UP',
  NI: 'NOT_INTERESTED',
}
export const DEFAULT_LEAD_STATUS = 'NEW'

// Old `lead_sources.name` -> new Lead.source
export const LEAD_SOURCE_MAP: Record<string, string> = {
  Google: 'WEBSITE',
  Facebook: 'SOCIAL_MEDIA',
  Reference: 'REFERRAL',
  'Just Dial': 'OTHER',
}
export const DEFAULT_LEAD_SOURCE = 'OTHER'

// Old `leave_types.name` -> new Leave.leaveType
export const LEAVE_TYPE_MAP: Record<string, string> = {
  'Sick Leave': 'SICK',
  'Casual Leave': 'CASUAL',
  'Annual Leave': 'PAID',
  'Maternity Leave': 'MATERNITY',
  'Paternity Leave': 'PATERNITY',
  Others: 'UNPAID',
}
export const DEFAULT_LEAVE_TYPE = 'UNPAID'

// Old `leaves.duration` enum -> new Leave.duration
export const LEAVE_DURATION_MAP: Record<string, string> = {
  single_day: 'SINGLE_DAY',
  multiple_days: 'MULTIPLE_DAYS',
  short_hourly: 'SHORT_HOURLY',
}

// Old `leaves.status` enum -> new Leave.status
export const LEAVE_STATUS_MAP: Record<string, string> = {
  pending: 'PENDING',
  approved: 'APPROVED',
  rejected: 'REJECTED',
}

// Old `attendances.status` enum -> new Attendance.status (free-text field)
export const ATTENDANCE_STATUS_MAP: Record<string, string> = {
  present: 'PRESENT',
  absent: 'ABSENT',
  'half-day': 'HALF_DAY',
  leave: 'LEAVE',
  weekoff: 'WEEK_OFF',
  holiday: 'HOLIDAY',
}

// Old `attendances.workmode` -> new Attendance.workMode
export const WORKMODE_MAP: Record<string, string> = {
  WFH: 'WFH',
  Office: 'WFO',
}

/**
 * Extract the calendar (year, month, day) from a value that may already be a
 * JS Date (mysql2 auto-converts DATE columns to Date objects) or a plain
 * 'YYYY-MM-DD' string. Uses LOCAL getters (getFullYear/getMonth/getDate), not
 * toISOString(), because toISOString() converts to UTC first and can shift
 * the day backward/forward depending on the server's timezone offset — that
 * off-by-one was the actual cause of the earlier
 * "attendance_employeeId_date_key" unique constraint failures.
 */
function toYMD(value: string | Date): { y: number; m: number; d: number } {
  if (value instanceof Date) {
    return { y: value.getFullYear(), m: value.getMonth() + 1, d: value.getDate() }
  }
  const str = String(value)
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) throw new Error(`Unparseable date value: ${str}`)
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
}

/**
 * Canonical UTC-midnight Date for a given calendar day, used consistently as
 * the value for the `date` column (and as the lookup key in findUnique) so
 * the same calendar day always produces the exact same Date value — no
 * matter whether the value originally came in as a string or a Date, and no
 * matter what timezone the Node process is running in.
 */
export function toDateOnly(value: string | Date): Date {
  const { y, m, d } = toYMD(value)
  return new Date(Date.UTC(y, m - 1, d))
}

/**
 * Combine a SQL DATE (string or already-converted Date) and TIME
 * ('11:31:00') into a JS Date. Fixed to use toDateOnly() internally instead
 * of toISOString().slice(0,10), which used to shift the date by a day.
 */
export function combineDateTime(date: string | Date, time: string | null): Date | null {
  if (!time) return null
  const { y, m, d } = toYMD(date)
  const [hh, mm, ss] = time.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hh || 0, mm || 0, ss || 0))
}

/** "35,37" -> 35 (first numeric id in a comma list); null/invalid -> null */
export function firstIdFromList(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const str = String(value)
  const match = str.match(/\d+/)
  return match ? parseInt(match[0], 10) : null
}

export function padNumber(n: number, width: number): string {
  return String(n).padStart(width, '0')
}