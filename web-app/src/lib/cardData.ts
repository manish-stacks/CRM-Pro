// Builds the visiting-card payload (shared by the public card API and the mobile API).
import { BRAND } from '@/lib/branding'
import { prisma } from '@/lib/prisma'

export const CARD_EMPLOYEE_SELECT = {
  employeeId: true,
  position: true,
  department: { select: { name: true } },
  user: { select: { name: true, avatar: true, phone: true, email: true, isActive: true, role: true } },
} as const

export async function buildCardData(employee: any) {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['company_name', 'company_phone', 'company_email', 'company_address', 'company_website', 'company_logo_url', 'company_profile_url'] } },
  })
  const s: Record<string, string> = {}
  rows.forEach(r => { s[r.key] = r.value })
  return {
    employeeId: employee.employeeId,
    name: employee.user.name,
    avatar: employee.user.avatar,
    position: employee.position || 'Marketing Executive',
    department: employee.department?.name || null,
    phone: employee.user.phone,
    email: employee.user.email,
    company: {
      name: s.company_name || BRAND.name,
      phone: s.company_phone || '',
      email: s.company_email || '',
      address: s.company_address || '',
      website: s.company_website || (BRAND.domain ? `https://${BRAND.domain}` : ''),
      logo: s.company_logo_url || BRAND.logoUrl,
      profileUrl: s.company_profile_url || '',
    },
  }
}
