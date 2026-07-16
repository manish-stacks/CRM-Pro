// src/app/api/mobile/client-login/route.ts
// Mobile client login — returns a Bearer token (the same client-token payload)
// so the app can store it and call client-portal endpoints with Authorization header.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { compare } from 'bcryptjs'
import { SignJWT } from 'jose'
import { accountManagerInclude, resolveAccountManager, toMobileShape } from '@/lib/accountManager'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production'
)

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ success: false, message: 'Email and password required' }, { status: 400 })
  }

  try {
    const client = await prisma.client.findFirst({
      where: { email: String(email).toLowerCase() },
      include: accountManagerInclude,
    })

    if (!client) {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 })
    }
    if (!client.portalPasswordSet || !client.portalPassword) {
      return NextResponse.json({ success: false, message: 'Portal access not activated. Contact your account manager.' }, { status: 403 })
    }
    if (client.status !== 'ACTIVE') {
      return NextResponse.json({ success: false, message: 'Your account is inactive.' }, { status: 403 })
    }

    const isValid = await compare(password, client.portalPassword)
    if (!isValid) {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 })
    }

    const token = await new SignJWT({ clientId: client.id, type: 'client' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET)

    await prisma.client.update({ where: { id: client.id }, data: { lastPortalLoginAt: new Date() } }).catch(() => {})

    const accountManager = toMobileShape(await resolveAccountManager(client))

    return NextResponse.json({
      success: true,
      token,
      data: {
        id: client.id,
        name: client.clientName,
        company: client.companyName,
        email: client.email,
        phone: client.phone,
        client_code: client.clientCode,
        reporting_person: accountManager,   // legacy key
        account_manager: accountManager,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message || 'Login failed' }, { status: 500 })
  }
}
