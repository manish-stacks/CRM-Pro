// src/app/api/auth/login/route.ts
// Phase 2: login now records LoginActivity (device/IP/browser/geo)
// Returns loginActivityId which the client stores in a cookie
// so logout can close the activity record.
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'
import { logLogin } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const { email, password, latitude, longitude, location } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        employee: { include: { department: true } },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (!user.isActive) {
      // Log failed attempt for a locked account
      await logLogin({ userId: user.id, status: 'FAILED', req })
      return NextResponse.json({
        error: user.disabledReason
          ? `Account is disabled. Reason: ${user.disabledReason}`
          : 'Account is disabled. Please contact your administrator.',
      }, { status: 403 })
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      await logLogin({ userId: user.id, status: 'FAILED', req })
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Success — log activity + track lastLoginAt
    const loginActivityId = await logLogin({
      userId: user.id,
      status: 'SUCCESS',
      req,
      latitude,
      longitude,
      location,
    })

    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    })

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone,
        employee: user.employee,
      },
    })

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    if (loginActivityId) {
      // Non-httpOnly so the logout endpoint can read it, but sameSite=lax + no js access to auth-token
      response.cookies.set('login-activity-id', loginActivityId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })
    }

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
