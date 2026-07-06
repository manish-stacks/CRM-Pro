export const SERVICES = [
  {
    id: '1',
    name: 'SEO Optimization',
    type: 'Search Engine Optimization',
    icon: '🔍',
    iconBg: 'rgba(59,130,246,0.1)',
    status: 'active',      // 'active' | 'expiring' | 'critical' | 'expired'
    startDate: 'Mar 15, 2025',
    renewalDate: 'Mar 15, 2026',
    plan: 'Premium SEO',
    monthlyValue: '₹18,000',
    progress: 75,
    manager: { name: 'Priya Kapoor', initials: 'PK', role: 'SEO Specialist' },
    chartData: [1200, 1850, 2100, 2450, 2800, 3400],
    chartLabels: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    reports: [
      { month: 'December 2025', generated: 'Jan 01, 2026' },
      { month: 'November 2025', generated: 'Dec 01, 2025' },
      { month: 'October 2025',  generated: 'Nov 01, 2025' },
    ],
  },
  {
    id: '2',
    name: 'GMB Management',
    type: 'Google My Business',
    icon: '📍',
    iconBg: 'rgba(234,179,8,0.1)',
    status: 'active',
    startDate: 'Jun 01, 2025',
    renewalDate: 'Jun 01, 2026',
    plan: 'GMB Pro',
    monthlyValue: '₹9,500',
    progress: 55,
    manager: { name: 'Arjun Mehta', initials: 'AM', role: 'GMB Specialist' },
    chartData: [200, 320, 410, 390, 520, 610],
    chartLabels: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    reports: [
      { month: 'December 2025', generated: 'Jan 01, 2026' },
    ],
  },
  {
    id: '3',
    name: 'Website Maintenance',
    type: 'Web Development & Support',
    icon: '🌐',
    iconBg: 'rgba(168,85,247,0.1)',
    status: 'expiring',
    startDate: 'Jan 15, 2025',
    renewalDate: 'Jan 15, 2026',
    plan: 'Maintenance Basic',
    monthlyValue: '₹12,000',
    progress: 82,
    manager: { name: 'Sneha Patel', initials: 'SP', role: 'Web Developer' },
    chartData: [],
    chartLabels: [],
    reports: [],
  },
  {
    id: '4',
    name: 'SSL & Hosting',
    type: 'Cloud Hosting Plan',
    icon: '🔒',
    iconBg: 'rgba(34,197,94,0.1)',
    status: 'critical',
    startDate: 'Jan 02, 2025',
    renewalDate: 'Jan 02, 2026',
    plan: 'Shared Cloud Hosting',
    monthlyValue: '₹6,000',
    progress: 96,
    manager: { name: 'Vikram Singh', initials: 'VS', role: 'DevOps Engineer' },
    chartData: [],
    chartLabels: [],
    reports: [],
  },
];

export const INVOICES = [
  { id: 'INV-2025-001', service: 'SEO Optimization',    amount: '₹18,000', date: 'Dec 15, 2025', status: 'paid'    },
  { id: 'INV-2025-002', service: 'Website Maintenance', amount: '₹12,000', date: 'Jan 15, 2026', status: 'pending' },
  { id: 'INV-2025-003', service: 'GMB Management',      amount: '₹9,500',  date: 'Dec 01, 2025', status: 'paid'    },
  { id: 'INV-2025-004', service: 'SSL & Hosting',       amount: '₹6,000',  date: 'Nov 15, 2025', status: 'paid'    },
];

export const PROPOSALS = [
  {
    id: 'P1',
    title: 'Social Media Marketing Package',
    price: '₹25,000/mo',
    sent: 'Dec 28, 2025',
    status: 'new',
    desc: 'Comprehensive social media strategy including content creation, daily posting (Instagram + LinkedIn), ad management, and monthly performance reports.',
  },
  {
    id: 'P2',
    title: 'PPC Google Ads Management',
    price: '₹15,000/mo',
    sent: 'Dec 20, 2025',
    status: 'pending',
    desc: 'Google Ads setup and management for lead generation. Includes keyword research, ad copywriting, A/B testing, and weekly reports.',
  },
  {
    id: 'P3',
    title: 'Website Redesign Project',
    price: '₹80,000',
    sent: 'Nov 10, 2025',
    status: 'accepted',
    desc: 'Complete website redesign with modern UI, mobile optimization, SEO-ready architecture, and 3-month post-launch support.',
  },
];

export const TICKETS = [
  { id: 'TKT-001', title: 'Website loading slow after update',      status: 'inprogress', date: 'Dec 20, 2025', replies: 2 },
  { id: 'TKT-002', title: 'GMB profile not showing updated hours',   status: 'resolved',   date: 'Dec 12, 2025', replies: 5 },
  { id: 'TKT-003', title: 'SEO report not received for November',    status: 'open',       date: 'Dec 28, 2025', replies: 1 },
];

export const NOTIFICATIONS = [
  { id: 'N1', title: 'SSL & Hosting expiring in 5 days!', body: 'Your SSL & Hosting plan expires on Jan 02, 2026. Renew immediately to avoid downtime.', time: 'Today, 9:30 AM', type: 'danger', unread: true  },
  { id: 'N2', title: 'Payment confirmed ✓',               body: '₹9,500 payment for GMB Management has been received. Invoice #INV-2025-003 issued.',  time: 'Yesterday, 4:15 PM', type: 'success', unread: true  },
  { id: 'N3', title: 'December SEO report ready',         body: 'Your monthly SEO report for December 2025 is now available. Organic traffic up 23%!', time: 'Jan 01, 2026',       type: 'info',    unread: false },
  { id: 'N4', title: 'New proposal sent to you',          body: "We've sent you a Social Media Marketing proposal. Review and accept before Jan 10, 2026.", time: 'Dec 28, 2025',   type: 'purple',  unread: false },
  { id: 'N5', title: 'Website renewal reminder',          body: 'Website Maintenance plan expires in 18 days. Plan your renewal early.', time: 'Dec 27, 2025',                      type: 'warning', unread: false },
];