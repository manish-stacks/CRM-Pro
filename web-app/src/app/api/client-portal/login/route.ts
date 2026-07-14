// src/app/api/client-portal/login/route.ts
// FIX: Previous version had hardcoded 'client123' password AND plain-text phone comparison.
// Now uses bcrypt-hashed portalPassword on the Client record.
// First-time flow: admin sets portalPassword when creating client -> welcome
// message (email + WhatsApp) sends credentials. Client can change from portal.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { compare } from 'bcryptjs'
import { SignJWT } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production'
)

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  try {
    const client = await prisma.client.findFirst({
      where: { email: email.toLowerCase() },
      include: {
        reportingPerson:  { select: { id: true, name: true, email: true, phone: true } },
        marketingPerson:  { select: { id: true, name: true, email: true, phone: true } },
        telecaller:       { select: { id: true, name: true, email: true, phone: true } },
        assignedTo:       { select: { id: true, name: true, email: true, phone: true } },
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Deny login if portal not activated
    if (!client.portalPasswordSet || !client.portalPassword) {
      return NextResponse.json(
        { error: 'Portal access not activated. Please contact your account manager.' },
        { status: 403 }
      )
    }

    // Deny login if client inactive
    if (client.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Your account is inactive. Please contact support.' },
        { status: 403 }
      )
    }

    const isValid = await compare(password, client.portalPassword)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Load quick stats for the dashboard
    const [services, invoices, reports, openTickets] = await Promise.all([
      prisma.clientService.findMany({ where: { clientId: client.id } }),
      prisma.invoice.findMany({ where: { clientId: client.id } }),
      prisma.clientReport.count({ where: { clientId: client.id } }),
      prisma.supportTicket.count({ where: { clientId: client.id, status: 'OPEN' } }),
    ])

    const activeServices = services.filter(s => s.status === 'ACTIVE').length
    const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0)
    const totalDue = invoices.reduce((s, i) => s + i.dueAmount, 0)

    // Reporting person = explicit > marketing > telecaller > assignedTo
    const reportingPerson =
      client.reportingPerson || client.marketingPerson || client.telecaller || client.assignedTo || null

    // Create JWT client session
    const token = await new SignJWT({ clientId: client.id, type: 'client' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET)

    // Track last portal login
    await prisma.client.update({
      where: { id: client.id },
      data: { lastPortalLoginAt: new Date() },
    })

    const response = NextResponse.json({
      client: {
        id: client.id,
        clientCode: client.clientCode,
        companyName: client.companyName,
        clientName: client.clientName,
        email: client.email,
        phone: client.phone,
        image: client.image,
      },
      reportingPerson,
      stats: { activeServices, totalPaid, totalDue, openTickets, reports },
    })

    response.cookies.set('client-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600,
      path: '/',
    })

    return response
  } catch (e) {
    console.error('Client portal login error:', e)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
