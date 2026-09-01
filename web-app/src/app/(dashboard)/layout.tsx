// src/app/(dashboard)/layout.tsx
'use client'
import DashboardLayout from '@/components/layout/DashboardLayout'
import LocationTracker from '@/components/LocationTracker'
import { ChatNotificationPopup } from '@/components/ChatNotificationPopup'
import { AnnouncementPopup } from '@/components/AnnouncementPopup'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LocationTracker />
      <ChatNotificationPopup />
      <AnnouncementPopup />
      <DashboardLayout>{children}</DashboardLayout>
    </>
  )
}
