import { AxiosInstance } from '../lib/Axios.instance';

// Helper: object -> query string (drops empty values)
const qs = (params) => {
  const p = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 'all') p.append(k, v);
  });
  const q = p.toString();
  return q ? `?${q}` : '';
};

// All employee (marketing person) calls hit the new CRM /mobile/* endpoints.
export const EmployeeAPI = {
  // Auth
  login: (email, password) => AxiosInstance.post('/mobile/auth/login', { email, password }),

  // Dashboard + profile
  getDashboard: () => AxiosInstance.get('/mobile/dashboard'),
  getProfile: () => AxiosInstance.get('/mobile/profile'),
  updateProfile: (data) => AxiosInstance.patch('/mobile/profile', data),
  changePassword: (data) => AxiosInstance.post('/mobile/profile/change-password', data),
  uploadImage: (dataUrl, folder = 'avatars') => AxiosInstance.post('/upload', { dataUrl, folder }),

  // Today's + upcoming birthdays/work-anniversaries
  getCelebrations: () => AxiosInstance.get('/mobile/celebrations'),
  
  // Attendance / tracking session
  getAttendanceStatus: () => AxiosInstance.get('/mobile/attendance/status'),
  checkIn: (loc) => AxiosInstance.post('/mobile/attendance/check-in', loc || {}),
  checkOut: (loc) => AxiosInstance.post('/mobile/attendance/check-out', loc || {}),

  // Clients
  // params: { range, date, dateFrom, dateTo, status, expiry, search }
  getClients: (params) => AxiosInstance.get(`/mobile/clients${qs(params)}`),
  createClient: (data) => AxiosInstance.post('/mobile/clients', data),
  getClientById: (id) => AxiosInstance.get(`/mobile/clients/${id}`),

  // Packages + service assignment
  getPackages: () => AxiosInstance.get('/mobile/packages'),
  assignService: (data) => AxiosInstance.post('/mobile/assign-service', data),

  // Proposals & Invoices (client deal paperwork)
  getProposals: (clientId) => AxiosInstance.get(`/mobile/proposals${clientId ? `?clientId=${clientId}` : ''}`),
  createProposal: (data) => AxiosInstance.post('/mobile/proposals', data),
  getInvoices: (clientId) => AxiosInstance.get(`/mobile/invoices${clientId ? `?clientId=${clientId}` : ''}`),
  createInvoice: (data) => AxiosInstance.post('/mobile/invoices', data),

  // Payments Received
  getPayments: (clientId) => AxiosInstance.get(`/mobile/payments${clientId ? `?clientId=${clientId}` : ''}`),
  collectPayment: (data) => AxiosInstance.post('/mobile/payments', data),

  // Meetings assigned to this marketing executive
  // params: { range, date, dateFrom, dateTo, status, search, lat, lng }
  // Send lat/lng to get distance + ETA for each meeting
  getMeetings: (params) => AxiosInstance.get(`/mobile/meetings${qs(params)}`),
  getMeetingById: (id) => AxiosInstance.get(`/mobile/meetings/${id}`),
  logMeetingActivity: (id, data) => AxiosInstance.post(`/mobile/meetings/${id}/activity`, data),
  closeMeeting: (id, data) => AxiosInstance.post(`/mobile/meetings/${id}/close`, data),

  // Visits
  // params: { range, status, date, dateFrom, dateTo, search }
  getVisits: (params) => AxiosInstance.get(`/mobile/visits${qs(params)}`),
  createVisit: (data) => AxiosInstance.post('/mobile/visits', data),
  startVisit: (id, loc) => AxiosInstance.post(`/mobile/visits/${id}/start`, loc || {}),
  completeVisit: (id, loc) => AxiosInstance.post(`/mobile/visits/${id}/complete`, loc || {}),

  // Location ping (used internally by LocationTracker too)
  sendLocation: (pings) => AxiosInstance.post('/mobile/location', { pings }),

  // Leaves
  getLeaves: () => AxiosInstance.get('/mobile/leaves'),
  applyLeave: (data) => AxiosInstance.post('/mobile/leaves', data),
  getLeaveBalance: () => AxiosInstance.get('/mobile/leaves/balance'),

  // Public share links (proposal / invoice / payment receipt) — for direct browser redirect
  getProposalShareLink: (proposalId) => AxiosInstance.get(`/proposals/${proposalId}/share-link`),
  getInvoiceShareLink: (invoiceId) => AxiosInstance.get(`/invoices/${invoiceId}/share-link`),
  getPaymentReceiptLink: (paymentId) => AxiosInstance.get(`/payments/receipt-link/${paymentId}`),
};