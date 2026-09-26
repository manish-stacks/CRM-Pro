import { AxiosInstance } from '../lib/Axios.instance';

// Client-side calls → new CRM /client-portal/* endpoints (Bearer token).
export const ClientAPI = {
  login: (email, password) => AxiosInstance.post('/mobile/client-login', { email, password }),

  getServices: () => AxiosInstance.get('/client-portal/services'),
  getServiceById: (id) => AxiosInstance.get(`/client-portal/services?id=${id}`),

  getInvoices: () => AxiosInstance.get('/client-portal/invoices'),
  getInvoiceById: (id) => AxiosInstance.get(`/client-portal/invoices/${id}`),
  // Public no-login PDF link for one of the client's own invoices/receipts —
  // safe to hand to Linking.openURL (opens the device's external browser).
  getInvoiceShareLink: (id) => AxiosInstance.get(`/client-portal/invoices/${id}/share-link`),

  getProfile: () => AxiosInstance.get('/client-portal/profile'),
  updateProfile: (data) => AxiosInstance.put('/client-portal/profile', data),
  uploadImage: (dataUrl) => AxiosInstance.post('/client-portal/upload', { dataUrl }),
  changePassword: (data) => AxiosInstance.post('/client-portal/change-password', data),

  getReports: () => AxiosInstance.get('/client-portal/reports'),

  getTickets: () => AxiosInstance.get('/client-portal/tickets'),
  createTicket: (data) => AxiosInstance.post('/client-portal/tickets', data),
  replyTicket: (id, body) => AxiosInstance.post(`/client-portal/tickets/${id}/replies`, { body }),

  getCompanyInfo: () => AxiosInstance.get('/client-portal/company-info'),

  // Payments (Razorpay)
  payInvoice: (id, data) => AxiosInstance.post(`/client-portal/invoices/${id}/pay`, data),
};
