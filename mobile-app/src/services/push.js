// src/services/push.js
// Push notifications — now registers the NATIVE FCM registration token.
//
//  Android : Notifications.getDevicePushTokenAsync() returns the real Firebase
//            (FCM) registration token, because google-services.json is bundled
//            via app.json -> android.googleServicesFile. This is what the CRM
//            stores in users.fcmToken and sends to through the FCM HTTP v1 API.
//
//  iOS     : the native token is an APNs token, which FCM can't address without
//            a Firebase iOS app + APNs key uploaded. Until that exists we keep
//            using the Expo token on iOS — the server accepts both and picks
//            whichever the device registered.
//
// IMPORTANT: a native FCM token is only available in a real build
// (`eas build` / `expo run:android`). In Expo Go there is no Firebase app, so
// the code automatically falls back to the Expo token there.
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AxiosInstance } from '../lib/Axios.instance';

const LAST_TOKEN_KEY = 'pushTokenSent';

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
    // The channel id MUST be "default" — the server sends android.notification.
    // channel_id = "default" in every FCM payload. A mismatch means Android
    // silently drops the notification on Android 8+.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E50914',
      // NOTE: do NOT pass sound: 'default' here — expo-notifications treats this
      // string as a *custom* sound filename and logs "Custom sound 'default' not
      // found". Omitting it uses the system default notification sound.
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
    }).catch(() => {});
  }
}

/** Ask for (or confirm) notification permission. Returns true when granted. */
export async function ensurePermission() {
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    status = req.status;
  }
  return status === 'granted';
}

/**
 * Fetch the best token this device can produce.
 * @returns {Promise<{token: string, provider: 'fcm'|'expo', platform: string}|null>}
 */
export async function getDeviceToken() {
  // Android: native FCM registration token (primary path).
  if (Platform.OS === 'android') {
    try {
      const native = await Notifications.getDevicePushTokenAsync();
      // { type: 'android', data: '<FCM registration token>' }
      if (native?.data && typeof native.data === 'string') {
        return { token: native.data, provider: 'fcm', platform: 'android' };
      }
    } catch (e) {
      // Expo Go / missing google-services.json -> fall through to Expo token.
      console.warn('[Push] Native FCM token unavailable, falling back to Expo:', e?.message || e);
    }
  }

  // iOS + Android fallback: Expo token.
  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
    const resp = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (resp?.data) {
      return { token: resp.data, provider: 'expo', platform: Platform.OS };
    }
  } catch (e) {
    console.warn('[Push] Expo token unavailable:', e?.message || e);
  }

  return null;
}

/**
 * Register this device with the CRM. Call after login and on every app launch.
 * @param {boolean} force  re-send even if the token hasn't changed
 */
export async function registerForPush(force = false) {
  try {
    await setupAndroidChannel();

    if (!Device.isDevice) return null; // no push on simulators

    const granted = await ensurePermission();
    if (!granted) return null;

    const result = await getDeviceToken();
    if (!result?.token) return null;

    // Skip the network call when nothing changed (saves a request per launch),
    // but always re-send if the caller asks or the account changed.
    const previous = await AsyncStorage.getItem(LAST_TOKEN_KEY).catch(() => null);
    if (!force && previous === result.token) return result;

    await AxiosInstance.post('/mobile/push-token', {
      token: result.token,
      provider: result.provider,
      platform: result.platform,
    });

    await AsyncStorage.setItem(LAST_TOKEN_KEY, result.token).catch(() => {});
    return result;
  } catch (e) {
    console.warn('[Push] Registration failed:', e?.message || e);
    return null;
  }
}

/**
 * Firebase rotates registration tokens (app restore, data clear, long idle).
 * When that happens the old token stops delivering, so push it up immediately.
 * Returns an unsubscribe function.
 */
export function listenForTokenRefresh() {
  try {
    const sub = Notifications.addPushTokenListener(async (tokenData) => {
      const token = tokenData?.data;
      if (!token || typeof token !== 'string') return;
      const provider = tokenData?.type === 'android' ? 'fcm' : Platform.OS === 'android' ? 'fcm' : 'expo';
      try {
        await AxiosInstance.post('/mobile/push-token', {
          token,
          provider: token.startsWith('ExponentPushToken[') ? 'expo' : provider,
          platform: Platform.OS,
        });
        await AsyncStorage.setItem(LAST_TOKEN_KEY, token).catch(() => {});
      } catch {}
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}

/** Tell the backend to forget this device (call on logout). */
export async function unregisterPush() {
  try { await AxiosInstance.delete('/mobile/push-token'); } catch {}
  try { await AsyncStorage.removeItem(LAST_TOKEN_KEY); } catch {}
}

// ---------------------------------------------------------------------------
// Diagnostics — used by the Notification Settings screen
// ---------------------------------------------------------------------------

/** Local + server view of this device's push state. */
export async function getPushDiagnostics() {
  const out = {
    isDevice: Device.isDevice,
    permission: 'unknown',
    provider: null,
    token: null,
    serverRegistered: false,
    serverProvider: null,
    error: null,
  };

  try {
    const perm = await Notifications.getPermissionsAsync();
    out.permission = perm.status;
    if (perm.status === 'granted' && Device.isDevice) {
      const t = await getDeviceToken();
      if (t) {
        out.provider = t.provider;
        out.token = t.token;
      }
    }
    const res = await AxiosInstance.get('/mobile/push-token');
    const d = res?.data?.data;
    out.serverRegistered = !!d?.registered;
    out.serverProvider = d?.provider || null;
  } catch (e) {
    out.error = e?.message || 'Could not reach the server';
  }

  return out;
}

/** Ask the server to push a test notification to this device. */
export async function sendTestPush() {
  const res = await AxiosInstance.post('/mobile/push-test', {});
  return res?.data || { success: false, message: 'No response' };
}
