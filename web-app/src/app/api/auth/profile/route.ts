// src/app/api/auth/profile/route.ts
// User's own profile — GET + PUT (self-update)
// Read-only for user: employeeId, joiningDate, salary, role, department, workMode
// Everything else user can edit themselves.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { getProfileCompletion } from '@/lib/profileCompletion'
import { deleteFile, publicIdFromUrl } from '@/lib/cloudinary'

// Fields the user can edit themselves
const USER_SELF_EDITABLE = new Set([
  'name', 'phone', 'altPhone', 'avatar', 'dateOfBirth',
])

const EMPLOYEE_SELF_EDITABLE = new Set([
  'dateOfBirth', 'gender', 'bloodGroup', 'maritalStatus',
  'fatherName', 'motherName',
  'address', 'city', 'state', 'pincode',
  'emergencyContact', 'emergencyPhone',
  'panNumber', 'aadharNumber', 'aadharFrontUrl', 'aadharBackUrl',
  'idProofType', 'idProofNumber', 'idProofUrl',
  'bankName', 'accountNumber', 'ifscCode', 'accountHolderName',
])

// Fields read-only for user (only admin can edit)
const READ_ONLY_FOR_USER = [
  'employeeId', 'joiningDate', 'salary', 'workMode', 'departmentId',
  'role', 'email',
]

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true, name: true, email: true, phone: true, altPhone: true,
      role: true, avatar: true, dateOfBirth: true, isActive: true,
      lastLoginAt: true, createdAt: true, emailVerified: true,
      employee: {
        include: { department: { select: { id: true, name: true } } },
      },
    },
  })
  if (!user) return errorResponse('User not found', 404)

  // Self-heal accounts affected by the old else-if bug: DOB got saved on User
  // but never copied to Employee, so it kept showing as "missing".
  if (user.employee && !user.employee.dateOfBirth && user.dateOfBirth) {
    await prisma.employee.update({
      where: { id: user.employee.id },
      data: { dateOfBirth: user.dateOfBirth },
    })
    user.employee.dateOfBirth = user.dateOfBirth
  }

  const profileCompletion = user.employee ? getProfileCompletion(user.employee, user.avatar) : null
  return successResponse({ ...user, readOnlyFields: READ_ONLY_FOR_USER, profileCompletion })
}

export async function PUT(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const body = await req.json()

  // Split incoming payload into User fields and Employee fields
  const userData: Record<string, any> = {}
  const employeeData: Record<string, any> = {}

  // NOTE: dateOfBirth is intentionally in both sets (kept on User for login/display,
  // and on Employee since that's what profile-completion checks). It must be written
  // to both, so this can't be an else-if.
  for (const [k, v] of Object.entries(body)) {
    if (USER_SELF_EDITABLE.has(k)) userData[k] = v === '' ? null : v
    if (EMPLOYEE_SELF_EDITABLE.has(k)) employeeData[k] = v === '' ? null : v
  }

  // Coerce date fields
  if (userData.dateOfBirth) userData.dateOfBirth = new Date(userData.dateOfBirth)
  if (employeeData.dateOfBirth) employeeData.dateOfBirth = new Date(employeeData.dateOfBirth)

  try {
    // If avatar is changing, remember the old one so we can delete it from
    // Cloudinary after the new avatar is saved successfully.
    let oldAvatarUrl: string | null = null
    if (userData.avatar) {
      const current = await prisma.user.findUnique({ where: { id: session.userId }, select: { avatar: true } })
      if (current?.avatar && current.avatar !== userData.avatar) oldAvatarUrl = current.avatar
    }

    // Update User row
    if (Object.keys(userData).length) {
      await prisma.user.update({ where: { id: session.userId }, data: userData })
    }

    // Update Employee row (if exists)
    if (Object.keys(employeeData).length) {
      const emp = await prisma.employee.findFirst({ where: { userId: session.userId } })
      if (emp) {
        await prisma.employee.update({ where: { id: emp.id }, data: employeeData })
      }
    }

    // Best-effort cleanup — don't fail the request if Cloudinary delete has an issue
    if (oldAvatarUrl) {
      const publicId = publicIdFromUrl(oldAvatarUrl)
      if (publicId) deleteFile(publicId).catch(() => {})
    }

    await logFromRequest(req, {
      userId: session.userId,
      action: 'UPDATE',
      entityType: 'Profile',
      entityId: session.userId,
      changes: { user: userData, employee: employeeData },
    })

    // Return refreshed profile
    const updated = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true, name: true, email: true, phone: true, altPhone: true,
        role: true, avatar: true, dateOfBirth: true,
        employee: { include: { department: { select: { id: true, name: true } } } },
      },
    })
    return successResponse(updated)
  } catch (e) {
    console.error('Profile update error:', e)
    return errorResponse('Failed to update profile')
  }
}
