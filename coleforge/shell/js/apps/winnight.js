"use strict";

// WinNight: the NightCode archiver, an official ColeForge program. A classic big-button archive
// manager on top of ZipKit (js/zipkit.js): ZIP / TAR / TAR.GZ read + write, AES-256 locked ZIPs,
// RAR, 7-Zip, XZ, BZIP2, ZSTD, ISO, CAB… read through libarchive (vendor/libarchive).
(function () {
  const { h } = CF;
  const ART = "assets/art/nightapps/";
  const KEY = "cf.winnight";
  const opts = Object.assign({ format: "zip", level: "deflate", splash: true }, CF.store.get(KEY, {}));
  const saveOpts = () => CF.store.set(KEY, opts);

  const EXT = {
    text: ["txt", "md", "log", "ini", "cfg", "csv", "nfo", "diz", "rtf"],
    code: ["js", "mjs", "ts", "json", "html", "htm", "css", "xml", "py", "c", "h", "cpp", "cs", "java", "rs", "go", "lua", "sh", "bat", "ps1", "yml", "yaml", "toml", "wad", "deh", "bex"],
    image: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "avif"],
    audio: ["mp3", "wav", "ogg", "oga", "opus", "flac", "m4a", "aac", "mid", "midi", "mus", "wma", "aiff", "aif", "weba"],
    video: ["mp4", "m4v", "webm", "mkv", "mov", "avi", "ogv", "wmv", "ts", "m3u8"],
    archive: ["zip", "rar", "7z", "tar", "gz", "tgz", "xz", "txz", "bz2", "tbz2", "zst", "iso", "cab", "lzh", "lha", "arj", "cpio", "xar", "jar", "apk", "cbz", "cbr", "pk3", "pk7"],
    exe: ["exe", "com", "msi", "dll", "sys", "bin", "img"],
  };
  const LABEL = { folder: "File folder", text: "Text document", code: "Source / data file", image: "Picture", audio: "Audio", video: "Video", archive: "Archive", exe: "Program", file: "File" };
  const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml", ico: "image/x-icon", avif: "image/avif",
    mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", opus: "audio/ogg", flac: "audio/flac", m4a: "audio/mp4", aac: "audio/aac", mp4: "video/mp4", webm: "video/webm", mkv: "video/x-matroska", mov: "video/quicktime", zip: "application/zip" };
  const ext = (n) => (/\.([^./]+)$/.exec(n.toLowerCase()) || [])[1] || "";
  const typeOf = (name, dir) => dir ? "folder" : Object.keys(EXT).find(k => EXT[k].includes(ext(name))) || "file";
  const typeIcon = (t) => `${ART}winnight/types/${t}.png`;
  const fmtSize = (n) => n == null ? "" : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(2)} GB`;
  const fmtDate = (d) => d && !isNaN(d) ? d.toLocaleString([], { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  const hex8 = (n) => n == null ? "" : n.toString(16).toUpperCase().padStart(8, "0");
  const readFile = (f) => f.arrayBuffer().then(b => new Uint8Array(b));
  const baseName = (n) => n.replace(/\/$/, "").split("/").pop();
  const stripExt = (n) => n.replace(/\.(tar\.(gz|xz|bz2|zst)|[^.]+)$/i, "");
  const isTextual = (b) => { const n = Math.min(b.length, 4096); for (let i = 0; i < n; i++) if (b[i] === 0) return false; return true; };

  CF.associate(EXT.archive, "winnight");

  CF.register({
    id: "winnight", name: "WinNight", icon: "winnight", desc: "WinNight archiver: ZIP, RAR, 7-Zip, TAR and more, with AES-256 locked archives.",
    window: { w: 880, h: 580 },
    open(win, args) {
      if (opts.splash) CF.appSplash({ id: "winnight", image: `${ART}winnight-splash.png` });
      const st = { mode: "home", name: null, source: null, bytes: null, arc: null, items: [], cwd: "", password: null, lockPassword: null,
        comment: "", dirty: false, sort: ["name", 1], sel: new Set(), busy: false };

      /* ---------- layout ---------- */
      const TOOLS = [
        ["add", "Add", addFiles, "Add files to the archive (Alt+A)"], ["extract", "Extract To", extractTo, "Extract files (Alt+E)"],
        ["test", "Test", testArchive, "Test archived files (Alt+T)"], ["view", "View", viewSelected, "View the file (Alt+V)"],
        ["delete", "Delete", deleteSelected, "Delete files (Del)"], ["find", "Find", findFiles, "Find files (F3)"],
        ["wizard", "Wizard", wizard, "The WinNight wizard"], ["info", "Info", showInfo, "Archive information (Alt+I)"],
        ["repair", "Repair", repairArchive, "Repair a damaged ZIP"], ["lock", "Lock", lockArchive, "Lock with a password (AES-256)"],
      ];
      const toolbar = h("div", { class: "wn-toolbar" }, TOOLS.map(([id, label, fn, tip]) => {
        const b = h("button", { class: "wn-tool", title: tip, "data-tool": id }, h("img", { src: `${ART}winnight/${id}.png`, alt: "" }), h("span", {}, label));
        b.addEventListener("click", () => run(fn));
        return b;
      }));
      const upBtn = h("button", { class: "wn-up", title: "Up one level (Backspace)" }, h("img", { src: typeIcon("folder"), alt: "" }), "↑");
      const pathBox = h("div", { class: "wn-path" });
      const COLS = [["name", "Name"], ["size", "Size"], ["csize", "Packed"], ["type", "Type"], ["mtime", "Modified"], ["crc", "CRC32"]];
      const head = h("div", { class: "wn-row wn-head" }, COLS.map(([k, label]) => {
        const c = h("div", { class: "clickable", "data-col": k }, label);
        c.addEventListener("click", () => { st.sort = [k, st.sort[0] === k ? -st.sort[1] : 1]; render(); });
        return c;
      }));
      const list = h("div", { class: "wn-list", tabindex: 0 });
      const drop = h("div", { class: "wn-drop" }, h("img", { src: `${ART}winnight-64.png`, alt: "" }), h("div", {}, "Drop files here to archive them, or an archive to open it"));
      win.body.append(h("div", { class: "wn" }, toolbar, h("div", { class: "wn-addr" }, upBtn, pathBox), h("div", { class: "wn-table" }, head, list), drop));
      upBtn.addEventListener("click", goUp);

      win.menubar([
        { label: "File", items: () => [
          { label: "Open archive…", key: "Ctrl+O", action: () => run(openFromDisk) },
          { label: "Open from My Documents", items: vfsArchives().length ? vfsArchives().map(d => ({ label: d.name, action: () => run(() => openVfs(d.name)) })) : [{ label: "(no archives)", disabled: true }] },
          { label: "New archive", key: "Ctrl+N", action: () => run(newArchive) }, "-",
          { label: "Save", key: "Ctrl+S", disabled: st.mode !== "archive", action: () => run(() => save(false)) },
          { label: "Save as…", disabled: st.mode !== "archive", action: () => run(() => save(true)) }, "-",
          { label: "Close archive", disabled: st.mode !== "archive", action: () => run(closeArchive) },
          { label: "Exit", action: () => win.close() }] },
        { label: "Commands", items: () => [
          { label: "Add files to archive…", key: "Alt+A", action: () => run(addFiles) },
          { label: "Extract to…", key: "Alt+E", action: () => run(extractTo), disabled: !hasFiles() },
          { label: "Test archived files", key: "Alt+T", action: () => run(testArchive), disabled: st.mode !== "archive" },
          { label: "View file", key: "Alt+V", action: () => run(viewSelected), disabled: !firstSelected() },
          { label: "Delete files", key: "Del", action: () => run(deleteSelected), disabled: !st.sel.size },
          { label: "Rename", key: "F2", action: () => run(renameSelected), disabled: st.mode !== "archive" || st.sel.size !== 1 },
          { label: "New folder", action: () => run(newFolder), disabled: !writable() }, "-",
          { label: "Find files…", key: "F3", action: () => run(findFiles), disabled: st.mode !== "archive" },
          { label: "Show information", key: "Alt+I", action: () => run(showInfo), disabled: st.mode !== "archive" },
          { label: "Add archive comment…", action: () => run(editComment), disabled: !isZip() },
          { label: "Lock with password…", action: () => run(lockArchive), disabled: st.mode !== "archive" }] },
        { label: "Tools", items: () => [
          { label: "Wizard", action: () => run(wizard) },
          { label: "Repair archive", action: () => run(repairArchive), disabled: !isZip() && !(st.mode === "home" && firstSelected()) },
          { label: "Convert archive…", action: () => run(convertArchive), disabled: st.mode !== "archive" },
          { label: "Create self-extracting archive (.html)…", action: () => run(createSfx), disabled: st.mode !== "archive" }] },
        { label: "Options", items: () => [
          { label: "New archives", items: ZipKit.WRITE_FORMATS.map(([id, label]) => ({ label, checked: opts.format === id, action: () => { opts.format = id; saveOpts(); } })) },
          { label: "Compression", items: [["deflate", "Normal (deflate)"], ["store", "Store (no compression)"]].map(([id, label]) => ({ label, checked: opts.level === id, action: () => { opts.level = id; saveOpts(); } })) },
          { label: "Show splash screen at start", checked: opts.splash, action: () => { opts.splash = !opts.splash; saveOpts(); } }] },
        { label: "Help", items: [{ label: "About WinNight", action: about }] },
      ]);

      /* ---------- helpers ---------- */
      const status = (text) => { st.status = text; renderStatus(); };
      async function run(fn) {
        if (st.busy) return;
        st.busy = true; win.el.classList.add("wn-busy");
        try { await fn(); } catch (e) { console.error(e); CF.dialog({ title: "WinNight", icon: "error", message: e.message || String(e) }); }
        finally {
          st.busy = false; win.el.classList.remove("wn-busy"); st.status = null; renderStatus();
          if (CF.windows.includes(win) && !document.querySelector(".dlg-veil")) list.focus({ preventScroll: true });   // keep Ctrl+S & co. working after dialogs
        }
      }
      const isZip = () => st.mode === "archive" && st.arc?.format === "zip";
      const writable = () => st.mode === "archive" && (!!st.newFormat || ["zip", "tar", "tar.gz"].includes(st.arc?.format));
      const hasFiles = () => st.mode === "archive" ? st.items.some(i => !i.dir) : !!firstSelected();
      const vfsArchives = () => CF.vfs.list().filter(d => EXT.archive.includes(ext(d.name)));
      function title() { win.setTitle(st.mode === "archive" ? `${st.dirty ? "*" : ""}${st.name} - WinNight` : "WinNight"); }

      async function askPassword(message) {
        const r = await CF.dialog({ title: "Enter password", icon: "question", message, input: "", inputType: "password", buttons: ["OK", "Cancel"] });
        return r.button === "OK" ? r.value : null;
      }
      async function dataOf(it) {
        if (it.data) return it.data;
        for (;;) {
          try {
            return await st.arc.read(it.entry, st.password);
          } catch (e) {
            if (e.code === "password") {
              const pw = await askPassword(st.password == null ? `${it.path} is encrypted. Enter the password:` : `Wrong password for ${it.path}. Try again:`);
              if (pw == null) throw new Error("Cancelled.");
              st.password = pw; continue;
            }
            if (e.code === "method") {                  // e.g. Deflate64 / BZIP2 / LZMA inside a ZIP
              st.lib = st.lib || await ZipKit.openLib(st.bytes, st.name, st.password);
              const le = st.lib.entries.find(x => x.name === it.path);
              if (!le) throw e;
              return await st.lib.read(le);
            }
            throw e;
          }
        }
      }

      /* ---------- the listing ---------- */
      function rows() {
        if (st.mode === "home") {
          return CF.vfs.list().map(d => ({ name: d.name, dir: false, size: d.data ? Math.round(String(d.data).length * (String(d.data).startsWith("data:") ? 0.75 : 1)) : 0, mtime: new Date(d.modified), doc: d, type: typeOf(d.name) }));
        }
        const map = new Map();
        for (const it of st.items) {
          if (!it.path.startsWith(st.cwd)) continue;
          const rest = it.path.slice(st.cwd.length).replace(/\/$/, "");
          if (!rest) continue;
          const seg = rest.split("/")[0];
          if (rest === seg && !it.dir) { map.set("f:" + seg, { name: seg, dir: false, size: it.size, csize: it.csize, mtime: it.mtime, crc: it.crc, encrypted: it.encrypted, item: it, type: typeOf(seg) }); continue; }
          const f = map.get("d:" + seg) || { name: seg, dir: true, size: 0, csize: 0, mtime: null, files: 0, type: "folder", path: st.cwd + seg + "/" };
          if (!it.dir) { f.size += it.size || 0; f.csize += it.csize || 0; f.files++; }
          if (it.mtime && !isNaN(it.mtime) && (!f.mtime || it.mtime > f.mtime)) f.mtime = it.mtime;
          map.set("d:" + seg, f);
        }
        return [...map.values()];
      }
      function sorted(rs) {
        const [k, dir] = st.sort;
        const val = (r) => k === "type" ? LABEL[r.type] : k === "mtime" ? (r.mtime ? r.mtime.getTime() : 0) : r[k] ?? "";
        return rs.sort((a, b) => (b.dir - a.dir) || (typeof val(a) === "number" ? (val(a) - val(b)) * dir : String(val(a)).localeCompare(String(val(b)), undefined, { numeric: true }) * dir));
      }
      function render() {
        title();
        const inArc = st.mode === "archive";
        pathBox.replaceChildren(...[h("img", { src: inArc ? `${ART}winnight.png` : CF.icon("documents"), alt: "" }),
          h("span", {}, inArc ? `${st.name}${st.cwd ? " \\ " + st.cwd.replace(/\/$/, "").split("/").join(" \\ ") : ""}` : "My Documents"),
          inArc && st.arc?.format ? h("small", { class: "wn-fmt" }, `${st.arc.format.toUpperCase()}${st.lockPassword || st.items.some(i => i.encrypted) ? " · AES" : ""}${writable() ? "" : " · read-only"}`) : null].filter(Boolean));
        upBtn.disabled = !inArc;
        head.querySelectorAll("[data-col]").forEach(c => { c.classList.toggle("sorted", c.dataset.col === st.sort[0]); c.dataset.dir = st.sort[1] > 0 ? "▲" : "▼"; });
        const rs = sorted(rows());
        const nodes = [];
        if (inArc) {
          const upRow = h("div", { class: "wn-row wn-item" }, h("div", { class: "wn-name" }, h("img", { src: typeIcon("folder"), alt: "" }), h("span", {}, "..")), h("div", {}, ""), h("div", {}, ""), h("div", {}, st.cwd ? "Up one level" : "Close archive"), h("div", {}, ""), h("div", {}, ""));
          upRow.addEventListener("dblclick", goUp);
          nodes.push(upRow);
        }
        for (const r of rs) {
          const key = r.dir ? r.path : (r.item?.path || r.name);
          const el = h("div", { class: "wn-row wn-item" + (st.sel.has(key) ? " sel" : ""), "data-key": key },
            h("div", { class: "wn-name" }, h("img", { src: typeIcon(r.type), alt: "" }), h("span", {}, r.name + (r.encrypted ? " *" : ""))),
            h("div", { class: "num" }, r.dir ? (r.files ? fmtSize(r.size) : "") : fmtSize(r.size)),
            h("div", { class: "num" }, r.dir ? (r.files ? fmtSize(r.csize) : "") : fmtSize(r.csize)),
            h("div", {}, LABEL[r.type]), h("div", {}, fmtDate(r.mtime)), h("div", { class: "mono" }, r.dir ? "" : r.encrypted && !r.crc ? "AES" : hex8(r.crc)));
          el.addEventListener("click", (e) => select(key, e));
          el.addEventListener("dblclick", () => run(() => openRow(r)));
          el.addEventListener("contextmenu", (e) => { e.preventDefault(); if (!st.sel.has(key)) select(key, {}); rowMenu(e, r); });
          nodes.push(el);
        }
        if (!rs.length && !inArc) nodes.push(h("div", { class: "wn-empty muted" }, "My Documents is empty. Drop files here, or use File → Open archive…"));
        list.replaceChildren(...nodes);
        drop.style.display = !inArc && !rs.length ? "" : "none";
        renderStatus();
      }
      function renderStatus() {
        const rs = st.mode === "archive" ? st.items.filter(i => !i.dir) : [];
        const selected = [...st.sel];
        const selSize = selected.reduce((a, k) => a + (st.mode === "archive" ? itemsUnder(k).reduce((s, i) => s + (i.size || 0), 0) : 0), 0);
        const total = rs.reduce((a, i) => a + (i.size || 0), 0), packed = rs.reduce((a, i) => a + (i.csize || 0), 0);
        const ratio = total && packed ? ` · ratio ${Math.round(packed / total * 100)}%` : "";
        win.statusbar([
          st.status || (selected.length ? `Selected ${selected.length} item(s)${selSize ? ", " + fmtSize(selSize) : ""}` : st.mode === "archive" ? "Ready" : "Select files to archive, or open an archive"),
          st.mode === "archive" ? `Total ${rs.length} file(s), ${fmtSize(total)}${ratio}` : `${CF.vfs.list().length} document(s)`,
        ]);
      }
      function select(key, e) {
        if (e.ctrlKey) st.sel.has(key) ? st.sel.delete(key) : st.sel.add(key);
        else if (e.shiftKey && st.lastSel) {
          const keys = [...list.querySelectorAll("[data-key]")].map(n => n.dataset.key);
          const [a, b] = [keys.indexOf(st.lastSel), keys.indexOf(key)].sort((x, y) => x - y);
          keys.slice(a, b + 1).forEach(k => st.sel.add(k));
        } else { st.sel.clear(); st.sel.add(key); }
        st.lastSel = key;
        list.querySelectorAll("[data-key]").forEach(n => n.classList.toggle("sel", st.sel.has(n.dataset.key)));
        renderStatus();
      }
      const itemsUnder = (key) => key.endsWith("/") ? st.items.filter(i => i.path.startsWith(key)) : st.items.filter(i => i.path === key);
      function firstSelected() {
        const k = [...st.sel][0];
        if (!k) return null;
        if (st.mode === "home") return CF.vfs.read(k);
        return k.endsWith("/") ? null : st.items.find(i => i.path === k);
      }
      function selectedItems() {
        if (st.mode !== "archive") return [];
        const out = new Set();
        for (const k of st.sel) itemsUnder(k).forEach(i => out.add(i));
        return [...out];
      }
      function goUp() {
        if (st.mode !== "archive") return;
        if (!st.cwd) return run(closeArchive);
        st.cwd = st.cwd.replace(/[^/]+\/$/, ""); st.sel.clear(); render();
      }
      async function openRow(r) {
        if (st.mode === "home") {
          if (EXT.archive.includes(ext(r.name))) return openVfs(r.name);
          return CF.open("files");
        }
        if (r.dir) { st.cwd = r.path; st.sel.clear(); return render(); }
        if (r.type === "archive") {
          const inner = await dataOf(r.item);
          const keep = (await CF.dialog({ title: "WinNight", icon: "question", message: `${r.name} is an archive inside this archive. Open it?`, buttons: ["Open", "Cancel"] })).button;
          if (keep === "Open") return openBytes(inner, r.name, "nested");
          return;
        }
        return viewItem(r.item);
      }
      function rowMenu(e, r) {
        const inArc = st.mode === "archive";
        CF.contextMenu({ x: e.clientX, y: e.clientY }, inArc ? [
          { label: r.dir ? "Open" : "View", action: () => run(() => openRow(r)) },
          { label: "Extract to…", action: () => run(extractTo) }, "-",
          { label: "Rename", key: "F2", disabled: !writable() || st.sel.size !== 1, action: () => run(renameSelected) },
          { label: "Delete", key: "Del", disabled: !writable() && st.arc?.format !== "zip", action: () => run(deleteSelected) }, "-",
          { label: "Test", action: () => run(testArchive) }, { label: "Information", action: () => run(showInfo) },
        ] : [
          { label: EXT.archive.includes(ext(r.name)) ? "Open archive" : "Open", action: () => run(() => openRow(r)) },
          { label: "Add to archive…", action: () => run(addFiles) },
          EXT.archive.includes(ext(r.name)) ? { label: "Extract here (My Documents)", action: () => run(async () => { await openVfs(r.name); await extractAll("vfs"); }) } : null,
        ]);
      }

      /* ---------- opening ---------- */
      async function openBytes(bytes, name, source) {
        status(`Opening ${name}…`);
        let arc;
        for (;;) {
          try { arc = await ZipKit.open(bytes, name, st.password); break; }
          catch (e) {
            if (/passphrase|password|encrypt/i.test(e.message)) {
              const pw = await askPassword(`${name} is locked. Enter the password:`);
              if (pw == null) return;
              st.password = pw; continue;
            }
            throw new Error(`WinNight can't open ${name}: ${e.message}`);
          }
        }
        Object.assign(st, { mode: "archive", arc, bytes, name, source, cwd: "", dirty: false, lib: null, comment: arc.comment || "", lockPassword: null });
        if (source !== "nested") st.password = st.password ?? null;
        st.items = arc.entries.map(e => ({ path: e.name, dir: e.dir, size: e.size, csize: e.csize, mtime: e.mtime, crc: e.crc, encrypted: e.encrypted, entry: e }));
        st.sel.clear();
        CF.sound("menu_popup");
        render();
      }
      async function openFromDisk() {
        const inp = h("input", { type: "file", accept: EXT.archive.map(x => "." + x).join(",") });
        const file = await new Promise(res => { inp.addEventListener("change", () => res(inp.files[0])); inp.click(); });
        if (file) { st.password = null; await openBytes(await readFile(file), file.name, "disk"); }
      }
      async function openVfs(name) {
        const bytes = CF.vfs.readBytes(name);
        if (!bytes) throw new Error(`${name} isn't in My Documents any more.`);
        st.password = null;
        await openBytes(bytes, name, "vfs");
      }
      async function newArchive() {
        if (!(await confirmDiscard())) return;
        const r = await archiveDialog("New archive", `New Archive.${opts.format === "zip" ? "zip" : opts.format}`, true);
        if (!r) return;
        Object.assign(st, { mode: "archive", arc: { format: r.format, entries: [] }, bytes: null, name: r.name, source: "new", cwd: "", items: [], dirty: true, lib: null, comment: "", lockPassword: r.password || null, password: r.password || null, newFormat: r.format });
        st.sel.clear(); render();
        return r;
      }
      async function closeArchive() {
        if (!(await confirmDiscard())) return;
        Object.assign(st, { mode: "home", arc: null, bytes: null, name: null, items: [], cwd: "", dirty: false, password: null, lockPassword: null, lib: null });
        st.sel.clear(); render();
      }
      async function confirmDiscard() {
        if (!st.dirty) return true;
        const r = await CF.dialog({ title: "WinNight", icon: "question", message: `${st.name} has changes that aren't saved. Save them first?`, buttons: ["Save", "Don't save", "Cancel"] });
        if (r.button === "Save") { await save(false); return !st.dirty; }
        return r.button === "Don't save";
      }

      /* ---------- archive options dialog (like WinRAR's "Archive name and parameters") ---------- */
      async function archiveDialog(titleText, defaultName, allowFormat) {
        const nameF = h("input", { class: "field", value: defaultName, style: "width:100%" });
        const fmtF = h("select", { class: "field" }, ZipKit.WRITE_FORMATS.map(([id, label]) => h("option", { value: id, selected: id === opts.format }, label)));
        const lvlF = h("select", { class: "field" }, [["deflate", "Normal"], ["store", "Store"]].map(([id, label]) => h("option", { value: id, selected: id === opts.level }, label)));
        const pw1 = h("input", { class: "field", type: "password", placeholder: "No password", autocomplete: "new-password" });
        const pw2 = h("input", { class: "field", type: "password", placeholder: "Repeat password", autocomplete: "new-password" });
        const syncExt = () => { nameF.value = stripExt(nameF.value) + "." + fmtF.value; pw1.disabled = pw2.disabled = fmtF.value !== "zip"; };
        fmtF.addEventListener("change", syncExt);
        const form = h("div", { class: "wn-form" },
          h("label", {}, "Archive name", nameF),
          allowFormat ? h("div", { class: "row" }, h("label", {}, "Format", fmtF), h("label", {}, "Compression", lvlF)) : null,
          allowFormat ? h("fieldset", { class: "wn-lockset" }, h("legend", {}, "Lock with password (AES-256, ZIP only)"), pw1, pw2) : null);
        if (allowFormat) pw1.disabled = pw2.disabled = fmtF.value !== "zip";
        const r = await CF.dialog({ title: titleText, icon: "winnight", message: "", content: form, buttons: ["OK", "Cancel"] });
        if (r.button !== "OK") return null;
        if (pw1.value !== pw2.value) { await CF.dialog({ title: "WinNight", icon: "error", message: "The passwords don't match." }); return null; }
        opts.level = lvlF.value; saveOpts();
        const name = nameF.value.trim() || defaultName;
        return { name, format: allowFormat ? fmtF.value : null, password: pw1.value || null };
      }

      /* ---------- Add ---------- */
      async function addFiles(dropped) {
        let files = dropped;
        if (!files) {
          if (st.mode === "home" && st.sel.size) {
            files = [...st.sel].map(n => { const d = CF.vfs.read(n); return d && { name: d.name, data: CF.vfs.readBytes(d.name), mtime: new Date(d.modified) }; }).filter(Boolean);
          } else {
            const inp = h("input", { type: "file", multiple: true });
            const picked = await new Promise(res => { inp.addEventListener("change", () => res([...inp.files])); inp.click(); });
            if (!picked.length) return;
            files = [];
            for (const f of picked) files.push({ name: f.webkitRelativePath || f.name, data: await readFile(f), mtime: new Date(f.lastModified) });
          }
        }
        if (!files?.length) return;
        if (st.mode !== "archive") {
          const base = files.length === 1 ? stripExt(files[0].name.split("/").pop()) : "New Archive";
          const r = await newArchiveNamed(`${base}.${opts.format}`);
          if (!r) return;
        } else if (!writable()) {
          const r = await CF.dialog({ title: "WinNight", icon: "question", message: `WinNight can read ${st.arc.format.toUpperCase()} archives but not change them. Convert ${st.name} to ZIP and add the files?`, buttons: ["Convert to ZIP", "Cancel"] });
          if (r.button !== "Convert to ZIP") return;
          await convertTo("zip", stripExt(st.name) + ".zip", true);
        }
        let n = 0;
        for (const f of files) {
          const path = st.cwd + f.name.replace(/^\/+/, "");
          st.items = st.items.filter(i => i.path !== path);
          st.items.push({ path, dir: false, size: f.data.length, csize: null, mtime: f.mtime || new Date(), crc: ZipKit.crc32(f.data), encrypted: !!st.lockPassword, data: f.data });
          status(`Adding ${++n}/${files.length}: ${f.name}`);
        }
        st.dirty = true; st.sel.clear(); render();
        CF.toast({ title: "WinNight", body: `Added ${files.length} file(s) to ${st.name}. Save (Ctrl+S) to write it.`, icon: "winnight" });
      }
      async function newArchiveNamed(defaultName) {
        const r = await archiveDialog("Archive name and parameters", defaultName, true);
        if (!r) return null;
        Object.assign(st, { mode: "archive", arc: { format: r.format, entries: [] }, bytes: null, name: r.name, source: "new", cwd: "", items: [], dirty: true, lib: null, comment: "", lockPassword: r.password, password: r.password, newFormat: r.format });
        return r;
      }

      /* ---------- Save / build ---------- */
      function targetFormat() {
        const f = st.newFormat || st.arc?.format;
        return ["zip", "tar", "tar.gz", "tar.xz", "tar.bz2", "tar.zst"].includes(f) ? f : "zip";
      }
      async function buildBytes(format, { password = st.lockPassword, reencrypt = false } = {}) {
        const files = [];
        let i = 0;
        for (const it of st.items) {
          status(`Packing ${++i}/${st.items.length}: ${it.path}`);
          // Untouched ZIP entries are copied as they are (renamed ones too: only the header changes).
          const canRaw = format === "zip" && st.arc?.format === "zip" && it.entry && !it.data && !reencrypt;
          if (canRaw) files.push({ name: it.path, dir: it.dir, raw: { zip: st.arc, entry: it.entry } });
          else files.push({ name: it.path, dir: it.dir, mtime: it.mtime, data: it.dir ? new Uint8Array(0) : await dataOf(it) });
        }
        return ZipKit.write(format, files, { level: opts.level, password: format === "zip" ? password : null, comment: st.comment });
      }
      async function save(as) {
        if (st.mode !== "archive") return;
        let name = st.name, dest = st.source === "vfs" ? "vfs" : "download";
        if (as || st.source === "new" || st.source === "nested" || !writable()) {
          const nameF = h("input", { class: "field", value: writable() ? name : stripExt(name) + ".zip", style: "width:100%" });
          const destF = h("select", { class: "field" }, h("option", { value: "vfs", selected: dest === "vfs" }, "My Documents"), h("option", { value: "download", selected: dest === "download" }, "Download to this PC"));
          const r = await CF.dialog({ title: "Save archive", icon: "winnight", message: "", content: h("div", { class: "wn-form" }, h("label", {}, "File name", nameF), h("label", {}, "Save to", destF)), buttons: ["Save", "Cancel"] });
          if (r.button !== "Save") return;
          name = nameF.value.trim() || name; dest = destF.value;
        }
        const format = writable() ? targetFormat() : "zip";
        const bytes = await buildBytes(/\.zip$/i.test(name) ? "zip" : format);
        if (dest === "vfs") {
          if (!CF.vfs.writeBytes(name, bytes, MIME[ext(name)] || "application/octet-stream")) { CF.download(name, bytes); CF.toast({ title: "WinNight", body: `My Documents is full, so ${name} was downloaded instead.`, icon: "winnight" }); dest = "download"; }
        } else CF.download(name, bytes);
        const keepPw = st.password ?? st.lockPassword;
        await openBytes(bytes, name, dest === "vfs" ? "vfs" : "disk");
        st.password = keepPw; st.newFormat = null;
        CF.toast({ title: "WinNight", body: `Saved ${name} (${fmtSize(bytes.length)}).`, icon: "winnight" });
      }

      /* ---------- Extract ---------- */
      async function extractTo() {
        if (st.mode === "home") {
          const d = firstSelected();
          if (d && EXT.archive.includes(ext(d.name))) { await openVfs(d.name); return extractTo(); }
          return CF.dialog({ title: "WinNight", icon: "info", message: "Select an archive first, or open one with File → Open archive." });
        }
        const destF = h("select", { class: "field" }, h("option", { value: "vfs" }, "My Documents"), h("option", { value: "download" }, "Download to this PC"));
        const folderF = h("input", { type: "checkbox", checked: true });
        const pathsF = h("input", { type: "checkbox", checked: true });
        const which = st.sel.size ? "the selected files" : "all files";
        const r = await CF.dialog({ title: "Extraction path and options", icon: "winnight", message: `Extract ${which} from ${st.name}`,
          content: h("div", { class: "wn-form" }, h("label", {}, "Destination", destF),
            h("label", { class: "chk" }, folderF, ` Put them in a folder named "${stripExt(st.name)}"`),
            h("label", { class: "chk" }, pathsF, " Keep folder paths")), buttons: ["Extract", "Cancel"] });
        if (r.button !== "Extract") return;
        await extractAll(destF.value, { folder: folderF.checked, paths: pathsF.checked, onlySel: !!st.sel.size });
      }
      async function extractAll(dest, { folder = true, paths = true, onlySel = false } = {}) {
        const items = (onlySel ? selectedItems() : st.items).filter(i => !i.dir);
        let n = 0, skipped = 0;
        for (const it of items) {
          status(`Extracting ${++n}/${items.length}: ${it.path}`);
          const data = await dataOf(it);
          const rel = paths ? it.path : baseName(it.path);
          const out = (folder ? stripExt(st.name) + "/" : "") + rel;
          if (dest === "download") { CF.download(out.split("/").join("_"), data, MIME[ext(out)]); continue; }
          const t = typeOf(out);
          let okW;
          if ((t === "text" || t === "code") && isTextual(data) && data.length < 2e6) okW = CF.vfs.write(out, new TextDecoder().decode(data), "text");
          else okW = CF.vfs.writeBytes(out, data, MIME[ext(out)] || "application/octet-stream");
          if (!okW) { skipped = items.length - n + 1; break; }
        }
        CF.sound("ding");
        CF.toast({ title: "WinNight", body: skipped ? `Extracted ${n - 1} file(s). My Documents ran out of space; ${skipped} left. Use "Download to this PC" for big archives.` : `Extracted ${items.length} file(s)${dest === "vfs" ? " to My Documents" : ""}.`, icon: "winnight", onclick: () => dest === "vfs" && CF.open("files") });
      }

      /* ---------- Test / View / Delete / Rename / New folder ---------- */
      async function testArchive() {
        if (st.mode !== "archive") return;
        const items = st.items.filter(i => !i.dir && !i.data);
        const bad = [];
        let n = 0;
        for (const it of items) {
          status(`Testing ${++n}/${items.length}: ${it.path}`);
          try { await dataOf(it); } catch (e) { if (e.message === "Cancelled.") return; bad.push(`${it.path}: ${e.message}`); }
        }
        CF.dialog({ title: "Testing archive", icon: bad.length ? "error" : "info",
          message: bad.length ? `${bad.length} of ${items.length} file(s) failed:\n\n${bad.slice(0, 12).join("\n")}${bad.length > 12 ? "\n…" : ""}` : `No errors found in ${st.name}.\n${items.length} file(s) tested${st.arc.format === "zip" ? " (CRC-32" + (st.items.some(i => i.encrypted) ? " and AES authentication" : "") + ")" : ""}.` });
      }
      async function viewSelected() {
        const it = firstSelected();
        if (!it) return CF.dialog({ title: "WinNight", icon: "info", message: "Select a file to view." });
        if (st.mode === "home") return CF.open("files");
        return viewItem(it);
      }
      async function viewItem(it) {
        const data = await dataOf(it);
        const name = baseName(it.path), t = typeOf(name);
        if (t === "audio" || t === "video") {
          const url = URL.createObjectURL(new Blob([data], { type: MIME[ext(name)] || "" }));
          return CF.open("nightamp", { add: [{ name, url }], play: true });
        }
        const w = CF.createWindow({ title: `${name} - WinNight Viewer`, icon: "winnight", w: 680, h: 480 });
        const body = h("div", { class: "wn-viewer" });
        if (t === "image") {
          const url = URL.createObjectURL(new Blob([data], { type: MIME[ext(name)] || "image/png" }));
          body.append(h("img", { src: url, alt: name }));
          w.on("close", () => URL.revokeObjectURL(url));
        } else if (isTextual(data)) {
          body.append(h("pre", {}, new TextDecoder().decode(data.subarray(0, 2e6))));
        } else {
          const lines = [];
          for (let o = 0; o < Math.min(data.length, 65536); o += 16) {
            const row = data.subarray(o, o + 16);
            lines.push(o.toString(16).padStart(8, "0") + "  " + [...row].map(b => b.toString(16).padStart(2, "0")).join(" ").padEnd(48) + "  " + [...row].map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : ".").join(""));
          }
          body.append(h("pre", {}, lines.join("\n") + (data.length > 65536 ? `\n… ${fmtSize(data.length)} in total` : "")));
        }
        w.body.append(body);
        w.statusbar([`${name} · ${fmtSize(data.length)} · CRC32 ${hex8(ZipKit.crc32(data))}`, LABEL[t]]);
        w.menubar([{ label: "File", items: [
          { label: "Save to My Documents", action: () => { if (CF.vfs.writeBytes(name, data, MIME[ext(name)] || "application/octet-stream")) CF.toast({ title: "WinNight", body: `Saved ${name} to My Documents.`, icon: "winnight" }); } },
          { label: "Download", action: () => CF.download(name, data, MIME[ext(name)]) }, "-", { label: "Close", action: () => w.close() }] }]);
      }
      async function deleteSelected() {
        if (st.mode === "home") {
          const names = [...st.sel];
          if (!names.length) return;
          const r = await CF.dialog({ title: "Delete", icon: "question", message: `Move ${names.length} document(s) to the Recycle Bin?`, buttons: ["Yes", "No"] });
          if (r.button === "Yes") { names.forEach(n => CF.vfs.remove(n)); CF.sound("recycle"); st.sel.clear(); render(); }
          return;
        }
        const items = selectedItems();
        if (!items.length) return;
        if (!writable()) return CF.dialog({ title: "WinNight", icon: "info", message: `WinNight can't change ${st.arc.format.toUpperCase()} archives. Use Tools → Convert archive to make a ZIP you can edit.` });
        const r = await CF.dialog({ title: "Delete", icon: "question", message: `Delete ${items.length} file(s) from ${st.name}?`, buttons: ["Yes", "No"] });
        if (r.button !== "Yes") return;
        const gone = new Set(items);
        st.items = st.items.filter(i => !gone.has(i) && ![...st.sel].some(k => k.endsWith("/") && i.path.startsWith(k)));
        st.dirty = true; st.sel.clear(); CF.sound("recycle"); render();
      }
      async function renameSelected() {
        const key = [...st.sel][0];
        if (!key || !writable()) return;
        const old = baseName(key);
        const r = await CF.dialog({ title: "Rename", icon: "winnight", message: `New name for ${old}:`, input: old, buttons: ["OK", "Cancel"] });
        if (r.button !== "OK" || !r.value.trim() || r.value === old) return;
        const parent = key.replace(/[^/]+\/?$/, ""), isDir = key.endsWith("/");
        const to = parent + r.value.trim().replace(/\//g, "_") + (isDir ? "/" : "");
        for (const it of st.items) if (isDir ? it.path.startsWith(key) : it.path === key) { it.path = to + it.path.slice(key.length); it.renamed = true; }
        st.dirty = true; st.sel.clear(); render();
      }
      async function newFolder() {
        const r = await CF.dialog({ title: "New folder", icon: "winnight", message: "Folder name:", input: "New Folder", buttons: ["OK", "Cancel"] });
        if (r.button !== "OK" || !r.value.trim()) return;
        st.items.push({ path: st.cwd + r.value.trim().replace(/\//g, "_") + "/", dir: true, size: 0, csize: 0, mtime: new Date(), data: new Uint8Array(0) });
        st.dirty = true; render();
      }

      /* ---------- Find ---------- */
      async function findFiles() {
        if (st.mode !== "archive") return;
        const maskF = h("input", { class: "field", value: "*", style: "width:100%" });
        const textF = h("input", { class: "field", placeholder: "(optional)", style: "width:100%" });
        const r = await CF.dialog({ title: "Find files", icon: "winnight", message: "", content: h("div", { class: "wn-form" }, h("label", {}, "File names to find (* and ? wildcards)", maskF), h("label", {}, "String to find inside files", textF)), buttons: ["Find", "Cancel"] });
        if (r.button !== "Find") return;
        const rx = new RegExp("^" + maskF.value.trim().split(/[;,]\s*/).map(m => m.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")).join("|") + "$", "i");
        const needle = textF.value;
        const hits = [];
        let n = 0;
        for (const it of st.items.filter(i => !i.dir)) {
          status(`Searching ${++n}/${st.items.length}…`);
          if (!rx.test(baseName(it.path))) continue;
          if (needle) { const d = await dataOf(it); if (!new TextDecoder().decode(d).toLowerCase().includes(needle.toLowerCase())) continue; }
          hits.push(it);
        }
        const w = CF.createWindow({ title: `Find results - ${hits.length} found`, icon: "winnight", w: 560, h: 360 });
        const l = h("div", { class: "list", style: "position:absolute;inset:0" }, hits.length ? hits.map(it => {
          const row = h("div", { class: "item clickable" }, h("img", { src: typeIcon(typeOf(it.path)), alt: "", style: "width:16px;height:16px" }), h("span", { style: "flex:1" }, it.path), h("small", { class: "muted" }, fmtSize(it.size)));
          row.addEventListener("dblclick", () => { st.cwd = it.path.replace(/[^/]+$/, ""); st.sel = new Set([it.path]); render(); win.focus(); });
          return row;
        }) : [h("div", { class: "pad muted" }, "Nothing found.")]);
        w.body.append(l);
        w.statusbar(["Double-click a file to show it in WinNight"]);
      }

      /* ---------- Info / Comment / Lock / Repair / Convert / SFX / Wizard ---------- */
      function showInfo() {
        if (st.mode !== "archive") return;
        const files = st.items.filter(i => !i.dir), dirs = new Set();
        st.items.forEach(i => { const parts = i.path.split("/"); for (let k = 1; k < parts.length; k++) dirs.add(parts.slice(0, k).join("/")); if (i.dir) dirs.add(i.path.replace(/\/$/, "")); });
        const total = files.reduce((a, i) => a + (i.size || 0), 0), packed = files.reduce((a, i) => a + (i.csize || 0), 0);
        const enc = files.filter(i => i.encrypted).length;
        CF.dialog({ title: `${st.name} - Information`, icon: "winnight", message: [
          `Archive: ${st.name}`, `Format: ${(st.arc?.format || st.newFormat || "zip").toUpperCase()}${writable() ? "" : " (read-only in WinNight)"}`,
          `Files: ${files.length}    Folders: ${dirs.size}`, `Total size: ${fmtSize(total)}`,
          packed ? `Packed size: ${fmtSize(packed)}    Ratio: ${total ? Math.round(packed / total * 100) : 0}%` : "Packed size: (not saved yet)",
          `Locked: ${enc ? `${enc} file(s) with ${files.some(i => i.entry?.aes) ? "AES-256" : "ZipCrypto"}` : st.lockPassword ? "AES-256 when saved" : "no"}`,
          st.comment ? `\nComment:\n${st.comment}` : ""].join("\n") });
      }
      async function editComment() {
        const ta = h("textarea", { class: "field", rows: 6, style: "width:100%;min-width:320px;font-family:inherit" }, st.comment || "");
        const r = await CF.dialog({ title: "Archive comment", icon: "winnight", message: "Comment shown when the archive is opened:", content: ta, buttons: ["OK", "Cancel"] });
        if (r.button !== "OK") return;
        st.comment = ta.value; st.dirty = true; render();
      }
      async function lockArchive() {
        if (st.mode !== "archive") return CF.dialog({ title: "WinNight", icon: "info", message: "Open or create an archive first." });
        if (!["zip", "new"].includes(st.arc?.format) && st.newFormat !== "zip") {
          const r = await CF.dialog({ title: "Lock archive", icon: "question", message: `Only ZIP archives can be locked. Convert ${st.name} to a locked ZIP?`, buttons: ["Convert", "Cancel"] });
          if (r.button !== "Convert") return;
          await convertTo("zip", stripExt(st.name) + ".zip", true);
        }
        const pw1 = h("input", { class: "field", type: "password", autocomplete: "new-password" }), pw2 = h("input", { class: "field", type: "password", autocomplete: "new-password" });
        const r = await CF.dialog({ title: "Lock with password", icon: "winnight", message: "Every file is encrypted with AES-256 (WinZip AE-2), which WinRAR, 7-Zip and Windows 11 can open. Leave it empty to remove the lock.",
          content: h("div", { class: "wn-form" }, h("label", {}, "Password", pw1), h("label", {}, "Repeat password", pw2)), buttons: ["OK", "Cancel"] });
        if (r.button !== "OK") return;
        if (pw1.value !== pw2.value) return CF.dialog({ title: "WinNight", icon: "error", message: "The passwords don't match." });
        for (const it of st.items) if (!it.dir && !it.data) it.data = await dataOf(it);   // decrypt with the old password first
        st.lockPassword = pw1.value || null;
        st.items.forEach(i => { if (!i.dir) { i.encrypted = !!st.lockPassword; i.csize = null; } });
        st.dirty = true; render();
        CF.toast({ title: "WinNight", body: st.lockPassword ? "Archive locked. Save to write it." : "Lock removed. Save to write it.", icon: "winnight" });
      }
      async function repairArchive() {
        let bytes = st.bytes, name = st.name;
        if (st.mode === "home") { const d = firstSelected(); if (!d) return; bytes = CF.vfs.readBytes(d.name); name = d.name; }
        if (!bytes || ZipKit.sniff(bytes, name) !== "zip" && !/\.zip$/i.test(name)) return CF.dialog({ title: "Repair", icon: "info", message: "WinNight can repair ZIP archives." });
        status(`Repairing ${name}…`);
        const r = await ZipKit.repairZip(bytes);
        const fixed = `rebuilt_${name.replace(/\.zip$/i, "")}.zip`;
        if (!r.recovered) return CF.dialog({ title: "Repair", icon: "error", message: `No files could be recovered from ${name}.\n\n${r.log.slice(0, 8).join("\n")}` });
        if (!CF.vfs.writeBytes(fixed, r.bytes, "application/zip")) CF.download(fixed, r.bytes);
        await CF.dialog({ title: "Repair", icon: "info", message: `Recovered ${r.recovered} of ${r.found} file record(s) from ${name} into ${fixed}.${r.log.length ? "\n\nProblems:\n" + r.log.slice(0, 8).join("\n") : ""}` });
        st.password = null;
        await openBytes(r.bytes, fixed, "vfs");
      }
      async function convertTo(format, name, keepOpen) {
        const bytes = await buildBytes(format, { password: format === "zip" ? st.lockPassword : null, reencrypt: true });
        await openBytes(bytes, name, "new");
        st.dirty = true; st.newFormat = format;
        if (!keepOpen) await save(true);
        render();
      }
      async function convertArchive() {
        const fmtF = h("select", { class: "field" }, ZipKit.WRITE_FORMATS.map(([id, label]) => h("option", { value: id }, label)));
        const r = await CF.dialog({ title: "Convert archive", icon: "winnight", message: `Convert ${st.name} to:`, content: fmtF, buttons: ["Convert", "Cancel"] });
        if (r.button !== "Convert") return;
        await convertTo(fmtF.value, `${stripExt(st.name)}.${fmtF.value}`, false);
      }
      async function createSfx() {
        const zip = st.arc?.format === "zip" && !st.dirty && st.bytes ? st.bytes : await buildBytes("zip", { reencrypt: true });
        const engine = await (await fetch("js/zipkit.js")).text();
        let b64 = "";
        for (let i = 0; i < zip.length; i += 0x8000) b64 += String.fromCharCode.apply(null, zip.subarray(i, i + 0x8000));
        const title = stripExt(st.name);
        const html = SFX_TEMPLATE.replace(/%TITLE%/g, title.replace(/[<&"]/g, "")).replace("%ENGINE%", () => engine.replace(/<\/script/gi, "<\\/script")).replace("%DATA%", btoa(b64));
        const name = `${title}.sfx.html`;
        CF.download(name, new TextEncoder().encode(html), "text/html");
        CF.dialog({ title: "Self-extracting archive", icon: "info", message: `Created ${name}. It opens in any modern browser and extracts itself, no WinNight needed${st.items.some(i => i.encrypted) || st.lockPassword ? " (it asks for the password)" : ""}.` });
      }
      async function wizard() {
        const choice = h("div", { class: "wn-form" }, ...[["new", "Create a new archive from files"], ["extract", "Extract an archive"], ["add", "Add files to the open archive"]].map(([v, label], i) => h("label", { class: "chk" }, h("input", { type: "radio", name: "wnwiz", value: v, checked: i === (st.mode === "archive" ? 2 : 0) }), " " + label)));
        const r = await CF.dialog({ title: "WinNight Wizard", icon: "winnight", message: "What would you like to do?", content: choice, buttons: ["Next >", "Cancel"] });
        if (r.button !== "Next >") return;
        const v = choice.querySelector("input:checked").value;
        if (v === "new") { await closeArchive(); if (st.mode === "home") await addFiles(); }
        else if (v === "extract") { if (st.mode !== "archive") await openFromDisk(); if (st.mode === "archive") await extractTo(); }
        else await addFiles();
      }
      function about() {
        const w = CF.createWindow({ title: "About WinNight", icon: "winnight", w: 580, h: 440, resizable: false });
        w.body.append(h("div", { class: "wn-about" }, h("img", { src: `${ART}winnight-splash.png`, alt: "WinNight" }),
          h("p", {}, "WinNight 1.0, the NightCode archiver. An official ColeForge program."),
          h("p", { class: "muted" }, "ZIP/TAR engine: ZipKit (ColeForge). RAR, 7-Zip, XZ, BZIP2, ZSTD, ISO and CAB reading: libarchive (BSD) via libarchive.js (MIT). AES-256 in WinZip's AE-2 format.")));
      }

      /* ---------- keyboard, drag & drop ---------- */
      win.el.addEventListener("keydown", (e) => {
        if (e.target.closest("input, textarea, select")) return;
        const k = e.key.toLowerCase();
        if (e.ctrlKey && k === "o") { e.preventDefault(); run(openFromDisk); }
        else if (e.ctrlKey && k === "n") { e.preventDefault(); run(newArchive); }
        else if (e.ctrlKey && k === "s") { e.preventDefault(); run(() => save(false)); }
        else if (e.ctrlKey && k === "a") { e.preventDefault(); list.querySelectorAll("[data-key]").forEach(n => st.sel.add(n.dataset.key)); render(); }
        else if (e.altKey && ["a", "e", "t", "v", "i"].includes(k)) { e.preventDefault(); run({ a: addFiles, e: extractTo, t: testArchive, v: viewSelected, i: showInfo }[k]); }
        else if (k === "delete") run(deleteSelected);
        else if (k === "f2") run(renameSelected);
        else if (k === "f3") { e.preventDefault(); run(findFiles); }
        else if (k === "backspace") goUp();
        else if (k === "enter") { const r = rows().find(x => st.sel.has(x.dir ? x.path : (x.item?.path || x.name))); if (r) run(() => openRow(r)); }
      });
      win.body.addEventListener("dragover", (e) => { e.preventDefault(); win.el.classList.add("wn-dragging"); });
      win.body.addEventListener("dragleave", () => win.el.classList.remove("wn-dragging"));
      win.body.addEventListener("drop", (e) => {
        e.preventDefault(); win.el.classList.remove("wn-dragging");
        const files = [...(e.dataTransfer?.files || [])];
        if (!files.length) return;
        run(async () => {
          if (st.mode !== "archive" && files.length === 1 && EXT.archive.includes(ext(files[0].name))) { st.password = null; return openBytes(await readFile(files[0]), files[0].name, "disk"); }
          const list2 = [];
          for (const f of files) list2.push({ name: f.name, data: await readFile(f), mtime: new Date(f.lastModified) });
          await addFiles(list2);
        });
      });
      win.on("beforeclose", () => {
        if (!st.dirty) return true;
        confirmDiscard().then(okClose => { if (okClose) { st.dirty = false; win.close(true); } });
        return false;
      });
      win.on("args", (a) => a.file && run(() => openVfs(a.file)));
      const off = CF.on("vfs", () => st.mode === "home" && render());
      win.on("close", off);

      render();
      if (args.file) run(() => openVfs(args.file));
      else if (args.bytes) run(() => openBytes(args.bytes, args.name || "archive.zip", "disk"));
    },
  });

  // A self-extracting archive: one HTML file carrying the ZIP and ZipKit.
  const SFX_TEMPLATE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>%TITLE% - WinNight self-extracting archive</title>
<style>body{margin:0;min-height:100vh;background:radial-gradient(circle at 30% 20%,#13265a,#02050e 70%);color:#cfe6ff;font:14px Consolas,"Share Tech Mono",monospace}
main{max-width:760px;margin:0 auto;padding:28px 18px}h1{margin:0;color:#fff;font:900 30px/1.2 Orbitron,Segoe UI,sans-serif;text-shadow:0 0 12px #1e78ff}
.sub{color:#31d7e8;letter-spacing:.2em;font-size:12px;margin:6px 0 18px}table{width:100%;border-collapse:collapse;margin:14px 0;background:#050a16;box-shadow:inset 0 0 0 1px #1f3a6e}
td,th{padding:5px 8px;text-align:left;border-bottom:1px solid #10224a}th{color:#31d7e8;font-weight:normal}td.n{text-align:right}
button,input{font:inherit;padding:7px 14px;background:#10204a;color:#fff;border:1px solid #31d7e8;cursor:pointer}input{cursor:text;background:#050a16}
a{color:#31d7e8}.err{color:#ff8fb0}</style></head><body><main>
<h1>%TITLE%</h1><div class="sub">WINNIGHT SELF-EXTRACTING ARCHIVE · NIGHTCODE</div>
<div id="pw" hidden>Password: <input type="password" id="pass"> </div>
<p><button id="all">Extract all files</button> <span id="msg"></span></p><table id="t"><tr><th>File</th><th>Size</th><th></th></tr></table>
<p style="color:#5f80ab;font-size:12px">Made with WinNight, the NightCode archiver for Windows – ColeForge Edition. Everything runs on this page; nothing is uploaded.</p></main>
<script>%ENGINE%<\/script><script>
(async function(){const b=Uint8Array.from(atob("%DATA%"),c=>c.charCodeAt(0));const z=ZipKit.readZip(b);const t=document.getElementById("t"),msg=document.getElementById("msg");
if(z.entries.some(e=>e.encrypted))document.getElementById("pw").hidden=false;
const size=n=>n<1024?n+" B":n<1048576?(n/1024).toFixed(1)+" KB":(n/1048576).toFixed(1)+" MB";
async function get(e){try{const d=await ZipKit.extract(z,e,document.getElementById("pass").value||null);const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([d]));a.download=e.name.split("/").join("_");a.click();msg.textContent="";msg.className="";}catch(err){msg.textContent=err.message;msg.className="err";throw err;}}
for(const e of z.entries.filter(e=>!e.dir)){const r=t.insertRow();r.insertCell().textContent=e.name;const s=r.insertCell();s.className="n";s.textContent=size(e.size);const btn=document.createElement("button");btn.textContent="Extract";btn.onclick=()=>get(e);r.insertCell().append(btn);}
document.getElementById("all").onclick=async()=>{for(const e of z.entries.filter(e=>!e.dir)){try{await get(e);}catch{return;}await new Promise(r=>setTimeout(r,250));}};
if(z.comment){const p=document.createElement("pre");p.textContent=z.comment;t.before(p);}})();
<\/script></body></html>`;
})();
