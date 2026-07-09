// src/app/api/letters/[id]/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession, hasMinRole } from '@/lib/auth'
import { unauthorizedResponse, forbiddenResponse, notFoundResponse, errorResponse } from '@/lib/api'
import { Settings } from '@/lib/settings'
import {
  buildOfferLetterBody,
  buildSalaryRevisionBody,
  buildRelievingExperienceBody,
  CompanyInfo,
} from '@/lib/letterPdf'
import { renderLetterPdf } from '@/lib/pdfRenderer'

const TYPE_LABEL: Record<string, string> = {
  OFFER: 'Offer Letter',
  SALARY_REVISION: 'Salary Revision Letter',
  RELIEVING_EXPERIENCE: 'Relieving & Experience Letter',
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const letter = await prisma.letter.findUnique({
    where: { id },
    include: {
      employee: { include: { user: { select: { id: true, name: true, email: true } }, department: { select: { name: true } } } },
    },
  })
  if (!letter) return notFoundResponse('Letter')

  // Admins can view any letter; an employee may view/print their own.
  const isOwner = letter.employee.user.id === session.userId
  if (!hasMinRole(session.role, 'ADMIN') && !isOwner) return forbiddenResponse()

  const fields = JSON.parse(letter.data)

  const [companyName, companyAddress, companyPhone, companyEmail, companyLogoUrl] = await Promise.all([
    Settings.companyName(),
    Settings.companyAddress(),
    Settings.companyPhone(),
    Settings.companyEmail(),
    Settings.companyLogo(),
  ])

  const company: CompanyInfo = {
    companyName: companyName || 'Hover Business Services',
    companyAddressLine1: companyAddress || undefined,
    companyPhone: companyPhone || undefined,
    companyEmail: companyEmail || undefined,
    companyLogoUrl: companyLogoUrl || undefined,
  }

  let bodyHtml = ''
  if (letter.type === 'OFFER') {
    bodyHtml = buildOfferLetterBody({
      candidateName: letter.employee.user.name,
      relationPrefix: fields.relationPrefix,
      relativeName: fields.relativeName,
      address: fields.address,
      designation: fields.designation,
      department: fields.department,
      placeOfPosting: fields.placeOfPosting,
      monthlySalary: Number(fields.monthlySalary) || 0,
      joiningDate: fields.joiningDate,
      reportingManagerName: fields.reportingManagerName,
      probationMonths: fields.probationMonths ? Number(fields.probationMonths) : undefined,
      noticePeriodMonths: fields.noticePeriodMonths ? Number(fields.noticePeriodMonths) : undefined,
      letterDate: fields.letterDate,
      company,
    })
  } else if (letter.type === 'SALARY_REVISION') {
    bodyHtml = buildSalaryRevisionBody({
      employeeName: letter.employee.user.name,
      effectiveDate: fields.effectiveDate,
      previousSalary: Number(fields.previousSalary) || 0,
      revisedSalary: Number(fields.revisedSalary) || 0,
      signatoryName: fields.signatoryName || session.name,
      signatoryDesignation: fields.signatoryDesignation || 'HR Manager',
      letterDate: fields.letterDate,
      company,
    })
  } else if (letter.type === 'RELIEVING_EXPERIENCE') {
    bodyHtml = buildRelievingExperienceBody({
      employeeName: letter.employee.user.name,
      salutation: fields.salutation,
      pronoun: fields.pronoun,
      possessivePronoun: fields.possessivePronoun,
      fromDate: fields.fromDate,
      toDate: fields.toDate,
      designation: fields.designation,
      department: fields.department,
      placeOfPosting: fields.placeOfPosting,
      fixedCTC: Number(fields.fixedCTC) || 0,
      place: fields.place,
      letterDate: fields.letterDate,
      company,
    })
  } else {
    return notFoundResponse('Letter type')
  }

  const title = TYPE_LABEL[letter.type] || 'Letter'

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderLetterPdf(bodyHtml, title)
  } catch (err) {
    console.error('Letter PDF render failed:', err)
    return errorResponse('Failed to generate PDF', 500)
  }

  const safeName = (letter.employee.user.name || 'letter').replace(/[^a-zA-Z0-9]+/g, '-')
  const fileName = `${title.replace(/\s+/g, '-')}-${safeName}.pdf`

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
