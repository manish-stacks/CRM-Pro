// src/app/api/kiosk/punch/route.ts
// Public endpoint used by the office kiosk (/kiosk). No user login: the kiosk
// proves itself with the shared key in the `x-kiosk-key` header (env KIOSK_KEY),
// and the person is identified by face. Matching happens on the server, so the
// browser never receives anyone's face data.
//
// Rules:
// - Minimum 30 minutes gap between punch in and punch out (prevents accidental punch-outs).
// - Supports explicit mode: 'AUTO' | 'PUNCH_IN' | 'PUNCH_OUT'.
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import { deviceFromRequest } from '@/lib/device'
import { logFromRequest } from '@/lib/audit'
import { todayDateOnly, computeLate } from '@/lib/attendanceDate'
import { Settings } from '@/lib/settings'
import { bestMatch, validDescriptor } from '@/lib/faceMatch'

const MIN_GAP_MIN = 30 // Minimum 30 minutes between punch-in and punch-out
const fails = new Map<string, { n: number; until: number }>() // simple per-IP brute-force guard

const json = (body: any, status = 200) => NextResponse.json(body, { status })

function keyOk(given: string | null) {
  const real = process.env.KIOSK_KEY || ''
  if (!real || !given) return false
  const a = Buffer.from(given), b = Buffer.from(real)
  return a.length === b.length && timingSafeEqual(a, b)
}

function fmtTime(date: Date) {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export async function POST(req: NextRequest) {
  const dev = deviceFromRequest(req)
  const ip = dev.ip || 'unknown'

  const lock = fails.get(ip)
  if (lock && lock.until > Date.now()) {
    return json({ success: false, message: 'Too many failed attempts. Try again in a minute.' }, 429)
  }

  if (!keyOk(req.headers.get('x-kiosk-key'))) {
    const n = (fails.get(ip)?.n || 0) + 1
    fails.set(ip, { n, until: n >= 8 ? Date.now() + 60_000 : 0 })
    return json({ success: false, code: 'BAD_KEY', message: 'This device is not authorised.' }, 401)
  }

  try {
    const { descriptor, mode = 'AUTO' } = await req.json()
    if (!validDescriptor(descriptor)) return json({ success: false, message: 'Invalid face data.' }, 400)

    const rows = await prisma.faceProfile.findMany()
    const profiles = rows.map(r => ({ employeeId: r.employeeId, descriptors: JSON.parse(r.descriptors) as number[][] }))
    const match = bestMatch(descriptor, profiles)
    if (!match) return json({ success: false, code: 'NO_MATCH', message: 'Face not recognised. Please try again.' })

    const employee = await prisma.employee.findUnique({
      where: { id: match.employeeId },
      include: { user: { select: { id: true, name: true, avatar: true, isActive: true, role: true } } },
    })
    if (!employee || !employee.user.isActive) {
      return json({ success: false, code: 'INACTIVE', message: 'Account is not active. Contact admin.' })
    }
    // Field staff punch from the mobile app only (GPS)
    if (employee.user.role === 'MARKETING_EXECUTIVE') {
      return json({ success: false, code: 'USE_APP', message: 'Please use the mobile app to punch.' })
    }

    const who = { name: employee.user.name, avatar: employee.user.avatar, empCode: employee.employeeId }
    const today = todayDateOnly()
    const now = new Date()
    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date: today } },
    })
    const device = { ip: dev.ip, device: 'Face Kiosk', browser: dev.browser, os: dev.os }

    // Case 1: Mode is explicitly PUNCH_OUT, but user hasn't punched in yet
    if (mode === 'PUNCH_OUT' && !existing?.punchIn) {
      return json({
        success: false,
        code: 'NOT_IN_YET',
        message: 'You have not punched in today yet.',
        ...who,
      })
    }

    // Case 2: Employee has not punched in today -> PUNCH IN
    if (!existing?.punchIn) {
      const [officeStart, grace] = await Promise.all([Settings.officeStartTime(), Settings.lateGraceMinutes()])
      const { isLate, lateBy } = computeLate(now, officeStart || '10:00', grace ?? 10)
      const rec = await prisma.attendance.upsert({
        where: { employeeId_date: { employeeId: employee.id, date: today } },
        update: {
          punchIn: now, workMode: 'WFO', status: 'PRESENT', isLate, lateBy,
          punchInIp: device.ip, punchInDevice: device.device, punchInBrowser: device.browser, punchInOs: device.os,
        },
        create: {
          employeeId: employee.id, date: today, punchIn: now, workMode: 'WFO', status: 'PRESENT', isLate, lateBy,
          punchInIp: device.ip, punchInDevice: device.device, punchInBrowser: device.browser, punchInOs: device.os,
        },
      })
      await logFromRequest(req, {
        userId: employee.user.id,
        action: 'PUNCH_IN',
        entityType: 'Attendance',
        entityId: rec.id,
        metadata: { via: 'face-kiosk', isLate, lateBy },
      })
      return json({ success: true, action: 'PUNCH_IN', time: now.toISOString(), isLate, lateBy, ...who })
    }

    // Case 3: Already punched out today
    if (existing.punchOut) {
      return json({
        success: true,
        action: 'DONE',
        time: existing.punchOut.toISOString(),
        message: `Already punched out today at ${fmtTime(existing.punchOut)}.`,
        ...who,
      })
    }

    // Case 4: Mode is PUNCH_IN only, but already in -> Never punch out!
    if (mode === 'PUNCH_IN') {
      return json({
        success: true,
        action: 'ALREADY_IN',
        time: existing.punchIn.toISOString(),
        message: `Welcome back! Already punched in today at ${fmtTime(existing.punchIn)}.`,
        ...who,
      })
    }

    // Case 5: Within 30-minute cooldown window
    const minutes = (now.getTime() - existing.punchIn.getTime()) / 60000
    if (minutes < MIN_GAP_MIN) {
      const remaining = Math.ceil(MIN_GAP_MIN - minutes)
      return json({
        success: true,
        action: 'ALREADY_IN',
        time: existing.punchIn.toISOString(),
        message: `Already punched in at ${fmtTime(existing.punchIn)}. Punch-out allowed after ${remaining} min.`,
        ...who,
      })
    }

    // Case 6: PUNCH OUT (either explicitly requested or AUTO after 30+ minutes)
    const hoursWorked = (now.getTime() - existing.punchIn.getTime()) / 3600000
    const thresholdRow = await prisma.setting.findUnique({ where: { key: 'half_day_threshold_hours' } })
    const halfDay = parseFloat(thresholdRow?.value || '4')
    const rec = await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        punchOut: now,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        status: hoursWorked < halfDay ? 'HALF_DAY' : 'PRESENT',
        punchOutIp: device.ip, punchOutDevice: device.device, punchOutBrowser: device.browser, punchOutOs: device.os,
      },
    })
    await logFromRequest(req, {
      userId: employee.user.id,
      action: 'PUNCH_OUT',
      entityType: 'Attendance',
      entityId: rec.id,
      metadata: { via: 'face-kiosk', hoursWorked: rec.hoursWorked },
    })
    return json({
      success: true,
      action: 'PUNCH_OUT',
      time: now.toISOString(),
      hoursWorked: rec.hoursWorked,
      message: `Punched out successfully at ${fmtTime(now)}. Worked ${rec.hoursWorked} hrs.`,
      ...who,
    })
  } catch (e) {
    console.error('Kiosk punch error:', e)
    return json({ success: false, message: 'Something went wrong. Please try again.' }, 500)
  }
}
