"use strict";

// Exposes window.forgeHost to the ColeForge shell (see shell/js/core.js: CF.host).
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("forgeHost", {
  webview: true,
  platform: process.platform,
  power: (action) => ipcRenderer.invoke("forge:power", action),
  openExternal: (url) => ipcRenderer.invoke("forge:openExternal", url),
  sysInfo: () => ipcRenderer.invoke("forge:sysInfo"),
  launchGame: (spec) => ipcRenderer.invoke("forge:launchGame", spec),
  onNewTab: (fn) => ipcRenderer.on("forge:new-tab", (_e, url) => fn(url)),
});
