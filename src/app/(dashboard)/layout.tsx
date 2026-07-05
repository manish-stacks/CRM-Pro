// src/app/(dashboard)/layout.tsx
'use client'
import DashboardLayout from '@/components/layout/DashboardLayout'
import LocationTracker from '@/components/LocationTracker'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LocationTracker />
      <DashboardLayout>{children}</DashboardLayout>
    </>
  )
}
