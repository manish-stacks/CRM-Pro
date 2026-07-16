"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// electron-app/src/preload.ts
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('tracker', {
    login: (email, password) => electron_1.ipcRenderer.invoke('auth:login', { email, password }),
    checkIn: () => electron_1.ipcRenderer.invoke('tracker:checkin'),
    checkOut: () => electron_1.ipcRenderer.invoke('tracker:checkout'),
});
