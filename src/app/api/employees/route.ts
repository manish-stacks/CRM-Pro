// src/app/api/employees/route.ts
// Phase 2: Admin adds a user with LIMITED fields (name, email, phone, password, role,
// department, position, salary, workMode, joiningDate). User fills the rest via profile page.
// Employee ID auto-generated (HBS00001 format).
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse, getPaginationParams } from '@/lib/api'
import { hash } from 'bcryptjs'
import { generateEmployeeId } from '@/lib/idgen'
import { logFromRequest } from '@/lib/audit'
import { getTeamScope } from '@/lib/teamScope'
import { sendEmployeeWelcome } from '@/lib/welcomeFlow'

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const { skip, limit } = getPaginationParams(searchParams)
  const search = searchParams.get('search') || ''
  const departmentId = searchParams.get('department') || searchParams.get('departmentId')
  const role = searchParams.get('role')
  const status = searchParams.get('status')       // 'true' | 'false'

  const where: any = {}

  // Non-admins: see themselves + anyone in a dept they head + their direct reports.
  if (!hasMinRole(session.role, 'ADMIN')) {
    const scope = await getTeamScope(session.userId)
    where.id = { in: scope.visibleIds.length ? scope.visibleIds : ['__none__'] }
  }

  if (search) where.OR = [
    { user: { name: { contains: search } } },
    { user: { email: { contains: search } } },
    { employeeId: { contains: search } },
  ]
  if (departmentId) where.departmentId = departmentId
  if (role) where.user = { ...(where.user || {}), role }
  if (status !== null && status !== '' && status !== undefined) {
    where.user = { ...(where.user || {}), isActive: status === 'true' }
  }

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where, skip, take: limit,
      include: {
        user: {
          select: {
            id: true, name: true, email: true, role: true, isActive: true,
            phone: true, altPhone: true, avatar: true, dateOfBirth: true,
            disabledAt: true, disabledReason: true, lastLoginAt: true,
          },
        },
        department: { select: { id: true, name: true, color: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.employee.count({ where }),
  ])

  return successResponse(employees, total)
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const body = await req.json()
  const {
    // MANDATORY (admin sets)
    name, email, phone, password, role,
    // ADMIN-ONLY employment
    position, salary, workMode, departmentId, joiningDate,
    dateOfBirth,
  } = body

  if (!name || !email || !password) return errorResponse('Name, email, password required')
  if (password.length < 6) return errorResponse('Password must be at least 6 characters')

  const normalizedEmail = String(email).toLowerCase().trim()
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) return errorResponse('Email already registered')

  try {
    const hashedPwd = await hash(password, 10)
    const employeeId = await generateEmployeeId()

    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        phone: phone || null,
        password: hashedPwd,
        role: role || 'EMPLOYEE',
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        employee: {
          create: {
            employeeId,
            position: position || null,
            salary: Number(salary) || 0,
            workMode: workMode || 'WFO',
            departmentId: departmentId || null,
            joiningDate: joiningDate ? new Date(joiningDate) : null,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          },
        },
      },
      include: { employee: { include: { department: true } } },
    })

    await logFromRequest(req, {
      userId: session.userId,
      action: 'CREATE',
      entityType: 'Employee',
      entityId: user.id,
      metadata: { employeeId, role, departmentId },
    })

    // Welcome email + WhatsApp with login credentials — best-effort, don't
    // block/fail the employee-creation response if either fails to send.
    sendEmployeeWelcome(user.id, password).catch((e) => {
      console.error('Employee welcome send failed:', e)
    })

    return successResponse(user)
  } catch (e: any) {
    console.error('Employee create error:', e)
    return errorResponse('Failed to create employee: ' + (e.message || 'Unknown error'))
  }
}