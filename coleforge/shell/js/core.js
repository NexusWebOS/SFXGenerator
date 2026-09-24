"use strict";

// Windows – ColeForge Edition shell core: boot, window manager, taskbar, Start menu,
// context menus, dialogs, toasts, settings, sounds and a small document store.
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style") el.style.cssText = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "html") el.innerHTML = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
    return el;
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } },
  };
  const host = window.forgeHost || null; // Electron bridge when running as the real shell
  // Pop-ups from any web view go to the browser window used last (Forge Browser, NightBrowser, NightAmp).
  if (host && host.onNewTab) host.onNewTab((url) => (window.CF.newTabTarget || ((u) => window.CF.open("nightbrowser", { url: u })))(url));

  const DEFAULTS = {
    user: "Cole", avatar: null, wallpaper: "nightcode-live", customWall: null, accent: "#1f6fff", theme: "nightcode",
    cursors: true, sounds: true, soundScheme: "nightcode", volume: 0.8, uiScale: 1, showBrand: true, fastBoot: false, clock24: false,
    scheme: "nightcode", screensaver: "nightcode", saverMinutes: 10, highContrast: false, hcScheme: "hc-black", hcShortcut: true, followSystemHC: true,
  };
  const settings = Object.assign({}, DEFAULTS, store.get("cf.settings", {}));
  // NightCode edition: move existing installs over once (1: wallpaper, avatar, colours; 2: the full
  // NightCode desktop theme with its cursors and sounds; 3: the animated NightCode Live wallpaper).
  // Afterwards they're ordinary settings you can change in Control Panel.
  const ncVersion = settings.nightcode || 0;
  if (ncVersion < 3) {
    if (ncVersion < 1) {
      settings.wallpaper = "nightcode";
      settings.scheme = "nightcode";
      if (!settings.avatar || settings.avatar === "assets/art/avatars/cole-blue.png") settings.avatar = "assets/art/avatars/nightcode.png";
    }
    if (ncVersion < 2) {
      settings.theme = "nightcode";
      settings.cursors = true;
      settings.soundScheme = "nightcode";
    }
    if (settings.wallpaper === "nightcode") settings.wallpaper = "nightcode-live";
    settings.nightcode = 3;
    store.set("cf.settings", settings);
  }

  const CF = window.CF = {
    h, $, esc, store, host, settings, apps: {}, windows: [],
    version: "1.0.0", build: "2406",
    edition: "Windows – ColeForge Edition",
  };

  /* ---------------- settings ---------------- */
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt))));
    return "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
  }
  CF.saveSettings = () => { store.set("cf.settings", settings); CF.applySettings(); };
  CF.applySettings = () => {
    const root = document.documentElement.style;
    root.setProperty("--accent", settings.accent);
    root.setProperty("--accent-hi", shade(settings.accent, 0.35));
    root.setProperty("--accent-lo", shade(settings.accent, -0.55));
    root.setProperty("--ui-scale", settings.uiScale);
    document.body.classList.toggle("forge-cursors", !!settings.cursors);
    document.body.classList.toggle("nc-scanlines", !!settings.ncScanlines);
    // Appearance scheme: High Contrast (the Accessibility switch, or Windows' own when running as the
    // shell) wins, then the chosen scheme. High Contrast always uses the Windows 98 look, like 1998.
    const scheme = CF.effectiveScheme(), hc = scheme.startsWith("hc");
    // NightCode is built on the Windows 98 shell (same menus, dialogs, log-on) with its own skin on top.
    document.body.classList.toggle("theme-98", settings.theme !== "glass" || hc);
    const nc = settings.theme === "nightcode" && !hc, ncChanged = nc !== document.body.classList.contains("theme-nc");
    document.body.classList.toggle("theme-nc", nc);
    if (ncChanged) refreshIcons();
    for (const [id] of CF.SCHEMES) document.body.classList.toggle("scheme-" + id, id === scheme && id !== "standard" && id !== "auto");
    document.body.classList.toggle("hc", hc);
    const desk = $("#desktop");
    if (desk) {
      desk.className = "wall-" + settings.wallpaper;
      desk.style.backgroundImage = settings.wallpaper === "custom" && settings.customWall ? `url("${settings.customWall}")` : "";
      liveWallpaper(desk, settings.wallpaper === "nightcode-live");
    }
    const brand = $("#desk-brand");
    if (brand) brand.style.display = settings.showBrand ? "" : "none";
    const av = CF.avatar();
    document.querySelectorAll("img.my-avatar").forEach(img => { img.src = av; });
    document.querySelectorAll(".my-name").forEach(el => { el.textContent = settings.user; });
  };
  // "NightCode Live": the code rain (js/nightcode-rain.js) behind the desktop icons, with the logo where
  // the still wallpaper has it. 30 fps, and paused while a maximized window covers the desktop.
  let live = null;
  function liveWallpaper(desk, on) {
    if (!on || !window.NightCodeRain) { if (live) { live.rain.stop(); live.el.remove(); live = null; } return; }
    if (live) return;
    const el = h("div", { id: "live-wall" });
    desk.prepend(el);
    const covered = () => CF.windows.some(w => w.el.classList.contains("max") && !w.el.classList.contains("min"));
    live = { el, rain: NightCodeRain(el, { logo: "fixed", logoX: 0.62, logoY: 0.48, logoSize: 0.74, fps: 30, rainOpacity: 0.85, paused: covered }) };
  }
  CF.avatar = () => settings.avatar || "assets/art/avatars/nightcode.png";
  CF.THEMES = [["nightcode", "NightCode"], ["98", "Windows 98 Classic"], ["glass", "ColeForge Glass"]];
  CF.is98 = () => document.body.classList.contains("theme-98");
  CF.SCHEMES = [["nightcode", "NightCode"], ["standard", "Windows Standard"], ["dark", "ColeForge Dark"], ["auto", "Automatic (match Windows light/dark)"],
    ["hc-black", "High Contrast Black"], ["hc-white", "High Contrast White"], ["hc1", "High Contrast #1"], ["hc2", "High Contrast #2"]];
  CF.HC_SCHEMES = CF.SCHEMES.filter(([id]) => id.startsWith("hc"));
  const mq = (q) => (window.matchMedia ? matchMedia(q) : { matches: false, addEventListener() {} });
  const systemHC = mq("(forced-colors: active)"), systemDark = mq("(prefers-color-scheme: dark)");
  CF.effectiveScheme = () => {
    if (settings.highContrast) return settings.hcScheme || "hc-black";
    if (settings.followSystemHC && systemHC.matches) return systemDark.matches ? "hc-black" : "hc-white";
    if (settings.theme === "nightcode") return "nightcode";
    if (settings.scheme === "auto") return systemDark.matches ? "dark" : "standard";
    return CF.SCHEMES.some(([id]) => id === settings.scheme) ? settings.scheme : "standard";
  };
  systemHC.addEventListener?.("change", () => CF.applySettings());
  systemDark.addEventListener?.("change", () => CF.applySettings());

  // Left Alt + Left Shift + Print Screen, with the confirmation Windows 98 showed.
  CF.toggleHighContrast = async (ask = true) => {
    const turningOn = !settings.highContrast;
    if (ask) {
      const r = await CF.dialog({ title: "High Contrast", icon: "question", buttons: ["OK", "Cancel"],
        message: turningOn
          ? "The keyboard shortcut for High Contrast is: Press Left ALT+Left SHIFT+PRINT SCREEN.\n\nThis shortcut sets up High Contrast, which makes the screen easier to read. Do you want to use High Contrast?"
          : "Do you want to turn off High Contrast?" });
      if (r.button !== "OK") return;
    }
    settings.highContrast = turningOn;
    CF.saveSettings();
    CF.sound(turningOn ? "maximize" : "minimize");
  };

  /* ---------------- avatar picker ---------------- */
  let avatarList = null;
  CF.avatars = async () => {
    if (!avatarList) avatarList = await fetch("assets/art/avatars/avatars.json").then(r => r.json()).catch(() => []);
    return avatarList;
  };
  CF.pickAvatar = async () => {
    const list = await CF.avatars();
    return new Promise(resolve => {
      const w = CF.createWindow({ title: "Change Picture", icon: "control", w: 560, h: 440, resizable: false });
      const grid = h("div", { class: "avatar-grid" });
      const finish = (v) => { w.close(true); resolve(v); };
      for (const a of list) {
        const b = h("button", { class: "av clickable" + (settings.avatar === a.file ? " on" : ""), title: a.label }, h("img", { src: a.file, alt: a.label }), h("small", {}, a.label));
        b.addEventListener("click", () => { settings.avatar = a.file; CF.saveSettings(); finish(a.file); });
        grid.append(b);
      }
      const upload = h("button", { class: "btn" }, "Browse…");
      upload.addEventListener("click", () => {
        const inp = h("input", { type: "file", accept: "image/*" });
        inp.addEventListener("change", () => {
          const f = inp.files[0]; if (!f) return;
          const img = new Image();
          img.onload = () => { const c = document.createElement("canvas"); c.width = c.height = 128; const k = Math.min(img.width, img.height); c.getContext("2d").drawImage(img, (img.width - k) / 2, (img.height - k) / 2, k, k, 0, 0, 128, 128); settings.avatar = c.toDataURL("image/png"); CF.saveSettings(); URL.revokeObjectURL(img.src); finish(settings.avatar); };
          img.src = URL.createObjectURL(f);
        });
        inp.click();
      });
      w.on("close", () => resolve(null));
      w.body.append(h("div", { class: "pad" }, h("div", {}, "Pick a picture for your account and ForgeChat:"), grid, h("div", { class: "row", style: "justify-content:flex-end" }, upload, h("button", { class: "btn", onclick: () => finish(null) }, "Cancel"))));
    });
  };

  /* ---------------- sounds ---------------- */
  // "studio" = ElevenLabs-generated scheme in assets/sounds/studio/, "classic" = procedural synth scheme.
  CF.SOUND_SCHEMES = [["nightcode", "NightCode (chiptune synth)"], ["studio", "ColeForge Studio (ElevenLabs)"], ["classic", "ColeForge Classic (synth)"]];
  const SOUND_DIRS = { classic: "", nightcode: "nightcode/", studio: "studio/" };
  CF.soundUrl = (name) => `assets/sounds/${SOUND_DIRS[settings.soundScheme] ?? "studio/"}${name}.wav`;
  const soundCache = {};
  CF.sound = (name) => {
    if (!settings.sounds) return;
    try {
      const url = CF.soundUrl(name);
      const base = soundCache[url] || (soundCache[url] = new Audio(url));
      const a = base.cloneNode();
      a.volume = settings.volume;
      a.play().catch(() => {});
    } catch { /* audio unavailable */ }
  };

  // 16-bit pixel logos: the Game Browser always, ForgeChat in the Windows 98 theme.
  const PIXEL_ICONS = {
    gamebrowser: "assets/art/gamebrowser/logo.png", legacy: "assets/art/legacy/logo.png",
    netcon: "assets/art/programs/netcon-64.png", diskdude: "assets/art/programs/diskdude-64.png", nightcode: "assets/art/nightcode/logo-128.png",
    winnight: "assets/art/nightapps/winnight.png", nightamp: "assets/art/nightapps/nightamp.png", nightbrowser: "assets/art/nightapps/nightbrowser.png",
  };
  // The NightCode theme has its own neon pixel set (art/nightcode/build_nightcode_theme.py).
  const NC_ICONS = new Set(["computer", "documents", "folder", "recycle", "forgeamp", "forgevision", "forgecraft", "browser", "notepad", "control",
    "arcade", "network", "info", "warning", "question", "error", "volume", "file", "image", "run", "shutdown"]);
  CF.icon = (id) => {
    if (PIXEL_ICONS[id]) return PIXEL_ICONS[id];
    const cls = document.body?.classList;
    if (cls?.contains("theme-nc")) {
      if (NC_ICONS.has(id)) return `assets/art/nightcode/icons/${id}.png`;
      if (id === "logo") return "assets/art/nightcode/logo-64.png";
    }
    return id === "forgechat" && cls?.contains("theme-98") ? "assets/art/forgechat/logo.png" : window.CFIcons.get(id);
  };
  // After a theme switch, swap every icon already on screen for the new theme's version.
  function refreshIcons() {
    if (!window.CFIcons) return;
    const ids = new Map();
    for (const id of window.CFIcons.ids) ids.set(window.CFIcons.get(id), id);
    for (const id of NC_ICONS) ids.set(`assets/art/nightcode/icons/${id}.png`, id);
    ids.set("assets/art/nightcode/logo-64.png", "logo");
    ids.set("assets/art/forgechat/logo.png", "forgechat");
    document.querySelectorAll("img").forEach(img => { const id = ids.get(img.getAttribute("src")); if (id) img.src = CF.icon(id); });
  }

  /* ---------------- document store (My Documents + Recycle Bin) ---------------- */
  const vfsKey = "cf.vfs";
  const vfsLoad = () => store.get(vfsKey, { docs: {}, bin: {} });
  CF.vfs = {
    list: () => Object.values(vfsLoad().docs).sort((a, b) => a.name.localeCompare(b.name)),
    bin: () => Object.values(vfsLoad().bin),
    read: (name) => vfsLoad().docs[name] || null,
    write(name, data, type = "text") {
      const fs = vfsLoad();
      fs.docs[name] = { name, type, data, modified: Date.now() };
      if (!store.set(vfsKey, fs)) { CF.dialog({ title: "Disk Full", icon: "error", message: "My Documents is full. Export large files instead." }); return false; }
      CF.emit("vfs");
      return true;
    },
    remove(name) {
      const fs = vfsLoad();
      if (!fs.docs[name]) return;
      fs.bin[name] = fs.docs[name]; delete fs.docs[name];
      store.set(vfsKey, fs); CF.emit("vfs");
    },
    restore(name) {
      const fs = vfsLoad();
      if (!fs.bin[name]) return;
      fs.docs[name] = fs.bin[name]; delete fs.bin[name];
      store.set(vfsKey, fs); CF.emit("vfs");
    },
    emptyBin() { const fs = vfsLoad(); fs.bin = {}; store.set(vfsKey, fs); CF.emit("vfs"); CF.sound("recycle"); },
    // Binary files (archives, music, video) are kept as data: URLs with type "file".
    readBytes(name) {
      const d = vfsLoad().docs[name];
      if (!d) return null;
      if (typeof d.data === "string" && d.data.startsWith("data:")) {
        const b64 = d.data.slice(d.data.indexOf(",") + 1), bin = atob(b64), out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
      }
      return new TextEncoder().encode(d.data || "");
    },
    writeBytes(name, bytes, mime = "application/octet-stream") {
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      const type = mime.startsWith("image/") ? "image" : "file";
      return CF.vfs.write(name, `data:${mime};base64,${btoa(bin)}`, type);
    },
  };

  // File associations: programs claim extensions so My Documents (and each other) open files with them.
  CF.fileTypes = [];
  CF.associate = (exts, app, icon) => CF.fileTypes.push({ exts, app, icon: icon || app });
  CF.fileType = (name) => { const ext = String(name).toLowerCase().split(".").pop(); return CF.fileTypes.find(t => t.exts.includes(ext)) || null; };
  CF.download = (name, bytes, mime = "application/octet-stream") => {
    const url = URL.createObjectURL(bytes instanceof Blob ? bytes : new Blob([bytes], { type: mime }));
    const a = h("a", { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  /* ---------------- tiny event bus ---------------- */
  const listeners = {};
  CF.on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); return () => { listeners[ev] = listeners[ev].filter(f => f !== fn); }; };
  CF.emit = (ev, data) => (listeners[ev] || []).slice().forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });

  /* ---------------- context menus ---------------- */
  let openCtx = null;
  function buildMenu(items) {
    const menu = h("div", { class: "ctx", role: "menu" });
    for (const it of items) {
      if (!it) continue;
      if (it === "-") { menu.append(h("div", { class: "cs" })); continue; }
      const row = h("div", { class: "ci" + (it.items ? " sub" : "") + (it.disabled ? " disabled" : "") + (it.checked ? " checked" : ""), role: "menuitem" },
        it.icon ? h("img", { src: CF.icon(it.icon), alt: "" }) : null, h("span", {}, it.label), it.key ? h("span", { class: "k" }, it.key) : null);
      if (it.items) row.append(buildMenu(it.items));
      else row.addEventListener("click", (e) => { e.stopPropagation(); CF.closeMenus(); CF.sound("menu_click"); it.action && it.action(); });
      menu.append(row);
    }
    return menu;
  }
  CF.closeMenus = () => {
    if (openCtx) { openCtx.remove(); openCtx = null; }
    document.querySelectorAll(".menubar > .open").forEach(m => m.classList.remove("open"));
  };
  CF.contextMenu = (pos, items) => {
    CF.closeMenus();
    const menu = buildMenu(items);
    document.body.append(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(2, Math.min(pos.x, innerWidth - r.width - 4)) + "px";
    menu.style.top = Math.max(2, Math.min(pos.y, innerHeight - r.height - 4)) + "px";
    openCtx = menu;
    CF.sound("menu_popup");
    return menu;
  };
  addEventListener("pointerdown", (e) => {
    if (openCtx && !openCtx.contains(e.target) && !e.target.closest(".menubar")) CF.closeMenus();
    const sm = $("#start-menu");
    if (sm && sm.classList.contains("open") && !sm.contains(e.target) && !e.target.closest("#start-btn")) CF.toggleStart(false);
  }, true);

  /* ---------------- dialogs & toasts ---------------- */
  // inputType: "password" etc. content: extra form elements shown under the message.
  CF.dialog = ({ title = "ColeForge", icon = "info", message = "", buttons = ["OK"], input = null, inputType = "text", content = null, sound } = {}) => new Promise(resolve => {
    const field = input != null ? h("input", { class: "field", value: input, type: inputType, autocomplete: "off" }) : null;
    const veil = h("div", { class: "dlg-veil" });
    const finish = (button) => { veil.remove(); resolve({ button, value: field ? field.value : undefined }); };
    const win = h("div", { class: "win active" },
      h("div", { class: "titlebar" }, h("img", { src: CF.icon("logo"), alt: "" }), h("span", { class: "title" }, title),
        h("button", { class: "tb-btn close", title: "Close", onclick: () => finish(null) }, "✕")),
      h("div", { class: "dlg-body" }, h("img", { src: CF.icon(icon), alt: "" }), h("div", { style: "flex:1;min-width:0" }, h("div", { class: "msg" }, message), field, content)),
      h("div", { class: "dlg-btns" }, buttons.map((b, i) => h("button", { class: "btn" + (i ? " flat" : ""), onclick: () => finish(b) }, b))));
    veil.append(h("div", { class: "dlg" }, win));
    veil.addEventListener("keydown", (e) => { if (e.key === "Enter") finish(buttons[0]); if (e.key === "Escape") finish(null); });
    document.body.append(veil);
    (field || content?.querySelector?.("input, select, textarea") || win.querySelector(".dlg-btns .btn")).focus();
    CF.sound(sound || { info: "ding", warning: "exclamation", error: "critical_stop", question: "question" }[icon] || "ding");
  });
  CF.toast = ({ title, body = "", icon = "info", timeout = 5000, onclick } = {}) => {
    const stack = $("#toasts");
    const el = h("div", { class: "toast clickable" }, h("img", { src: CF.icon(icon), alt: "" }), h("div", {}, h("b", {}, title), h("small", {}, body)), h("span", { class: "x" }, "✕"));
    const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 300); };
    el.addEventListener("click", (e) => { if (!e.target.classList.contains("x") && onclick) onclick(); close(); });
    stack.append(el);
    while (stack.children.length > 4) stack.firstChild.remove();
    CF.sound("notify");
    setTimeout(close, timeout);
  };

  /* ---------------- window manager ---------------- */
  let zTop = 100, winSeq = 0, cascade = 0;
  CF.register = (app) => { CF.apps[app.id] = app; };

  CF.open = (appId, args = {}) => {
    const app = CF.apps[appId];
    if (!app) return CF.dialog({ title: "Run", icon: "error", message: `Cannot find '${appId}'. Make sure you typed the name correctly, and then try again.` });
    if (app.single) {
      const existing = CF.windows.find(w => w.appId === appId);
      if (existing) { existing.restore(); existing.focus(); existing.emit("args", args); return existing; }
    }
    CF.toggleStart(false);
    document.body.classList.add("busy");
    setTimeout(() => document.body.classList.remove("busy"), 350);
    const w = CF.createWindow({ appId, title: app.name, icon: app.icon, ...(app.window || {}) });
    try { app.open(w, args); } catch (e) { console.error(e); w.close(); CF.dialog({ title: app.name, icon: "error", message: "This program has performed an illegal operation and will be shut down.\n\n" + e.message }); }
    return w;
  };

  // frameless: the app draws its own skinned title bar (NightAmp) and calls win.dragBy(handle).
  CF.createWindow = ({ appId = null, title = "Window", icon = "logo", w = 640, h: hh = 440, x, y, resizable = true, maximized = false, frameless = false } = {}) => {
    const desk = $("#desktop");
    const dw = desk.clientWidth, dh = desk.clientHeight;
    w = Math.min(w, dw - 8); hh = Math.min(hh, dh - 8);
    if (x == null) { x = Math.max(4, (dw - w) / 2 - 90 + cascade * 26); y = Math.max(4, (dh - hh) / 2 - 60 + cascade * 26); cascade = (cascade + 1) % 7; }
    const id = "w" + (++winSeq);
    const bodyEl = h("div", { class: "win-body" });
    const titleEl = h("span", { class: "title" }, title);
    const iconEl = h("img", { src: CF.icon(icon), alt: "" });
    const el = h("div", { class: "win opening" + (frameless ? " frameless" : ""), id, style: `left:${x}px;top:${y}px;width:${w}px;height:${hh}px` },
      h("div", { class: "titlebar" }, iconEl, titleEl,
        h("button", { class: "tb-btn", title: "Minimize", "data-act": "min" }, "▁"),
        resizable ? h("button", { class: "tb-btn", title: "Maximize", "data-act": "max" }, "□") : null,
        h("button", { class: "tb-btn close", title: "Close", "data-act": "close" }, "✕")),
      bodyEl, h("div", { class: "win-shield" }), resizable ? h("div", { class: "resize-grip" }) : null);
    const taskBtn = h("div", { class: "task clickable", title }, h("img", { src: CF.icon(icon), alt: "" }), h("span", {}, title));
    const handlers = {};
    const win = {
      id, appId, el, body: bodyEl, taskBtn, data: {},
      on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return win; },
      emit(ev, arg) { let veto = false; (handlers[ev] || []).forEach(fn => { if (fn(arg) === false) veto = true; }); return !veto; },
      setTitle(t) { titleEl.textContent = t; taskBtn.title = t; taskBtn.querySelector("span").textContent = t; },
      setIcon(i) { iconEl.src = CF.icon(i); taskBtn.querySelector("img").src = CF.icon(i); },
      focus() {
        CF.windows.forEach(o => { o.el.classList.remove("active"); o.taskBtn.classList.remove("active"); });
        el.style.zIndex = ++zTop; el.classList.add("active"); taskBtn.classList.add("active");
        win.emit("focus");
      },
      minimize() { el.classList.add("min"); el.classList.remove("active"); taskBtn.classList.remove("active"); CF.sound("minimize"); },
      restore() { if (el.classList.contains("min")) { el.classList.remove("min"); CF.sound("maximize"); } },
      toggleMax() {
        if (!resizable) return;
        if (el.classList.contains("max")) {
          el.classList.remove("max"); Object.assign(el.style, win.data.prevRect);
        } else {
          win.data.prevRect = { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height };
          el.classList.add("max"); Object.assign(el.style, { left: "0px", top: "0px", width: "100%", height: "100%" });
        }
        CF.sound("maximize"); win.emit("resize");
      },
      async close(force) {
        if (!force && !win.emit("beforeclose")) return;
        win.emit("close");
        el.remove(); taskBtn.remove();
        CF.windows = CF.windows.filter(o => o !== win);
        const next = CF.windows.filter(o => !o.el.classList.contains("min")).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0];
        if (next) next.focus();
      },
      menubar(defs) {
        const bar = h("div", { class: "menubar" });
        for (const d of defs) {
          const m = h("div", { class: "clickable" }, d.label);
          m.addEventListener("click", (e) => {
            e.stopPropagation();
            const wasOpen = m.classList.contains("open");
            CF.closeMenus();
            if (wasOpen) return;
            const r = m.getBoundingClientRect();
            CF.contextMenu({ x: r.left, y: r.bottom }, typeof d.items === "function" ? d.items() : d.items);
            m.classList.add("open");
          });
          bar.append(m);
        }
        el.insertBefore(bar, bodyEl);
        return bar;
      },
      statusbar(parts) {
        let bar = el.querySelector(":scope > .statusbar");
        if (!bar) { bar = h("div", { class: "statusbar" }); el.insertBefore(bar, bodyEl.nextSibling); }
        bar.replaceChildren(...parts.map(p => h("span", {}, p)));
        return bar;
      },
    };
    el.addEventListener("animationend", () => el.classList.remove("opening"), { once: true });
    el.addEventListener("pointerdown", () => { if (!el.classList.contains("active")) win.focus(); }, true);
    el.querySelector(".titlebar").addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "min") win.minimize(); else if (act === "max") win.toggleMax(); else if (act === "close") win.close();
    });
    el.querySelector(".titlebar").addEventListener("dblclick", (e) => { if (!e.target.closest(".tb-btn")) win.toggleMax(); });
    el.querySelector(".titlebar").addEventListener("contextmenu", (e) => {
      e.preventDefault();
      CF.contextMenu({ x: e.clientX, y: e.clientY }, [
        { label: "Restore", action: () => el.classList.contains("max") && win.toggleMax(), disabled: !el.classList.contains("max") },
        { label: "Minimize", action: () => win.minimize() },
        { label: "Maximize", action: () => !el.classList.contains("max") && win.toggleMax(), disabled: !resizable || el.classList.contains("max") },
        "-", { label: "Close", key: "Alt+F4", action: () => win.close() },
      ]);
    });
    win.dragBy = dragBehaviour(win, resizable);
    taskBtn.addEventListener("click", () => {
      if (el.classList.contains("min")) { win.restore(); win.focus(); }
      else if (el.classList.contains("active")) win.minimize();
      else win.focus();
    });
    taskBtn.addEventListener("contextmenu", (e) => { e.preventDefault(); el.querySelector(".titlebar").dispatchEvent(new MouseEvent("contextmenu", e)); });
    desk.append(el);
    $("#tasks").append(taskBtn);
    CF.windows.push(win);
    win.focus();
    if (maximized) win.toggleMax();
    return win;
  };

  function dragBehaviour(win, resizable) {
    const el = win.el, bar = el.querySelector(".titlebar"), grip = el.querySelector(".resize-grip");
    const track = (startEv, onMove) => {
      startEv.preventDefault();
      const target = startEv.currentTarget;
      target.setPointerCapture(startEv.pointerId);
      document.body.classList.add("dragging-any");
      const move = (e) => onMove(e);
      const up = () => { target.removeEventListener("pointermove", move); target.removeEventListener("pointerup", up); document.body.classList.remove("dragging-any"); win.emit("resize"); };
      target.addEventListener("pointermove", move);
      target.addEventListener("pointerup", up);
    };
    const dragBy = (handle) => handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest(".tb-btn, button, input, select, [data-nodrag]") || el.classList.contains("max")) return;
      const ox = e.clientX - el.offsetLeft, oy = e.clientY - el.offsetTop;
      const desk = el.parentElement;
      track(e, (m) => {
        el.style.left = Math.max(-el.offsetWidth + 80, Math.min(desk.clientWidth - 80, m.clientX - ox)) + "px";
        el.style.top = Math.max(0, Math.min(desk.clientHeight - 30, m.clientY - oy)) + "px";
      });
    });
    dragBy(bar);
    if (resizable && grip) grip.addEventListener("pointerdown", (e) => {
      const sx = e.clientX, sy = e.clientY, sw = el.offsetWidth, sh = el.offsetHeight;
      track(e, (m) => { el.style.width = Math.max(240, sw + m.clientX - sx) + "px"; el.style.height = Math.max(140, sh + m.clientY - sy) + "px"; });
    });
    return dragBy;
  }

  // A program's start-up splash (WinNight, NightAmp, NightBrowser): the picture fades in over the
  // desktop, then out; click to skip. Shown once per session per program unless `always`.
  const splashed = new Set();
  CF.appSplash = ({ id, image, ms = 1600, always = false }) => new Promise(resolve => {
    if (settings.fastBoot || (!always && splashed.has(id))) return resolve();
    splashed.add(id);
    const img = h("img", { src: image, alt: "" });
    const el = h("div", { class: "app-splash" }, img);
    let done = false;
    const finish = () => { if (done) return; done = true; el.classList.add("out"); setTimeout(() => el.remove(), 300); resolve(); };
    el.addEventListener("click", finish);
    img.addEventListener("error", finish);
    document.body.append(el);
    setTimeout(finish, ms);
  });

  CF.activeWindow = () => CF.windows.find(w => w.el.classList.contains("active"));

  /* ---------------- desktop ---------------- */
  const DESK_ITEMS = [
    ["mycomputer", "My Computer", "computer"], ["files", "My Documents", "documents"], ["recycle", "Recycle Bin", "recycle"],
    ["browser", "Forge Browser", "browser"], ["forgechat", "ForgeChat", "forgechat"], ["forgeamp", "ForgeAmp", "forgeamp"],
    ["forgevision", "ForgeVision", "forgevision"], ["forgecraft", "Forgecraft", "forgecraft"], ["arcade", "Forge Arcade", "arcade"],
    ["gamebrowser", "Game Browser", "gamebrowser"], ["legacy", "Legacy Mode", "legacy"], ["netcon", "Netcon", "netcon"], ["diskdude", "Disk Dude", "diskdude"], ["winnight", "WinNight", "winnight"], ["nightamp", "NightAmp", "nightamp"], ["nightbrowser", "NightBrowser", "nightbrowser"], ["notepad", "Notepad", "notepad"], ["control", "Control Panel", "control"],
  ];
  function buildDesktop() {
    const icons = $("#icons");
    icons.replaceChildren();
    for (const [app, label, icon] of DESK_ITEMS) {
      const el = h("div", { class: "desk-icon clickable", tabindex: 0, "data-app": app }, h("img", { src: CF.icon(icon), alt: "" }), h("span", {}, label));
      el.addEventListener("click", (e) => { if (!e.ctrlKey) icons.querySelectorAll(".selected").forEach(s => s.classList.remove("selected")); el.classList.add("selected"); });
      el.addEventListener("dblclick", () => CF.open(app));
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") CF.open(app); });
      el.addEventListener("contextmenu", (e) => {
        e.preventDefault(); e.stopPropagation(); el.click();
        const extra = app === "recycle" ? [{ label: "Empty Recycle Bin", action: () => CF.vfs.emptyBin(), disabled: !CF.vfs.bin().length }, "-"] : [];
        CF.contextMenu({ x: e.clientX, y: e.clientY }, [{ label: "Open", action: () => CF.open(app) }, "-", ...extra,
          { label: "Properties", action: () => CF.dialog({ title: label + " Properties", icon, message: `${label}\n\n${CF.apps[app]?.desc || ""}` }) }]);
      });
      icons.append(el);
    }
    const desk = $("#desktop");
    const rubber = $("#rubber");
    desk.addEventListener("pointerdown", (e) => {
      if (e.target !== desk && e.target !== icons) return;
      icons.querySelectorAll(".selected").forEach(s => s.classList.remove("selected"));
      if (e.button !== 0) return;
      const sx = e.clientX, sy = e.clientY;
      const move = (m) => {
        const x = Math.min(sx, m.clientX), y = Math.min(sy, m.clientY), w = Math.abs(m.clientX - sx), hh = Math.abs(m.clientY - sy);
        Object.assign(rubber.style, { display: "block", left: x + "px", top: y + "px", width: w + "px", height: hh + "px" });
        icons.querySelectorAll(".desk-icon").forEach(ic => {
          const r = ic.getBoundingClientRect();
          ic.classList.toggle("selected", r.right > x && r.left < x + w && r.bottom > y && r.top < y + hh);
        });
      };
      const up = () => { rubber.style.display = "none"; removeEventListener("pointermove", move); removeEventListener("pointerup", up); };
      addEventListener("pointermove", move); addEventListener("pointerup", up);
    });
    desk.addEventListener("contextmenu", (e) => {
      if (e.target !== desk && e.target !== icons) return;
      e.preventDefault();
      CF.contextMenu({ x: e.clientX, y: e.clientY }, [
        { label: "Arrange Icons", items: [{ label: "by Name", action: () => sortIcons() }, { label: "Reset", action: buildDesktop }] },
        { label: "Refresh", key: "F5", action: () => { buildDesktop(); CF.applySettings(); } },
        "-",
        { label: "New", items: [
          { label: "Text Document", icon: "notepad", action: () => CF.open("notepad", { newName: true }) },
          { label: "Image", icon: "forgecraft", action: () => CF.open("forgecraft") },
        ] },
        "-",
        { label: "Wallpaper", items: WALLPAPERS.map(([id, name]) => ({ label: name, checked: settings.wallpaper === id, action: () => { settings.wallpaper = id; CF.saveSettings(); } })) },
        { label: "Show ColeForge Branding", checked: settings.showBrand, action: () => { settings.showBrand = !settings.showBrand; CF.saveSettings(); } },
        "-",
        { label: "Properties", icon: "control", action: () => CF.open("control", { tab: "display" }) },
      ]);
    });
    function sortIcons() {
      [...icons.children].sort((a, b) => a.textContent.localeCompare(b.textContent)).forEach(n => icons.append(n));
    }
  }
  const WALLPAPERS = [["nightcode-live", "NightCode Live (animated)"], ["nightcode", "NightCode"], ["nightcode-enter", "Enter the NightCode"], ["nightcode-grid", "Shadow Grid"], ["nightcode-beyond", "Beyond the Light"], ["classic98", "ColeForge 98 Navy"], ["lake", "Twilight Lake"], ["energy", "Blue Energy"], ["forge", "Forge Splash"], ["navy", "Midnight"], ["teal", "Classic Teal"], ["custom", "Custom Picture…"]];
  CF.WALLPAPERS = WALLPAPERS;

  /* ---------------- Start menu ---------------- */
  function build98Start() {
    const menu = $("#start-menu");
    const go = (fn) => () => { CF.sound("menu_click"); CF.toggleStart(false); fn(); };
    const row = (label, icon, fn, opts = {}) => {
      const el = h("div", { class: "sm98-item clickable" + (opts.small ? " small" : "") + (opts.sub ? " sub" : "") }, h("img", { src: CF.icon(icon), alt: "" }), h("span", {}, label));
      if (opts.sub) el.append(h("div", { class: "sm98-flyout" }, opts.sub));
      else el.addEventListener("click", go(fn));
      return el;
    };
    const app = (id, small = true) => { const a = CF.apps[id]; return row(a.name, a.icon, () => CF.open(id), { small }); };
    const programs = Object.values(CF.apps).filter(a => !a.hidden).sort((a, b) => a.name.localeCompare(b.name)).map(a => app(a.id));
    const docs = CF.vfs.list().slice(0, 12).map(d => row(d.name, d.type === "image" ? "image" : "file", () => CF.open(d.type === "image" ? "forgecraft" : "notepad", { file: d.name }), { small: true }));
    menu.replaceChildren(
      h("div", { class: "sm98-banner" }, h("span", {}, ...(document.body.classList.contains("theme-nc") ? [h("b", {}, "Night"), "Code"] : [h("b", {}, "Windows "), "ColeForge Edition"]))),
      h("div", { class: "sm98-items" },
        row("ForgeChat", "forgechat", () => CF.open("forgechat")),
        row("Forge Arcade", "arcade", () => CF.open("arcade")),
        h("div", { class: "sm98-sep" }),
        row("Programs", "folder", null, { sub: programs }),
        row("Documents", "documents", null, { sub: docs.length ? docs : [row("(Empty)", "file", () => CF.open("files"), { small: true })] }),
        row("Settings", "control", null, { sub: [row("Control Panel", "control", () => CF.open("control"), { small: true }), row("Display", "computer", () => CF.open("control", { tab: "display" }), { small: true }), row("Sounds", "volume", () => CF.open("control", { tab: "sounds" }), { small: true }), row("Account Picture…", "image", () => CF.pickAvatar(), { small: true }), row("Accessibility Options", "control", () => CF.open("control", { tab: "access" }), { small: true })] }),
        row("Find", "browser", () => CF.open("browser")),
        row("Help", "question", () => CF.open("about")),
        row("Run...", "run", runDialog),
        h("div", { class: "sm98-sep" }),
        row(`Log Off ${settings.user}...`, "logo", logOff),
        row("Shut Down...", "shutdown", () => CF.shutdownDialog())));
  }
  function buildStart() {
    if (CF.is98()) return build98Start();
    const item = (app, label, sub, icon) => {
      const el = h("div", { class: "sm-item clickable" }, h("img", { src: CF.icon(icon), alt: "" }), h("div", {}, label, sub ? h("small", {}, sub) : null));
      el.addEventListener("click", () => { CF.sound("menu_click"); CF.open(app); });
      return el;
    };
    const allPrograms = h("div", { class: "sm-item sm-all clickable" }, h("img", { src: CF.icon("folder"), alt: "" }), h("div", {}, "All Programs ▸"),
      h("div", { class: "sm-sub" }, Object.values(CF.apps).filter(a => !a.hidden).sort((a, b) => a.name.localeCompare(b.name)).map(a => item(a.id, a.name, null, a.icon))));
    const menu = $("#start-menu");
    menu.replaceChildren(
      h("div", { class: "sm-head" }, h("img", { class: "my-avatar", src: CF.avatar(), alt: "" }), h("span", { class: "my-name" }, settings.user)),
      h("div", { class: "sm-cols" },
        h("div", { class: "sm-left" },
          item("browser", "Internet", "Forge Browser", "browser"), item("forgechat", "ForgeChat", "Messenger & lobbies", "forgechat"),
          h("div", { class: "sm-sep" }),
          item("forgeamp", "ForgeAmp", "Music player", "forgeamp"), item("forgevision", "ForgeVision", "Video player", "forgevision"),
          item("forgecraft", "Forgecraft", "Paint & photo editor", "forgecraft"), item("arcade", "Forge Arcade", "Doom · Quake · Duke3D", "arcade"),
          item("notepad", "Notepad", null, "notepad"),
          h("div", { class: "sm-sep" }), allPrograms),
        h("div", { class: "sm-right" },
          item("files", "My Documents", null, "documents"), item("mycomputer", "My Computer", null, "computer"), item("recycle", "Recycle Bin", null, "recycle"),
          h("div", { class: "sm-sep" }),
          item("control", "Control Panel", null, "control"), item("about", "About ColeForge", null, "info"),
          h("div", { class: "sm-sep" }),
          (() => { const r = h("div", { class: "sm-item clickable" }, h("img", { src: CF.icon("run"), alt: "" }), h("div", {}, "Run…")); r.addEventListener("click", runDialog); return r; })())),
      h("div", { class: "sm-foot" },
        h("button", { class: "btn flat", onclick: () => { CF.toggleStart(false); logOff(); } }, "Log Off"),
        h("button", { class: "btn", onclick: () => { CF.toggleStart(false); CF.shutdownDialog(); } }, "Shut Down…")));
  }
  CF.toggleStart = (force) => {
    const menu = $("#start-menu"), btn = $("#start-btn");
    if (!menu) return;
    const open = force ?? !menu.classList.contains("open");
    if (open && !menu.classList.contains("open")) { buildStart(); CF.sound("menu_popup"); }
    menu.classList.toggle("open", open); btn.classList.toggle("open", open);
  };
  async function runDialog() {
    CF.toggleStart(false);
    const r = await CF.dialog({ title: "Run", icon: "run", message: "Type the name of a program, folder, document or Internet resource, and ColeForge will open it for you.", input: "", buttons: ["OK", "Cancel"] });
    if (r.button !== "OK" || !r.value.trim()) return;
    const v = r.value.trim(), lower = v.toLowerCase();
    const alias = { winrar: "winnight", rar: "winnight", "7z": "winnight", zip: "winnight", winzip: "winnight", winamp: "nightamp", amp: "nightamp", nightbrowse: "nightbrowser", nb: "nightbrowser", cmd: "about", winver: "about", mspaint: "forgecraft", paint: "forgecraft", explorer: "files", iexplore: "browser", control: "control", notepad: "notepad", doom: "arcade", quake: "arcade", aim: "forgechat", chat: "forgechat" };
    if (/^https?:\/\/|^www\./.test(lower)) CF.open("browser", { url: v });
    else if (CF.apps[lower]) CF.open(lower);
    else if (alias[lower]) CF.open(alias[lower]);
    else CF.dialog({ title: v, icon: "error", message: `Cannot find the file '${v}' (or one of its components). Make sure the path and filename are correct.` });
  }

  /* ---------------- tray ---------------- */
  function buildTray() {
    const tray = $("#tray");
    const net = h("span", { class: "ti clickable", title: "Network" }, h("i", { class: "dot" }));
    const vol = h("img", { class: "clickable", src: CF.icon("volume"), alt: "Volume", title: "Volume" });
    const chat = h("img", { class: "clickable", src: CF.icon("forgechat"), alt: "ForgeChat", title: "ForgeChat" });
    const clock = h("span", { id: "clock", class: "clickable" });
    tray.replaceChildren(chat, net, vol, clock);
    chat.addEventListener("click", () => CF.open("forgechat"));
    const updateNet = () => { net.firstChild.classList.toggle("off", !navigator.onLine); net.title = navigator.onLine ? "Connected" : "Not connected"; };
    addEventListener("online", () => { updateNet(); CF.toast({ title: "Network", body: "You're connected.", icon: "network" }); });
    addEventListener("offline", () => { updateNet(); CF.toast({ title: "Network", body: "Network cable unplugged / Wi‑Fi lost.", icon: "warning" }); });
    updateNet();
    net.addEventListener("click", () => CF.open("mycomputer"));
    vol.addEventListener("click", (e) => {
      const slider = h("input", { type: "range", min: 0, max: 1, step: 0.05, value: settings.volume, style: "width:150px" });
      slider.addEventListener("input", () => { settings.volume = +slider.value; CF.saveSettings(); CF.emit("volume", settings.volume); });
      slider.addEventListener("change", () => CF.sound("ding"));
      const menu = CF.contextMenu({ x: e.clientX - 90, y: e.clientY - 110 }, [{ label: settings.sounds ? "Mute system sounds" : "Unmute system sounds", action: () => { settings.sounds = !settings.sounds; CF.saveSettings(); } }]);
      menu.prepend(h("div", { class: "pad" }, h("div", { class: "muted", style: "color:#333" }, "Volume"), slider));
      menu.addEventListener("click", (ev) => ev.stopPropagation());
    });
    const tick = () => {
      const d = new Date();
      clock.textContent = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: !settings.clock24 });
      clock.title = d.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    };
    tick(); setInterval(tick, 5000);
    clock.addEventListener("click", () => { settings.clock24 = !settings.clock24; CF.saveSettings(); tick(); });
  }

  /* ---------------- power ---------------- */
  CF.shutdownDialog = async () => {
    const choice = h("select", { class: "field", style: "width:100%" },
      h("option", { value: "shutdown" }, "Shut down"), h("option", { value: "restart" }, "Restart"), h("option", { value: "logoff" }, `Log off ${settings.user}`));
    const veil = h("div", { id: "shutdown" });
    const done = (go) => { veil.remove(); if (go) power(choice.value); };
    veil.append(h("div", { class: "dlg" }, h("div", { class: "win active" },
      h("div", { class: "titlebar" }, h("img", { src: CF.icon("shutdown"), alt: "" }), h("span", { class: "title" }, "Shut Down ColeForge")),
      h("div", { class: "dlg-body" }, h("img", { src: CF.icon("logo"), alt: "" }), h("div", { style: "flex:1" }, h("div", { class: "msg" }, "What do you want the computer to do?"), choice)),
      h("div", { class: "dlg-btns" }, h("button", { class: "btn", onclick: () => done(true) }, "OK"), h("button", { class: "btn flat", onclick: () => done(false) }, "Cancel")))));
    document.body.append(veil);
    CF.sound("question");
  };
  async function power(action) {
    if (action === "logoff") return logOff();
    for (const w of CF.windows.slice()) await w.close(true);
    CF.sound("shutdown");
    document.body.classList.add("busy");
    await new Promise(r => setTimeout(r, 2600));
    if (host && host.power) return host.power(action);
    if (action === "restart") return location.reload();
    document.body.replaceChildren(h("div", { id: "shutdown", class: "final" }, h("div", {}, "It's now safe to turn off", h("br"), "your computer.")));
  }
  function logOff() {
    CF.windows.slice().forEach(w => w.close(true));
    CF.emit("logoff");
    showWelcome();
  }

  /* ---------------- boot sequence ---------------- */
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  async function bios() {
    const el = h("div", { id: "bios" });
    document.body.append(el);
    const gpu = (() => { try { const gl = document.createElement("canvas").getContext("webgl"); const ext = gl.getExtension("WEBGL_debug_renderer_info"); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "Accelerated display adapter"; } catch { return "Display adapter"; } })();
    const ok = `<span class="ok">[  OK  ]</span>`;
    const lines = document.body.classList.contains("theme-nc") ? [
      `<span class="hi">NightCode BIOS v6.10</span>   ColeForge firmware (C) 1998-2026 ColeForge Studios`, "",
      `${ok} CPU     : ${navigator.hardwareConcurrency || "?"} logical processors`,
      `${ok} Memory  : ${(navigator.deviceMemory || 8) * 1024 * 1024}K`,
      `${ok} Display : ${esc(gpu)}`,
      `${ok} Link    : ${navigator.onLine ? "up" : "down"}`,
      `${ok} Mounting USB / NVMe / SATA volumes`,
      `${ok} Loading the NightCode kernel bridge`,
      "", `<span class="hi">&gt;</span> Entering the NightCode_`,
    ] : [
      `<span class="hi">ColeForge BIOS v4.10</span>   (C) 1998-2026 ColeForge Studios`, "",
      `CPU : ${navigator.hardwareConcurrency || "?"} logical processors detected`,
      `Memory Test : ${(navigator.deviceMemory || 8) * 1024 * 1024}K <span class="ok">OK</span>`,
      `Display : ${esc(gpu)}`,
      `Network : ${navigator.onLine ? "Link up" : "No link"}`,
      "", "Detecting USB / NVMe / SATA devices ... <span class=\"ok\">done</span>",
      "Starting Windows – ColeForge Edition ...",
    ];
    for (const line of lines) { el.innerHTML += line + "\n"; await sleep(settings.fastBoot ? 20 : 170); }
    await sleep(settings.fastBoot ? 50 : 500);
    el.remove();
  }
  async function splash() {
    const boot = h("div", { id: "boot" });
    const bar = h("div", { class: "seg-bar" }, Array.from({ length: 10 }, () => h("i")));
    const status = h("div", { class: "boot-status" }, "");
    const nc = document.body.classList.contains("theme-nc");
    boot.append(h("div", { class: "boot-frame" }, nc ? h("div", { class: "boot-tag" }, "ENTER THE NIGHTCODE") : null, h("div", { class: "boot-inner" }, bar)), status);
    document.body.append(boot);
    const steps = nc ? ["Decrypting kernel bridge", "Probing hardware", "Loading display drivers", "Bringing up the link", "Loading ForgeChat services", "Mounting the desktop",
      "Loading neon icons", "Applying NightCode", "Loading sounds", "Welcome, hacker"]
      : ["Loading kernel bridge", "Detecting hardware", "Loading display drivers", "Starting network", "Loading ForgeChat services", "Preparing desktop",
      "Loading icons", "Applying theme", "Loading sounds", "Welcome"];
    await CFIcons.resolve();
    for (let i = 0; i < 10; i++) {
      bar.children[i].classList.add("on");
      status.textContent = steps[i] + "…";
      await sleep(settings.fastBoot ? 40 : 260 + Math.random() * 200);
    }
    return boot;
  }
  function showWelcome() {
    return new Promise(resolve => {
      const name = h("input", { value: settings.user, maxlength: 24, "aria-label": "User name" });
      const av = h("img", { class: "my-avatar clickable", src: CF.avatar(), alt: "", title: "Click to change your picture" });
      av.addEventListener("click", () => CF.pickAvatar().then(() => { av.src = CF.avatar(); }));
      const wel = CF.is98() ? h("div", { id: "welcome" }, h("div", { class: "welcome-card" },
        h("div", { class: "w98-title" }, h("img", { src: CF.icon("logo"), alt: "" }), "Welcome to Windows – ColeForge Edition"),
        h("div", { class: "w98-banner" }),
        h("div", { class: "w98-body" }, av, h("div", { class: "user" },
          h("div", { style: "margin-bottom:8px" }, "Type a user name to log on to Windows – ColeForge Edition."),
          h("div", { class: "w98-row" }, h("label", {}, "User name:"), name),
          h("div", { class: "w98-row", style: "margin-top:6px" }, h("span", {}), h("a", { class: "clickable", style: "color:var(--w98-link, #0000ee);text-decoration:underline", onclick: () => av.click() }, "Change picture…")))),
        h("div", { class: "w98-btns" }, h("button", { class: "btn", onclick: go }, "OK"), h("button", { class: "btn", onclick: () => CF.shutdownDialog() }, "Cancel")))) : h("div", { id: "welcome" }, h("div", { class: "welcome-card" },
        h("img", { class: "logo", src: CF.icon("logo"), alt: "" }), h("h1", {}, "Windows"), h("h2", {}, "ColeForge Edition"),
        h("div", { class: "user" }, av, name),
        h("button", { class: "btn", style: "width:100%;padding:8px", onclick: go }, "Log On  ▶"),
        h("div", { class: "tag" }, "CLASSIC ROOTS. MODERN HORIZONS.")));
      name.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
      document.body.append(wel);
      name.focus();
      function go() {
        settings.user = name.value.trim() || "Cole";
        CF.saveSettings();
        CF.sound("startup"); // first user gesture: audio is allowed from here on
        wel.classList.add("fade");
        setTimeout(() => wel.remove(), 700);
        CF.emit("logon");
        resolve();
      }
    });
  }

  async function bootSequence() {
    CF.applySettings();
    await bios();
    const boot = await splash();
    $("#start-btn img").src = CF.icon("logo");
    document.querySelectorAll("#quick [data-app]").forEach(img => { img.src = CF.icon(img.dataset.icon); });
    buildDesktop(); buildTray(); CF.applySettings();
    boot.classList.add("fade");
    setTimeout(() => boot.remove(), 900);
    await showWelcome();
    setTimeout(() => CF.toast({ title: "Welcome to ColeForge", body: "Right-click the desktop to customize. Press Ctrl+Esc for Start.", icon: "logo" }), 2200);
  }

  /* ---------------- keyboard ---------------- */
  addEventListener("keydown", (e) => {
    if ((e.ctrlKey && e.key === "Escape") || e.key === "Meta" || e.key === "OS") { e.preventDefault(); CF.toggleStart(); }
    else if (e.altKey && e.key === "F4") { e.preventDefault(); const w = CF.activeWindow(); w ? w.close() : CF.shutdownDialog(); }
    else if (e.key === "Escape") { CF.closeMenus(); CF.toggleStart(false); }
    else if (e.key === "F5" && !e.target.closest(".win")) { e.preventDefault(); buildDesktop(); }
    else if (e.ctrlKey && e.key.toLowerCase() === "r" && e.shiftKey) { e.preventDefault(); runDialog(); }
  });
  // Browsers only report Print Screen on key-up. (When ColeForge is the Windows shell, Windows catches
  // this shortcut itself, switches to High Contrast, and ColeForge follows it through forced-colors.)
  addEventListener("keyup", (e) => {
    if (e.key === "PrintScreen" && e.altKey && e.shiftKey && settings.hcShortcut) { e.preventDefault(); CF.toggleHighContrast(); }
  });
  /* ---------------- right-click: text boxes, taskbar, Start, tray ---------------- */
  // Text boxes get a themed Cut/Copy/Paste menu (ColeForge.exe has no native one to fall back on).
  const TEXT_FIELD = "input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]):not([type=button]):not([type=submit]), textarea, [contenteditable]:not([contenteditable=false])";
  function textMenu(e, field) {
    e.preventDefault();
    field.focus();
    const editable = !field.readOnly && !field.disabled;
    const hasSel = field.isContentEditable ? !getSelection().isCollapsed : field.selectionStart !== field.selectionEnd;
    const run = (cmd) => () => { field.focus(); document.execCommand(cmd); };
    const menu = CF.contextMenu({ x: e.clientX, y: e.clientY }, [
      { label: "Undo", key: "Ctrl+Z", action: run("undo"), disabled: !editable },
      "-",
      { label: "Cut", key: "Ctrl+X", action: run("cut"), disabled: !editable || !hasSel },
      { label: "Copy", key: "Ctrl+C", action: run("copy"), disabled: !hasSel },
      { label: "Paste", key: "Ctrl+V", disabled: !editable, action: async () => {
        field.focus();
        try { document.execCommand("insertText", false, await navigator.clipboard.readText()); }
        catch { if (!document.execCommand("paste")) CF.toast({ title: "Paste", body: "Press Ctrl+V to paste here.", icon: "info" }); }
      } },
      { label: "Delete", key: "Del", action: run("delete"), disabled: !editable || !hasSel },
      "-",
      { label: "Select All", key: "Ctrl+A", action: () => { field.focus(); if (field.select) field.select(); else document.execCommand("selectAll"); } },
    ]);
    // Keep the text box focused (and its selection intact) while the menu is clicked.
    menu.addEventListener("mousedown", (ev) => ev.preventDefault());
  }

  // Taskbar: arrange windows, like Windows 98's taskbar menu.
  let lastMinimized = [];
  function arrangeWindows(kind) {
    const wins = CF.windows.filter(w => !w.el.classList.contains("min"));
    const desk = $("#desktop"), W = desk.clientWidth, H = desk.clientHeight, n = wins.length;
    wins.forEach((w, i) => {
      if (w.el.classList.contains("max")) w.toggleMax();
      const st = w.el.style;
      if (kind === "cascade") Object.assign(st, { left: 20 + i * 26 + "px", top: 12 + i * 26 + "px" });
      else if (kind === "tileH") Object.assign(st, { left: "0px", top: Math.floor(i * H / n) + "px", width: W + "px", height: Math.floor(H / n) + "px" });
      else Object.assign(st, { left: Math.floor(i * W / n) + "px", top: "0px", width: Math.floor(W / n) + "px", height: H + "px" });
      w.emit("resize"); w.focus();
    });
  }
  function taskbarMenu(e) {
    const open = CF.windows.filter(w => !w.el.classList.contains("min"));
    CF.contextMenu({ x: e.clientX, y: e.clientY }, [
      { label: "Cascade Windows", action: () => arrangeWindows("cascade"), disabled: !open.length },
      { label: "Tile Windows Horizontally", action: () => arrangeWindows("tileH"), disabled: !open.length },
      { label: "Tile Windows Vertically", action: () => arrangeWindows("tileV"), disabled: !open.length },
      "-",
      { label: "Minimize All Windows", action: () => { lastMinimized = open; open.forEach(w => w.minimize()); }, disabled: !open.length },
      { label: "Undo Minimize All", action: () => { lastMinimized.forEach(w => CF.windows.includes(w) && w.restore()); lastMinimized = []; }, disabled: !lastMinimized.length },
      "-",
      { label: "Properties", action: () => CF.open("control", { tab: "display" }) },
    ]);
  }
  function startButtonMenu(e) {
    CF.contextMenu({ x: e.clientX, y: e.clientY }, [
      { label: "Open", action: () => CF.toggleStart(true) },
      { label: "Explore", action: () => CF.open("files") },
      { label: "Find…", action: () => CF.open("mycomputer") },
      { label: "Run…", key: "Ctrl+Shift+R", action: () => runDialog() },
      "-",
      { label: "Control Panel", action: () => CF.open("control") },
    ]);
  }
  function trayMenu(e) {
    const now = new Date();
    CF.contextMenu({ x: e.clientX, y: e.clientY }, [
      { label: "Adjust Volume…", action: () => CF.open("control", { tab: "sounds" }) },
      { label: "Adjust Date/Time…", action: () => CF.dialog({ title: "Date/Time Properties", icon: "info", message: now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" }) + "\n" + now.toLocaleTimeString() + "\n\nColeForge uses your PC's clock. Switch to 24-hour time in Control Panel → Display." }) },
      "-",
      { label: "Open ForgeChat", action: () => CF.open("forgechat") },
      { label: "Display Properties", action: () => CF.open("control", { tab: "display" }) },
    ]);
  }

  // The shell owns right-click everywhere; apps attach their own menus (and call preventDefault).
  addEventListener("contextmenu", (e) => {
    if (e.defaultPrevented) return;
    const field = e.target.closest(TEXT_FIELD);
    if (field) return textMenu(e, field);
    e.preventDefault();
    if (e.target.closest("#start-btn")) startButtonMenu(e);
    else if (e.target.closest("#tray")) trayMenu(e);
    else if (e.target.closest("#quick [data-app]")) { const app = e.target.closest("[data-app]").dataset.app; CF.contextMenu({ x: e.clientX, y: e.clientY }, [{ label: "Open", action: () => CF.open(app) }, { label: "Properties", action: () => CF.dialog({ title: (CF.apps[app]?.name || app) + " Properties", icon: CF.apps[app]?.icon || "info", message: CF.apps[app]?.desc || "" }) }]); }
    else if (e.target.closest("#taskbar")) taskbarMenu(e);
  });

  document.addEventListener("DOMContentLoaded", () => {
    $("#start-btn").addEventListener("click", () => CF.toggleStart());
    document.querySelectorAll("#quick [data-app]").forEach(img => img.addEventListener("click", () => CF.open(img.dataset.app)));
    bootSequence();
  });
})();
