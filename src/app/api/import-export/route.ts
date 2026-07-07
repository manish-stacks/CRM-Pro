// src/app/api/import-export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, getRequestSession } from '@/lib/auth'
import { errorResponse, successResponse } from '@/lib/api'
import { dateOnly } from '@/lib/attendanceDate'

function toCsv(data: any[], filename: string) {
  if (data.length === 0) {
    return new NextResponse('No data', {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${filename}.csv"` },
    })
  }
  const headers = Object.keys(data[0]).join(',')
  const rows = data.map(row =>
    Object.values(row).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
  )
  const csv = [headers, ...rows].join('\n')
  return new NextResponse('\uFEFF' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}.csv"`,
    },
  })
}

// GET: Export data as CSV/JSON
export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') // clients, payments, attendance, leads, employees
  const format = searchParams.get('format') || 'csv'

  try {
    let data: any[] = []
    let filename = `${type}-export`

    switch (type) {
      case 'clients': {
        const clients = await prisma.client.findMany({
          include: { services: true, assignedTo: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        })
        data = clients.map(c => ({
          ClientCode: c.clientCode,
          CompanyName: c.companyName,
          ContactName: c.clientName,
          Phone: c.phone,
          Email: c.email || '',
          GSTIN: c.gstNo || '',
          Address: c.address || '',
          City: c.city || '',
          State: c.state || '',
          Status: c.status,
          AssignedTo: c.assignedTo?.name || '',
          Services: c.services.map(s => s.serviceName).join('; '),
          CreatedAt: c.createdAt.toISOString().split('T')[0],
        }))
        filename = 'clients-export'
        break
      }

      case 'payments': {
        const payments = await prisma.payment.findMany({
          include: {
            invoice: { include: { client: { select: { companyName: true } } } },
          },
          orderBy: { paidAt: 'desc' },
        })
        data = payments.map(p => ({
          InvoiceNumber: p.invoice?.invoiceNumber || '',
          Client: p.invoice?.client?.companyName || '',
          Amount: p.amount,
          Method: p.method,
          Reference: p.reference || '',
          PaidAt: p.paidAt.toISOString().split('T')[0],
        }))
        filename = 'payments-export'
        break
      }

      case 'attendance': {
        // Same filters as the attendance list so "filter → export" matches on-screen data
        const departmentId = searchParams.get('departmentId')
        const status = searchParams.get('status')
        const month = searchParams.get('month')       // YYYY-MM
        const date = searchParams.get('date')         // YYYY-MM-DD
        const dateFrom = searchParams.get('dateFrom')
        const dateTo = searchParams.get('dateTo')
        const search = searchParams.get('search')

        const where: any = {}
        if (date) {
          where.date = dateOnly(date)
        } else if (month) {
          const [y, m] = month.split('-').map(Number)
          where.date = { gte: new Date(y, m - 1, 1), lte: new Date(y, m, 0, 23, 59, 59) }
        } else if (dateFrom || dateTo) {
          where.date = {}
          if (dateFrom) where.date.gte = new Date(dateFrom)
          if (dateTo) where.date.lte = new Date(dateTo + 'T23:59:59')
        }
        if (status) where.status = status
        if (departmentId) {
          const deptEmps = await prisma.employee.findMany({ where: { departmentId }, select: { id: true } })
          where.employeeId = { in: deptEmps.map(e => e.id) }
        }
        if (search) {
          const users = await prisma.user.findMany({ where: { name: { contains: search } }, select: { id: true } })
          const emps = await prisma.employee.findMany({ where: { userId: { in: users.map(u => u.id) } }, select: { id: true } })
          where.employeeId = where.employeeId?.in
            ? { in: where.employeeId.in.filter((id: string) => emps.map(e => e.id).includes(id)) }
            : { in: emps.map(e => e.id) }
        }

        const attendance = await prisma.attendance.findMany({
          where,
          include: {
            employee: {
              include: {
                user: { select: { name: true } },
                department: { select: { name: true } },
              },
            },
          },
          orderBy: [{ date: 'desc' }, { punchIn: 'desc' }],
          take: 5000,
        })
        data = attendance.map(a => ({
          EmployeeID: a.employee.employeeId,
          Name: a.employee.user.name,
          Department: a.employee.department?.name || '',
          Date: a.date.toISOString().split('T')[0],
          PunchIn: a.punchIn ? new Date(a.punchIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '',
          PunchOut: a.punchOut ? new Date(a.punchOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '',
          HoursWorked: a.hoursWorked ?? 0,
          Late: a.isLate ? 'Yes' : 'No',
          'LateBy(min)': a.isLate ? (a.lateBy ?? 0) : 0,
          WorkMode: a.workMode,
          Status: a.status,
        }))

        // Append a summary row: total records + total late marks
        const totalLate = attendance.filter(a => a.isLate).length
        if (data.length > 0) {
          data.push({
            EmployeeID: '', Name: '', Department: '', Date: '',
            PunchIn: '', PunchOut: '', HoursWorked: '',
            Late: `TOTAL LATE: ${totalLate}`, 'LateBy(min)': '',
            WorkMode: '', Status: `TOTAL RECORDS: ${attendance.length}`,
          })
        }
        filename = 'attendance-export'
        break
      }

      case 'employees': {
        // Admin-only rich export. status = active | inactive | all (default all)
        if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)) {
          return errorResponse('Forbidden', 403)
        }
        const statusParam = (searchParams.get('status') || 'all').toLowerCase()
        const where: any = {}
        if (statusParam === 'active') where.user = { isActive: true }
        else if (statusParam === 'inactive') where.user = { isActive: false }

        const employees = await prisma.employee.findMany({
          where,
          include: {
            user: { select: { name: true, phone: true, avatar: true, dateOfBirth: true, isActive: true } },
            department: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
        data = employees.map(e => ({
          'Date Of Joining': e.joiningDate ? e.joiningDate.toISOString().split('T')[0] : '',
          Name: e.user.name,
          Designation: e.position || '',
          Department: e.department?.name || '',
          'Blood Group': e.bloodGroup || '',
          'Phone Number': e.user.phone || '',
          'Emergency Number': e.emergencyPhone || '',
          Address: [e.address, e.city, e.state, e.pincode].filter(Boolean).join(', '),
          Photos: e.user.avatar || '',
          'Employee ID': e.employeeId,
          DOB: e.dateOfBirth
            ? e.dateOfBirth.toISOString().split('T')[0]
            : (e.user.dateOfBirth ? e.user.dateOfBirth.toISOString().split('T')[0] : ''),
          Status: e.user.isActive ? 'Active' : 'Inactive',
        }))
        filename = `employees-${statusParam}-export`
        break
      }

      case 'leads': {
        // Mirror /api/leads' filters + role-based visibility so
        // "filter on screen → export" gives exactly what's shown.
        const status = searchParams.get('status')
        const source = searchParams.get('source')
        const assignedToId = searchParams.get('assignedToId')
        const search = searchParams.get('search')
        const dateFrom = searchParams.get('dateFrom')
        const dateTo = searchParams.get('dateTo')

        const where: any = {}
        if (status) where.status = status
        if (source) where.source = source
        if (search) {
          where.OR = [
            { leadNumber: { contains: search } },
            { clientName: { contains: search } },
            { companyName: { contains: search } },
            { clientPhone: { contains: search } },
            { clientEmail: { contains: search } },
          ]
        }
        if (dateFrom || dateTo) {
          where.createdAt = {}
          if (dateFrom) where.createdAt.gte = new Date(dateFrom)
          if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59')
        }

        // Role-based visibility (same rules as the leads list)
        if (session.role === 'TELECALLER') {
          where.assignedToId = session.userId
        } else if (session.role === 'MARKETING_EXECUTIVE') {
          where.meetingAssignedToId = session.userId
        } else if (session.role === 'EMPLOYEE') {
          return toCsv([], 'leads-export')
        }
        if (assignedToId && ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)) {
          where.assignedToId = assignedToId
        }

        const leads = await prisma.lead.findMany({
          where,
          include: {
            createdBy: { select: { name: true } },
            assignedTo: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
        data = leads.map(l => ({
          LeadNumber: l.leadNumber,
          Name: l.clientName,
          Phone: l.clientPhone,
          Email: l.clientEmail || '',
          Company: l.companyName || '',
          Source: l.source,
          Service: l.service || '',
          Status: l.status,
          CreatedBy: l.createdBy?.name || '',
          AssignedTo: l.assignedTo?.name || '',
          CreatedAt: l.createdAt.toISOString().split('T')[0],
        }))
        filename = dateFrom || dateTo
          ? `leads-export-${dateFrom || 'start'}_to_${dateTo || 'end'}`
          : 'leads-export'
        break
      }

      case 'attendance-summary': {
        // Monthly per-employee summary for ACTIVE users.
        // ?month=YYYY-MM  (defaults to current month)
        if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)) {
          return errorResponse('Forbidden', 403)
        }
        const monthParam = searchParams.get('month') || new Date().toISOString().slice(0, 7)
        const [y, m] = monthParam.split('-').map(Number)
        const monthStart = new Date(y, m - 1, 1)
        const monthEnd = new Date(y, m, 0, 23, 59, 59)

        const employees = await prisma.employee.findMany({
          where: { user: { isActive: true } },
          include: {
            user: { select: { name: true } },
            department: { select: { name: true } },
          },
          orderBy: { employeeId: 'asc' },
        })
        const empIds = employees.map(e => e.id)

        // Attendance rows for the month
        const atts = await prisma.attendance.findMany({
          where: { employeeId: { in: empIds }, date: { gte: monthStart, lte: monthEnd } },
          select: { employeeId: true, status: true, workMode: true, isLate: true },
        })
        // Approved leaves overlapping the month
        const leaves = await prisma.leave.findMany({
          where: {
            employeeId: { in: empIds },
            status: 'APPROVED',
            startDate: { lte: monthEnd },
            endDate: { gte: monthStart },
          },
          select: { employeeId: true, duration: true, days: true, leaveType: true },
        })

        const agg: Record<string, any> = {}
        for (const e of employees) {
          agg[e.id] = { present: 0, leave: 0, late: 0, wfh: 0, shortLeave: 0, halfDay: 0 }
        }
        for (const a of atts) {
          const g = agg[a.employeeId]; if (!g) continue
          if (a.status === 'PRESENT') g.present++
          if (a.status === 'HALF_DAY') g.halfDay++
          if (a.workMode === 'WFH') g.wfh++
          if (a.isLate) g.late++
        }
        for (const lv of leaves) {
          const g = agg[lv.employeeId]; if (!g) continue
          if (lv.duration === 'SHORT_HOURLY') g.shortLeave++
          else g.leave += lv.days || 0
        }

        data = employees.map(e => ({
          EmployeeID: e.employeeId,
          Name: e.user.name,
          Department: e.department?.name || '',
          Present: agg[e.id].present,
          Leave: agg[e.id].leave,
          Late: agg[e.id].late,
          WFH: agg[e.id].wfh,
          'Short leave': agg[e.id].shortLeave,
          'Half days': agg[e.id].halfDay,
        }))
        filename = `attendance-summary-${monthParam}`
        break
      }

      default:
        return errorResponse('Invalid export type')
    }

    if (format === 'csv') return toCsv(data, filename)
    return NextResponse.json({ data, total: data.length })
  } catch (error) {
    console.error('Export error:', error)
    return errorResponse('Export failed')
  }
}

// POST: Import leads from CSV/JSON
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, 'MANAGER')
  if (auth instanceof Response) return auth

  const body = await req.json()
  const { leads } = body

  if (!Array.isArray(leads) || leads.length === 0) {
    return errorResponse('No leads provided')
  }

  const session = await getRequestSession(req)

  try {
    const created: any[] = []
    const errors: any[] = []

    for (let i = 0; i < leads.length; i++) {
      const row = leads[i]
      const clientName = row.clientName || row.name
      const clientPhone = row.clientPhone || row.phone
      if (!clientName || !clientPhone) {
        errors.push({ row: i + 1, error: 'Name and phone required' })
        continue
      }
      try {
        // leadNumber auto: LEAD-000001 style
        const count = await prisma.lead.count()
        const leadNumber = `LEAD-${String(count + 1).padStart(6, '0')}`
        const createdLead = await prisma.lead.create({
          data: {
            leadNumber,
            clientName,
            clientPhone,
            clientEmail: row.clientEmail || row.email || null,
            companyName: row.companyName || row.company || null,
            source: row.source || 'OTHER',
            service: row.service || null,
            status: 'NEW',
            createdById: (session as any).userId,
          },
        })
        created.push(createdLead)
      } catch {
        errors.push({ row: i + 1, error: 'Failed to create lead' })
      }
    }

    return successResponse({ imported: created.length, errors }, created.length)
  } catch {
    return errorResponse('Import failed')
  }
}