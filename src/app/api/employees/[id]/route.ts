// src/app/api/employees/[id]/route.ts
// Phase 2: rich employee detail. Admin can update employment fields; user updates
// personal fields via /api/auth/profile.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, getRequestSession } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse, unauthorizedResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { getTeamScope } from '@/lib/teamScope'

// Fields admin can update on User row
const USER_ADMIN_FIELDS = new Set([
  'name', 'phone', 'altPhone', 'avatar', 'role', 'dateOfBirth',
])

// Fields admin can update on Employee row
const EMP_ADMIN_FIELDS = new Set([
  'employeeId', 'departmentId', 'reportingToId', 'position', 'salary', 'workMode', 'joiningDate',
  'dateOfBirth', 'gender', 'bloodGroup', 'maritalStatus',
  'fatherName', 'motherName',
  'address', 'city', 'state', 'pincode',
  'emergencyContact', 'emergencyPhone',
  'panNumber', 'aadharNumber', 'aadharFrontUrl', 'aadharBackUrl',
  'idProofType', 'idProofNumber', 'idProofUrl',
  'bankName', 'accountNumber', 'ifscCode', 'accountHolderName',
])

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const emp = await prisma.employee.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true, name: true, email: true, phone: true, altPhone: true, role: true,
          avatar: true, dateOfBirth: true, isActive: true, disabledAt: true,
          disabledReason: true, lastLoginAt: true, createdAt: true,
        },
      },
      department: true,
      managedDept: { select: { id: true, name: true } },
      leaveBalance: true,
      reportingTo: { select: { id: true, employeeId: true, user: { select: { name: true } } } },
    },
  })
  if (!emp) return notFoundResponse('Employee')

  // Admins see everyone. Managers (team leads) see themselves + their team
  // (dept they head + direct reports). Everyone else can only see their own record.
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.role)) {
    if (session.role === 'MANAGER') {
      const scope = await getTeamScope(session.userId)
      if (!scope.visibleIds.includes(emp.id)) return errorResponse('Forbidden', 403)
    } else if (emp.userId !== session.userId) {
      return errorResponse('Forbidden', 403)
    }
  }

  return successResponse(emp)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const body = await req.json()
  const userData: Record<string, any> = {}
  const empData: Record<string, any> = {}
  for (const [k, v] of Object.entries(body)) {
    // Note: some keys (e.g. dateOfBirth) exist in BOTH field sets — use independent
    // ifs (not if/else) so they get written to both tables, not just the first match.
    if (USER_ADMIN_FIELDS.has(k)) userData[k] = v === '' ? null : v
    if (EMP_ADMIN_FIELDS.has(k)) empData[k] = v === '' ? null : v
  }
  if (userData.dateOfBirth) userData.dateOfBirth = new Date(userData.dateOfBirth)
  if (empData.dateOfBirth) empData.dateOfBirth = new Date(empData.dateOfBirth)
  if (empData.joiningDate) empData.joiningDate = new Date(empData.joiningDate)
  if (empData.salary !== undefined) empData.salary = Number(empData.salary) || 0

  const emp = await prisma.employee.findUnique({ where: { id }, include: { user: true } })
  if (!emp) return notFoundResponse('Employee')

  try {
    if (Object.keys(userData).length) {
      await prisma.user.update({ where: { id: emp.userId }, data: userData })
    }
    if (Object.keys(empData).length) {
      await prisma.employee.update({ where: { id }, data: empData })
    }

    await logFromRequest(req, {
      userId: session.userId,
      action: 'UPDATE',
      entityType: 'Employee',
      entityId: id,
      changes: { user: userData, employee: empData },
    })

    return successResponse({ updated: true })
  } catch (e: any) {
    console.error('Employee update error:', e)
    return errorResponse(e.message || 'Update failed')
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'SUPER_ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const emp = await prisma.employee.findUnique({ where: { id } })
  if (!emp) return notFoundResponse('Employee')
  if (emp.userId === session.userId) return errorResponse('Cannot delete yourself', 403)

  try {
    // Cascade will remove attendance/leaves/etc via schema. User row goes too.
    await prisma.user.delete({ where: { id: emp.userId } })
    await logFromRequest(req, {
      userId: session.userId,
      action: 'DELETE',
      entityType: 'Employee',
      entityId: id,
    })
    return successResponse({ deleted: true })
  } catch (e: any) {
    return errorResponse(e.message || 'Delete failed')
  }
}