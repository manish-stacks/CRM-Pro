'use client'
import { FileText, Download } from 'lucide-react'
import { useClientPortal } from '../context'

export default function InvoicesPage() {
  const { invoices, fmt, statusPill, openPay, downloadClientPdf } = useClientPortal()

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-4">My Invoices</h2>
      {invoices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400"><FileText size={34} className="mx-auto mb-2 text-gray-300" />No invoices yet</div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv: any) => (
            <div key={inv.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500"><FileText size={17} /></div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{inv.invoiceNumber}</p>
                <p className="text-xs text-gray-500">Total {fmt(inv.totalAmount)}{inv.paidAmount > 0 && <> · Paid {fmt(inv.paidAmount)}</>}{inv.dueDate && <> · Due date {new Date(inv.dueDate).toLocaleDateString('en-IN')}</>}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900">{fmt(inv.totalAmount)}</p>
                {inv.dueAmount > 0 && <p className="text-[11px] text-red-600 font-medium">Due {fmt(inv.dueAmount)}</p>}
                <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium ${statusPill(inv.status)}`}>{inv.status}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => downloadClientPdf(inv)} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg flex items-center gap-1 font-medium"><Download size={13} /> PDF</button>
                {inv.dueAmount > 0 && <button onClick={() => openPay(inv)} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium">Pay</button>}
              </div>

              {/* Visible to admin + marketing executive via the public link.*/}
              {inv.payments?.length > 0 && (
                <div className="w-full border-t border-gray-100 pt-3 mt-1 space-y-1.5">
                  <p className="text-[10px] font-semibold text-gray-400 tracking-wide">PAYMENT RECEIPTS</p>
                  {inv.payments.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-3 flex-wrap text-xs">
                      <span className="font-semibold text-gray-900">{fmt(p.amount)}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                        {String(p.method || '').replace(/_/g, ' ')}
                      </span>
                      <span className="text-gray-400">
                        {new Date(p.paidAt || p.paid_at).toLocaleDateString('en-IN')}
                      </span>
                      {p.reference && <span className="text-gray-400">Ref: {p.reference}</span>}
                      {(p.receiptUrl || p.receipt_url) && (
                        <a
                          href={p.receiptUrl || p.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-auto text-emerald-600 hover:underline inline-flex items-center gap-1 font-medium"
                        >
                          <Download size={12} /> Receipt
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
