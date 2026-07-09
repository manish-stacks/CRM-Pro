'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import {
  LayoutDashboard, Users, Clock, Calendar, DollarSign, Building2,
  Target, FileText, Users2, CreditCard, BarChart3, Settings,
  Briefcase, Package, Bell, ChevronDown, ChevronRight, LogOut,
  User, Menu, X, Video, UserCheck, Shield, MessageSquare, AlertCircle, MapPin
} from 'lucide-react'

interface NavItem {
  label: string
  href?: string
  icon: React.ElementType
  roles?: string[]
  children?: NavItem[]
}

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    label: 'HRM', icon: Users, children: [
      { label: 'Employees', href: '/employees', icon: UserCheck, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
      { label: 'Attendance', href: '/attendance', icon: Clock },
      { label: 'Leaves', href: '/leaves', icon: Calendar },
      { label: 'Payroll', href: '/payroll', icon: DollarSign },
      { label: 'Letters', href: '/letters', icon: FileText, roles: ['SUPER_ADMIN', 'ADMIN'] },
      { label: 'Departments', href: '/departments', icon: Building2, roles: ['SUPER_ADMIN', 'ADMIN'] },
    ]
  },
  {
    label: 'CRM', icon: Briefcase, children: [
      { label: 'Leads', href: '/leads', icon: Target, roles: ['SUPER_ADMIN', 'ADMIN', 'TELECALLER'] },
      { label: 'My Meetings', href: '/marketing', icon: Video, roles: ['SUPER_ADMIN', 'ADMIN', 'MARKETING_EXECUTIVE'] },
      { label: 'Proposals', href: '/proposals', icon: FileText, roles: ['SUPER_ADMIN', 'ADMIN', 'MARKETING_EXECUTIVE'] },
      { label: 'Invoices', href: '/invoices', icon: CreditCard, roles: ['SUPER_ADMIN', 'ADMIN', 'MARKETING_EXECUTIVE'] },
      { label: 'Clients', href: '/clients', icon: Users2, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TELECALLER', 'MARKETING_EXECUTIVE'] },
      { label: 'Projects', href: '/projects', icon: Briefcase },
      { label: 'Services', href: '/services', icon: Package, roles: ['SUPER_ADMIN', 'ADMIN'] },
    ]
  },
  {
    label: 'Support', icon: MessageSquare, children: [
      { label: 'Team Chat', href: '/chat', icon: MessageSquare },
      { label: 'Client Tickets', href: '/tickets', icon: MessageSquare, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'MARKETING_EXECUTIVE'] },
      { label: 'My Tickets', href: '/my-tickets', icon: AlertCircle },
    ]
  },
  {
    label: 'Finance', icon: CreditCard, children: [
      { label: 'Payments', href: '/payments', icon: CreditCard, roles: ['SUPER_ADMIN', 'ADMIN'] },
      { label: 'Reports', href: '/reports', icon: BarChart3, roles: ['SUPER_ADMIN', 'ADMIN'] },
    ]
  },
  { label: 'Field Tracking', href: '/tracking', icon: MapPin, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'Audit Log', href: '/audit-logs', icon: Shield, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['SUPER_ADMIN', 'ADMIN'] },
]

// Client portal external link shown below nav


function NavLink({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const pathname = usePathname()
  const { user } = useAuth()
  const [open, setOpen] = useState(() => item.children?.some(c => pathname.startsWith(c.href || '')))

  if (item.roles && user && !item.roles.includes(user.role)) return null

  if (item.children) {
    const visibleChildren = item.children.filter(c => !c.roles || (user && c.roles.includes(user.role)))
    if (visibleChildren.length === 0) return null

    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="sidebar-link w-full justify-between"
        >
          <div className="flex items-center gap-3">
            <item.icon size={17} />
            <span>{item.label}</span>
          </div>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {open && (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-gray-100 pl-3">
            {visibleChildren.map(child => (
              <NavLink key={child.label} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

  return (
    <Link href={item.href!}>
      <div className={`sidebar-link ${isActive ? 'active' : ''}`}>
        <item.icon size={17} />
        <span>{item.label}</span>
      </div>
    </Link>
  )
}

export default function Sidebar({ mobile, onClose }: { mobile?: boolean; onClose?: () => void }) {
  const { user } = useAuth()

  return (
    <aside className={`flex flex-col h-full bg-white border-r border-gray-200 ${mobile ? 'w-full' : ''}`}>
      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Briefcase size={16} className="text-white" />
          </div>
          <span className="font-bold text-gray-900 text-base">Hover Business Services LLP</span>
        </div>
        {mobile && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        )}
      </div>

      {/* User pill */}
      <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {NAV.map(item => <NavLink key={item.label} item={item} />)}
        <a href="/client-portal" target="_blank" rel="noopener noreferrer">
          <div className="sidebar-link mt-2 border border-dashed border-gray-200">
            <Shield size={17} className="text-indigo-500" />
            <span className="text-indigo-500">Client Portal</span>
          </div>
        </a>
      </nav>
    </aside>
  )
}
