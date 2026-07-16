// src/lib/accountManager.ts
// Client ka "Account Manager" ek hi jagah se resolve hota hai taki web portal,
// mobile app aur emails — sab me same naam dikhe.
//
// Priority:
//   1. marketingPerson  -> jis MARKETING_EXECUTIVE ne meeting karke client add kiya
//   2. reportingPerson  -> agar admin ne manually koi aur set kiya ho
//   3. telecaller
//   4. assignedTo
//   5. Company default  -> "Hover" (Settings se naam/phone/email)
import { prisma } from './prisma'
import { Settings } from './settings'

export interface AccountManager {
  id: string | null
  name: string
  email: string | null
  phone: string | null
  role: string          // 'MARKETING_EXECUTIVE' | ... | 'COMPANY'
  isDefault: boolean    // true = company fallback, koi person assigned nahi
}

const PERSON_SELECT = { id: true, name: true, email: true, phone: true, role: true } as const

/** Prisma include block — jahan bhi client fetch ho, ye spread kar do */
export const accountManagerInclude = {
  marketingPerson: { select: PERSON_SELECT },
  reportingPerson: { select: PERSON_SELECT },
  telecaller: { select: PERSON_SELECT },
  assignedTo: { select: PERSON_SELECT },
} as const

async function companyDefault(): Promise<AccountManager> {
  const [name, email, phone] = await Promise.all([
    Settings.companyName(),
    Settings.companyEmail(),
    Settings.companyPhone(),
  ])
  return {
    id: null,
    // Company ka pura naam lamba hai — pehla word ("Hover") kaafi hai
    name: (name || 'Hover').split(' ')[0] || 'Hover',
    email: email || null,
    phone: phone || null,
    role: 'COMPANY',
    isDefault: true,
  }
}

/** Already-included client object se resolve karo (extra DB hit nahi) */
export async function resolveAccountManager(client: any): Promise<AccountManager> {
  const p =
    client?.marketingPerson ||
    client?.reportingPerson ||
    client?.telecaller ||
    client?.assignedTo ||
    null

  if (p?.name) {
    return {
      id: p.id ?? null,
      name: p.name,
      email: p.email ?? null,
      phone: p.phone ?? null,
      role: p.role || 'MARKETING_EXECUTIVE',
      isDefault: false,
    }
  }
  return companyDefault()
}

/** clientId se seedha resolve karo */
export async function getAccountManager(clientId: string): Promise<AccountManager> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: accountManagerInclude,
  })
  if (!client) return companyDefault()
  return resolveAccountManager(client)
}

/** Mobile app ke snake_case shape me */
export function toMobileShape(am: AccountManager) {
  return {
    id: am.id,
    name: am.name,
    email: am.email,
    phone: am.phone,
    role: am.role,
    is_default: am.isDefault,
  }
}
