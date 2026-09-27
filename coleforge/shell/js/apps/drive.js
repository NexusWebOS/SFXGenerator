"use strict";

// Google Drive: the NightCode folder in your Google Drive, through Google Drive for desktop and the local
// server (server/drive.js). CF.drive is the file API (Albert uses it too); the Google Drive window browses
// it. A file opened from Drive is linked: saving it in Notepad / Forgecraft writes it back to Drive.
(function () {
  const { h } = CF;
  const TEXT = /\.(txt|md|json|js|css|html?|ini|cfg|log|csv|xml|bat|ps1|py|lua|sh|yml|yaml)$/i;
  const MY_DOCS_CAP = 4 * 1024 * 1024; // My Documents lives in browser storage: bigger files are saved to the PC instead
  const enc = (p) => encodeURIComponent(p);
  const join = (dir, name) => (dir ? dir + "/" + name : name);
  const fmtBytes = (n) => n == null ? "" : n >= 1e9 ? (n / 1e9).toFixed(1) + " GB" : n >= 1e6 ? (n / 1e6).toFixed(1) + " MB" : n >= 1e3 ? Math.round(n / 1e3) + " KB" : n + " bytes";

  async function call(op, { method = "GET", query = {}, body, raw } = {}) {
    const qs = new URLSearchParams(query).toString();
    let r;
    try {
      r = await fetch(`/api/drive/${op}${qs ? "?" + qs : ""}`, { method, body, headers: Object.assign({ "X-ColeForge-Drive": "1" }, typeof body === "string" && op === "folder" ? { "Content-Type": "application/json" } : {}) });
    } catch { throw new Error("NightCode's local server isn't answering."); }
    const json = (r.headers.get("content-type") || "").includes("application/json");
    // No local server behind this page (the NightCode website): its 404 / page fallback isn't JSON.
    if (!json && (!r.ok || !raw)) throw Object.assign(new Error("Google Drive works in the NightCode app on your PC (ColeForge.exe), not on the website."), { hosted: true });
    if (!r.ok) throw new Error((await r.json()).error || `Drive answered ${r.status}`);
    return raw ? r : r.json();
  }

  CF.drive = {
    status: () => call("status"),
    setFolder: (folder) => call("folder", { method: "POST", body: JSON.stringify({ folder }) }),
    list: (path = "") => call("list", { query: { path } }),
    async readBytes(path) { return new Uint8Array(await (await call("file", { query: { path }, raw: true })).arrayBuffer()); },
    async readText(path) { return (await call("file", { query: { path }, raw: true })).text(); },
    async blob(path) { return (await call("file", { query: { path }, raw: true })).blob(); },
    write: (path, data) => call("file", { method: "PUT", query: { path }, body: data }),
    mkdir: (path) => call("mkdir", { method: "POST", query: { path } }),
    remove: (path) => call("delete", { method: "POST", query: { path } }),
    rename: (path, to) => call("rename", { method: "POST", query: { path, to } }),
  };

  /* ---------- links: My Documents copies of Drive files save back to Drive ---------- */
  const LINKS = "cf.driveLinks";
  const links = () => CF.store.get(LINKS, {});
  const link = (name, path) => { const l = links(); if (path) l[name] = path; else delete l[name]; CF.store.set(LINKS, l); };
  const vfsBytes = (d) => (d.type === "text" ? new TextEncoder().encode(d.data || "") : CF.vfs.readBytes(d.name));
  const origWrite = CF.vfs.write;
  const pending = new Map();
  CF.vfs.write = function (name, data, type) {
    const ok = origWrite.call(CF.vfs, name, data, type);
    const path = ok && links()[name];
    if (path) {
      clearTimeout(pending.get(name));
      pending.set(name, setTimeout(async () => {
        pending.delete(name);
        const d = CF.vfs.read(name);
        if (!d) return;
        try { await CF.drive.write(path, vfsBytes(d)); CF.emit("drive"); }
        catch (e) { CF.toast({ title: "Google Drive", body: `Couldn't save ${name} to Drive: ${e.message}`, icon: "warning" }); }
      }, 400));
    }
    return ok;
  };
  const origRemove = CF.vfs.remove;
  CF.vfs.remove = function (name) { link(name, null); return origRemove.call(CF.vfs, name); };

  // Bring a Drive file into My Documents (linked) and open it with its program.
  async function openFromDrive(path, size) {
    const name = path.split("/").pop();
    const t = CF.fileType(name);
    const isText = TEXT.test(name), isImage = /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
    if (!isText && size > MY_DOCS_CAP) {
      CF.toast({ title: "Google Drive", body: `${name} is too big for My Documents; saving it to this PC's Downloads instead.`, icon: "info" });
      return CF.download(name, await CF.drive.blob(path));
    }
    const mine = CF.vfs.read(name);
    if (mine && links()[name] !== path) {
      const r = await CF.dialog({ title: "Google Drive", icon: "question", message: `My Documents already has a “${name}”. Replace it with the one from Google Drive?`, buttons: ["Replace", "Cancel"] });
      if (r.button !== "Replace") return;
    }
    link(name, null); // don't echo the download straight back to Drive
    let ok;
    if (isText) ok = origWrite.call(CF.vfs, name, await CF.drive.readText(path), "text");
    else {
      const blob = await CF.drive.blob(path);
      ok = CF.vfs.writeBytes(name, new Uint8Array(await blob.arrayBuffer()), blob.type || "application/octet-stream");
    }
    if (!ok) return;
    link(name, path);
    if (t) CF.open(t.app, { file: name });
    else if (isText) CF.open("notepad", { file: name });
    else if (isImage) CF.open("forgecraft", { file: name });
    else CF.open("files");
  }

  /* ---------------- the Google Drive window ---------------- */
  CF.register({
    id: "gdrive", name: "Google Drive", icon: "clouddrive", single: true,
    desc: "The NightCode folder in your Google Drive: open, save and back up files that sync to Google Drive on the web and your phone.",
    window: { w: 760, h: 480 },
    open(win, opts = {}) {
      let cwd = opts.path || "", entries = [], status = null;
      const crumbs = h("div", { class: "drv-crumbs" });
      const list = h("div", { class: "list", tabIndex: 0, style: "flex:1;overflow:auto" });
      const side = h("div", { class: "exp-side" });
      win.body.append(h("div", { class: "explorer" }, side, h("div", { class: "exp-main", style: "display:flex;flex-direction:column;padding:0" }, crumbs, list)));
      const lnk = (text, fn) => { const a = h("div", { class: "exp-link clickable" }, text); a.addEventListener("click", fn); return a; };
      side.append(
        h("div", { class: "exp-panel" }, h("div", { class: "exp-ph" }, "File and Folder Tasks"),
          lnk("Make a new folder", newFolder), lnk("Upload from My Documents", uploadDocs), lnk("Upload from this PC", uploadPc), lnk("Back up all My Documents", backupAll)),
        h("div", { class: "exp-panel" }, h("div", { class: "exp-ph" }, "Other Places"),
          lnk("My Documents", () => CF.open("files")), lnk("My Computer", () => CF.open("mycomputer")), lnk("Google Drive on the web", openWeb)),
        h("div", { class: "exp-panel drv-where" }));
      win.menubar([
        { label: "File", items: () => [
          { label: "Open", action: () => sel() && activate(sel()), disabled: !sel() },
          { label: "New Folder", action: newFolder },
          { label: "Upload from My Documents…", action: uploadDocs },
          { label: "Upload from this PC…", action: uploadPc },
          { label: "Back up all My Documents", action: backupAll }, "-",
          { label: "Save to this PC", action: () => sel() && saveToPc(sel()), disabled: !sel() || sel().dir },
          { label: "Rename", key: "F2", action: rename, disabled: !sel() },
          { label: "Delete", key: "Del", action: del, disabled: !sel() }, "-",
          { label: "Close", action: () => win.close() }] },
        { label: "View", items: [{ label: "Refresh", key: "F5", action: () => load() }, { label: "Up one level", key: "Backspace", action: up }] },
        { label: "Tools", items: () => [{ label: "Use another folder…", action: chooseFolder }, { label: "Find the Drive folder by itself", action: () => CF.drive.setFolder("").then(() => load()), disabled: !status?.chosen }, "-", { label: "Google Drive on the web", action: openWeb }] },
      ]);

      function openWeb() { const u = "https://drive.google.com/"; if (CF.host?.openExternal) CF.host.openExternal(u); else window.open(u, "_blank", "noopener"); }
      function sel() { const r = list.querySelector(".sel"); return r ? entries.find((e) => e.name === r.dataset.name) : null; }
      const busy = (on) => win.body.classList.toggle("busy", on);
      async function guard(fn) { busy(true); try { await fn(); } catch (e) { CF.dialog({ title: "Google Drive", icon: "error", message: e.message }); } finally { busy(false); } }

      function renderCrumbs() {
        const parts = cwd ? cwd.split("/") : [];
        const seg = (label, path) => { const s = h("span", { class: "clickable" }, label); s.addEventListener("click", () => { cwd = path; load(); }); return s; };
        crumbs.replaceChildren(h("img", { src: CF.icon("clouddrive"), alt: "" }), seg("Google Drive › NightCode", ""), ...parts.flatMap((p, i) => [" › ", seg(p, parts.slice(0, i + 1).join("/"))]));
      }

      function notConnected(why, hosted) {
        entries = [];
        list.replaceChildren(h("div", { class: "pad drv-setup" },
          h("b", {}, hosted ? "Google Drive needs the NightCode app" : "Connect Google Drive"),
          hosted ? h("p", {}, "Google Drive files live on your PC, so this works in NightCode on your computer (ColeForge.exe). On the website, use Google Drive on the web.")
            : h("div", {},
              h("p", {}, why),
              h("ol", {},
                h("li", {}, "Install Google Drive for desktop (the button below opens the download page) and sign in with your Google account."),
                h("li", {}, "It adds a Google Drive disk to This PC (usually G:). NightCode makes a NightCode folder in My Drive and uses it."),
                h("li", {}, "Come back here and press Refresh.")),
              h("p", { class: "muted" }, "Keep Drive somewhere else? Tools → Use another folder… and pick any folder that syncs.")),
          h("div", { style: "display:flex;gap:6px;margin-top:10px" },
            hosted ? h("button", { class: "btn", onclick: openWeb }, "Open Google Drive on the web")
              : [h("button", { class: "btn", onclick: () => { const u = "https://www.google.com/drive/download/"; if (CF.host?.openExternal) CF.host.openExternal(u); else window.open(u, "_blank", "noopener"); } }, "Get Google Drive for desktop"),
                h("button", { class: "btn flat", onclick: () => load() }, "Refresh"), h("button", { class: "btn flat", onclick: chooseFolder }, "Use another folder…")])));
        win.statusbar(["Not connected", "Google Drive"]);
      }

      async function load() {
        renderCrumbs();
        try { status = await CF.drive.status(); } catch (e) { return notConnected(e.message, e.hosted); }
        side.querySelector(".drv-where").replaceChildren(h("div", { class: "exp-ph" }, "Details"),
          h("div", { class: "muted", style: "padding:4px 8px;word-break:break-all" }, status.connected ? `${status.folder}\n(${status.how})` : "Not connected"));
        if (!status.connected) return notConnected(status.why);
        try { entries = (await CF.drive.list(cwd)).entries; }
        catch (e) { if (cwd) { cwd = ""; return load(); } return notConnected(e.message); }
        list.replaceChildren(...(entries.length ? entries.map(row) : [h("div", { class: "pad muted" }, cwd ? "This folder is empty." : "Your NightCode folder in Google Drive is empty. Upload something, or use “Back up all My Documents”.")]));
        const files = entries.filter((e) => !e.dir);
        win.statusbar([`${entries.length} object(s)`, fmtBytes(files.reduce((n, e) => n + e.size, 0)) || "", "Google Drive"]);
      }
      function row(e) {
        const icon = e.dir ? "folder" : CF.fileType(e.name)?.icon || (/\.(png|jpe?g|gif|webp|bmp)$/i.test(e.name) ? "image" : TEXT.test(e.name) ? "notepad" : "file");
        const r = h("div", { class: "item clickable", "data-name": e.name },
          h("img", { src: CF.icon(icon), alt: "" }), h("span", { style: "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis" }, e.name),
          h("span", { class: "muted", style: "width:80px;text-align:right" }, e.dir ? "" : fmtBytes(e.size)),
          h("span", { class: "muted", style: "width:150px;text-align:right" }, new Date(e.modified).toLocaleString()));
        r.addEventListener("click", () => { list.querySelectorAll(".sel").forEach((s) => s.classList.remove("sel")); r.classList.add("sel"); });
        r.addEventListener("dblclick", () => activate(e));
        r.addEventListener("contextmenu", (ev) => {
          ev.preventDefault(); r.click();
          CF.contextMenu({ x: ev.clientX, y: ev.clientY }, [{ label: "Open", action: () => activate(e) }, ...(e.dir ? [] : [{ label: "Save to this PC", action: () => saveToPc(e) }]), "-", { label: "Rename", action: rename }, { label: "Delete", action: del }]);
        });
        return r;
      }
      function activate(e) { if (e.dir) { cwd = join(cwd, e.name); load(); } else guard(() => openFromDrive(join(cwd, e.name), e.size)); }
      function up() { if (!cwd) return; cwd = cwd.split("/").slice(0, -1).join("/"); load(); }
      function saveToPc(e) { guard(async () => CF.download(e.name, await CF.drive.blob(join(cwd, e.name)))); }

      async function newFolder() {
        const r = await CF.dialog({ title: "New Folder", icon: "question", message: "Folder name:", input: "New Folder", buttons: ["OK", "Cancel"] });
        if (r.button === "OK" && r.value.trim()) guard(async () => { await CF.drive.mkdir(join(cwd, r.value.trim())); await load(); });
      }
      async function rename() {
        const e = sel(); if (!e) return;
        const r = await CF.dialog({ title: "Rename", icon: "question", message: `New name for “${e.name}”:`, input: e.name, buttons: ["OK", "Cancel"] });
        if (r.button === "OK" && r.value.trim() && r.value.trim() !== e.name) guard(async () => {
          const from = join(cwd, e.name), to = join(cwd, r.value.trim());
          await CF.drive.rename(from, to);
          const l = links(); for (const [n, p] of Object.entries(l)) if (p === from) link(n, to);
          await load();
        });
      }
      async function del() {
        const e = sel(); if (!e) return;
        const r = await CF.dialog({ title: "Delete", icon: "warning", message: `Delete “${e.name}”${e.dir ? " and everything in it" : ""}? Google Drive keeps it in its Trash for 30 days.`, buttons: ["Delete", "Cancel"] });
        if (r.button === "Delete") guard(async () => { await CF.drive.remove(join(cwd, e.name)); CF.sound("recycle"); await load(); });
      }
      async function uploadDocs() {
        const docs = CF.vfs.list();
        if (!docs.length) return CF.dialog({ title: "Google Drive", message: "My Documents is empty." });
        const box = h("div", { style: "max-height:220px;overflow:auto;margin-top:6px" }, docs.map((d) => h("label", { style: "display:flex;gap:6px;align-items:center" }, h("input", { type: "checkbox", value: d.name }), d.name)));
        const r = await CF.dialog({ title: "Upload to Google Drive", icon: "question", message: `Copy these to Google Drive › NightCode${cwd ? " › " + cwd.replace(/\//g, " › ") : ""}:`, content: box, buttons: ["Upload", "Cancel"] });
        if (r.button !== "Upload") return;
        const names = [...box.querySelectorAll("input:checked")].map((i) => i.value);
        guard(async () => { for (const n of names) { await CF.drive.write(join(cwd, n), vfsBytes(CF.vfs.read(n))); link(n, join(cwd, n)); } await load(); CF.toast({ title: "Google Drive", body: `Uploaded ${names.length} file(s).`, icon: "clouddrive" }); });
      }
      function uploadPc() {
        const inp = h("input", { type: "file", multiple: true });
        inp.addEventListener("change", () => guard(async () => { for (const f of inp.files) await CF.drive.write(join(cwd, f.name), f); await load(); }));
        inp.click();
      }
      function backupAll() {
        guard(async () => {
          const docs = CF.vfs.list();
          const stamp = new Date().toISOString().slice(0, 10);
          for (const d of docs) await CF.drive.write(`My Documents backup ${stamp}/${d.name}`, vfsBytes(d));
          await load();
          CF.toast({ title: "Google Drive", body: `Backed up ${docs.length} document(s) to “My Documents backup ${stamp}”.`, icon: "clouddrive" });
        });
      }
      async function chooseFolder() {
        const r = await CF.dialog({ title: "Google Drive folder", icon: "question", message: "Full path of the folder NightCode should use (for example G:\\My Drive\\NightCode):", input: status?.folder || "", buttons: ["OK", "Cancel"] });
        if (r.button === "OK") guard(async () => { await CF.drive.setFolder(r.value.trim()); cwd = ""; await load(); });
      }

      list.addEventListener("keydown", (e) => {
        if (e.key === "Delete") del(); else if (e.key === "F2") rename(); else if (e.key === "Backspace") up();
        else if (e.key === "Enter" && sel()) activate(sel()); else if (e.key === "F5") { e.preventDefault(); load(); }
      });
      const off = CF.on("drive", () => load());
      win.on("close", off);
      load();
    },
  });
})();
