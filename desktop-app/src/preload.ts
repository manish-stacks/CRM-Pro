// src/preload.ts
// Secure bridge between Electron main process and HBS CRM web dashboard
import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  isDesktop: true,
  platform: process.platform,

  // Reports & Downloads
  downloadReport: (url: string, suggestedName?: string) =>
    ipcRenderer.invoke('report:download', { url, suggestedName }),

  onDownloadStarted: (cb: (data: { fileName: string }) => void) => {
    const handler = (_: any, data: any) => cb(data)
    ipcRenderer.on('download:started', handler)
    return () => { ipcRenderer.removeListener('download:started', handler) }
  },
  onDownloadCompleted: (cb: (data: { fileName: string; filePath: string }) => void) => {
    const handler = (_: any, data: any) => cb(data)
    ipcRenderer.on('download:completed', handler)
    return () => { ipcRenderer.removeListener('download:completed', handler) }
  },
  onDownloadFailed: (cb: (data: { fileName: string; state: string }) => void) => {
    const handler = (_: any, data: any) => cb(data)
    ipcRenderer.on('download:failed', handler)
    return () => { ipcRenderer.removeListener('download:failed', handler) }
  },

  // Notifications
  showNotification: (opts: { title: string; body: string; link?: string; sound?: boolean; tag?: string }) =>
    ipcRenderer.invoke('notification:show', opts),

  // Shell & Files
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),
  showItemInFolder: (path: string) => ipcRenderer.invoke('shell:showItemInFolder', path),
  openDownloadsFolder: () => ipcRenderer.invoke('shell:openDownloadsFolder'),

  // Window Controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Badge & Focus
  setBadgeCount: (count: number) => ipcRenderer.invoke('app:setBadgeCount', count),
  flashWindow: () => ipcRenderer.invoke('window:flash'),

  // Tracking & Status
  getTrackingStatus: () => ipcRenderer.invoke('tracker:status'),
  punchOut: () => ipcRenderer.invoke('tracker:punchout'),
  onTrackingStateChanged: (cb: (isTracking: boolean) => void) => {
    const handler = (_: any, isTracking: boolean) => cb(isTracking)
    ipcRenderer.on('tracker:state-changed', handler)
    return () => { ipcRenderer.removeListener('tracker:state-changed', handler) }
  },

  // Navigation from native notification click
  onNavigate: (cb: (path: string) => void) => {
    const handler = (_: any, path: string) => cb(path)
    ipcRenderer.on('navigate:to', handler)
    return () => { ipcRenderer.removeListener('navigate:to', handler) }
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// Legacy tracker methods for backwards compatibility
contextBridge.exposeInMainWorld('tracker', {
  login: (email: string, password: string) => ipcRenderer.invoke('auth:login', { email, password }),
  checkIn: () => ipcRenderer.invoke('tracker:checkin'),
  checkOut: () => ipcRenderer.invoke('tracker:checkout'),
})

export type ElectronAPI = typeof electronAPI
