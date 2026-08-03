// electron-app/src/preload.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('tracker', {
  login: (email: string, password: string) => ipcRenderer.invoke('auth:login', { email, password }),
  checkIn: () => ipcRenderer.invoke('tracker:checkin'),
  checkOut: () => ipcRenderer.invoke('tracker:checkout'),
})
