import { AxiosInstance } from '../lib/Axios.instance';

// Client-side calls → new CRM /client-portal/* endpoints (Bearer token).
export const ClientAPI = {
  login: (email, password) => AxiosInstance.post('/mobile/client-login', { email, password }),

  getServices: () => AxiosInstance.get('/client-portal/services'),
  getServiceById: (id) => AxiosInstance.get(`/client-portal/services?id=${id}`),

  getInvoices: () => AxiosInstance.get('/client-portal/invoices'),
  getInvoiceById: (id) => AxiosInstance.get(`/client-portal/invoices/${id}`),

  getProfile: () => AxiosInstance.get('/client-portal/profile'),
  updateProfile: (data) => AxiosInstance.put('/client-portal/profile', data),

  getReports: () => AxiosInstance.get('/client-portal/reports'),

  getTickets: () => AxiosInstance.get('/client-portal/tickets'),
  createTicket: (data) => AxiosInstance.post('/client-portal/tickets', data),
  replyTicket: (id, body) => AxiosInstance.post(`/client-portal/tickets/${id}/replies`, { body }),

  getCompanyInfo: () => AxiosInstance.get('/client-portal/company-info'),

  // Payments (Razorpay)
  payInvoice: (id, data) => AxiosInstance.post(`/client-portal/invoices/${id}/pay`, data),
};
