import { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
// Import the tracker so its background TaskManager task is registered at app launch.
// (expo-task-manager requires the task to be defined in the global scope on start.)
import './src/services/LocationTracker';
import { setupAndroidChannel } from './src/services/push';

// Status bar icon color must follow the app's own manual dark-mode toggle
// (ThemeContext), NOT the OS color scheme — "auto" was reading the device's
// system theme, so on screens with no per-screen <StatusBar>, the icons/time
// rendered in the wrong color and became invisible against a dark background.
function AppStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function App() {
  const navRef = useRef(null);

  useEffect(() => {
    setupAndroidChannel();

    const route = (data) => {
      if (!navRef.current || !data) return;
      const { screen, leadId, link } = data;
      try {
        // The server now sends an explicit `screen` in the push payload —
        // prefer it, and fall back to the old link sniffing for older messages.
        if (screen === 'MeetingDetail' && leadId) {
          navRef.current.navigate('MeetingDetail', { id: leadId, meetingId: leadId });
          return;
        }
        if (screen === 'Visits') {
          navRef.current.navigate('Visits', { refresh: Date.now() });
          return;
        }
        if (screen) {
          navRef.current.navigate(screen, { refresh: Date.now() });
          return;
        }
        if (!link) return;
        if (link.includes('visit')) {
          navRef.current.navigate('Visits', { refresh: Date.now() });
        } else if (link.includes('lead') || link.includes('meeting') || link.includes('marketing')) {
          navRef.current.navigate('Meetings', { refresh: Date.now() });
        } else if (link.includes('ticket')) {
          navRef.current.navigate('Notifications');
        } else if (link.includes('invoice') || link.includes('payment')) {
          navRef.current.navigate('Payments');
        }
      } catch {}
    };

    // Tap on a notification while the app is running
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      route(response?.notification?.request?.content?.data);
    });

    // App opened from a cold start by tapping a notification
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) setTimeout(() => route(response.notification?.request?.content?.data), 600);
      })
      .catch(() => {});

    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppStatusBar />
          <AppNavigator navRef={navRef} />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}