'use client'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Menu, Search, LogOut, User, Settings, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { NotificationBell } from '@/components/NotificationBell'

export default function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="md:hidden p-2 text-gray-500 hover:text-gray-700">
          <Menu size={20} />
        </button>
        <div className="hidden md:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-64">
          <Search size={15} className="text-gray-400" />
          <input className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none w-full" placeholder="Search..." />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <NotificationBell />

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-semibold text-gray-900 leading-tight">{user?.name}</p>
              <p className="text-xs text-gray-500">
                {user?.role?.replace(/_/g, ' ')}
                {user?.employee?.employeeId && <span className="ml-1 font-mono text-gray-400">· {user.employee.employeeId}</span>}
              </p>
            </div>
            <ChevronDown size={14} className="text-gray-400 hidden md:block" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
                {user?.employee?.employeeId && <p className="text-xs font-mono text-blue-600">{user.employee.employeeId}</p>}
              </div>
              <Link href="/profile" onClick={() => setDropdownOpen(false)}>
                <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700">
                  <User size={15} /><span>Profile</span>
                </div>
              </Link>
              <Link href="/settings" onClick={() => setDropdownOpen(false)}>
                <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700">
                  <Settings size={15} /><span>Settings</span>
                </div>
              </Link>
              <div className="border-t border-gray-100">
                <button onClick={logout} className="flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 text-sm text-red-600 w-full">
                  <LogOut size={15} /><span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
