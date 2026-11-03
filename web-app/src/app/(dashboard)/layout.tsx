// src/app/(dashboard)/layout.tsx
'use client'
import DashboardLayout from '@/components/layout/DashboardLayout'
import LocationTracker from '@/components/LocationTracker'
import { ChatNotificationPopup } from '@/components/ChatNotificationPopup'
import { AnnouncementPopup } from '@/components/AnnouncementPopup'
import { ImpersonationBanner } from '@/components/ImpersonationBanner'
import DiwaliTheme from '@/components/DiwaliTheme'
import ChristmasTheme from '@/components/ChristmasTheme'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ImpersonationBanner />
      <LocationTracker />
      <ChatNotificationPopup />
      <AnnouncementPopup />
      <DiwaliTheme />
      <ChristmasTheme />
      <DashboardLayout>{children}</DashboardLayout>
    </>
  )
}
