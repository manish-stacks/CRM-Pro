// src/lib/loginSession.ts
// Shared "finish login" step — issues the JWT, sets cookies, and records
// LoginActivity. Used by both the direct (non-admin) login path in
// /api/auth/login and the OTP-verified admin path in
// /api/auth/verify-login-otp, so the two can never drift out of sync.
import { NextRequest, NextResponse } from 'next/server'
import { signToken } from './auth'
import { logLogin } from './audit'

interface LoginUser {
  id: string
  email: string
  role: string
  name: string
  avatar: string | null
  phone: string | null
  employee?: any
}

interface GeoParams {
  latitude?: number
  longitude?: number
  location?: string
}

export async function completeLogin(user: LoginUser, req: NextRequest, geo?: GeoParams): Promise<NextResponse> {
  const loginActivityId = await logLogin({
    userId: user.id,
    status: 'SUCCESS',
    req,
    latitude: geo?.latitude,
    longitude: geo?.longitude,
    location: geo?.location,
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
}
