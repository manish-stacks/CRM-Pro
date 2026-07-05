// src/hooks/useAuth.ts
'use client'
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  avatar?: string
  phone?: string
  employee?: {
    id: string
    employeeId: string
    department?: { id: string, name: string }
    position?: string
    salary?: number
  }
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  hasRole: (...roles: string[]) => boolean
  isAtLeast: (role: string) => boolean
}

const ROLE_HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 7, ADMIN: 6, MANAGER: 5, EMPLOYEE: 4,
  TELECALLER: 3, MARKETING_EXECUTIVE: 2, CLIENT: 1,
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Login failed')
        return false
      }
      setUser(data.user)
      toast.success(`Welcome back, ${data.user.name}!`)
      return true
    } catch {
      toast.error('Network error')
      return false
    }
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.push('/login')
  }

  const refreshUser = fetchUser

  const hasRole = (...roles: string[]) => !!user && roles.includes(user.role)

  const isAtLeast = (role: string) => {
    if (!user) return false
    return (ROLE_HIERARCHY[user.role] || 0) >= (ROLE_HIERARCHY[role] || 0)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, hasRole, isAtLeast }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
