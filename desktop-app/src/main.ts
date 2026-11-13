import {
  app,
  BrowserWindow,
  session,
  powerMonitor,
  desktopCapturer,
  screen,
  ipcMain,
  shell,
  Menu,
  MenuItem,
  Tray,
  nativeImage,
  Notification,
} from 'electron'
import path from 'path'
import fs from 'fs'
import Store from 'electron-store'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'

// ---------------------------------------------------------------------------
// Config & Constants
// ---------------------------------------------------------------------------
const API_BASE = (process.env.API_BASE_URL || 'https://web-crm.hoverbusinessservices.com').replace(/\/+$/, '')
const PARTITION = 'persist:hbs-crm' // persistent session across restarts
const SYNC_INTERVAL_MS = 60_000
const SCREENSHOT_POLL_MS = 5_000
const IDLE_CHECK_INTERVAL_MS = 30_000
const DEFAULT_IDLE_THRESHOLD_SECONDS = 300 // 5 minutes

interface StoreSchema {
  sessionId?: string
  windowBounds?: {
    x?: number
    y?: number
    width: number
    height: number
    isMaximized?: boolean
  }
}
const store = new Store<StoreSchema>()

// Disable hardware acceleration to eliminate blank screen after sleep/GPU context loss
app.disableHardwareAcceleration()

// Windows AppUserModelId for native notifications
if (process.platform === 'win32') {
  app.setAppUserModelId('com.hoverbusinessservices.crm')
}

// ---------------------------------------------------------------------------
// Global References
// ---------------------------------------------------------------------------
let mainWindow: BrowserWindow | null = null
let alertWindow: BrowserWindow | null = null
let updateAlertWindow: BrowserWindow | null = null
let idleAlertWindow: BrowserWindow | null = null
let tray: Tray | null = null

let syncTimer: NodeJS.Timeout | null = null
let screenshotPollTimer: NodeJS.Timeout | null = null
let idlePollTimer: NodeJS.Timeout | null = null

let accumulatedIdleSeconds = 0
let isTracking = false
let wasLoggedIn = false
let isQuitting = false

interface TrackerSettings {
  idleThresholdSeconds: number
  officeStart: string
  officeEnd: string
  timezone: string
}
let currentSettings: TrackerSettings | null = null

// ---------------------------------------------------------------------------
// Helper: Resolve App Icon
// ---------------------------------------------------------------------------
function getAppIcon(): string {
  const ico = path.join(__dirname, '..', 'build', 'icon.png')
  if (fs.existsSync(ico)) return ico
  return path.join(__dirname, 'build', 'icon.png')
}

// ---------------------------------------------------------------------------
// Window Creation
// ---------------------------------------------------------------------------
function createWindow() {
  const savedBounds = store.get('windowBounds')
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  const defaultWidth = Math.min(1366, Math.round(screenWidth * 0.9))
  const defaultHeight = Math.min(860, Math.round(screenHeight * 0.9))

  const width = savedBounds?.width || defaultWidth
  const height = savedBounds?.height || defaultHeight
  const x = savedBounds?.x !== undefined ? savedBounds.x : Math.round((screenWidth - width) / 2)
  const y = savedBounds?.y !== undefined ? savedBounds.y : Math.round((screenHeight - height) / 2)

  mainWindow = new BrowserWindow({
    title: 'HBS CRM Pro',
    width,
    height,
    x,
    y,
    minWidth: 980,
    minHeight: 640,
    icon: getAppIcon(),
    show: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      partition: PARTITION,
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true,
    },
  })

  if (savedBounds?.isMaximized) {
    mainWindow.maximize()
  }

  // Load backend web dashboard
  mainWindow.loadURL(API_BASE)

  // Show window once content is ready to eliminate white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    updateTray()
  })

  // Handle window bounds save on move/resize
  const saveBounds = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const isMax = mainWindow.isMaximized()
    if (!isMax) {
      const bounds = mainWindow.getBounds()
      store.set('windowBounds', { ...bounds, isMaximized: false })
    } else {
      const prev = store.get('windowBounds') || { width: defaultWidth, height: defaultHeight }
      store.set('windowBounds', { ...prev, isMaximized: true })
    }
  }
  mainWindow.on('resize', saveBounds)
  mainWindow.on('move', saveBounds)

  // Handle load failure with branded offline screen
  let loadRetries = 0
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -3) return // ERR_ABORTED on redirects
    log.warn(`Page load failed (${errorCode}: ${errorDescription}) for ${validatedURL}`)

    if (loadRetries < 2) {
      loadRetries++
      setTimeout(() => mainWindow?.loadURL(API_BASE), 2000)
    } else {
      const offlinePath = path.join(__dirname, 'offline.html')
      if (fs.existsSync(offlinePath)) {
        mainWindow?.loadFile(offlinePath)
      }
    }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    loadRetries = 0
    mainWindow?.setTitle('HBS CRM Pro')
  })

  // Auto-reload on crash/freeze
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log.error('Renderer process gone:', details.reason)
    mainWindow?.loadURL(API_BASE)
  })

  mainWindow.on('unresponsive', () => {
    log.error('Window unresponsive, reloading')
    mainWindow?.loadURL(API_BASE)
  })

  // Setup SetWindowOpenHandler: CRUCIAL for reports, WhatsApp, and popups
  setupWindowOpenHandler(mainWindow)

  // Setup Right-Click Context Menu
  setupContextMenu(mainWindow)

  // Close behavior: prompt if tracking, minimize to tray
  mainWindow.on('close', (e) => {
    if (isQuitting) return // allow app.quit()
    e.preventDefault()
    handleWindowCloseRequest()
  })

  // Refocus check for blank body
  mainWindow.on('focus', () => {
    mainWindow?.webContents
      .executeJavaScript('document.body.innerText.trim().length', true)
      .then((len) => {
        if (len === 0) mainWindow?.loadURL(API_BASE)
      })
      .catch(() => {})
  })
}

// ---------------------------------------------------------------------------
// Window Open Handler: Fixes Reports, PDFs, CSVs, WhatsApp, Modals
// ---------------------------------------------------------------------------
function setupWindowOpenHandler(window: BrowserWindow) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    // 1. External protocols or URLs (WhatsApp, mailto, tel, external websites)
    if (
      url.startsWith('https://wa.me') ||
      url.startsWith('https://api.whatsapp.com') ||
      url.startsWith('mailto:') ||
      url.startsWith('tel:') ||
      (!url.startsWith(API_BASE) &&
        !url.startsWith('http://localhost') &&
        !url.startsWith('blob:') &&
        !url.startsWith('about:'))
    ) {
      shell.openExternal(url).catch((err) => log.error('openExternal error:', err))
      return { action: 'deny' }
    }

    // 2. Report Downloads (CSV, Excel, Invoices PDF, Letters PDF, Payroll Slips)
    if (
      url.includes('/api/import-export') ||
      url.includes('/api/payroll/slip') ||
      url.endsWith('/pdf') ||
      url.includes('/pdf?') ||
      url.includes('.csv') ||
      url.includes('.xlsx')
    ) {
      const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`
      log.info('Directing report request to download manager:', fullUrl)
      mainWindow?.webContents.downloadURL(fullUrl)
      return { action: 'deny' }
    }

    // 3. Blob URLs or about:blank (Used for ID cards, Form PDFs, Print dialogs)
    if (url.startsWith('blob:') || url === 'about:blank' || url.startsWith('data:')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          title: 'HBS CRM Preview',
          width: 1040,
          height: 820,
          autoHideMenuBar: true,
          icon: getAppIcon(),
          webPreferences: {
            partition: PARTITION,
            contextIsolation: true,
            sandbox: false,
          },
        },
      }
    }

    // 4. Internal CRM popups (e.g. Impersonation tab, modal preview)
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        title: 'HBS CRM',
        width: 1200,
        height: 850,
        autoHideMenuBar: true,
        icon: getAppIcon(),
        webPreferences: {
          partition: PARTITION,
          contextIsolation: true,
          sandbox: false,
        },
      },
    }
  })
}

// ---------------------------------------------------------------------------
// Right-Click Context Menu
// ---------------------------------------------------------------------------
function setupContextMenu(window: BrowserWindow) {
  window.webContents.on('context-menu', (_event, params) => {
    const menu = new Menu()

    // Text editing actions
    if (params.isEditable) {
      menu.append(new MenuItem({ role: 'undo' }))
      menu.append(new MenuItem({ role: 'redo' }))
      menu.append(new MenuItem({ type: 'separator' }))
      menu.append(new MenuItem({ role: 'cut' }))
      menu.append(new MenuItem({ role: 'copy' }))
      menu.append(new MenuItem({ role: 'paste' }))
      menu.append(new MenuItem({ role: 'selectAll' }))
      menu.append(new MenuItem({ type: 'separator' }))
    } else if (params.selectionText && params.selectionText.trim().length > 0) {
      menu.append(new MenuItem({ role: 'copy' }))
      menu.append(new MenuItem({ type: 'separator' }))
    }

    // Link actions
    if (params.linkURL) {
      menu.append(
        new MenuItem({
          label: 'Open Link in Browser',
          click: () => shell.openExternal(params.linkURL),
        })
      )
      menu.append(
        new MenuItem({
          label: 'Copy Link Address',
          click: () => {
            const { clipboard } = require('electron')
            clipboard.writeText(params.linkURL)
          },
        })
      )
      menu.append(new MenuItem({ type: 'separator' }))
    }

    // Image actions
    if (params.hasImageContents) {
      menu.append(new MenuItem({ role: 'copy' }))
      menu.append(new MenuItem({ type: 'separator' }))
    }

    // Navigation actions
    menu.append(
      new MenuItem({
        label: 'Back',
        enabled: window.webContents.canGoBack(),
        click: () => window.webContents.goBack(),
      })
    )
    menu.append(
      new MenuItem({
        label: 'Forward',
        enabled: window.webContents.canGoForward(),
        click: () => window.webContents.goForward(),
      })
    )
    menu.append(
      new MenuItem({
        label: 'Reload Page',
        accelerator: 'CmdOrCtrl+R',
        click: () => window.webContents.reload(),
      })
    )

    if (!app.isPackaged) {
      menu.append(new MenuItem({ type: 'separator' }))
      menu.append(
        new MenuItem({
          label: 'Inspect Element',
          click: () => window.webContents.inspectElement(params.x, params.y),
        })
      )
    }

    menu.popup({ window })
  })
}

// ---------------------------------------------------------------------------
// Native Application Menu
// ---------------------------------------------------------------------------
function setupApplicationMenu() {
  const isMac = process.platform === 'darwin'
  const template: any[] = [
    ...(isMac
      ? [
          {
            label: 'HBS CRM Pro',
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              {
                label: 'Check for Updates...',
                click: () => autoUpdater.checkForUpdatesAndNotify(),
              },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              {
                label: 'Quit HBS CRM Pro',
                accelerator: 'Command+Q',
                click: () => {
                  isQuitting = true
                  app.quit()
                },
              },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Dashboard Home',
          accelerator: 'CmdOrCtrl+H',
          click: () => mainWindow?.loadURL(API_BASE),
        },
        {
          label: 'Open Downloads Folder',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => shell.openPath(app.getPath('downloads')),
        },
        { type: 'separator' },
        {
          label: 'Minimize to Tray',
          accelerator: 'CmdOrCtrl+W',
          click: () => mainWindow?.hide(),
        },
        {
          label: 'Quit',
          accelerator: isMac ? 'Command+Q' : 'Ctrl+Q',
          click: () => {
            isQuitting = true
            app.quit()
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.webContents.reload(),
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => mainWindow?.webContents.reloadIgnoringCache(),
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(!app.isPackaged ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : []),
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' }, { role: 'front' }, { type: 'separator' }, { role: 'window' }]
          : [{ role: 'close' }]),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => autoUpdater.checkForUpdatesAndNotify(),
        },
        {
          label: 'Report Issue / Support',
          click: () => shell.openExternal('https://hoverbusinessservices.com/contact'),
        },
        { type: 'separator' },
        {
          label: `Version ${app.getVersion()}`,
          enabled: false,
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// ---------------------------------------------------------------------------
// System Tray: Status Indicator & Quick Controls
// ---------------------------------------------------------------------------
function setupSystemTray() {
  const iconPath = getAppIcon()
  if (!fs.existsSync(iconPath)) return

  let trayIcon = nativeImage.createFromPath(iconPath)
  if (process.platform === 'darwin') {
    trayIcon = trayIcon.resize({ width: 18, height: 18 })
  } else {
    trayIcon = trayIcon.resize({ width: 24, height: 24 })
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('HBS CRM Pro')

  tray.on('click', () => {
    toggleMainWindow()
  })

  tray.on('double-click', () => {
    showMainWindow()
  })

  updateTray()
}

function updateTray() {
  if (!tray) return

  const statusLabel = isTracking ? '🟢 Status: Punched In (Tracking Active)' : '⚪ Status: Punched Out'
  const tooltip = isTracking ? 'HBS CRM Pro — Punched In (Active)' : 'HBS CRM Pro — Punched Out'

  tray.setToolTip(tooltip)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'HBS CRM Pro',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: statusLabel,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Open Dashboard',
      click: () => showMainWindow(),
    },
    {
      label: 'Refresh Page (F5)',
      click: () => mainWindow?.webContents.reload(),
    },
    {
      label: 'Open Downloads Folder',
      click: () => shell.openPath(app.getPath('downloads')),
    },
    {
      label: 'Check for Updates',
      click: () => autoUpdater.checkForUpdatesAndNotify(),
    },
    { type: 'separator' },
    {
      label: 'Quit HBS CRM Pro',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
}

function toggleMainWindow() {
  if (!mainWindow) {
    createWindow()
    return
  }
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide()
  } else {
    showMainWindow()
  }
}

// ---------------------------------------------------------------------------
// Download Manager: Handles CSV, Excel, PDF Reports cleanly
// ---------------------------------------------------------------------------
function setupDownloadManager() {
  const electronSession = session.fromPartition(PARTITION)

  // Auto-grant permissions for desktop experience
  electronSession.setPermissionCheckHandler((_webContents, permission) => {
    if (permission === 'notifications' || permission === 'media') return true
    return false
  })
  electronSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'notifications' || permission === 'media') return callback(true)
    callback(false)
  })

  electronSession.on('will-download', (_event, item) => {
    const fileName = item.getFilename()
    const downloadsFolder = app.getPath('downloads')
    const savePath = path.join(downloadsFolder, fileName)

    item.setSavePath(savePath)
    log.info(`Report download started: ${fileName} -> ${savePath}`)

    mainWindow?.webContents.send('download:started', { fileName })

    item.on('updated', (_ev, state) => {
      if (state === 'interrupted') {
        log.warn(`Download interrupted: ${fileName}`)
      }
    })

    item.once('done', (_ev, state) => {
      if (state === 'completed') {
        const finalPath = item.getSavePath()
        log.info(`Download completed successfully: ${finalPath}`)

        // Native OS notification
        if (Notification.isSupported()) {
          const notif = new Notification({
            title: 'Report Downloaded',
            body: `${fileName} has been saved to Downloads. Tap to view.`,
            icon: getAppIcon(),
          })
          notif.on('click', () => {
            shell.showItemInFolder(finalPath)
          })
          notif.show()
        }

        mainWindow?.webContents.send('download:completed', { fileName, filePath: finalPath })
      } else {
        log.error(`Download failed with state: ${state}`)
        mainWindow?.webContents.send('download:failed', { fileName, state })
      }
    })
  })
}

// ---------------------------------------------------------------------------
// Close Handling & Tracking Alert
// ---------------------------------------------------------------------------
async function handleWindowCloseRequest() {
  const token = await getAuthToken()
  if (!token) {
    mainWindow?.destroy()
    return
  }

  try {
    const res = await fetch(`${API_BASE}/api/mobile/attendance/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = res.ok ? await res.json().catch(() => null) : null
    const stillTracking = !!json?.data?.trackingEnabled
    isTracking = stillTracking
    updateTray()

    if (stillTracking) {
      showTrackingAlert()
      // Minimize/hide to tray instead of hard close
      mainWindow?.hide()
      if (tray) {
        tray.displayBalloon?.({
          title: 'HBS CRM Pro is still running',
          content: 'You are currently punched in. Attendance tracking continues in background.',
          icon: getAppIcon(),
        })
      }
    } else {
      mainWindow?.destroy()
    }
  } catch (err) {
    log.error('Close verification failed:', err)
    if (isTracking) {
      showTrackingAlert()
      mainWindow?.hide()
    } else {
      mainWindow?.destroy()
    }
  }
}

function showTrackingAlert() {
  if (alertWindow) {
    alertWindow.focus()
    return
  }
  alertWindow = new BrowserWindow({
    width: 400,
    height: 240,
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
  alertWindow.on('closed', () => {
    alertWindow = null
  })
}

// ---------------------------------------------------------------------------
// Idle Time Alert Popup
// ---------------------------------------------------------------------------
function showIdleAlert() {
  if (idleAlertWindow) {
    idleAlertWindow.focus()
    return
  }
  idleAlertWindow = new BrowserWindow({
    width: 420,
    height: 250,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    parent: mainWindow ?? undefined,
    modal: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'idle-alert-preload.js'),
    },
  })
  idleAlertWindow.loadFile(path.join(__dirname, 'idle-alert.html'))
  idleAlertWindow.once('ready-to-show', () => {
    idleAlertWindow?.show()
    // Flash frame to get user's attention
    mainWindow?.flashFrame(true)
  })
  idleAlertWindow.on('closed', () => {
    idleAlertWindow = null
  })
}

// ---------------------------------------------------------------------------
// Update Alert Window
// ---------------------------------------------------------------------------
function showUpdateReadyAlert() {
  if (updateAlertWindow) {
    updateAlertWindow.focus()
    return
  }
  updateAlertWindow = new BrowserWindow({
    width: 400,
    height: 240,
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
  updateAlertWindow.on('closed', () => {
    updateAlertWindow = null
  })
}

// ---------------------------------------------------------------------------
// IPC Handlers
// ---------------------------------------------------------------------------
function setupIPCHandlers() {
  // Offline page reload request
  ipcMain.on('app:reload', () => {
    mainWindow?.loadURL(API_BASE)
  })

  // Update alert
  ipcMain.on('update-alert:restart-now', () => {
    autoUpdater.quitAndInstall()
  })

  // Idle alert actions
  ipcMain.on('idle-alert:active', () => {
    accumulatedIdleSeconds = 0
    idleAlertWindow?.close()
    showMainWindow()
  })

  ipcMain.on('idle-alert:dismiss', () => {
    idleAlertWindow?.close()
  })

  // Shell actions
  ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url))
  ipcMain.handle('shell:openPath', (_e, targetPath: string) => shell.openPath(targetPath))
  ipcMain.handle('shell:showItemInFolder', (_e, targetPath: string) => shell.showItemInFolder(targetPath))
  ipcMain.handle('shell:openDownloadsFolder', () => shell.openPath(app.getPath('downloads')))

  // Window control actions
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)
  ipcMain.handle('window:flash', () => mainWindow?.flashFrame(true))

  // App Badge Count
  ipcMain.handle('app:setBadgeCount', (_e, count: number) => {
    if (app.setBadgeCount) app.setBadgeCount(count)
    if (process.platform === 'win32' && count > 0) {
      mainWindow?.flashFrame(true)
    }
  })

  // Native Notification Trigger
  ipcMain.handle('notification:show', (_e, opts: { title: string; body: string; link?: string; tag?: string }) => {
    if (!Notification.isSupported()) return false

    const notif = new Notification({
      title: opts.title || 'HBS CRM',
      body: opts.body || '',
      icon: getAppIcon(),
    })

    notif.on('click', () => {
      showMainWindow()
      if (opts.link) {
        mainWindow?.webContents.send('navigate:to', opts.link)
      }
    })

    notif.show()
    mainWindow?.flashFrame(true)
    return true
  })

  // Manual Report Download Trigger
  ipcMain.handle('report:download', (_e, { url, suggestedName }: { url: string; suggestedName?: string }) => {
    const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`
    log.info('Explicit report download request:', fullUrl, suggestedName)
    mainWindow?.webContents.downloadURL(fullUrl)
    return true
  })

  // Tracker Status & Actions
  ipcMain.handle('tracker:status', () => ({
    isTracking,
    sessionId: store.get('sessionId') || null,
    settings: currentSettings,
  }))

  ipcMain.handle('tracker:punchout', async () => {
    const token = await getAuthToken()
    if (token) {
      await stopTracking(token)
    }
  })
}

// ---------------------------------------------------------------------------
// Authentication & Tracking Loop
// ---------------------------------------------------------------------------
async function getAuthToken(): Promise<string | null> {
  const electronSession = session.fromPartition(PARTITION)
  const cookies = await electronSession.cookies.get({ url: API_BASE, name: 'auth-token' })
  return cookies[0]?.value ?? null
}

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
    if (wasLoggedIn) {
      wasLoggedIn = false
      mainWindow?.loadURL(API_BASE)
    }
    updateTray()
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
    updateTray()
  } catch (err) {
    log.error('Tracking status sync failed:', err)
  }
}

async function startTracking(token: string) {
  try {
    const res = await fetch(`${API_BASE}/api/tracker/checkin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const json = await res.json().catch(() => null)
    const data = json?.data
    if (!data || !data.tracking) return

    store.set('sessionId', data.session.id)
    currentSettings = data.settings
    accumulatedIdleSeconds = 0
    isTracking = true
    startIdlePolling()
    updateTray()
    mainWindow?.webContents.send('tracker:state-changed', true)
  } catch (err) {
    log.error('Start tracking error:', err)
  }
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
  updateTray()
  mainWindow?.webContents.send('tracker:state-changed', false)
}

// ---------------------------------------------------------------------------
// Idle Polling & Inactivity Alert
// ---------------------------------------------------------------------------
function startIdlePolling() {
  if (idlePollTimer) clearInterval(idlePollTimer)
  idlePollTimer = setInterval(() => {
    const idleSecs = powerMonitor.getSystemIdleTime()
    if (idleSecs >= 30) {
      accumulatedIdleSeconds += 30
    }

    const threshold = currentSettings?.idleThresholdSeconds || DEFAULT_IDLE_THRESHOLD_SECONDS
    if (isTracking && idleSecs >= threshold && !idleAlertWindow) {
      showIdleAlert()
    }
  }, IDLE_CHECK_INTERVAL_MS)
}

function stopIdlePolling() {
  if (idlePollTimer) clearInterval(idlePollTimer)
  idlePollTimer = null
}

// ---------------------------------------------------------------------------
// Screenshot Capture
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
  if (!token) return
  try {
    const res = await fetch(`${API_BASE}/api/tracker/screenshot-request`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const json = await res.json().catch(() => null)
    const pendingId = json?.data?.id
    if (pendingId) await captureAndUploadScreenshot(pendingId, token)
  } catch (err) {
    log.error('Screenshot poll failed:', err)
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
    log.error('Screenshot capture failed:', err)
  }
}

// ---------------------------------------------------------------------------
// Power & Screen Listeners
// ---------------------------------------------------------------------------
powerMonitor.on('resume', () => {
  mainWindow?.loadURL(API_BASE)
})
powerMonitor.on('unlock-screen', () => {
  mainWindow?.loadURL(API_BASE)
})

// ---------------------------------------------------------------------------
// App Lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  setupApplicationMenu()
  setupIPCHandlers()
  setupDownloadManager()
  createWindow()
  setupSystemTray()
  startSyncLoop()
  startScreenshotPolling()

  if (app.isPackaged) {
    log.transports.file.level = 'info'
    autoUpdater.logger = log
    log.info('App starting, version:', app.getVersion())
    autoUpdater.checkForUpdatesAndNotify()
  }
})

app.on('window-all-closed', () => {
  stopSyncLoop()
  stopScreenshotPolling()
  stopIdlePolling()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  showMainWindow()
})

app.on('before-quit', () => {
  isQuitting = true
})

// ---------------------------------------------------------------------------
// Auto-Updater Listeners
// ---------------------------------------------------------------------------
autoUpdater.on('update-available', (info) => {
  log.info('Update Available:', info.version)
})
autoUpdater.on('error', (err) => {
  log.error('Auto-update error:', err)
})
autoUpdater.on('update-downloaded', () => {
  log.info('Update downloaded, showing alert')
  showUpdateReadyAlert()
})
