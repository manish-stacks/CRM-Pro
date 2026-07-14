import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

// ── New HBS CRM (Next.js) base URL ──
// Mobile endpoints live under /api/mobile/* and return { success, data, token }.
// Update this to your deployed CRM domain.
const BASE_URL = 'https://web-crm.hoverbusinessservices.com/api'; //'http://192.168.1.10:3000/api'

// React Native's default fetch/axios User-Agent doesn't look like a phone UA
// to server-side UA parsers, so the CRM was logging every app punch-in as
// "Desktop". We send explicit device headers instead so the server can
// identify the app correctly regardless of what the UA string says.
const mapDeviceType = () => {
  switch (Device.deviceType) {
    case Device.DeviceType.TABLET: return 'Tablet'
    case Device.DeviceType.DESKTOP: return 'Desktop'
    case Device.DeviceType.TV: return 'SmartTV'
    default: return 'Mobile'
  }
}

const deviceHeaders = {
  'X-Client-Platform': 'mobile-app',
  'X-Device-Type': mapDeviceType(),
  'X-Device-Model': Device.modelName || `${Platform.OS} device`,
  'X-Device-Os': `${Platform.OS === 'ios' ? 'iOS' : 'Android'}${Device.osVersion ? ' ' + Device.osVersion : ''}`,
};

const attachInterceptors = (instance) => {
  instance.interceptors.request.use(
    async (config) => {
      const token = await AsyncStorage.getItem('userToken');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      config.headers = { ...config.headers, ...deviceHeaders };
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
