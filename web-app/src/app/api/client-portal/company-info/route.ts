// src/app/api/client-portal/company-info/route.ts
// Public info about the company for client-side PDF generation
import { NextRequest, NextResponse } from 'next/server'
import { getClientSession } from '@/lib/clientAuth'
import { Settings } from '@/lib/settings'

export async function GET(req: NextRequest) {
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const company = {
    name: await Settings.companyName(),
    address: await Settings.companyAddress(),
    phone: await Settings.companyPhone(),
    email: await Settings.companyEmail(),
    gstNo: await Settings.companyGst(),
    logoUrl: await Settings.companyLogo(),
  }
  return NextResponse.json({ data: company })
}
