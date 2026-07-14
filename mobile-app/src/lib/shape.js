// src/lib/shape.js
// The client-portal API returns raw DB records (serviceName, status:'ACTIVE',
// expiryDate:Date, totalAmount, ...). The RN screens were built to render a
// "presentation" shape (name, status:'active', renewalDate, progress, icon...).
// We shape on the app side so the shared web+mobile endpoints stay untouched.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}

export function fmtMoney(n) {
  const v = Number(n || 0);
  return `₹${v.toLocaleString('en-IN')}`;
}

const ICON_MAP = {
  SEO: '🔍', MARKETING: '📣', DEVELOP: '💻', WEB: '🌐', DESIGN: '🎨',
  SOCIAL: '📱', HOST: '🖥️', DOMAIN: '🔗', AD: '📊', APP: '📲',
};
function iconFor(name, category) {
  const key = `${category || ''} ${name || ''}`.toUpperCase();
  for (const k of Object.keys(ICON_MAP)) if (key.includes(k)) return ICON_MAP[k];
  return '📦';
}

const ICON_BG = ['#EEF2FF', '#ECFEFF', '#FEF2F2', '#F0FDF4', '#FFF7ED'];

// active | expiring (<=30d) | critical (<=7d) | expired
export function serviceStatus(cs) {
  if (cs?.status === 'CANCELLED' || cs?.status === 'EXPIRED') return 'expired';
  if (!cs?.expiryDate) return 'active';
  const days = Math.ceil((new Date(cs.expiryDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'expired';
  if (days <= 7) return 'critical';
  if (days <= 30) return 'expiring';
  return 'active';
}

function progressPct(start, expiry) {
  if (!start || !expiry) return 0;
  const s = new Date(start).getTime();
  const e = new Date(expiry).getTime();
  if (e <= s) return 0;
  const pct = Math.round(((Date.now() - s) / (e - s)) * 100);
  return Math.max(0, Math.min(100, pct));
}

export function shapeService(cs) {
  return {
    ...cs, // keep raw fields (serviceName, expiryDate, billingCycle...) for detail screens
    id: cs.id,
    name: cs.serviceName,
    type: cs.category || cs.billingCycle || 'Service',
    status: serviceStatus(cs),
    icon: iconFor(cs.serviceName, cs.category),
    iconBg: ICON_BG[(cs.serviceName?.length || 0) % ICON_BG.length],
    startDate: fmtDate(cs.startDate),
    renewalDate: fmtDate(cs.expiryDate),
    progress: progressPct(cs.startDate, cs.expiryDate),
    amount: fmtMoney(cs.amount),
    amountRaw: cs.amount ?? 0,
  };
}

export function shapeInvoice(inv) {
  // Matches web's 4 invoice statuses (see Invoice.status in schema.prisma):
  // DRAFT/PENDING -> pending, PARTIAL -> partial, PAID -> paid, OVERDUE -> overdue
  const status =
    inv.status === 'PAID' ? 'paid' :
    inv.status === 'PARTIAL' ? 'partial' :
    inv.status === 'OVERDUE' ? 'overdue' : 'pending';
  return {
    ...inv,
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    service: inv.invoiceNumber, // shown as the card title
    amount: fmtMoney(inv.totalAmount),
    amountRaw: inv.totalAmount ?? 0,
    totalAmount: inv.totalAmount ?? 0,
    paidAmount: inv.paidAmount ?? 0,
    paidAmountFmt: fmtMoney(inv.paidAmount),
    dueAmount: inv.dueAmount ?? 0,
    dueAmountFmt: fmtMoney(inv.dueAmount),
    date: fmtDate(inv.createdAt),
    dueDate: inv.dueDate ? fmtDate(inv.dueDate) : null,
    status,
  };
}

export function shapeTicket(t) {
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    title: t.subject,
    subject: t.subject,
    description: t.description,
    priority: t.priority,
    // Screens' ticketStatusMap uses lowercase, no-underscore keys (open/inprogress/resolved)
    status: (t.status || '').toLowerCase().replace(/_/g, ''),
    statusRaw: t.status, // OPEN / IN_PROGRESS / RESOLVED / CLOSED / REOPENED (for badges matching web)
    date: fmtDate(t.createdAt),
    createdAt: t.createdAt,
    assignedToName: t.assignedTo?.name || null,
    replies: Array.isArray(t.replies) ? t.replies.map(r => ({
      id: r.id,
      body: (r.body || '').replace('[FROM CLIENT] ', ''),
      userName: r.user?.name || 'Support',
      createdAt: r.createdAt,
      date: fmtDate(r.createdAt),
    })) : [],
    repliesCount: Array.isArray(t.replies) ? t.replies.length : (t._count?.replies ?? 0),
  };
}