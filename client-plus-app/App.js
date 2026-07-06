import { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
// Import the tracker so its background TaskManager task is registered at app launch.
// (expo-task-manager requires the task to be defined in the global scope on start.)
import './src/services/LocationTracker';
import { setupAndroidChannel } from './src/services/push';

export default function App() {
  const navRef = useRef(null);

  useEffect(() => {
    setupAndroidChannel();

    // Tap on a notification → route where possible
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const link = response?.notification?.request?.content?.data?.link;
      // Deep-link mapping is best-effort; the app opens and shows the relevant tab.
      if (link && navRef.current) {
        try {
          if (link.includes('ticket')) navRef.current.navigate('Notifications');
          else if (link.includes('invoice') || link.includes('payment')) navRef.current.navigate('Payments');
        } catch {}
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <StatusBar style="auto" />
          <AppNavigator navRef={navRef} />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
