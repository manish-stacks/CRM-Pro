// src/idle-alert-preload.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('idleAlert', {
  confirmActive: () => ipcRenderer.send('idle-alert:active'),
  dismiss: () => ipcRenderer.send('idle-alert:dismiss'),
})
