'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import api from '@/lib/axios'
import { AlertCircle, Package, Calendar, ArrowRight } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'

export function ExpiringServicesWidget() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/services/expiring?days=30')
      .then(r => setData(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || !data) return null
  if (data.total === 0) return null

  return (
    <div className="card p-5 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center text-white">
          <AlertCircle size={16} />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 text-sm">Services Expiring Soon</h3>
          <p className="text-xs text-gray-600">Next 30 days · {data.total} total</p>
        </div>
      </div>

      {data.urgent?.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-red-700 mb-1">🔥 Urgent (7 days)</p>
          <div className="space-y-1">
            {data.urgent.slice(0, 3).map((s: any) => (
              <Link key={s.id} href={`/clients/${s.client.id}`}
                className="flex items-center gap-2 text-xs bg-white rounded p-2 hover:shadow-sm">
                <Package size={11} className="text-red-500" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{s.serviceName}</p>
                  <p className="text-gray-500 truncate">{s.client.clientName}</p>
                </div>
                <span className="text-red-600 font-semibold whitespace-nowrap">
                  {formatDate(s.expiryDate)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {data.soon?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-700 mb-1">📅 Upcoming (8-30 days)</p>
          <div className="space-y-1">
            {data.soon.slice(0, 3).map((s: any) => (
              <Link key={s.id} href={`/clients/${s.client.id}`}
                className="flex items-center gap-2 text-xs bg-white rounded p-2 hover:shadow-sm">
                <Package size={11} className="text-amber-500" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{s.serviceName}</p>
                  <p className="text-gray-500 truncate">{s.client.clientName}</p>
                </div>
                <span className="text-amber-700 whitespace-nowrap">
                  {formatDate(s.expiryDate)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
