'use client'
import { Package } from 'lucide-react'
import { useClientPortal } from '../context'

export default function ServicesPage() {
  const { services, fmt, statusPill, daysLeft } = useClientPortal()

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-4">My Services</h2>
      {services.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400"><Package size={34} className="mx-auto mb-2 text-gray-300" />No services yet</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {services.map((s: any) => {
            const dl = s.expiryDate ? daysLeft(s.expiryDate) : null
            const pct = dl !== null ? Math.max(0, Math.min(100, (dl / 365) * 100)) : 0
            return (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{s.serviceName}</p>
                    {s.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{s.description}</p>}
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-medium flex-shrink-0 ${statusPill(s.status)}`}>{s.status}</span>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <p className="text-lg font-bold text-gray-900">{fmt(s.amount)}</p>
                    <p className="text-[11px] text-gray-400">{s.billingCycle}</p>
                  </div>
                  {s.expiryDate && (
                    <div className="text-right">
                      <p className={`text-xs font-medium ${dl !== null && dl < 30 ? 'text-amber-600' : 'text-gray-600'}`}>
                        {dl !== null && dl < 0 ? `Expired ${-dl}d ago` : `${dl}d left`}
                      </p>
                      <p className="text-[11px] text-gray-400">{new Date(s.expiryDate).toLocaleDateString('en-IN')}</p>
                    </div>
                  )}
                </div>
                {s.expiryDate && dl !== null && (
                  <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full rounded-full ${dl < 0 ? 'bg-red-400' : dl < 30 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${dl < 0 ? 100 : pct}%` }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
