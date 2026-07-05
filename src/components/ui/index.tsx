'use client'
import React, { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { ChevronLeft, ChevronRight, AlertCircle, Search, X, Loader2 } from 'lucide-react'

// Badge
export function Badge({ status, className = '' }: { status?: string; className?: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700', INACTIVE: 'bg-gray-100 text-gray-600',
    PENDING: 'bg-yellow-100 text-yellow-700', APPROVED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700', PRESENT: 'bg-green-100 text-green-700',
    ABSENT: 'bg-red-100 text-red-700', HALF_DAY: 'bg-yellow-100 text-yellow-700',
    LEAVE: 'bg-purple-100 text-purple-700', PAID: 'bg-green-100 text-green-700',
    UNPAID: 'bg-gray-100 text-gray-600', OVERDUE: 'bg-red-100 text-red-700',
    PARTIAL: 'bg-orange-100 text-orange-700', DRAFT: 'bg-gray-100 text-gray-600',
    SENT: 'bg-blue-100 text-blue-700', VIEWED: 'bg-purple-100 text-purple-700',
    ACCEPTED: 'bg-green-100 text-green-700', CONVERTED: 'bg-emerald-100 text-emerald-700',
    CLOSED: 'bg-gray-100 text-gray-600', NEW: 'bg-blue-100 text-blue-700',
    FOLLOW_UP: 'bg-yellow-100 text-yellow-700', MEETING: 'bg-indigo-100 text-indigo-700',
    PROPOSAL: 'bg-cyan-100 text-cyan-700', OPEN: 'bg-blue-100 text-blue-700',
    RESOLVED: 'bg-green-100 text-green-700', WEBSITE: 'bg-blue-100 text-blue-700',
    REFERRAL: 'bg-purple-100 text-purple-700', SOCIAL_MEDIA: 'bg-pink-100 text-pink-700',
    COLD_CALL: 'bg-orange-100 text-orange-700', EMAIL: 'bg-cyan-100 text-cyan-700',
    // Ticket statuses
    IN_PROGRESS: 'bg-amber-100 text-amber-700', REOPENED: 'bg-orange-100 text-orange-700',
    // Priorities
    LOW: 'bg-slate-100 text-slate-600', MEDIUM: 'bg-blue-100 text-blue-700',
    HIGH: 'bg-orange-100 text-orange-700', URGENT: 'bg-red-100 text-red-700',
    // Lead statuses (uppercase enum)
    NOT_INTERESTED: 'bg-red-100 text-red-700', RINGING: 'bg-yellow-100 text-yellow-700',
    MEETING_SCHEDULED: 'bg-indigo-100 text-indigo-700', CALLBACK: 'bg-purple-100 text-purple-700',
    // Service statuses
    EXPIRED: 'bg-red-100 text-red-700', PAUSED: 'bg-gray-100 text-gray-600',
    CANCELLED: 'bg-gray-100 text-gray-600', RENEWING: 'bg-blue-100 text-blue-700',
    OTHER: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`badge ${map[status || ''] || 'bg-gray-100 text-gray-600'} ${className}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  )
}

// Button
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}
export function Button({ variant = 'primary', size = 'md', loading, children, className = '', disabled, ...props }: ButtonProps) {
  const v = { primary: 'btn-primary', secondary: 'btn-secondary', danger: 'btn-danger', ghost: 'btn-ghost', success: 'btn-success' }
  const s = { sm: 'btn-sm', md: '', lg: 'btn-lg' }
  return (
    <button className={`${v[variant]} ${s[size]} ${className}`} disabled={disabled || loading} {...props}>
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}

// Input
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}
export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className={`${className}`}>
      {label && <label className="label">{label}</label>}
      <input className={`input ${error ? 'border-red-400 focus:border-red-400' : ''}`} {...props} />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

// Select
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
}
export function Select({ label, options, className = '', ...props }: SelectProps) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <select className="input" {...props}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// Textarea
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}
export function Textarea({ label, className = '', ...props }: TextareaProps) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <textarea className="input resize-none" {...props} />
    </div>
  )
}

// Modal
export function Modal({ open, onClose, title, children, className = '' }: {
  open: boolean; onClose: () => void; title?: string; children: ReactNode; className?: string
}) {
  if (!open) return null
  return (
    <div className="modal-overlay !mt-0" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal-content max-w-6xl ${className}`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// Pagination
export function Pagination({ page, totalPages, onPageChange, onChange }: { page: number; totalPages: number; onPageChange?: (p: number) => void; onChange?: (p: number) => void }) {
  if (totalPages <= 1) return null
  const go = onPageChange || onChange || (() => {})
  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
      <div className="flex gap-1">
        <button onClick={() => go(page - 1)} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30">
          <ChevronLeft size={16} />
        </button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          const p = totalPages <= 7 ? i + 1 : (page <= 4 ? i + 1 : page - 3 + i)
          if (p < 1 || p > totalPages) return null
          return (
            <button key={p} onClick={() => go(p)}
              className={`w-8 h-8 rounded-lg text-sm ${p === page ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-600'}`}>
              {p}
            </button>
          )
        })}
        <button onClick={() => go(page + 1)} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

// EmptyState
export function EmptyState({ title, description, action, icon: iconProp }: {
  title: string; description?: string; action?: ReactNode; icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3 text-gray-400">
        {iconProp || <AlertCircle size={22} />}
      </div>
      <h3 className="font-semibold text-gray-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-400 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// SearchInput
export function SearchInput({ value, onChange, placeholder = 'Search...' }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="relative flex-1 max-w-xs">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        className="input pl-9 pr-8"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          <X size={14} />
        </button>
      )}
    </div>
  )
}

// StatCard  
export function StatCard({ label, value, icon: Icon, color, change, sub }: {
  label: string; value: string | number; icon: React.ElementType;
  color: string; change?: string; sub?: string
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color.replace('text-', 'bg-').replace('-600', '-50').replace('-700', '-50').replace('-500', '-50')}`}>
          <Icon size={19} className={color} />
        </div>
      </div>
      {change && <p className="text-xs text-green-600 mt-2 font-medium">{change}</p>}
    </div>
  )
}

// Spinner
export function Spinner({ size = 20 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin text-blue-600" />
}

// ConfirmDialog
export function ConfirmDialog({ open, onClose, onConfirm, title, message, danger }: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message: string; danger?: boolean
}) {
  if (!open) return null
  return (
    <Modal open={open} onClose={onClose} title={title} className="max-w-sm">
      <p className="text-sm text-gray-600 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose() }}>Confirm</Button>
      </div>
    </Modal>
  )
}
