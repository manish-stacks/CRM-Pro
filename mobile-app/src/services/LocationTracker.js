// src/services/LocationTracker.js
// Location tracking for marketing/field staff.
// - Foreground: continuous watch (every ~30s or 50m movement)
// - Background: periodic task (every ~5-10 min) via expo-task-manager
// - ONLY runs between check-in and check-out (office time)
//
// Pings are POSTed to /mobile/location. The server rejects pings when the user
// is not in an active (checked-in) session, so tracking self-heals.

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AxiosInstance } from '../lib/Axios.instance';

const BG_TASK = 'hbs-background-location';
const PING_QUEUE_KEY = 'pendingPings';

let foregroundSub = null;

// ── Helper: read battery % safely ──
async function getBattery() {
  try {
    const level = await Battery.getBatteryLevelAsync();
    return level >= 0 ? Math.round(level * 100) : null;
  } catch { return null; }
}

// ── Send one or more pings to the server (with offline queue) ──
async function sendPings(pings) {
  try {
    const res = await AxiosInstance.post('/mobile/location', { pings });
    // If server says tracking disabled, stop everything
    if (res.data?.data?.trackingEnabled === false) {
      await stopTracking();
    }
    return true;
  } catch (e) {
    // Queue for retry if network failed
    try {
      const existing = JSON.parse((await AsyncStorage.getItem(PING_QUEUE_KEY)) || '[]');
      const merged = [...existing, ...pings].slice(-200); // cap queue
      await AsyncStorage.setItem(PING_QUEUE_KEY, JSON.stringify(merged));
    } catch {}
    return false;
  }
}

// ── Flush any queued pings ──
export async function flushQueue() {
  try {
    const q = JSON.parse((await AsyncStorage.getItem(PING_QUEUE_KEY)) || '[]');
    if (q.length === 0) return;
    const okSent = await sendPings(q);
    if (okSent) await AsyncStorage.removeItem(PING_QUEUE_KEY);
  } catch {}
}

// ── Build a ping object from a Location fix ──
async function buildPing(loc, source) {
  const battery = await getBattery();
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy ?? null,
    speed: loc.coords.speed ?? null,
    heading: loc.coords.heading ?? null,
    altitude: loc.coords.altitude ?? null,
    battery,
    isMoving: (loc.coords.speed ?? 0) > 0.5,
    source,
    recordedAt: new Date(loc.timestamp || Date.now()).toISOString(),
  };
}

// ── Background task definition ──
TaskManager.defineTask(BG_TASK, async ({ data, error }) => {
  if (error) return;
  if (!data) return;
  const { locations } = data;
  if (!locations || locations.length === 0) return;
  // Only send if still checked in
  const checkedIn = await AsyncStorage.getItem('isCheckedIn');
  if (checkedIn !== 'true') {
    await stopTracking();
    return;
  }
  const pings = [];
  for (const loc of locations) {
    pings.push(await buildPing(loc, 'background'));
  }
  await sendPings(pings);
});

// ── Check current permission status WITHOUT prompting ──
// Used to decide whether the prominent in-app disclosure needs to be shown
// before triggering the OS permission dialog.
export async function getPermissionStatus() {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    const bg = await Location.getBackgroundPermissionsAsync();
    return {
      foregroundGranted: fg.status === 'granted',
      backgroundGranted: bg.status === 'granted',
      needsDisclosure: fg.status !== 'granted' || bg.status !== 'granted',
    };
  } catch {
    return { foregroundGranted: false, backgroundGranted: false, needsDisclosure: true };
  }
}

// ── Request permissions ──
// IMPORTANT: Only call this AFTER the user has seen the in-app prominent
// disclosure and explicitly tapped "Allow". Never call this directly from
// a button press without the disclosure step — Google Play policy requires
// the disclosure to be shown before the system permission dialog appears.
export async function requestPermissions() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return { granted: false, background: false };
  // Background is optional — app still works foreground-only if denied
  let bgGranted = false;
  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    bgGranted = bg.status === 'granted';
  } catch {}
  return { granted: true, background: bgGranted };
}

// ── Start tracking (called after check-in, once disclosure/consent is handled by the UI) ──
export async function startTracking() {
  await AsyncStorage.setItem('isCheckedIn', 'true');

  const perm = await requestPermissions();
  if (!perm.granted) return { ok: false, reason: 'permission-denied' };

  // Foreground continuous watch
  if (!foregroundSub) {
    foregroundSub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30000,     // 30s
        distanceInterval: 50,    // or every 50m
      },
      async (loc) => {
        const checkedIn = await AsyncStorage.getItem('isCheckedIn');
        if (checkedIn !== 'true') { await stopTracking(); return; }
        const ping = await buildPing(loc, 'foreground');
        await sendPings([ping]);
      }
    );
  }

  // Background periodic (every ~7 min or 200m)
  if (perm.background) {
    try {
      const already = await Location.hasStartedLocationUpdatesAsync(BG_TASK).catch(() => false);
      if (!already) {
        await Location.startLocationUpdatesAsync(BG_TASK, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 7 * 60 * 1000,   // 7 min
          distanceInterval: 200,          // or 200m
          deferredUpdatesInterval: 7 * 60 * 1000,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'HBS — On Duty',
            notificationBody: 'Location sharing is active during office hours.',
            notificationColor: '#E50914',
          },
        });
      }
    } catch (e) {
      // Background not available — foreground still works
    }
  }

  return { ok: true, background: perm.background };
}

// ── Stop tracking (called on check-out / logout) ──
export async function stopTracking() {
  await AsyncStorage.setItem('isCheckedIn', 'false');
  if (foregroundSub) {
    try { foregroundSub.remove(); } catch {}
    foregroundSub = null;
  }
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(BG_TASK).catch(() => false);
    if (started) await Location.stopLocationUpdatesAsync(BG_TASK);
  } catch {}
}

// ── Get one immediate fix (for check-in/out/visit stamping) ──
export async function getCurrentLocation() {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      const req = await Location.requestForegroundPermissionsAsync();
      if (req.status !== 'granted') return null;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy,
    };
  } catch {
    return null;
  }
}

// ── Reverse geocode a coord to a short address (best-effort) ──
export async function reverseGeocode(lat, lng) {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (results && results[0]) {
      const r = results[0];
      return [r.name, r.street, r.city, r.region].filter(Boolean).join(', ');
    }
  } catch {}
  return null;
}
