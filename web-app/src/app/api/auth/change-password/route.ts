// src/app/api/auth/change-password/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { currentPassword, newPassword } = await req.json()

  if (!currentPassword || !newPassword) return errorResponse('All fields required')
  if (newPassword.length < 6) return errorResponse('Password must be at least 6 characters')

  try {
    const user = await prisma.user.findUnique({ where: { id: session.userId } })
    if (!user) return errorResponse('User not found', 404)

    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) return errorResponse('Current password is incorrect')

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: session.userId }, data: { password: hashed } })

    return successResponse({ message: 'Password changed successfully' })
  } catch {
    return errorResponse('Failed to change password')
  }
}
