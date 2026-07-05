// src/app/(dashboard)/reports/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, Users, Target, DollarSign, Download, RefreshCw } from 'lucide-react'
import * as XLSX from 'xlsx'

interface ReportData {
  revenue: { month: string; revenue: number; count: number }[]
  attendance: { status: string; count: number }[]
  leads: {
    byStatus: { status: string; count: number }[]
    bySource: { source: string; count: number }[]
    conversionRate: number
  }
  totals: {
    totalRevenue: number
    totalEmployees: number
    totalLeads: number
    totalClients: number
    proposalSuccessRate: number
  }
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm">
        <p className="text-slate-400 mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.color }} className="font-medium">
            {entry.name}: {entry.name === 'Revenue' ? formatCurrency(entry.value) : entry.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('12')

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports?period=${period}`)
      const d = await res.json()
      setData(d.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [period])

  const exportRevenue = () => {
    if (!data) return
    const ws = XLSX.utils.json_to_sheet(data.revenue)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Revenue')
    XLSX.writeFile(wb, 'revenue-report.xlsx')
  }

  const exportLeads = () => {
    if (!data) return
    const ws = XLSX.utils.json_to_sheet(data.leads.byStatus)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Leads')
    XLSX.writeFile(wb, 'leads-report.xlsx')
  }

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Reports & Analytics</h1>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card p-4 h-24 skeleton" />)}
        </div>
        <div className="grid grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card p-4 h-64 skeleton" />)}
        </div>
      </div>
    )
  }

  const stats = [
    {
      label: 'Total Revenue',
      value: formatCurrency(data?.totals?.totalRevenue || 0),
      icon: <DollarSign size={20} className="text-green-400" />,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      label: 'Total Employees',
      value: data?.totals?.totalEmployees || 0,
      icon: <Users size={20} className="text-blue-400" />,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Total Leads',
      value: data?.totals?.totalLeads || 0,
      icon: <Target size={20} className="text-purple-400" />,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
    {
      label: 'Conversion Rate',
      value: `${data?.leads?.conversionRate?.toFixed(1) || 0}%`,
      icon: <TrendingUp size={20} className="text-amber-400" />,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">Business intelligence overview</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="input w-auto"
            value={period}
            onChange={e => setPeriod(e.target.value)}
          >
            <option value="3">Last 3 months</option>
            <option value="6">Last 6 months</option>
            <option value="12">Last 12 months</option>
          </select>
          <Button variant="ghost" onClick={fetchData}><RefreshCw size={15} /></Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                {stat.icon}
              </div>
            </div>
            <div className={`text-2xl font-display font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-display font-semibold text-slate-100">Revenue Overview</h2>
            <p className="text-sm text-slate-500">Monthly revenue trend</p>
          </div>
          <Button variant="ghost" size="sm" onClick={exportRevenue}>
            <Download size={14} />Export
          </Button>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data?.revenue || []}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" fill="url(#revenueGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Lead Pipeline */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-display font-semibold text-slate-100">Lead Pipeline</h2>
              <p className="text-xs text-slate-500">Leads by status</p>
            </div>
            <Button variant="ghost" size="sm" onClick={exportLeads}><Download size={14} /></Button>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.leads?.byStatus || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis dataKey="status" type="category" width={80} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Leads" radius={[0, 4, 4, 0]}>
                {data?.leads?.byStatus?.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Lead Sources */}
        <div className="card p-6">
          <div className="mb-4">
            <h2 className="text-base font-display font-semibold text-slate-100">Lead Sources</h2>
            <p className="text-xs text-slate-500">Where leads come from</p>
          </div>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data?.leads?.bySource || []} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="count" nameKey="source" paddingAngle={3}>
                  {data?.leads?.bySource?.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
                <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attendance Summary */}
        <div className="card p-6">
          <div className="mb-4">
            <h2 className="text-base font-display font-semibold text-slate-100">Attendance Summary</h2>
            <p className="text-xs text-slate-500">Overall attendance distribution</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data?.attendance || []} cx="50%" cy="50%" outerRadius={90} dataKey="count" nameKey="status" label={({ status, percent }) => `${status} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {data?.attendance?.map((entry, i) => {
                  const colorMap: Record<string, string> = { PRESENT: '#10b981', ABSENT: '#ef4444', HALF_DAY: '#f59e0b', LEAVE: '#8b5cf6' }
                  return <Cell key={i} fill={colorMap[entry.status] || COLORS[i % COLORS.length]} />
                })}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Table */}
        <div className="card p-6">
          <h2 className="text-base font-display font-semibold text-slate-100 mb-4">Performance Summary</h2>
          <div className="space-y-3">
            {[
              { label: 'Total Clients', value: data?.totals?.totalClients || 0, unit: 'clients' },
              { label: 'Proposal Success Rate', value: `${data?.totals?.proposalSuccessRate?.toFixed(1) || 0}%`, unit: '' },
              { label: 'Lead Conversion Rate', value: `${data?.leads?.conversionRate?.toFixed(1) || 0}%`, unit: '' },
              { label: 'Total Revenue (All Time)', value: formatCurrency(data?.totals?.totalRevenue || 0), unit: '' },
              { label: 'Active Employees', value: data?.totals?.totalEmployees || 0, unit: 'employees' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-800">
                <span className="text-sm text-slate-400">{item.label}</span>
                <span className="font-display font-bold text-slate-100">
                  {item.value} <span className="font-normal text-xs text-slate-500">{item.unit}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
