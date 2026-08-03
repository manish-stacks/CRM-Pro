import { app, BrowserWindow, session, powerMonitor, desktopCapturer, screen, ipcMain } from 'electron'
import path from 'path'
import Store from 'electron-store'
import { autoUpdater } from "electron-updater";
import log from 'electron-log'

// Production backend URL is baked in directly so the packaged app works on
// any machine without needing a .env file shipped alongside it. Setting the
// API_BASE_URL environment variable before launch (e.g. for local dev) will
// still override this.
const API_BASE = 'https://web-crm.hoverbusinessservices.com/' //"http://localhost:3000/"
const PARTITION = 'persist:hbs-crm' // keeps the login session across app restarts, like a browser profile
const SYNC_INTERVAL_MS = 60_000
// Admin "View Screen" requests need to feel near-instant, so this polls a lot
// more often than the attendance sync above — but only while logged in.
const SCREENSHOT_POLL_MS = 5_000

const store = new Store<{ sessionId?: string }>()

// Blank white screen after the machine sleeps / the window sits idle for a
// while is a known Electron+Chromium GPU-context bug. Disabling hardware
// acceleration avoids it entirely (small tradeoff: slightly less smooth
// scrolling/animations, not noticeable for a dashboard app like this).
app.disableHardwareAcceleration()

// Windows groups/labels native notifications by AppUserModelId — without
// this, OS notifications triggered by the web page (new Notification(...))
// show up as coming from "Electron" instead of "HBS CRM".
if (process.platform === 'win32') {
  app.setAppUserModelId('com.hoverbusinessservices.crm')
}

let mainWindow: BrowserWindow | null = null
let alertWindow: BrowserWindow | null = null
let idlePollTimer: NodeJS.Timeout | null = null
let syncTimer: NodeJS.Timeout | null = null
let screenshotPollTimer: NodeJS.Timeout | null = null
let accumulatedIdleSeconds = 0
let isTracking = false

// Custom-styled replacement for dialog.showMessageBox — a small frameless,
// rounded, branded popup instead of the plain OS-native alert box. Loads
// tracking-alert.html, which just calls window.close() on its own "Got it"
// button — no IPC/preload needed since it's a pure acknowledgment popup.
function showTrackingAlert() {
  if (alertWindow) { alertWindow.focus(); return }
  alertWindow = new BrowserWindow({
    width: 380,
    height: 220,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    transparent: true,
    parent: mainWindow ?? undefined,
    modal: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: { contextIsolation: true },
  })
  alertWindow.loadFile(path.join(__dirname, 'tracking-alert.html'))
  alertWindow.once('ready-to-show', () => alertWindow?.show())
  alertWindow.on('closed', () => { alertWindow = null })
}

let updateAlertWindow: BrowserWindow | null = null

// Same idea as showTrackingAlert(), but this one needs to actually trigger
// autoUpdater.quitAndInstall() when clicked, not just dismiss — so it gets
// its own tiny preload (update-alert-preload.ts) exposing restartNow() over
// IPC instead of relying on plain window.close().
function showUpdateReadyAlert() {
  if (updateAlertWindow) { updateAlertWindow.focus(); return }
  updateAlertWindow = new BrowserWindow({
    width: 380,
    height: 220,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    transparent: true,
    parent: mainWindow ?? undefined,
    modal: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'update-alert-preload.js'),
    },
  })
  updateAlertWindow.loadFile(path.join(__dirname, 'update-alert.html'))
  updateAlertWindow.once('ready-to-show', () => updateAlertWindow?.show())
  updateAlertWindow.on('closed', () => { updateAlertWindow = null })
}

ipcMain.on('update-alert:restart-now', () => {
  autoUpdater.quitAndInstall()
})

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
    // Don't show the window until content has actually painted — otherwise
    // Electron shows a plain white frame for however long the initial
    // network request + page render takes, which is exactly the "white
    // blank screen" users were reporting right after opening the app.
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      partition: PARTITION,
    },
  })
  mainWindow.loadURL(API_BASE)

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // If the very first load fails (app opened before the network/Wi-Fi is
  // up, DNS hiccup, server briefly unreachable, etc.) Electron is left
  // showing a blank/error page with nothing retrying it. Back off and try
  // again a few times instead of leaving the user stuck.
  let loadRetries = 0
  mainWindow.webContents.on('did-fail-load', (_event, errorCode) => {
    // -3 is ERR_ABORTED, which fires on normal navigations (e.g. redirects)
    // and isn't a real failure — ignore it.
    if (errorCode === -3) return
    if (loadRetries >= 5) return
    loadRetries += 1
    setTimeout(() => mainWindow?.loadURL(API_BASE), Math.min(2000 * loadRetries, 10_000))
  })
  mainWindow.webContents.on('did-finish-load', () => { loadRetries = 0 })

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

  // Don't trust the locally cached `isTracking` flag here — it only updates
  // on the ~60s sync tick, so punching in/out on the web page right before
  // closing (either direction) can be stale for up to a minute:
  //   - punch OUT then close immediately -> local flag still says tracking,
  //     app wrongly blocks the close until the next tick catches up
  //   - punch IN then close immediately -> local flag still says not
  //     tracking, app wrongly lets a checked-in user close
  // Ask the server "am I checked in right now?" at the moment of closing
  // instead of relying on the cached value.
  mainWindow.on('close', (e) => {
    e.preventDefault()
    checkStillTrackingThenClose()
  })

  async function checkStillTrackingThenClose() {
    const token = await getAuthToken()
    if (!token) { mainWindow?.destroy(); return }

    try {
      const res = await fetch(`${API_BASE}/api/mobile/attendance/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = res.ok ? await res.json().catch(() => null) : null
      const stillTracking = !!json?.data?.trackingEnabled
      isTracking = stillTracking // resync the local flag while we're at it

      if (stillTracking) {
        showTrackingAlert()
        mainWindow?.minimize()
      } else {
        mainWindow?.destroy()
      }
    } catch (err) {
      // Couldn't reach the server to verify — fall back to the last known
      // local state rather than silently letting a checked-in user close.
      console.error('Close-time tracking check failed:', err)
      if (isTracking) {
        showTrackingAlert()
        mainWindow?.minimize()
      } else {
        mainWindow?.destroy()
      }
    }
  }

  // Catch-all: whatever the exact trigger (some idle/blank cases aren't a
  // clean lock or sleep event), check when the window regains focus whether
  // the page actually rendered anything. An empty body after the app has
  // had time to load means it's stuck blank — reload instead of leaving the
  // user to hit refresh themselves.
  mainWindow.on('focus', () => {
    mainWindow?.webContents.executeJavaScript('document.body.innerText.trim().length', true)
      .then(len => {
        if (len === 0) mainWindow?.loadURL(API_BASE)
      })
      .catch(() => { })
  })
}

// When the OS wakes up from sleep, force a reload — this is the main
// trigger for the "left it idle, came back to a white screen" symptom.
powerMonitor.on('resume', () => {
  mainWindow?.loadURL(API_BASE)
})

// Leaving the machine idle usually triggers a screen LOCK long before it
// triggers full sleep (Windows/macOS default lock timeouts are shorter
// than sleep timeouts). Locking also drops the renderer's GPU context, same
// as sleep does, but 'resume' never fires for a plain lock/unlock cycle —
// only 'unlock-screen' does. Without this, "walked away, came back, locked
// and unlocked, still white" was the gap the resume-only fix above missed.
powerMonitor.on('unlock-screen', () => {
  mainWindow?.loadURL(API_BASE)
})

app.whenReady().then(() => {
  createWindow();
  startSyncLoop();
  startScreenshotPolling();
  if (app.isPackaged) {
    log.transports.file.level = 'info'
    autoUpdater.logger = log
    log.info('App starting, checking for updates. Current version:', app.getVersion())
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on('window-all-closed', () => {
  stopSyncLoop()
  stopScreenshotPolling()
  if (process.platform !== 'darwin') app.quit()
})

autoUpdater.on("checking-for-update", () => {
  log.info("Checking for update...");
});

autoUpdater.on("update-available", (info) => {
  log.info("Update Available:", info.version);
});

autoUpdater.on("update-not-available", (info) => {
  log.info("No update available. Current is latest:", info.version);
});

autoUpdater.on("error", (err) => {
  log.error("Auto-update error:", err);
});

autoUpdater.on("download-progress", (progress) => {
  log.info(`Download progress: ${Math.round(progress.percent)}%`);
});

autoUpdater.on("update-downloaded", () => {
  log.info("Update downloaded, forcing restart");
  showUpdateReadyAlert()
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

let wasLoggedIn = false

async function syncTrackingState() {
  const token = await getAuthToken()
  if (!token) {
    if (isTracking) await stopTracking()
    if (wasLoggedIn) {
      wasLoggedIn = false
      mainWindow?.loadURL(API_BASE)
    }
    return
  }
  wasLoggedIn = true
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
    }).catch(() => { })
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

// ---------------------------------------------------------------------------
// On-demand screenshot — admin clicks "View Screen" for this employee in the
// web dashboard; that creates a PENDING request server-side. This polls for
// one addressed to the logged-in user, captures a single full-screen image,
// and uploads it. No continuous recording, no local copy kept, no dialog —
// just a one-shot capture in response to an explicit admin action.
// ---------------------------------------------------------------------------
function startScreenshotPolling() {
  if (screenshotPollTimer) return
  screenshotPollTimer = setInterval(checkScreenshotRequest, SCREENSHOT_POLL_MS)
}

function stopScreenshotPolling() {
  if (screenshotPollTimer) clearInterval(screenshotPollTimer)
  screenshotPollTimer = null
}

async function checkScreenshotRequest() {
  const token = await getAuthToken()
  if (!token) return // not logged in — nothing to do
  try {
    const res = await fetch(`${API_BASE}/api/tracker/screenshot-request`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const json = await res.json().catch(() => null)
    const pendingId = json?.data?.id
    if (pendingId) await captureAndUploadScreenshot(pendingId, token)
  } catch (err) {
    console.error('Screenshot poll failed:', err)
  }
}

async function captureAndUploadScreenshot(requestId: string, token: string) {
  try {
    const primary = screen.getPrimaryDisplay()
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(primary.size.width * primary.scaleFactor),
        height: Math.round(primary.size.height * primary.scaleFactor),
      },
    })
    const source = sources[0]
    if (!source || source.thumbnail.isEmpty()) return

    const dataUrl = source.thumbnail.toDataURL()
    await fetch(`${API_BASE}/api/tracker/screenshot-request/${requestId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl }),
    })
  } catch (err) {
    // On macOS this most commonly means Screen Recording permission hasn't
    // been granted to the app yet (System Settings → Privacy & Security).
    console.error('Screenshot capture/upload failed:', err)
  }
}