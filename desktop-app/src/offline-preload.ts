// src/offline-preload.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('offlineBridge', {
  reload: () => ipcRenderer.send('app:reload'),
})
