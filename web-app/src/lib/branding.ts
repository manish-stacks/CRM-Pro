// src/lib/branding.ts
// SINGLE SOURCE OF TRUTH for all company/brand text used across the app.
// Change the .env values (COMPANY_NAME, COMPANY_SHORT, COMPANY_DOMAIN,
// COMPANY_LOGO_URL) and every screen, PDF, email, and ID prefix updates —
// no more hunting through files when handing this project to a new client.
//
// NEXT_PUBLIC_* versions exist so client components (login page, client
// portal shell, etc.) can read them too — Next.js inlines these at build
// time, so `npm run build` again after changing .env.

export const BRAND = {
  name: process.env.COMPANY_NAME || process.env.NEXT_PUBLIC_COMPANY_NAME || 'Your Company',
  short: process.env.COMPANY_SHORT || process.env.NEXT_PUBLIC_COMPANY_SHORT || 'APP',
  domain: process.env.COMPANY_DOMAIN || process.env.NEXT_PUBLIC_COMPANY_DOMAIN || '',
  logoUrl: process.env.COMPANY_LOGO_URL || process.env.NEXT_PUBLIC_COMPANY_LOGO_URL || '/images/hbs-logo.png',
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'CRM',
}
