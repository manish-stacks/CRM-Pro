import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── New HBS CRM (Next.js) base URL ──
// Mobile endpoints live under /api/mobile/* and return { success, data, token }.
// Update this to your deployed CRM domain.
const BASE_URL = 'http://192.168.1.15:3000/api'//'https://crm.hoverbusinessservices.com/api';

const attachInterceptors = (instance) => {
  instance.interceptors.request.use(
    async (config) => {
      const token = await AsyncStorage.getItem('userToken');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    },
    (error) => Promise.reject(error)
  );

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const status = error.response?.status;
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Network error. Please check your connection.';
      if (status === 401 || status === 403) {
        await AsyncStorage.multiRemove(['userToken', 'userRole', 'userData']);
      }
      return Promise.reject({ status, message: errorMessage });
    }
  );
  return instance;
};

export const AxiosInstance = attachInterceptors(
  axios.create({ baseURL: BASE_URL, timeout: 30000, headers: { 'Content-Type': 'application/json' } })
);
