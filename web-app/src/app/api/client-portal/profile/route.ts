// src/app/api/client-portal/profile/route.ts
// Client can update own basic details + change portal password.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientSession } from '@/lib/clientAuth'
import { compare, hash } from 'bcryptjs'
import { getAccountManager, toMobileShape } from '@/lib/accountManager'

const EDITABLE = new Set([
  'clientName', 'phone', 'altPhone', 'email',
  'address', 'city', 'state', 'pincode',
  'gstNo', 'image',
])

export async function GET(req: NextRequest) {
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [client, am] = await Promise.all([
    prisma.client.findUnique({
      where: { id: session.clientId },
      select: {
        id: true, clientCode: true, companyName: true, clientName: true,
        phone: true, altPhone: true, email: true,
        address: true, city: true, state: true, pincode: true,
        gstApplicable: true, gstNo: true,
        image: true, status: true, onboardingDate: true,
      },
    }),
    // Account Manager = client ka MARKETING_EXECUTIVE (default: Hover).
    // Mobile app apna dashboard isi endpoint se banata hai, isliye yahin bhej
    // rahe hain — koi extra call nahi.
    getAccountManager(session.clientId),
  ])

  return NextResponse.json({
    data: client ? { ...client, accountManager: am, account_manager: toMobileShape(am) } : null,
    accountManager: am,
  })
}

export async function PUT(req: NextRequest) {
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const data: Record<string, any> = {}
  for (const [k, v] of Object.entries(body)) {
    if (EDITABLE.has(k)) data[k] = v === '' ? null : v
  }
  if (data.email) data.email = String(data.email).toLowerCase()

  const updated = await prisma.client.update({
    where: { id: session.clientId },
    data,
  })
  return NextResponse.json({ data: updated })
}

export async function POST(req: NextRequest) {
  // Change password
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { currentPassword, newPassword } = await req.json()
  if (!currentPassword || !newPassword) return NextResponse.json({ error: 'Current + new password required' }, { status: 400 })
  if (newPassword.length < 6) return NextResponse.json({ error: 'Password too short' }, { status: 400 })

  const client = await prisma.client.findUnique({ where: { id: session.clientId } })
  if (!client?.portalPassword) return NextResponse.json({ error: 'No password set' }, { status: 400 })

  const valid = await compare(currentPassword, client.portalPassword)
  if (!valid) return NextResponse.json({ error: 'Current password incorrect' }, { status: 400 })

  const newHash = await hash(newPassword, 10)
  await prisma.client.update({
    where: { id: session.clientId },
    data: { portalPassword: newHash },
  })
  return NextResponse.json({ ok: true })
}
