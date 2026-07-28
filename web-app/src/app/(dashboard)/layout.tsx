// src/app/(dashboard)/layout.tsx
'use client'
import DashboardLayout from '@/components/layout/DashboardLayout'
import LocationTracker from '@/components/LocationTracker'
import { ChatNotificationPopup } from '@/components/ChatNotificationPopup'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LocationTracker />
      <ChatNotificationPopup />
      <DashboardLayout>{children}</DashboardLayout>
    </>
  )
}
