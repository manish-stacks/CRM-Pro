// src/services/push.js
// Firebase/Expo push notifications.
// - registerForPush(): asks permission, gets the Expo push token (delivered via
//   FCM on Android / APNs on iOS) and sends it to the CRM (/mobile/push-token).
// - setupPushHandler(): foreground display + tap handling.
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { AxiosInstance } from '../lib/Axios.instance';

// Show notifications while the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E50914',
    }).catch(() => {});
  }
}

// Register device + push token with the backend. Call after a successful login.
export async function registerForPush() {
  try {
    await setupAndroidChannel();

    if (!Device.isDevice) return null; // no push on simulators

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId;

    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenResp.data;
    if (token) {
      await AxiosInstance.post('/mobile/push-token', { token }).catch(() => {});
    }
    return token;
  } catch (e) {
    return null;
  }
}

// Tell the backend to forget this device (call on logout).
export async function unregisterPush() {
  try { await AxiosInstance.delete('/mobile/push-token'); } catch {}
}
