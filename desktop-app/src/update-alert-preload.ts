// src/update-alert-preload.ts
// Tiny preload just for the custom "Update Ready" popup window — exposes a
// single restartNow() call over IPC so the renderer button can actually
// trigger autoUpdater.quitAndInstall() in the main process (window.close()
// alone, like the tracking alert uses, isn't enough here since this popup
// needs to *do* something, not just dismiss itself).
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('updateAlert', {
  restartNow: () => ipcRenderer.send('update-alert:restart-now'),
})
