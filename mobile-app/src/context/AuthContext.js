import { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AxiosInstance } from '../lib/Axios.instance';
import { Alert } from 'react-native';
import { stopTracking } from '../services/LocationTracker';
import { registerForPush, unregisterPush } from '../services/push';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState(null); // 'client' | 'employee'
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    AsyncStorage.multiGet(['userToken', 'userRole', 'userData']).then(stores => {
      const token = stores[0][1];
      const savedRole = stores[1][1];
      const savedUser = stores[2][1];
      if (token && savedRole) {
        setIsLoggedIn(true);
        setRole(savedRole);
        if (savedUser) setUser(JSON.parse(savedUser));
        registerForPush().catch(() => {}); // refresh token on relaunch
      }
      setLoading(false);
    });
  }, []);

  const login = async (email, password, loginRole = 'client') => {
    try {
      // New CRM: staff use /mobile/auth/login, clients use /mobile/client-login
      const endpoint = loginRole === 'employee' ? '/mobile/auth/login' : '/mobile/client-login';
      const response = await AxiosInstance.post(endpoint, { email, password });

      const token = response.data.token;
      const userData = response.data.data || response.data.user || {};

      if (!token) {
        // Client portal uses cookie auth on web; for mobile we require a token.
        // If client login returns no token, surface a helpful message.
        Alert.alert('Login Failed', 'This account type is not enabled for the app yet.');
        return false;
      }

      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userRole', loginRole);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));

      setUser(userData);
      setRole(loginRole);
      setIsLoggedIn(true);
      // Register this device for push notifications (fire-and-forget)
      registerForPush().catch(() => {});
      return true;
    } catch (error) {
      Alert.alert('Login Failed', error.message || 'Invalid credentials');
      return false;
    }
  };

  const logout = async () => {
    try { await stopTracking(); } catch {}
    try { await unregisterPush(); } catch {}
    await AsyncStorage.multiRemove(['userToken', 'userRole', 'userData', 'attendanceId', 'isCheckedIn']);
    setIsLoggedIn(false);
    setRole(null);
    setUser(null);
  };

  const getUserData = async () => {
    const data = await AsyncStorage.getItem('userData');
    return data ? JSON.parse(data) : null;
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, loading, login, logout, role, user, userData: getUserData }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
