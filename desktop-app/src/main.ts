// desktop-app/src/main.ts
//
// The window loads the real web dashboard (same one you open in a browser) —
// so login, logout, and every other page work exactly the same way, using
// the same session cookie.
//
// The desktop tracker no longer has its own login/check-in widget. It runs
// quietly in the background: every SYNC_INTERVAL_MS it asks the server "is
// this employee checked in right now?" (GET /api/mobile/attendance/status)
// and starts/stops the session + idle tracking to match. Whether tracking
// actually happens is still fully controlled server-side by the admin
// Settings master switch and per-employee "tracker exempt" flag (see
// /api/tracker/checkin in the web app) — this file never decides that on
// its own.
import { app, BrowserWindow, session, powerMonitor, dialog } from 'electron'
import path from 'path'
import Store from 'electron-store'
import { autoUpdater } from "electron-updater";

// Production backend URL is baked in directly so the packaged app works on
// any machine without needing a .env file shipped alongside it. Setting the
// API_BASE_URL environment variable before launch (e.g. for local dev) will
// still override this.
const API_BASE = process.env.API_BASE_URL || 'https://web-crm.hoverbusinessservices.com/'
const PARTITION = 'persist:hbs-crm' // keeps the login session across app restarts, like a browser profile
const SYNC_INTERVAL_MS = 60_000

const store = new Store<{ sessionId?: string }>()

// Blank white screen after the machine sleeps / the window sits idle for a
// while is a known Electron+Chromium GPU-context bug. Disabling hardware
// acceleration avoids it entirely (small tradeoff: slightly less smooth
// scrolling/animations, not noticeable for a dashboard app like this).
app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null
let idlePollTimer: NodeJS.Timeout | null = null
let syncTimer: NodeJS.Timeout | null = null
let accumulatedIdleSeconds = 0
let isTracking = false

interface TrackerSettings {
  idleThresholdSeconds: number
  officeStart: string
  officeEnd: string
  timezone: string
}
let currentSettings: TrackerSettings | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      partition: PARTITION,
    },
  })
  mainWindow.loadURL(API_BASE)

  // Belt-and-suspenders on top of disableHardwareAcceleration(): if the
  // renderer still ever goes blank/unresponsive (crashed, OOM-killed, or
  // just stuck after a long sleep), reload it automatically instead of
  // making the user hit Ctrl+R.
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process gone:', details.reason)
    mainWindow?.loadURL(API_BASE)
  })

  mainWindow.on('unresponsive', () => {
    console.error('Window unresponsive, reloading')
    mainWindow?.loadURL(API_BASE)
  })
}

// When the OS wakes up from sleep, force a reload — this is the main
// trigger for the "left it idle, came back to a white screen" symptom.
powerMonitor.on('resume', () => {
  mainWindow?.loadURL(API_BASE)
})

app.whenReady().then(() => {
  createWindow();
  startSyncLoop();
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on('window-all-closed', () => {
  stopSyncLoop()
  if (process.platform !== 'darwin') app.quit()
})

autoUpdater.on("update-available", () => {
    console.log("Update Available");
});

autoUpdater.on("error", (err) => {
    console.error("Auto-update error:", err);
});

autoUpdater.on("update-downloaded", () => {
    dialog.showMessageBox({
        type: 'info',
        buttons: ['Restart Now', 'Later'],
        message: 'A new version has been downloaded. Restart to apply the update?',
    }).then((result) => {
        if (result.response === 0) autoUpdater.quitAndInstall();
    });
});

// ---------------------------------------------------------------------------
// Auth — reuse the same 'auth-token' cookie the web dashboard sets on login.
// requireAuth() on the server accepts this same JWT either as a cookie (web
// pages) or as an `Authorization: Bearer` header (mobile/desktop API calls),
// so we just read it out of the window's cookie jar for our own fetches.
// ---------------------------------------------------------------------------
async function getAuthToken(): Promise<string | null> {
  const electronSession = session.fromPartition(PARTITION)
  const cookies = await electronSession.cookies.get({ url: API_BASE, name: 'auth-token' })
  return cookies[0]?.value ?? null
}

// ---------------------------------------------------------------------------
// Background sync — no manual check-in/check-out button anymore. This polls
// "am I checked in today?" and starts/stops idle tracking to match.
// ---------------------------------------------------------------------------
function startSyncLoop() {
  runSyncTick()
  syncTimer = setInterval(runSyncTick, SYNC_INTERVAL_MS)
}

async function runSyncTick() {
  await syncTrackingState()
}

function stopSyncLoop() {
  if (syncTimer) clearInterval(syncTimer)
  syncTimer = null
}

async function syncTrackingState() {
  const token = await getAuthToken()
  if (!token) {
    if (isTracking) await stopTracking()
    return
  }
  try {
    const res = await fetch(`${API_BASE}/api/mobile/attendance/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const json = await res.json().catch(() => null)
    if (!json?.success) return

    const shouldTrack = !!json.data.trackingEnabled
    if (shouldTrack && !isTracking) {
      await startTracking(token)
    } else if (!shouldTrack && isTracking) {
      await stopTracking(token)
    }
  } catch (err) {
    console.error('Tracking status sync failed:', err)
  }
}

async function startTracking(token: string) {
  const res = await fetch(`${API_BASE}/api/tracker/checkin`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return
  const json = await res.json().catch(() => null)
  const data = json?.data
  if (!data) return

  // DISABLED_BY_ADMIN or EMPLOYEE_EXEMPT: attendance is tracked server-side
  // regardless, but there's nothing for this app to do — do nothing.
  if (!data.tracking) return

  store.set('sessionId', data.session.id)
  currentSettings = data.settings
  accumulatedIdleSeconds = 0
  isTracking = true
  startIdlePolling()
}

async function stopTracking(token?: string) {
  stopIdlePolling()
  const sessionId = store.get('sessionId')
  if (sessionId && token) {
    await fetch(`${API_BASE}/api/tracker/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, idleSeconds: accumulatedIdleSeconds }),
    }).catch(() => {})
  }
  store.delete('sessionId')
  currentSettings = null
  isTracking = false
}

// ---------------------------------------------------------------------------
// Idle time accumulation
// ---------------------------------------------------------------------------
function startIdlePolling() {
  idlePollTimer = setInterval(() => {
    const idleSecs = powerMonitor.getSystemIdleTime()
    if (idleSecs >= 30) accumulatedIdleSeconds += 30
  }, 30_000)
}

function stopIdlePolling() {
  if (idlePollTimer) clearInterval(idlePollTimer)
  idlePollTimer = null
}
