import type { Metadata } from 'next'
import { Inter, Outfit } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/hooks/useAuth'
import { ThemeColorProvider } from '@/components/ThemeColorProvider'
import { BRAND } from '@/lib/branding'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })

export const metadata: Metadata = {
  title: `${BRAND.appName} — Business Management`,
  description: `Complete CRM & HRM by ${BRAND.name}`,
  icons: {
    icon: '/images/favicon.ico',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${outfit.variable} font-sans antialiased`}>
        <ThemeColorProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeColorProvider>
      </body>
    </html>
  )
}
