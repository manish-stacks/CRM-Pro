// src/app/api/mobile/push-token/route.ts
// The mobile app registers its Expo push token here after login.
// Works for both staff (Bearer user token) and clients (Bearer client token).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { getClientSession } from '@/lib/clientAuth'

export async function POST(req: NextRequest) {
  let body: any = {}
  try { body = await req.json() } catch {}
  const token = body?.token
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ success: false, message: 'token required' }, { status: 400 })
  }

  // Staff first
  const staff = await getRequestSession(req)
  if (staff) {
    await prisma.user.update({ where: { id: staff.userId }, data: { expoPushToken: token } })
    return NextResponse.json({ success: true, data: { scope: 'user' } })
  }

  // Then client
  const client = await getClientSession(req)
  if (client) {
    await prisma.client.update({ where: { id: client.clientId }, data: { expoPushToken: token } })
    return NextResponse.json({ success: true, data: { scope: 'client' } })
  }

  return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
}

// Clear token on logout (optional)
export async function DELETE(req: NextRequest) {
  const staff = await getRequestSession(req)
  if (staff) {
    await prisma.user.update({ where: { id: staff.userId }, data: { expoPushToken: null } }).catch(() => {})
    return NextResponse.json({ success: true })
  }
  const client = await getClientSession(req)
  if (client) {
    await prisma.client.update({ where: { id: client.clientId }, data: { expoPushToken: null } }).catch(() => {})
    return NextResponse.json({ success: true })
  }
  return NextResponse.json({ success: false }, { status: 401 })
}
