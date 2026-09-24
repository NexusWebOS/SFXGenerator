"use strict";

// Built-in system programs: My Computer, My Documents, Recycle Bin, Notepad, Control Panel, About.
(function () {
  const { h } = CF;

  function gpuName() {
    try {
      const gl = document.createElement("canvas").getContext("webgl");
      const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : (gl ? gl.getParameter(gl.RENDERER) : "Unknown");
    } catch { return "Unknown"; }
  }
  const fmtBytes = (n) => n == null ? "—" : n > 1e9 ? (n / 1e9).toFixed(1) + " GB" : n > 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.round(n / 1e3) + " KB";

  /* ---------------- My Computer ---------------- */
  CF.register({
    id: "mycomputer", name: "My Computer", icon: "computer", single: true, desc: "Hardware detected by ColeForge: processor, graphics, memory, network, battery and storage.",
    window: { w: 720, h: 470 },
    async open(win) {
      win.menubar([
        { label: "File", items: [{ label: "Close", action: () => win.close() }] },
        { label: "View", items: [{ label: "Refresh", key: "F5", action: render }] },
        { label: "Help", items: [{ label: "About ColeForge", action: () => CF.open("about") }] },
      ]);
      const side = h("div", { class: "exp-side" });
      const main = h("div", { class: "exp-main" });
      win.body.append(h("div", { class: "explorer" }, side, main));
      side.append(
        h("div", { class: "exp-panel" }, h("div", { class: "exp-ph" }, "System Tasks"),
          link("View system information", () => CF.open("about")), link("Change display settings", () => CF.open("control", { tab: "display" })), link("Sound settings", () => CF.open("control", { tab: "sounds" }))),
        h("div", { class: "exp-panel" }, h("div", { class: "exp-ph" }, "Other Places"),
          link("My Documents", () => CF.open("files")), link("Recycle Bin", () => CF.open("recycle")), link("ForgeChat Network", () => CF.open("forgechat"))));
      function link(text, fn) { const a = h("div", { class: "exp-link clickable" }, text); a.addEventListener("click", fn); return a; }

      async function render() {
        const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate().catch(() => null) : null;
        let battery = null;
        try { battery = navigator.getBattery ? await navigator.getBattery() : null; } catch { battery = null; }
        const conn = navigator.connection || {};
        const hw = [
          ["computer", "Processor", `${navigator.hardwareConcurrency || "?"} logical cores`],
          ["forgevision", "Graphics", gpuName()],
          ["file", "Memory", navigator.deviceMemory ? `≥ ${navigator.deviceMemory} GB RAM` : "Reported by host"],
          ["network", "Network", `${navigator.onLine ? "Connected" : "Offline"}${conn.effectiveType ? " · " + conn.effectiveType : ""}${conn.downlink ? " · " + conn.downlink + " Mbps" : ""}`],
          ["volume", "Display", `${screen.width}×${screen.height} @ ${devicePixelRatio}x`],
          ["info", "Battery", battery ? `${Math.round(battery.level * 100)}% ${battery.charging ? "(charging)" : "(on battery)"}` : "No battery / not reported"],
        ];
        let hostInfo = null;
        if (CF.host && CF.host.sysInfo) { try { hostInfo = await CF.host.sysInfo(); } catch { hostInfo = null; } }
        main.replaceChildren(
          h("div", { class: "exp-h" }, "Devices and drives"),
          h("div", { class: "exp-grid" },
            drive("documents", "My Documents", () => CF.open("files"), `${CF.vfs.list().length} files`),
            drive("recycle", "Recycle Bin", () => CF.open("recycle"), `${CF.vfs.bin().length} items`),
            drive("computer", "Local Storage (C:)", null, est ? `${fmtBytes(est.usage)} used of ${fmtBytes(est.quota)}` : "—"),
            ...(hostInfo?.drives || []).map(d => drive("computer", d.name, null, d.detail))),
          h("div", { class: "exp-h" }, "Hardware"),
          h("div", { class: "hw-list" }, hw.map(([icon, k, v]) => h("div", { class: "hw" }, h("img", { src: CF.icon(icon), alt: "" }), h("b", {}, k), h("span", {}, v)))),
          hostInfo ? h("div", { class: "muted pad" }, `Host: ${hostInfo.os} · ${hostInfo.cpu} · ${fmtBytes(hostInfo.totalmem)} RAM`) : h("div", { class: "muted pad" }, "Running in browser mode. Launch through the ColeForge desktop host for full device details."));
        win.statusbar([`${hw.length} devices`, "ColeForge Edition"]);
      }
      function drive(icon, name, fn, detail) {
        const d = h("div", { class: "drive clickable" }, h("img", { src: CF.icon(icon), alt: "" }), h("div", {}, h("b", {}, name), h("small", {}, detail)));
        if (fn) d.addEventListener("dblclick", fn);
        return d;
      }
      render();
    },
  });

  /* ---------------- My Documents / Recycle Bin ---------------- */
  const typeIcon = (d) => d.type === "image" ? "image" : "file";
  function openDoc(d) { CF.open(d.type === "image" ? "forgecraft" : "notepad", { file: d.name }); }

  CF.register({
    id: "files", name: "My Documents", icon: "documents", single: true, desc: "Your saved documents and pictures.",
    window: { w: 620, h: 420 },
    open(win) {
      const list = h("div", { class: "list", style: "position:absolute;inset:0" });
      win.body.append(list);
      win.menubar([
        { label: "File", items: () => [{ label: "New Text Document", icon: "notepad", action: () => CF.open("notepad", { newName: true }) }, { label: "Import files…", action: importFiles }, "-", { label: "Close", action: () => win.close() }] },
        { label: "Edit", items: () => [{ label: "Delete", key: "Del", action: del, disabled: !sel() }] },
      ]);
      function sel() { return list.querySelector(".sel")?.dataset.name; }
      function del() { const n = sel(); if (n) { CF.vfs.remove(n); CF.sound("recycle"); } }
      function importFiles() {
        const inp = h("input", { type: "file", multiple: true });
        inp.addEventListener("change", () => [...inp.files].forEach(f => {
          const r = new FileReader();
          if (f.type.startsWith("image/")) { r.onload = () => CF.vfs.write(f.name, r.result, "image"); r.readAsDataURL(f); }
          else { r.onload = () => CF.vfs.write(f.name, r.result, "text"); r.readAsText(f); }
        }));
        inp.click();
      }
      function render() {
        const docs = CF.vfs.list();
        list.replaceChildren(...(docs.length ? docs.map(d => {
          const row = h("div", { class: "item clickable", "data-name": d.name }, h("img", { src: CF.icon(typeIcon(d)), alt: "" }), h("span", { style: "flex:1" }, d.name), h("span", { class: "muted" }, new Date(d.modified).toLocaleString()));
          row.addEventListener("click", () => { list.querySelectorAll(".sel").forEach(s => s.classList.remove("sel")); row.classList.add("sel"); });
          row.addEventListener("dblclick", () => openDoc(d));
          row.addEventListener("contextmenu", (e) => { e.preventDefault(); row.click(); CF.contextMenu({ x: e.clientX, y: e.clientY }, [{ label: "Open", action: () => openDoc(d) }, "-", { label: "Delete", action: del }]); });
          return row;
        }) : [h("div", { class: "pad muted" }, "This folder is empty. Save something from Notepad or Forgecraft, or use File → Import.")]));
        win.statusbar([`${docs.length} object(s)`, "My Documents"]);
      }
      list.addEventListener("keydown", (e) => { if (e.key === "Delete") del(); });
      list.tabIndex = 0;
      list.addEventListener("contextmenu", (e) => { if (e.target === list) { e.preventDefault(); CF.contextMenu({ x: e.clientX, y: e.clientY }, [{ label: "New Text Document", action: () => CF.open("notepad", { newName: true }) }, { label: "Import files…", action: importFiles }, { label: "Refresh", action: render }]); } });
      const off = CF.on("vfs", render);
      win.on("close", off);
      render();
    },
  });

  CF.register({
    id: "recycle", name: "Recycle Bin", icon: "recycle", single: true, desc: "Deleted documents wait here until you empty the bin.",
    window: { w: 520, h: 360 },
    open(win) {
      const list = h("div", { class: "list", style: "position:absolute;inset:0" });
      win.body.append(list);
      win.menubar([{ label: "File", items: () => [{ label: "Empty Recycle Bin", action: empty, disabled: !CF.vfs.bin().length }, "-", { label: "Close", action: () => win.close() }] }]);
      async function empty() {
        const r = await CF.dialog({ title: "Confirm Delete", icon: "question", message: "Are you sure you want to permanently delete everything in the Recycle Bin?", buttons: ["Yes", "No"] });
        if (r.button === "Yes") CF.vfs.emptyBin();
      }
      function render() {
        const items = CF.vfs.bin();
        list.replaceChildren(...(items.length ? items.map(d => {
          const row = h("div", { class: "item clickable" }, h("img", { src: CF.icon(typeIcon(d)), alt: "" }), h("span", { style: "flex:1" }, d.name));
          row.addEventListener("contextmenu", (e) => { e.preventDefault(); CF.contextMenu({ x: e.clientX, y: e.clientY }, [{ label: "Restore", action: () => CF.vfs.restore(d.name) }]); });
          row.addEventListener("dblclick", () => CF.vfs.restore(d.name));
          return row;
        }) : [h("div", { class: "pad muted" }, "The Recycle Bin is empty.")]));
        win.setIcon("recycle");
        win.statusbar([`${items.length} object(s)`, "Double-click to restore"]);
      }
      const off = CF.on("vfs", render);
      win.on("close", off);
      render();
    },
  });

  /* ---------------- Notepad ---------------- */
  CF.register({
    id: "notepad", name: "Notepad", icon: "notepad", desc: "Plain text editor with word wrap, find and save to My Documents.",
    window: { w: 600, h: 420 },
    open(win, args) {
      let name = args.file || null, dirty = false;
      const ta = h("textarea", { class: "notepad", spellcheck: "false" });
      win.body.append(ta);
      if (name) ta.value = CF.vfs.read(name)?.data || "";
      const title = () => win.setTitle(`${dirty ? "*" : ""}${name || "Untitled"} - Notepad`);
      ta.addEventListener("input", () => { if (!dirty) { dirty = true; title(); } status(); });
      ta.addEventListener("keyup", status); ta.addEventListener("click", status);
      function status() {
        const before = ta.value.slice(0, ta.selectionStart).split("\n");
        win.statusbar([`Ln ${before.length}, Col ${before[before.length - 1].length + 1}`, `${ta.value.length} chars`]);
      }
      async function saveAs() {
        const r = await CF.dialog({ title: "Save As", icon: "documents", message: "File name:", input: name || "Untitled.txt", buttons: ["Save", "Cancel"] });
        if (r.button !== "Save" || !r.value.trim()) return false;
        name = r.value.trim(); return save();
      }
      function save() {
        if (!name) return saveAs();
        if (CF.vfs.write(name, ta.value, "text")) { dirty = false; title(); return true; }
        return false;
      }
      function download() {
        const a = h("a", { href: URL.createObjectURL(new Blob([ta.value], { type: "text/plain" })), download: name || "Untitled.txt" });
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
      async function find() {
        const r = await CF.dialog({ title: "Find", icon: "question", message: "Find what:", input: win.data.lastFind || "", buttons: ["Find Next", "Cancel"] });
        if (r.button !== "Find Next" || !r.value) return;
        win.data.lastFind = r.value;
        const i = ta.value.toLowerCase().indexOf(r.value.toLowerCase(), ta.selectionEnd);
        const j = i >= 0 ? i : ta.value.toLowerCase().indexOf(r.value.toLowerCase());
        if (j < 0) return CF.dialog({ title: "Notepad", icon: "info", message: `Cannot find "${r.value}"` });
        ta.focus(); ta.setSelectionRange(j, j + r.value.length);
      }
      win.menubar([
        { label: "File", items: [
          { label: "New", key: "Ctrl+N", action: () => CF.open("notepad") }, { label: "Save", key: "Ctrl+S", action: save }, { label: "Save As…", action: saveAs },
          { label: "Export to disk…", action: download }, "-", { label: "Exit", action: () => win.close() }] },
        { label: "Edit", items: [
          { label: "Undo", key: "Ctrl+Z", action: () => { ta.focus(); document.execCommand("undo"); } },
          "-", { label: "Find…", key: "Ctrl+F", action: find }, { label: "Select All", key: "Ctrl+A", action: () => ta.select() },
          { label: "Time/Date", key: "F5", action: () => { ta.setRangeText(new Date().toLocaleString(), ta.selectionStart, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input")); } }] },
        { label: "Format", items: () => [{ label: "Word Wrap", checked: ta.wrap !== "off", action: () => { ta.wrap = ta.wrap === "off" ? "soft" : "off"; } }] },
      ]);
      ta.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
        if (e.ctrlKey && e.key.toLowerCase() === "f") { e.preventDefault(); find(); }
        if (e.key === "F5") { e.preventDefault(); ta.setRangeText(new Date().toLocaleString(), ta.selectionStart, ta.selectionEnd, "end"); }
      });
      win.on("beforeclose", () => {
        if (!dirty) return true;
        CF.dialog({ title: "Notepad", icon: "warning", message: `The text in ${name || "Untitled"} has changed.\n\nDo you want to save the changes?`, buttons: ["Yes", "No", "Cancel"] })
          .then(async r => { if (r.button === "No" || (r.button === "Yes" && await save())) win.close(true); });
        return false;
      });
      title(); status(); ta.focus();
      if (args.newName) saveAs();
    },
  });

  /* ---------------- Control Panel ---------------- */
  CF.register({
    id: "control", name: "Control Panel", icon: "control", single: true, desc: "Display, desktop, cursors, sounds and account settings.",
    window: { w: 560, h: 500 },
    open(win, args) {
      const s = CF.settings;
      const tabs = [["display", "Display"], ["cursors", "Mouse"], ["sounds", "Sounds"], ["account", "Account"], ["system", "System"]];
      const tabBar = h("div", { class: "tabs" });
      const page = h("div", { class: "pad", style: "overflow:auto;position:absolute;inset:34px 0 0" });
      win.body.append(tabBar, page);
      const save = () => CF.saveSettings();
      function show(tab) {
        tabBar.replaceChildren(...tabs.map(([id, label]) => { const t = h("div", { class: "clickable" + (id === tab ? " on" : "") }, label); t.addEventListener("click", () => show(id)); return t; }));
        page.replaceChildren(...pages[tab]());
      }
      win.on("args", (a) => a.tab && show(a.tab));
      const check = (label, key, after) => {
        const c = h("input", { type: "checkbox" }); c.checked = !!s[key];
        c.addEventListener("change", () => { s[key] = c.checked; save(); after && after(); });
        return h("label", { class: "row clickable" }, c, label);
      };
      const pages = {
        display: () => {
          const walls = h("div", { class: "wall-grid" }, CF.WALLPAPERS.map(([id, name]) => {
            const t = h("div", { class: "wall-tile clickable" + (s.wallpaper === id ? " on" : "") }, h("div", { class: "wall-prev wall-" + id }), h("small", {}, name));
            t.addEventListener("click", () => {
              if (id === "custom") return pickWall();
              s.wallpaper = id; save(); show("display");
            });
            return t;
          }));
          function pickWall() {
            const inp = h("input", { type: "file", accept: "image/*" });
            inp.addEventListener("change", () => {
              const f = inp.files[0]; if (!f) return;
              const img = new Image();
              img.onload = () => {
                // Downscale so the picture fits comfortably in local storage.
                const scale = Math.min(1, 1920 / img.width), c = document.createElement("canvas");
                c.width = img.width * scale; c.height = img.height * scale;
                c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
                s.customWall = c.toDataURL("image/jpeg", 0.85); s.wallpaper = "custom"; save(); show("display");
                URL.revokeObjectURL(img.src);
              };
              img.src = URL.createObjectURL(f);
            });
            inp.click();
          }
          const accent = h("input", { type: "color", value: s.accent });
          accent.addEventListener("input", () => { s.accent = accent.value; save(); });
          const swatches = ["#1f6fff", "#00a2c7", "#7b3fe4", "#d43a8a", "#e0493a", "#ff8a1f", "#2aa84a", "#5a6c8f"].map(c => {
            const b = h("span", { class: "swatch clickable", style: `background:${c}` }); b.addEventListener("click", () => { s.accent = c; accent.value = c; save(); }); return b;
          });
          const scale = h("input", { type: "range", min: 0.85, max: 1.4, step: 0.05, value: s.uiScale });
          scale.addEventListener("change", () => { s.uiScale = +scale.value; save(); });
          const theme = h("select", { class: "field" }, CF.THEMES.map(([id, label]) => h("option", { value: id, selected: s.theme === id }, label)));
          theme.addEventListener("change", () => { s.theme = theme.value; save(); show("display"); });
          return [h("div", { class: "group" }, h("div", { class: "legend" }, "Theme"), h("div", { class: "row" }, "Look:", theme)),
            h("div", { class: "group" }, h("div", { class: "legend" }, "Wallpaper"), walls),
            h("div", { class: "group" }, h("div", { class: "legend" }, "Colour scheme"), h("div", { class: "row" }, "Accent:", accent, ...swatches)),
            h("div", { class: "group" }, h("div", { class: "legend" }, "Appearance"), h("div", { class: "row" }, "Text & UI size", scale), check("Show ColeForge branding on the desktop", "showBrand"), check("24-hour clock", "clock24"), check("Fast boot (skip long BIOS/splash)", "fastBoot"))];
        },
        cursors: () => [h("div", { class: "group" }, h("div", { class: "legend" }, "Pointer scheme"),
          check("Use ColeForge glow cursors", "cursors"),
          h("div", { class: "row" }, ...["arrow", "hand", "text", "busy"].map(n => h("div", { class: "cursor-prev" }, h("img", { src: `assets/cursors/${n}.svg`, alt: n }), h("small", {}, n))))),
          h("p", { class: "muted" }, "Cursor files live in assets/cursors/. Replace them with your own .svg or .png art to make a new scheme.")],
        sounds: () => {
          const vol = h("input", { type: "range", min: 0, max: 1, step: 0.05, value: s.volume });
          vol.addEventListener("change", () => { s.volume = +vol.value; save(); CF.sound("ding"); });
          const events = [["startup", "Start ColeForge"], ["shutdown", "Exit ColeForge"], ["logon", "Log on"], ["ding", "Default beep"], ["notify", "Notification"], ["exclamation", "Exclamation"], ["critical_stop", "Critical stop"], ["question", "Question"], ["menu_click", "Menu command"], ["menu_popup", "Menu popup"], ["minimize", "Minimize"], ["maximize", "Maximize"], ["recycle", "Empty Recycle Bin"], ["chat_in", "ForgeChat: message in"], ["chat_out", "ForgeChat: message out"], ["buddy_in", "ForgeChat: buddy signs on"], ["buddy_out", "ForgeChat: buddy signs off"], ["call_ring", "ForgeChat: incoming call"], ["lobby_ready", "Arcade: lobby ready"]];
          const scheme = h("select", { class: "field" }, CF.SOUND_SCHEMES.map(([id, label]) => h("option", { value: id, selected: s.soundScheme === id }, label)));
          scheme.addEventListener("change", () => { s.soundScheme = scheme.value; save(); CF.sound("logon"); });
          return [h("div", { class: "group" }, h("div", { class: "legend" }, "Sound scheme"), h("div", { class: "row" }, "Scheme:", scheme), check("Play system sounds", "sounds"), h("div", { class: "row" }, "Volume", vol)),
            h("div", { class: "list", style: "height:230px" }, events.map(([id, label]) => { const r = h("div", { class: "item clickable" }, h("img", { src: CF.icon("volume"), alt: "", style: "filter:invert(.3)" }), h("span", { style: "flex:1" }, label), h("small", { class: "muted" }, id + ".wav")); r.addEventListener("click", () => CF.sound(id)); return r; }))];
        },
        account: () => {
          const name = h("input", { class: "field", value: s.user, maxlength: 24 });
          name.addEventListener("change", () => { s.user = name.value.trim() || "Cole"; save(); });
          const av = h("img", { class: "my-avatar", src: CF.avatar(), alt: "", style: "width:72px;height:72px;object-fit:cover" });
          const pick = h("button", { class: "btn" }, "Change picture…");
          pick.addEventListener("click", () => CF.pickAvatar().then(() => { av.src = CF.avatar(); }));
          return [h("div", { class: "group" }, h("div", { class: "legend" }, "Your account"), h("div", { class: "row" }, av, h("div", {}, h("div", { class: "row" }, "Name:", name), pick))),
            h("p", { class: "muted" }, "Your picture is also your ForgeChat avatar.")];
        },
        system: () => [h("div", { class: "group" }, h("div", { class: "legend" }, "ColeForge"),
          h("div", {}, `${CF.edition} · Version ${CF.version} (Build ${CF.build})`),
          h("div", { class: "muted" }, CF.host ? "Running as the desktop shell (host bridge connected)." : "Running in browser mode.")),
          h("div", { class: "group" }, h("div", { class: "legend" }, "Maintenance"),
            h("button", { class: "btn flat", onclick: async () => { const r = await CF.dialog({ title: "Reset", icon: "warning", message: "Reset all ColeForge settings to defaults? Documents are kept.", buttons: ["Reset", "Cancel"] }); if (r.button === "Reset") { CF.store.set("cf.settings", {}); location.reload(); } } }, "Reset settings…"))],
      };
      show(args.tab || "display");
    },
  });

  /* ---------------- About ---------------- */
  CF.register({
    id: "about", name: "About ColeForge", icon: "info", single: true, hidden: false, desc: "Version information.",
    window: { w: 460, h: 360, resizable: false },
    open(win) {
      win.body.append(h("div", { class: "about" },
        h("img", { src: CF.icon("logo"), alt: "" }),
        h("div", {}, h("div", { class: "about-w" }, "Windows"), h("div", { class: "about-e" }, "ColeForge Edition"),
          h("p", {}, `Version ${CF.version} (Build ${CF.build})`, h("br"), "A modern take on a classic.", h("br"), "© 2026 ColeForge Studios. Private build."),
          h("p", { class: "muted" }, `Licensed to: `, h("span", { class: "my-name" }, CF.settings.user)),
          h("div", { class: "about-tag" }, "Classic Roots. Modern Horizons."),
          h("button", { class: "btn", onclick: () => win.close() }, "OK"))));
    },
  });
})();
