'use client'
import Link from 'next/link'
import {
  Package, FileText, MessageSquare, Phone, Mail, CheckCircle2, Plus,
  ArrowRight, ShieldCheck, Wallet, AlertTriangle, TrendingUp,
} from 'lucide-react'
import { useClientPortal } from './context'

export default function OverviewPage() {
  const {
    client, invoices, reportingPerson, expiring, activeServices, totalPaid, totalDue,
    openTickets, fmt, waLink, greeting, statusPill, openPay, setTicketModal,
  } = useClientPortal()

  return (
    <div className="space-y-5">
      {/* Greeting hero */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white p-6 relative overflow-hidden">
        <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <p className="text-indigo-100 text-sm">{greeting()},</p>
          <h1 className="text-2xl font-bold mt-0.5">{client?.clientName || client?.companyName} 👋</h1>
          <p className="text-indigo-100 text-sm mt-1">Here's what's happening with your account.</p>
        </div>
      </div>

      {/* Expiring alert */}
      {expiring.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-amber-800">
            <b>{expiring.length} service{expiring.length > 1 ? 's' : ''}</b> expiring within 30 days.{' '}
            <Link href="/client-portal/services" className="underline font-medium">Review now</Link>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Active Services', value: activeServices, icon: Package, s: { chip: 'bg-indigo-100 text-indigo-600', val: 'text-indigo-600' } },
          { label: 'Total Paid', value: fmt(totalPaid), icon: CheckCircle2, s: { chip: 'bg-emerald-100 text-emerald-600', val: 'text-emerald-600' } },
          { label: 'Amount Due', value: fmt(totalDue), icon: Wallet, s: totalDue > 0 ? { chip: 'bg-red-100 text-red-600', val: 'text-red-600' } : { chip: 'bg-gray-100 text-gray-500', val: 'text-gray-900' } },
          { label: 'Open Tickets', value: openTickets, icon: MessageSquare, s: openTickets > 0 ? { chip: 'bg-amber-100 text-amber-600', val: 'text-amber-600' } : { chip: 'bg-gray-100 text-gray-500', val: 'text-gray-900' } },
        ].map((c: any) => (
          <div key={c.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${c.s.chip}`}>
              <c.icon size={17} />
            </div>
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${c.s.val}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Recent invoices */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-gray-900">Recent Invoices</h3>
            <Link href="/client-portal/invoices" className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5">View all <ArrowRight size={11} /></Link>
          </div>
          <div className="divide-y divide-gray-50">
            {invoices.length === 0 ? (
              <p className="p-8 text-center text-gray-400 text-sm">No invoices yet</p>
            ) : invoices.slice(0, 5).map((inv: any) => (
              <div key={inv.id} className="px-5 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"><FileText size={15} /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900">{inv.invoiceNumber}</p>
                  <p className="text-xs text-gray-400">Due: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN') : 'On receipt'}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">{fmt(inv.totalAmount)}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusPill(inv.status)}`}>{inv.status}</span>
                </div>
                {inv.dueAmount > 0 && (
                  <button onClick={() => openPay(inv)} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-medium">Pay</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Account manager */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-400 mb-3 flex items-center gap-1"><ShieldCheck size={13} /> YOUR ACCOUNT MANAGER</p>
          {reportingPerson ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-bold text-lg">
                  {reportingPerson.name?.[0]}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{reportingPerson.name}</p>
                  <p className="text-xs text-gray-400 truncate">{reportingPerson.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <a href={`tel:${reportingPerson.phone}`} className="flex flex-col items-center gap-1 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs"><Phone size={15} /> Call</a>
                <a href={`mailto:${reportingPerson.email}`} className="flex flex-col items-center gap-1 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs"><Mail size={15} /> Email</a>
                <a href={waLink(reportingPerson.phone)} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 text-xs"><MessageSquare size={15} /> WhatsApp</a>
              </div>
            </>
          ) : <p className="text-sm text-gray-400">Not assigned yet</p>}
          <button onClick={() => setTicketModal(true)} className="w-full mt-4 border border-dashed border-gray-300 rounded-xl py-2.5 text-sm text-gray-600 hover:border-indigo-400 hover:text-indigo-600 flex items-center justify-center gap-1.5">
            <Plus size={14} /> Raise a support ticket
          </button>
        </div>
      </div>
    </div>
  )
}
