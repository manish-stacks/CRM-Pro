"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// desktop-app/src/main.ts
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const electron_store_1 = __importDefault(require("electron-store"));
const electron_updater_1 = require("electron-updater");
// TODO: replace with your real backend URL, or set the API_BASE_URL env var
// when launching the app (e.g. `API_BASE_URL=https://api.yourcompany.com npm start`)
const API_BASE = process.env.API_BASE_URL || 'http://192.168.1.14:3000';
const store = new electron_store_1.default();
let mainWindow = null;
let captureTimers = [];
let midnightTimer = null;
let idlePollTimer = null;
let accumulatedIdleSeconds = 0;
let currentSettings = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 380,
        height: 480,
        minWidth: 320,
        minHeight: 420,
        resizable: true,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
        },
    });
    mainWindow.loadFile(path_1.default.join(__dirname, '../src/renderer/index.html'));
}
electron_1.app.whenReady().then(() => {
    createWindow();
    // Only check for updates when the app is actually packaged/installed.
    // In dev (npm start) this is skipped — running unpacked always fails
    // the update check and just spams the console otherwise.
    if (electron_1.app.isPackaged) {
        electron_updater_1.autoUpdater.checkForUpdatesAndNotify();
    }
});
electron_1.app.on('window-all-closed', () => { if (process.platform !== 'darwin')
    electron_1.app.quit(); });
electron_updater_1.autoUpdater.on("update-available", () => {
    console.log("Update Available");
});
electron_updater_1.autoUpdater.on("error", (err) => {
    console.error("Auto-update error:", err);
});
electron_updater_1.autoUpdater.on("update-downloaded", () => {
    electron_1.dialog.showMessageBox({
        type: 'info',
        buttons: ['Restart Now', 'Later'],
        message: 'A new version has been downloaded. Restart to apply the update?',
    }).then((result) => {
        if (result.response === 0)
            electron_updater_1.autoUpdater.quitAndInstall();
    });
});
// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
electron_1.ipcMain.handle('auth:login', async (_e, { email, password }) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok)
        return { ok: false, error: 'Invalid credentials' };
    const data = await res.json();
    console.log('Login response from server:', data);
    if (!data.token) {
        return { ok: false, error: 'Server did not return a token — check response shape' };
    }
    store.set('token', data.token);
    return { ok: true };
});
// ---------------------------------------------------------------------------
// Check-in / Check-out
// ---------------------------------------------------------------------------
electron_1.ipcMain.handle('tracker:checkin', async () => {
    const token = store.get('token');
    const res = await fetch(`${API_BASE}/api/tracker/checkin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { ok: false, error: err.error || 'Check-in failed' };
    }
    const { data } = await res.json();
    // Tracking off (admin master switch OFF, or this employee is exempted).
    // Still a successful check-in from the employee's point of view — we just
    // don't run any screenshot capture.
    if (!data.tracking) {
        store.delete('sessionId');
        return { ok: true, tracking: false, reason: data.reason };
    }
    store.set('sessionId', data.session.id);
    currentSettings = data.settings;
    accumulatedIdleSeconds = 0;
    scheduleTodaysCaptures();
    scheduleMidnightReschedule();
    startIdlePolling();
    return { ok: true, tracking: true };
});
electron_1.ipcMain.handle('tracker:checkout', async () => {
    const token = store.get('token');
    const sessionId = store.get('sessionId');
    stopCaptureLoop();
    stopIdlePolling();
    if (sessionId) {
        await fetch(`${API_BASE}/api/tracker/checkout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, idleSeconds: accumulatedIdleSeconds }),
        }).catch(() => { });
    }
    store.delete('sessionId');
    currentSettings = null;
    return { ok: true };
});
// ---------------------------------------------------------------------------
// Screenshot capture — admin sets an exact count per day (Settings > Desktop
// Tracker > "Screenshots Per Day", default 4). We pick that many random
// moments spread across the remaining work window and schedule one capture
// at each, instead of firing on a short fixed interval all day.
// ---------------------------------------------------------------------------
function parseHHMM(hhmm) {
    const [h, m] = (hhmm || '00:00').split(':').map(Number);
    return { h, m: m || 0 };
}
function stopCaptureLoop() {
    captureTimers.forEach(t => clearTimeout(t));
    captureTimers = [];
    if (midnightTimer) {
        clearTimeout(midnightTimer);
        midnightTimer = null;
    }
}
function scheduleTodaysCaptures() {
    captureTimers.forEach(t => clearTimeout(t));
    captureTimers = [];
    if (!currentSettings)
        return;
    const now = new Date();
    const windowStart = now;
    let windowEnd;
    if (currentSettings.officeHoursOnly) {
        const end = parseHHMM(currentSettings.officeEnd);
        windowEnd = new Date(now);
        windowEnd.setHours(end.h, end.m, 0, 0);
        if (windowEnd <= now)
            return; // office hours already over for today
    }
    else {
        // No office-hours restriction — spread across the rest of the calendar day.
        windowEnd = new Date(now);
        windowEnd.setHours(23, 59, 0, 0);
    }
    const count = Math.max(1, currentSettings.screenshotsPerDay);
    const spanMs = windowEnd.getTime() - windowStart.getTime();
    if (spanMs <= 0)
        return;
    // N random moments within the window, sorted ascending.
    const offsets = Array.from({ length: count }, () => Math.random() * spanMs).sort((a, b) => a - b);
    for (const offset of offsets) {
        const timer = setTimeout(() => {
            captureAndUpload().catch(err => console.error('Screenshot capture/upload failed:', err));
        }, offset);
        captureTimers.push(timer);
    }
}
// If a check-in stays open across local midnight, re-roll a fresh set of N
// captures for the new day.
function scheduleMidnightReschedule() {
    if (midnightTimer)
        clearTimeout(midnightTimer);
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 5, 0); // a few seconds past midnight
    midnightTimer = setTimeout(() => {
        scheduleTodaysCaptures();
        scheduleMidnightReschedule();
    }, nextMidnight.getTime() - now.getTime());
}
async function captureAndUpload() {
    const sessionId = store.get('sessionId');
    const token = store.get('token');
    if (!sessionId || !currentSettings)
        return;
    // Skip capturing while the user is idle (admin-configurable threshold).
    if (electron_1.powerMonitor.getSystemIdleTime() > currentSettings.idleThresholdSeconds)
        return;
    const primaryDisplay = electron_1.screen.getPrimaryDisplay();
    const sources = await electron_1.desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: primaryDisplay.size,
    });
    const jpegBuffer = sources[0].thumbnail.toJPEG(currentSettings.qualityPercent);
    const dataUrl = `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`;
    // Single-request upload — the server stores directly to Cloudinary (this
    // deployment's storage provider) and re-checks the admin's tracker
    // settings (enabled, employee not exempt, office-hours window) before
    // accepting it.
    const res = await fetch(`${API_BASE}/api/tracker/screenshot`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, imageBase64: dataUrl }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn('Screenshot rejected by server:', err.error || res.status);
    }
}
// ---------------------------------------------------------------------------
// Idle time accumulation
// ---------------------------------------------------------------------------
function startIdlePolling() {
    idlePollTimer = setInterval(() => {
        const idleSecs = electron_1.powerMonitor.getSystemIdleTime();
        if (idleSecs >= 30)
            accumulatedIdleSeconds += 30;
    }, 30000);
}
function stopIdlePolling() {
    if (idlePollTimer)
        clearInterval(idlePollTimer);
    idlePollTimer = null;
}
