"use strict";

// ColeForge desktop host (Electron). Runs the ColeForge shell as a normal app window, or as the
// full-screen Windows shell replacement when started with --shell (see core/windows/).
//   ColeForge.exe            windowed
//   ColeForge.exe --shell    full-screen replacement for explorer.exe
//   ColeForge.exe --kiosk    full-screen, no exit shortcuts (bootable kiosk builds)

const { app, BrowserWindow, ipcMain, shell, session, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn, exec } = require("child_process");

const SHELL_MODE = process.argv.includes("--shell");
const KIOSK = process.argv.includes("--kiosk");
const PORT = 8098;
// Packaged builds carry shell/ and server/ under app/; a source checkout uses the sibling folders.
const APP_ROOT = fs.existsSync(path.join(__dirname, "app", "shell")) ? path.join(__dirname, "app") : path.join(__dirname, "..");

let win = null;

function startLanServer() {
  // The LAN server serves the shell on http://localhost (a secure context, so webcam/mic work)
  // and hosts ForgeChat for friends on the network. If another instance owns the port, reuse it.
  return new Promise((resolve) => {
    try {
      process.env.PORT = String(PORT);
      const { server } = require(path.join(APP_ROOT, "server", "forgechat-server.js"));
      server.once("listening", () => resolve(true));
      server.once("error", () => resolve(false));
    } catch (e) {
      console.error("LAN server failed:", e.message);
      resolve(false);
    }
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1366, height: 800, minWidth: 800, minHeight: 600,
    fullscreen: SHELL_MODE || KIOSK, kiosk: KIOSK, frame: !(SHELL_MODE || KIOSK), autoHideMenuBar: true,
    backgroundColor: "#02060f", title: "Windows – ColeForge Edition",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, webviewTag: true, sandbox: false },
  });
  Menu.setApplicationMenu(null);
  win.loadURL(`http://localhost:${PORT}/`);
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  if (SHELL_MODE || KIOSK) win.on("close", (e) => { if (!app.isQuitting) e.preventDefault(); });
}

// Harden embedded browser tabs: no Node, no preload, no insecure content.
app.on("web-contents-created", (_e, contents) => {
  contents.on("will-attach-webview", (_ev, webPreferences) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
  });
  if (contents.getType() === "webview") contents.setWindowOpenHandler(({ url }) => { win?.webContents.send("forge:new-tab", url); return { action: "deny" }; });
});

/* ---------------- host bridge ---------------- */
ipcMain.handle("forge:openExternal", (_e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });

ipcMain.handle("forge:power", (_e, action) => {
  app.isQuitting = true;
  if (!SHELL_MODE && !KIOSK) return app.quit();
  const cmds = process.platform === "win32"
    ? { shutdown: "shutdown /s /t 0", restart: "shutdown /r /t 0", logoff: "shutdown /l" }
    : { shutdown: "systemctl poweroff", restart: "systemctl reboot", logoff: "loginctl terminate-session self" };
  exec(cmds[action] || cmds.shutdown);
});

ipcMain.handle("forge:sysInfo", async () => {
  const drives = [];
  const letters = process.platform === "win32" ? "CDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => l + ":\\") : ["/"];
  for (const root of letters) {
    try {
      const s = await fs.promises.statfs(root);
      const total = s.blocks * s.bsize, free = s.bavail * s.bsize;
      drives.push({ name: process.platform === "win32" ? `Drive (${root.slice(0, 2)})` : "Root (/)", detail: `${(free / 1e9).toFixed(1)} GB free of ${(total / 1e9).toFixed(1)} GB` });
    } catch { /* no such drive */ }
  }
  return { os: `${os.type()} ${os.release()} (${os.arch()})`, cpu: os.cpus()[0]?.model || "CPU", totalmem: os.totalmem(), drives };
});

ipcMain.handle("forge:launchGame", (_e, { command }) => {
  if (typeof command !== "string" || !command.trim()) throw new Error("No command configured");
  // Run from the engine's folder when an absolute path is given, so ports find their data files.
  const m = /^"?([A-Za-z]:\\[^"]+?\.exe|\/[^\s"]+)"?/.exec(command.trim());
  const cwd = m ? path.dirname(m[1]) : os.homedir();
  const child = spawn(command, { shell: true, cwd, detached: true, stdio: "ignore" });
  child.on("error", () => {});
  child.unref();
  return true;
});

app.whenReady().then(async () => {
  // Allow webcam/mic/screen capture for ForgeChat calls from the local shell only.
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(wc.getURL().startsWith(`http://localhost:${PORT}`) && ["media", "display-capture", "clipboard-read", "clipboard-sanitized-write", "notifications", "fullscreen"].includes(permission)));
  await startLanServer();
  createWindow();
});
app.on("window-all-closed", () => app.quit());
