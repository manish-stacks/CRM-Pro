// src/lib/meetingSlots.ts
// Generates fixed meeting slots for a day from the admin-configured office
// window + slot duration (Settings.meetingOfficeStart/End/SlotMinutes), and
// helpers to check whether a given time falls after office hours (used to
// gate the marketing-person self-reschedule flow).

export interface MeetingSlot {
  start: string  // "10:00"
  end: string    // "11:30"
  label: string  // "10:00 - 11:30"
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function toHHMM(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}

// Builds fixed slots between officeStart and officeEnd, each `slotMinutes`
// long. The last slot is dropped if it would run past officeEnd.
export function generateSlots(officeStart: string, officeEnd: string, slotMinutes: number): MeetingSlot[] {
  const startMin = toMinutes(officeStart)
  const endMin = toMinutes(officeEnd)
  const slots: MeetingSlot[] = []
  for (let t = startMin; t + slotMinutes <= endMin; t += slotMinutes) {
    const start = toHHMM(t)
    const end = toHHMM(t + slotMinutes)
    slots.push({ start, end, label: `${to12h(start)} - ${to12h(end)}` })
  }
  return slots
}

// True if `hhmm` is at/after the configured office end time — used to force
// marketing-person self-reschedules to land after office hours.
export function isAfterOfficeHours(hhmm: string, officeEnd: string): boolean {
  return toMinutes(hhmm) >= toMinutes(officeEnd)
}
