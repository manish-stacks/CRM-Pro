// src/app/api/employees/[id]/reset-password/route.ts
// Admin can set/reset an employee's login password
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { sendMail, wrapEmailHtml } from '@/lib/mailer'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { password, notify } = await req.json()

  if (!password || typeof password !== 'string' || password.length < 6) {
    return errorResponse('Password must be at least 6 characters')
  }

  const emp = await prisma.employee.findUnique({
    where: { id },
    include: { user: true },
  })
  if (!emp) return errorResponse('Employee not found', 404)

  // Safety: only SUPER_ADMIN can reset a SUPER_ADMIN's password
  if (emp.user.role === 'SUPER_ADMIN' && session.role !== 'SUPER_ADMIN') {
    return errorResponse('Only SUPER_ADMIN can reset a super admin password', 403)
  }

  const hashed = await bcrypt.hash(password, 10)

  await prisma.user.update({
    where: { id: emp.userId },
    data: { password: hashed },
  })

  await logFromRequest(req, {
    userId: session.userId,
    action: 'RESET_PASSWORD',
    entityType: 'User',
    entityId: emp.userId,
    metadata: { employeeId: emp.employeeId, byAdmin: session.email, notified: !!notify },
  })

  if (notify && emp.user.email) {
    try {
      await sendMail({
        to: emp.user.email,
        subject: 'Your HBS account password was changed',
        html: wrapEmailHtml(
          'Password Updated',
          `<p>Hi ${emp.user.name},</p>
           <p>Your HBS account password has been reset by an administrator.</p>
           <p><b>Email:</b> ${emp.user.email}<br/><b>New Password:</b> ${password}</p>
           <p>Please log in and change this password from your profile.</p>`
        ),
      })
    } catch (e) {
      console.error('Reset password mail failed:', e)
    }
  }

  return successResponse({ id: emp.userId, email: emp.user.email, notified: !!notify })
}