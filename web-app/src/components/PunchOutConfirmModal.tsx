// src/components/PunchOutConfirmModal.tsx
// Shared "are you sure you want to punch out?" dialog.
//
// Punching out closes the working day and cannot be undone by the employee,
// so a mis-click used to silently end someone's shift. This is used by BOTH
// punch widgets — the one on /dashboard and the one on /attendance — because
// people punch out from either page.
//
// window.confirm() was the first attempt but browsers can suppress it (and it
// looks nothing like the rest of the CRM), so this is a real modal.
'use client'
import { Modal, Button } from '@/components/ui'
import { LogOut, AlertTriangle, Clock } from 'lucide-react'

const fmtTime = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'

export function PunchOutConfirmModal({
  open,
  onClose,
  onConfirm,
  loading = false,
  punchInAt,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
  punchInAt?: string | Date | null
}) {
  // Live worked duration so the person can see what they're closing out.
  let worked = ''
  if (punchInAt) {
    const mins = Math.max(0, Math.floor((Date.now() - new Date(punchInAt).getTime()) / 60000))
    worked = `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  return (
    <Modal open={open} onClose={onClose} title="Punch Out?" className="!max-w-md">
      <div className="space-y-4">
        <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">This ends your working day.</p>
            <p className="text-xs mt-1">
              Once you punch out you <b>cannot punch in again today.</b> Only continue if you are actually leaving.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Clock size={14} /> Punched in at
          </div>
          <span className="font-semibold text-gray-900">{fmtTime(punchInAt)}</span>
        </div>
        {worked && (
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 text-sm">
            <span className="text-gray-600">Worked so far</span>
            <span className="font-semibold text-gray-900">{worked}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            No, keep working
          </Button>
          <Button onClick={onConfirm} loading={loading} className="!bg-gray-800 hover:!bg-gray-900">
            <LogOut size={14} /> Yes, Punch Out
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default PunchOutConfirmModal
