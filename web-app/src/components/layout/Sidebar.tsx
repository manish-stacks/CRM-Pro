'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import {
  LayoutDashboard, Users, Clock, Calendar, DollarSign, Building2,
  Target, FileText, Users2, CreditCard, BarChart3, Settings,
  Briefcase, Package, Bell, ChevronDown, ChevronRight, LogOut,
  User, Menu, X, Video, UserCheck, Shield, MessageSquare, AlertCircle, MapPin, MapPinned, Wallet, AlarmClock, StickyNote, Mail, PartyPopper,
  MessageSquareCode, CalendarClock, ShieldCheck
} from 'lucide-react'

interface NavItem {
  label: string
  href?: string
  icon: React.ElementType
  roles?: string[]
  /** Permission gate — takes precedence over `roles` when set. */
  permission?: string
  children?: NavItem[]
}

// Every entry below is gated by `permission` (module.action from the live
// Roles & Permissions catalog) instead of a hardcoded role list — so
// whatever an admin grants/revokes for a role in /settings/roles is exactly
// what shows in the sidebar, with zero code changes needed. The only
// exceptions are the two "My ..." links (My Leads, My Meetings), which are
// each one specific tier's personal working queue rather than a general
// module view, so they intentionally stay pinned to that tier.
const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  {
    label: 'HRM', icon: Users, children: [
      { label: 'Employees', href: '/employees', icon: UserCheck, permission: 'employees.view' },
      { label: 'Attendance', href: '/attendance', icon: Clock, permission: 'attendance.view' },
      { label: 'Leaves', href: '/leaves', icon: Calendar, permission: 'leaves.view' },
      { label: 'Payroll', href: '/payroll', icon: DollarSign, permission: 'payroll.view' },
      { label: 'Letters', href: '/letters', icon: FileText, permission: 'letters.view' },
      { label: 'Departments', href: '/departments', icon: Building2, permission: 'departments.view' },
    ]
  },
  {
    label: 'CRM', icon: Briefcase, children: [
      { label: 'Leads', href: '/leads', icon: Target, permission: 'leads.view' },
      // Personal queue — Manager's own working list, not the general Leads permission.
      { label: 'My Leads', href: '/leads/my', icon: Target, roles: ['MANAGER'] },
      // Personal calendar — the marketing tier's own booked meetings, not the general Meetings permission.
      { label: 'My Meetings', href: '/marketing', icon: Video, roles: ['SUPER_ADMIN', 'ADMIN', 'MARKETING_EXECUTIVE'] },
      // Whole-team availability grid. Telecallers had to open a lead and start
      // the booking flow just to see who was free — this shows the full board.
      { label: 'Slot Board', href: '/meeting-slots', icon: CalendarClock, permission: 'meetings.view' },
      { label: 'Proposals', href: '/proposals', icon: FileText, permission: 'proposals.view' },
      { label: 'Invoices', href: '/invoices', icon: CreditCard, permission: 'invoices.view' },
      { label: 'Clients', href: '/clients', icon: Users2, permission: 'clients.view' },
      { label: 'Services', href: '/services', icon: Package, permission: 'services.view' },
    ]
  },
  {
    label: 'Projects', icon: Building2, children: [
      { label: 'Projects', href: '/projects', icon: Briefcase, permission: 'projects.view' },
      { label: 'SEO Reports', href: '/seo-reports', icon: MapPinned, permission: 'seo_reports.view' },
    ]
  },
  { label: 'Team Chat', href: '/chat', icon: MessageSquareCode, permission: 'chat.view' },
  {
    label: 'Support Tickets', icon: MessageSquare, children: [

      { label: 'Client Tickets', href: '/tickets', icon: MessageSquare, permission: 'tickets.view' },
      { label: 'My Tickets', href: '/my-tickets', icon: AlertCircle },
    ]
  },
  {
    label: 'Finance', icon: CreditCard, children: [
      { label: 'Payments', href: '/payments', icon: CreditCard, permission: 'payments.view' },
      { label: 'Reports', href: '/reports', icon: BarChart3, permission: 'reports.view' },
      { label: 'Daily Collection', href: '/collection', icon: Wallet, permission: 'collection.view' },
    ]
  },
  {
    label: 'Tracking', icon: MapPinned, children: [
      { label: 'Visit Sheet', href: '/visits', icon: MapPinned, permission: 'visits.view' },
      { label: 'Field Tracking', href: '/tracking', icon: MapPin, permission: 'tracking.view' },
    ]
  },

  { label: 'Announcements', href: '/announcements', icon: PartyPopper, permission: 'announcements.view' },
  { label: 'Notifications', href: '/notifications', icon: Bell },
  // { label: 'Reminders', href: '/reminders', icon: AlarmClock },
  // { label: 'Sticky Notes', href: '/notes', icon: StickyNote },
  { label: 'Custom Mail', href: '/compose-mail', icon: Mail, permission: 'mail.view' },
  { label: 'Audit Log', href: '/audit-logs', icon: Shield, permission: 'audit.view' },
  { label: 'Settings', href: '/settings', icon: Settings, permission: 'settings.view' },
  { label: 'Roles & Permissions', href: '/roles-permissions', icon: ShieldCheck, permission: 'roles.view' },
]

// Client portal external link shown below nav


function NavLink({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const pathname = usePathname()
  const { user, can } = useAuth()
  const [open, setOpen] = useState(() => item.children?.some(c => pathname.startsWith(c.href || '')))

  // A `permission` gate wins over the legacy `roles` list, so a custom role
  // can open or close a menu entry without touching this file.
  const allowed = (it: NavItem) =>
    it.permission ? can(it.permission) : (!it.roles || !user || it.roles.includes(user.role))

  if (!allowed(item)) return null

  const displayLabel = item.href === '/leads' && user?.role === 'MANAGER' ? 'Team Leads' : item.label

  if (item.children) {
    const visibleChildren = item.children.filter(allowed)
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

  const hrefPath = (item.href || '').split('?')[0]
  const isActive = pathname === hrefPath || pathname.startsWith(hrefPath + '/')

  return (
    <Link href={item.href!}>
      <div className={`sidebar-link ${isActive ? 'active' : ''}`}>
        <item.icon size={17} />
        <span>{displayLabel}</span>
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
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-sm">
            <Briefcase size={16} className="text-white" />
          </div>
          <div className="leading-tight">
            <span className="font-extrabold text-gray-900 text-sm block">HOVER BUSINESS</span>
            <span className="text-[10px] font-medium text-gray-400 tracking-wide">SERVICES LLP.</span>
          </div>
        </div>
        {mobile && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        )}
      </div>

      {/* User pill */}
      <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.avatar ? <img src={user?.avatar} alt="" className="w-full h-full object-cover rounded-md" /> : user?.name?.[0]?.toUpperCase()}
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


// 'use client'
// import { useState } from 'react'
// import Link from 'next/link'
// import { usePathname } from 'next/navigation'
// import { useAuth } from '@/hooks/useAuth'
// import {
//   LayoutDashboard, Users, Clock, Calendar, DollarSign, Building2,
//   Target, FileText, Users2, CreditCard, BarChart3, Settings,
//   Briefcase, Package, Bell, ChevronDown, ChevronRight, LogOut,
//   User, Menu, X, Video, UserCheck, Shield, MessageSquare, AlertCircle, MapPin, MapPinned, Wallet, AlarmClock, StickyNote, Mail, PartyPopper,
//   MessageSquareCode, CalendarClock, ShieldCheck
// } from 'lucide-react'

// interface NavItem {
//   label: string
//   href?: string
//   icon: React.ElementType
//   roles?: string[]
//   /** Permission gate — takes precedence over `roles` when set. */
//   permission?: string
//   children?: NavItem[]
// }

// const NAV: NavItem[] = [
//   { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
//   {
//     label: 'HRM', icon: Users, children: [
//       { label: 'Employees', href: '/employees', icon: UserCheck, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
//       { label: 'Attendance', href: '/attendance', icon: Clock },
//       { label: 'Leaves', href: '/leaves', icon: Calendar },
//       { label: 'Payroll', href: '/payroll', icon: DollarSign },
//       { label: 'Letters', href: '/letters', icon: FileText, roles: ['SUPER_ADMIN', 'ADMIN'] },
//       { label: 'Departments', href: '/departments', icon: Building2, roles: ['SUPER_ADMIN', 'ADMIN'] },
//     ]
//   },
//   {
//     label: 'CRM', icon: Briefcase, children: [
//       { label: 'Leads', href: '/leads', icon: Target, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TELECALLER'] },
//       { label: 'My Leads', href: '/leads/my', icon: Target, roles: ['MANAGER'] },
//       { label: 'My Meetings', href: '/marketing', icon: Video, roles: ['SUPER_ADMIN', 'ADMIN', 'MARKETING_EXECUTIVE'] },
//       // Whole-team availability grid. Telecallers had to open a lead and start
//       // the booking flow just to see who was free — this shows the full board.
//       { label: 'Slot Board', href: '/meeting-slots', icon: CalendarClock, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TELECALLER', 'MARKETING_EXECUTIVE'] },
//       { label: 'Proposals', href: '/proposals', icon: FileText, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MARKETING_EXECUTIVE',] },
//       { label: 'Invoices', href: '/invoices', icon: CreditCard, roles: ['SUPER_ADMIN', 'ADMIN', 'MARKETING_EXECUTIVE'] },
//       { label: 'Clients', href: '/clients', icon: Users2, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MARKETING_EXECUTIVE'] },
      
//       { label: 'Services', href: '/services', icon: Package, roles: ['SUPER_ADMIN', 'ADMIN'] },
//     ]
//   },
//   {
//     label: 'Projects', icon: Building2, children: [
//       { label: 'Projects', href: '/projects', icon: Briefcase },
//       { label: 'SEO Reports', href: '/seo-reports', icon: MapPinned, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MARKETING_EXECUTIVE', 'EMPLOYEE'] },
//     ]
//   },
//   { label: 'Team Chat', href: '/chat', icon: MessageSquareCode },
//   {
//     label: 'Support Tickets', icon: MessageSquare, children: [

//       { label: 'Client Tickets', href: '/tickets', icon: MessageSquare, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'MARKETING_EXECUTIVE'] },
//       { label: 'My Tickets', href: '/my-tickets', icon: AlertCircle },
//     ]
//   },
//   {
//     label: 'Finance', icon: CreditCard, children: [
//       { label: 'Payments', href: '/payments', icon: CreditCard, roles: ['SUPER_ADMIN', 'ADMIN'] },
//       { label: 'Reports', href: '/reports', icon: BarChart3, roles: ['SUPER_ADMIN', 'ADMIN'] },
//       { label: 'Daily Collection', href: '/collection', icon: Wallet, roles: ['SUPER_ADMIN', 'ADMIN'] },
//     ]
//   },
//   {
//     label: 'Tracking', icon: MapPinned, children: [
//       { label: 'Visit Sheet', href: '/visits', icon: MapPinned, roles: ['SUPER_ADMIN', 'ADMIN', 'MARKETING_EXECUTIVE'] },
//       { label: 'Field Tracking', href: '/tracking', icon: MapPin, roles: ['SUPER_ADMIN', 'ADMIN'] },
//     ]
//   },

//   { label: 'Announcements', href: '/announcements', icon: PartyPopper, roles: ['SUPER_ADMIN', 'ADMIN'] },
//   { label: 'Notifications', href: '/notifications', icon: Bell },
//   // { label: 'Reminders', href: '/reminders', icon: AlarmClock },
//   // { label: 'Sticky Notes', href: '/notes', icon: StickyNote },
//   { label: 'Custom Mail', href: '/compose-mail', icon: Mail, roles: ['SUPER_ADMIN', 'ADMIN'] },
//   { label: 'Audit Log', href: '/audit-logs', icon: Shield, roles: ['SUPER_ADMIN', 'ADMIN'] },
//   { label: 'Settings', href: '/settings', icon: Settings, roles: ['SUPER_ADMIN', 'ADMIN'] },
//   { label: 'Roles & Permissions', href: '/roles-permissions', icon: ShieldCheck, permission: 'roles.view' },
// ]

// // Client portal external link shown below nav


// function NavLink({ item, depth = 0 }: { item: NavItem; depth?: number }) {
//   const pathname = usePathname()
//   const { user, can } = useAuth()
//   const [open, setOpen] = useState(() => item.children?.some(c => pathname.startsWith(c.href || '')))

//   // A `permission` gate wins over the legacy `roles` list, so a custom role
//   // can open or close a menu entry without touching this file.
//   const allowed = (it: NavItem) =>
//     it.permission ? can(it.permission) : (!it.roles || !user || it.roles.includes(user.role))

//   if (!allowed(item)) return null

//   const displayLabel = item.href === '/leads' && user?.role === 'MANAGER' ? 'Team Leads' : item.label

//   if (item.children) {
//     const visibleChildren = item.children.filter(allowed)
//     if (visibleChildren.length === 0) return null

//     return (
//       <div>
//         <button
//           onClick={() => setOpen(!open)}
//           className="sidebar-link w-full justify-between"
//         >
//           <div className="flex items-center gap-3">
//             <item.icon size={17} />
//             <span>{item.label}</span>
//           </div>
//           {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
//         </button>
//         {open && (
//           <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-gray-100 pl-3">
//             {visibleChildren.map(child => (
//               <NavLink key={child.label} item={child} depth={depth + 1} />
//             ))}
//           </div>
//         )}
//       </div>
//     )
//   }

//   const hrefPath = (item.href || '').split('?')[0]
//   const isActive = pathname === hrefPath || pathname.startsWith(hrefPath + '/')

//   return (
//     <Link href={item.href!}>
//       <div className={`sidebar-link ${isActive ? 'active' : ''}`}>
//         <item.icon size={17} />
//         <span>{displayLabel}</span>
//       </div>
//     </Link>
//   )
// }

// export default function Sidebar({ mobile, onClose }: { mobile?: boolean; onClose?: () => void }) {
//   const { user } = useAuth()

//   return (
//     <aside className={`flex flex-col h-full bg-white border-r border-gray-200 ${mobile ? 'w-full' : ''}`}>
//       {/* Logo */}
//       <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100 flex-shrink-0">
//         <div className="flex items-center gap-2.5">
//           <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-sm">
//             <Briefcase size={16} className="text-white" />
//           </div>
//           <div className="leading-tight">
//             <span className="font-extrabold text-gray-900 text-sm block">HOVER BUSINESS</span>
//             <span className="text-[10px] font-medium text-gray-400 tracking-wide">SERVICES LLP.</span>
//           </div>
//         </div>
//         {mobile && (
//           <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
//         )}
//       </div>

//       {/* User pill */}
//       <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
//         <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
//           <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
//             {user?.avatar ? <img src={user?.avatar} alt="" className="w-full h-full object-cover rounded-md" /> : user?.name?.[0]?.toUpperCase()}
//           </div>
//           <div className="min-w-0">
//             <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
//             <p className="text-xs text-gray-500">{user?.role?.replace(/_/g, ' ')}</p>
//           </div>
//         </div>
//       </div>

//       {/* Nav */}
//       <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
//         {NAV.map(item => <NavLink key={item.label} item={item} />)}
//         <a href="/client-portal" target="_blank" rel="noopener noreferrer">
//           <div className="sidebar-link mt-2 border border-dashed border-gray-200">
//             <Shield size={17} className="text-indigo-500" />
//             <span className="text-indigo-500">Client Portal</span>
//           </div>
//         </a>
//       </nav>
//     </aside>
//   )
// }
