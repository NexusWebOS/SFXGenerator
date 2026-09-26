"use strict";

// Exposes window.forgeHost to the ColeForge shell (see shell/js/core.js: CF.host).
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("forgeHost", {
  webview: true,
  platform: process.platform,
  power: (action) => ipcRenderer.invoke("forge:power", action),
  openExternal: (url) => ipcRenderer.invoke("forge:openExternal", url),
  openPanel: (id) => ipcRenderer.invoke("forge:openPanel", id),
  mode: () => ipcRenderer.invoke("forge:mode"),
  sysInfo: () => ipcRenderer.invoke("forge:sysInfo"),
  launchGame: (spec) => ipcRenderer.invoke("forge:launchGame", spec),
  legacyEngines: () => ipcRenderer.invoke("forge:legacyEngines"),
  legacyPrepare: (spec) => ipcRenderer.invoke("forge:legacyPrepare", spec),
  legacyOpen: (dir) => ipcRenderer.invoke("forge:legacyOpen", dir),
  programStatus: (id) => ipcRenderer.invoke("forge:programStatus", id),
  runProgram: (id) => ipcRenderer.invoke("forge:runProgram", id),
  onNewTab: (fn) => ipcRenderer.on("forge:new-tab", (_e, url) => fn(url)),
  shield: (opts) => ipcRenderer.invoke("forge:shield", opts),
  shieldStats: (webContentsId) => ipcRenderer.invoke("forge:shieldStats", webContentsId),
  shieldReset: (webContentsId) => ipcRenderer.invoke("forge:shieldReset", webContentsId),
});
