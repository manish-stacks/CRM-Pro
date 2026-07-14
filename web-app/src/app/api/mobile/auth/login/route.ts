// src/app/api/mobile/auth/login/route.ts
// Mobile login — returns a Bearer token (not cookie) for the app to store.
// Works for MARKETING_EXECUTIVE / EMPLOYEE / MANAGER / ADMIN roles.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { signToken } from '@/lib/auth'
import { logFromRequest } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email and password required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase() },
      include: { employee: { include: { department: true } } },
    })

    if (!user) {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 })
    }
    if (!user.isActive) {
      return NextResponse.json({ success: false, message: 'Account is disabled. Contact admin.' }, { status: 403 })
    }

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 })
    }

    // Only staff roles can use the employee side of the app
    const staffRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'TELECALLER', 'MARKETING_EXECUTIVE']
    if (!staffRoles.includes(user.role)) {
      return NextResponse.json({ success: false, message: 'This login is for staff only.' }, { status: 403 })
    }

    const token = await signToken({ userId: user.id, email: user.email, role: user.role, name: user.name })

    // Track lastLoginAt
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {})

    await logFromRequest(req, {
      userId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id,
      metadata: { via: 'mobile' },
    })

    return NextResponse.json({
      success: true,
      token,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        image: user.avatar,
        employeeId: user.employee?.employeeId || null,
        department: user.employee?.department?.name || null,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message || 'Login failed' }, { status: 500 })
  }
}
