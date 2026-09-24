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

/* ---------------- Legacy Mode: DOSBox – ColeForge Edition + 86Box ---------------- */
// Engines live in %LOCALAPPDATA%\ColeForge\legacy\engines (core/windows/get-legacy-engines.ps1);
// game configs and 86Box machines sit next to them. The shell only ever writes inside this folder.
const LEGACY_HOME = path.join(process.env.LOCALAPPDATA || app.getPath("userData"), "ColeForge", "legacy");
// Letters, digits, space, dot and dash only, never starting with a dot (so never "." or "..").
const legacyDirName = (s) => String(s || "").replace(/[^\w .-]/g, "").replace(/^[\s.]+|[\s.]+$/g, "").slice(0, 40) || "Untitled";
function findExe(dir, names, depth = 3) {
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isFile() && names.some(n => n.toLowerCase() === e.name.toLowerCase())) return path.join(dir, e.name);
    }
    if (depth > 0) for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { const hit = findExe(path.join(dir, e.name), names, depth - 1); if (hit) return hit; }
    }
  } catch { /* not installed */ }
  return null;
}
ipcMain.handle("forge:legacyEngines", () => {
  const engines = path.join(LEGACY_HOME, "engines");
  const box86 = findExe(path.join(engines, "86box"), ["86Box.exe", "86Box"]);
  const roms = findExe(path.join(engines, "86box", "roms"), ["README.md", "readme.txt"], 1) ? path.join(engines, "86box", "roms") : null;
  return { home: LEGACY_HOME, dosbox: findExe(path.join(engines, "dosbox-staging"), ["dosbox.exe", "dosbox"]), box86, roms };
});
ipcMain.handle("forge:legacyPrepare", async (_e, { kind, name, text, diskBytes, overwrite } = {}) => {
  if (!["dos", "win9x"].includes(kind) || typeof text !== "string" || text.length > 65536) throw new Error("Bad Legacy Mode config");
  const dir = path.join(LEGACY_HOME, kind === "dos" ? "dos" : "machines", legacyDirName(name));
  await fs.promises.mkdir(dir, { recursive: true });
  const file = path.join(dir, kind === "dos" ? "dosbox.conf" : "86box.cfg");
  // 86Box rewrites its own cfg when you change settings in it, so only create it the first time.
  const write = kind === "dos" || overwrite || !fs.existsSync(file);
  if (write) await fs.promises.writeFile(file, text);
  let disk = null;
  if (kind === "win9x") {
    const img = /^hdd_01_fn = ([\w.-]+\.img)\s*$/m.exec(text)?.[1];
    const bytes = Math.min(Math.max(0, +diskBytes || 0), 8 * 1024 ** 3);
    if (img && bytes && !fs.existsSync(path.join(dir, img))) {
      const fh = await fs.promises.open(path.join(dir, img), "wx"); // blank raw disk, sized like the cfg's geometry
      await fh.truncate(bytes); await fh.close();
      disk = path.join(dir, img);
    }
  }
  return { dir, file, wrote: write, disk };
});
ipcMain.handle("forge:legacyOpen", (_e, dir) => {
  const target = path.resolve(String(dir || LEGACY_HOME));
  if (target !== LEGACY_HOME && !target.startsWith(LEGACY_HOME + path.sep)) throw new Error("Outside the Legacy Mode folder");
  fs.mkdirSync(target, { recursive: true });
  return shell.openPath(target);
});

/* ---------------- NightCode programs: Netcon + Disk Dude ---------------- */
// Official ColeForge programs from NexusWebOS/NightCode (programs/retro-tools). Runs a built .exe when
// there is one (core/windows/build-nightcode-programs.ps1), otherwise the Python source via "py -3".
const PROGRAMS = {
  netcon: { exe: "Netcon.exe", script: "netcon.py" },
  diskdude: { exe: "DiskDude.exe", script: "disk_dude.py" },
};
// Python can't read inside app.asar, so packaged builds unpack programs/ next to it (asarUnpack).
const PROGRAMS_SRC = path.join(APP_ROOT, "programs", "retro-tools").replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
const PROGRAMS_BIN = path.join(process.env.LOCALAPPDATA || app.getPath("userData"), "ColeForge", "programs");
function programStatus(id) {
  const p = PROGRAMS[id];
  const exe = [path.join(PROGRAMS_BIN, p.exe), path.join(PROGRAMS_SRC, "dist", p.exe)].find(f => fs.existsSync(f)) || null;
  return { id, exe, source: fs.existsSync(path.join(PROGRAMS_SRC, p.script)) ? path.join(PROGRAMS_SRC, p.script) : null, bin: PROGRAMS_BIN };
}
ipcMain.handle("forge:programStatus", (_e, id) => {
  if (!PROGRAMS[id]) throw new Error("Unknown program");
  return programStatus(id);
});
ipcMain.handle("forge:runProgram", (_e, id) => new Promise((resolve, reject) => {
  if (!PROGRAMS[id]) return reject(new Error("Unknown program"));
  const st = programStatus(id);
  let cmd, argv, cwd;
  if (st.exe) { cmd = st.exe; argv = []; cwd = path.dirname(st.exe); }
  else if (st.source) {
    cmd = process.platform === "win32" ? "py" : "python3";
    argv = process.platform === "win32" ? ["-3", st.source] : [st.source];
    cwd = PROGRAMS_SRC;
  } else return reject(new Error("Program files are missing from this ColeForge build."));
  const child = spawn(cmd, argv, { cwd, detached: true, stdio: "ignore", windowsHide: false });
  const fail = (e) => reject(new Error(st.exe ? e.message : `Couldn't start Python (${e.message}). Install Python 3.10+ with Pillow, or build the .exe with core\\windows\\build-nightcode-programs.ps1.`));
  child.once("error", fail);
  // If it's still alive shortly after starting, call it launched.
  setTimeout(() => { child.removeListener("error", fail); child.unref(); resolve({ ok: true, via: st.exe ? "exe" : "python" }); }, 800);
}));

app.whenReady().then(async () => {
  // Allow webcam/mic/screen capture for ForgeChat calls from the local shell only.
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(wc.getURL().startsWith(`http://localhost:${PORT}`) && ["media", "display-capture", "clipboard-read", "clipboard-sanitized-write", "notifications", "fullscreen"].includes(permission)));
  await startLanServer();
  createWindow();
});
app.on("window-all-closed", () => app.quit());
