'use client'
import toast from 'react-hot-toast'
import {
  MessageSquare, Plus, Send, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useClientPortal } from '../context'

export default function TicketsPage() {
  const {
    tickets, setTicketModal, statusPill,
    ticketReply, setTicketReply, openThreads, setOpenThreads,
    ticketPage, setTicketPage, TICKETS_PAGE_SIZE, loadData,
  } = useClientPortal()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Support Tickets</h2>
        <button onClick={() => setTicketModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-medium"><Plus size={14} /> Raise Ticket</button>
      </div>
      {tickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <MessageSquare size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">No tickets yet. Raise one if you need help.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets
            .slice((ticketPage - 1) * TICKETS_PAGE_SIZE, ticketPage * TICKETS_PAGE_SIZE)
            .map((t: any) => {
              const replyCount = t.replies?.length || 0
              const threadOpen = !!openThreads[t.id]
              return (
                <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs text-gray-400">{t.ticketNumber}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${statusPill(t.status)}`}>{t.status}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">{t.priority}</span>
                    </div>
                    <p className="font-semibold text-gray-900">{t.subject}</p>
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{t.description}</p>
                    <p className="text-xs text-gray-400 mt-2">Assigned: {t.assignedTo?.name || 'Unassigned'} · {new Date(t.createdAt).toLocaleDateString('en-IN')}</p>
                  </div>
                  {replyCount > 0 && (
                    <button
                      onClick={() => setOpenThreads((p: any) => ({ ...p, [t.id]: !p[t.id] }))}
                      className="w-full flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50/50 border-b border-gray-50"
                    >
                      <MessageSquare size={13} />
                      <span className="flex-1 text-left">{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
                      {threadOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  )}
                  {threadOpen && replyCount > 0 && (
                    <div className="bg-slate-50 p-4 space-y-2">
                      {t.replies.map((r: any) => (
                        <div key={r.id} className="bg-white rounded-xl p-3 text-sm border border-gray-100">
                          <p className="text-xs font-semibold text-indigo-600 mb-1">{r.user?.name}</p>
                          <p className="whitespace-pre-wrap text-gray-700">{r.body?.replace('[FROM CLIENT] ', '')}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {t.status !== 'CLOSED' && (
                    <div className="p-3 border-t border-gray-50 flex gap-2">
                      <input type="text" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        placeholder="Write a reply..." value={ticketReply[t.id] || ''}
                        onChange={e => setTicketReply((p: any) => ({ ...p, [t.id]: e.target.value }))} />
                      <button onClick={async () => {
                        if (!ticketReply[t.id]?.trim()) return
                        const r = await fetch(`/api/client-portal/tickets/${t.id}/replies`, {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ body: ticketReply[t.id] }),
                        })
                        if (r.ok) { setTicketReply((p: any) => ({ ...p, [t.id]: '' })); setOpenThreads((p: any) => ({ ...p, [t.id]: true })); loadData(); toast.success('Reply sent') }
                      }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 rounded-xl text-sm flex items-center"><Send size={14} /></button>
                    </div>
                  )}
                </div>
              )
            })}

          {tickets.length > TICKETS_PAGE_SIZE && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                disabled={ticketPage === 1}
                onClick={() => setTicketPage((p: number) => Math.max(1, p - 1))}
                className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-gray-600 font-medium">
                Page {ticketPage} of {Math.max(1, Math.ceil(tickets.length / TICKETS_PAGE_SIZE))}
              </span>
              <button
                disabled={ticketPage >= Math.ceil(tickets.length / TICKETS_PAGE_SIZE)}
                onClick={() => setTicketPage((p: number) => Math.min(Math.ceil(tickets.length / TICKETS_PAGE_SIZE), p + 1))}
                className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
