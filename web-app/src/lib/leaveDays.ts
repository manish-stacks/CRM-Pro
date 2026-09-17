// Computes start/end date + days for a leave, given its duration type.
// Shared by POST /api/leaves (apply) and PATCH /api/leaves/[id] (admin edit)
// so the calculation never drifts between the two.
export function computeLeaveDays(input: {
  duration: string
  startDate: string
  endDate?: string
  hourlyStart?: string
  hourlyEnd?: string
  hourlyHours?: number | string
}): { start: Date; end: Date; days: number; error?: string } {
  const { duration, startDate, endDate, hourlyStart, hourlyEnd, hourlyHours } = input

  if (duration === 'SINGLE_DAY') {
    if (!startDate) return { start: new Date(), end: new Date(), days: 0, error: 'Start date required' }
    const start = new Date(startDate)
    return { start, end: new Date(startDate), days: 1 }
  }

  if (duration === 'MULTIPLE_DAYS') {
    if (!startDate || !endDate) return { start: new Date(), end: new Date(), days: 0, error: 'Start and end dates required' }
    const start = new Date(startDate)
    const end = new Date(endDate)
    const days = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1
    if (days <= 0) return { start, end, days: 0, error: 'Invalid date range' }
    return { start, end, days }
  }

  // SHORT_HOURLY
  if (!startDate || !hourlyStart || !hourlyEnd) {
    return { start: new Date(), end: new Date(), days: 0, error: 'Date and start/end times required' }
  }
  const start = new Date(startDate)
  const end = new Date(startDate)
  const hours = Number(hourlyHours) || (() => {
    const [sh, sm] = hourlyStart.split(':').map(Number)
    const [eh, em] = hourlyEnd.split(':').map(Number)
    return ((eh * 60 + em) - (sh * 60 + sm)) / 60
  })()
  if (!hours || hours <= 0) return { start, end, days: 0, error: 'Invalid hourly time range' }
  return { start, end, days: hours / 8 }
}
