import { AxiosInstance } from '../lib/Axios.instance';

// All employee (marketing person) calls hit the new CRM /mobile/* endpoints.
export const EmployeeAPI = {
  // Auth
  login: (email, password) => AxiosInstance.post('/mobile/auth/login', { email, password }),

  // Dashboard + profile
  getDashboard: () => AxiosInstance.get('/mobile/dashboard'),
  getProfile: () => AxiosInstance.get('/mobile/profile'),

  // Attendance / tracking session
  getAttendanceStatus: () => AxiosInstance.get('/mobile/attendance/status'),
  checkIn: (loc) => AxiosInstance.post('/mobile/attendance/check-in', loc || {}),
  checkOut: (loc) => AxiosInstance.post('/mobile/attendance/check-out', loc || {}),

  // Clients
  getClients: () => AxiosInstance.get('/mobile/clients'),
  createClient: (data) => AxiosInstance.post('/mobile/clients', data),
  getClientById: (id) => AxiosInstance.get(`/mobile/clients/${id}`),

  // Packages + service assignment
  getPackages: () => AxiosInstance.get('/mobile/packages'),
  assignService: (data) => AxiosInstance.post('/mobile/assign-service', data),

  // Visits
  getVisits: () => AxiosInstance.get('/mobile/visits'),
  createVisit: (data) => AxiosInstance.post('/mobile/visits', data),
  startVisit: (id, loc) => AxiosInstance.post(`/mobile/visits/${id}/start`, loc || {}),
  completeVisit: (id, loc) => AxiosInstance.post(`/mobile/visits/${id}/complete`, loc || {}),

  // Location ping (used internally by LocationTracker too)
  sendLocation: (pings) => AxiosInstance.post('/mobile/location', { pings }),
};
