"use strict";

// Legacy Mode: play 1990s PC games on modern hardware.
//   DOS games   → DOSBox – ColeForge Edition (DOSBox Staging + ColeForge machine presets)
//   Win9x games → a whole 1999 PC in 86Box, including the Voodoo3 rig ("Voodoo3 Mode")
// Presets and config generation live in js/legacy-profiles.js; the desktop host writes the files
// and starts the emulator. In a plain browser, Legacy Mode hands you the config files instead.
(function () {
  const { h } = CF;
  const L = window.LegacyProfiles;
  const art = (n) => `assets/art/legacy/${n}.png`;
  const ico = (n, cls = "lg-ico") => h("img", { class: cls, src: art(n), alt: "" });
  const KEY = "cf.legacy.games";
  const DISK_BYTES = 63 * 16 * 8322 * 512; // matches hdd_01_parameters in box86Cfg (≈ 4 GB)
  const uid = () => "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const STARTERS = [
    { id: "starter-v3", name: "Voodoo3 Rig", kind: "win9x", machine: "voodoo3", vmName: "ColeForge 98 Voodoo3", memMb: 128, renderThreads: 4, cdImage: "" },
    { id: "starter-dos", name: "DOS Prompt (486)", kind: "dos", machine: "486", folder: "", exe: "" },
  ];
  const games = () => CF.store.get(KEY, null) || STARTERS.map(g => ({ ...g }));
  const saveGames = (list) => CF.store.set(KEY, list);

  function configFor(g) {
    return g.kind === "dos"
      ? { kind: "dos", file: "dosbox.conf", text: L.dosboxConf(g.machine, g) }
      : { kind: "win9x", file: "86box.cfg", text: L.box86Cfg(g.machine, { name: g.vmName || g.name, memMb: g.memMb, renderThreads: g.renderThreads, cdImage: g.cdImage }) };
  }

  function hardwareSheet(m) {
    const rows = m.kind === "dos"
      ? [["cpu", "CPU", `${m.cpu} (${m.cycles.toLocaleString()} cycles)`], ["ram", "Memory", `${m.memsize} MB`], ["card3d", "Video", m.video], ["sound", "Sound", m.sound]]
      : [["win98", "Board", m.board], ["cpu", "CPU", m.cpu], ["ram", "Memory", `${m.mem_kb / 1024} MB`], ["card3d", "Video", m.gfxName], ["sound", "Sound", m.sound], ["config", "Network", m.netName]];
    return h("div", { class: "lg-sheet" },
      h("div", { class: "lg-sheet-head" }, ico(m.kind === "dos" ? "dos" : "win98"), h("div", {}, h("b", {}, m.name), h("div", { class: "muted" }, `${m.era} · ${m.kind === "dos" ? "DOSBox – ColeForge Edition" : "86Box · " + m.os}`)),
        m.id === "voodoo3" ? h("img", { class: "lg-badge", src: art("voodoo3-mode"), alt: "Voodoo3 Mode" }) : null),
      ...rows.map(([i, k, v]) => h("div", { class: "lg-row" }, ico(i + "-16", "lg-ico16"), h("span", { class: "lg-k" }, k), h("span", {}, v))),
      h("p", { class: "muted lg-blurb" }, m.blurb));
  }

  CF.register({
    id: "legacy", name: "Legacy Mode", icon: "legacy", single: true,
    desc: "Play 90's PC games on modern hardware: DOSBox – ColeForge Edition for DOS, 86Box Windows 98 PCs, Voodoo3 Mode.",
    window: { w: 980, h: 640 },
    open(win, args) {
      let list = games(), selId = list[0]?.id, tab = "games";
      const tabsEl = h("div", { class: "tabs" });
      const page = h("div", { class: "lg-page" });
      const v3Btn = h("button", { class: "lg-v3btn clickable", title: "Voodoo3 Mode: a 1999 Pentium II with a 3dfx Voodoo3 3000 AGP" }, h("img", { src: art("voodoo3-mode"), alt: "Voodoo3 Mode" }));
      v3Btn.addEventListener("click", voodoo3Mode);
      win.body.append(h("div", { class: "lg" },
        h("div", { class: "lg-top" }, h("img", { class: "lg-logo", src: art("logo-64"), alt: "" }),
          h("div", { style: "flex:1" }, h("img", { class: "lg-title", src: art("legacy-mode"), alt: "Legacy Mode" }),
            h("div", { class: "muted" }, "90's games on today's hardware · DOSBox – ColeForge Edition · 86Box Windows 98 PCs")), v3Btn),
        tabsEl, page));
      win.menubar([
        { label: "File", items: [{ label: "New DOS game…", action: () => newGame("dos") }, { label: "New Windows 98 PC…", action: () => newGame("win9x") }, "-",
          { label: "Open Legacy Mode folder", disabled: !CF.host?.legacyOpen, action: () => CF.host.legacyOpen() }, "-", { label: "Close", action: () => win.close() }] },
        { label: "View", items: () => [["games", "Games"], ["machines", "Machines"], ["then", "Then vs Now"], ["engines", "Engines"]].map(([id, label]) => ({ label, checked: tab === id, action: () => show(id) })) },
        { label: "Help", items: [{ label: "Why old games break (Then vs Now)", action: () => show("then") }, { label: "About Legacy Mode", action: about }] },
      ]);

      function show(t) {
        tab = t;
        tabsEl.replaceChildren(...[["games", "Games"], ["machines", "Machines"], ["then", "Then vs Now"], ["engines", "Engines"]].map(([id, label]) => {
          const el = h("div", { class: "clickable" + (id === tab ? " on" : "") }, label); el.addEventListener("click", () => show(id)); return el;
        }));
        page.replaceChildren(...({ games: gamesPage, machines: machinesPage, then: thenPage, engines: enginesPage }[tab])());
        win.statusbar([`${list.length} entries`, CF.host?.legacyPrepare ? "Desktop host: launches directly" : "Browser mode: download configs"]);
      }

      /* ---------- games ---------- */
      function gamesPage() {
        const cur = list.find(g => g.id === selId) || list[0];
        const side = h("div", { class: "list lg-list" }, list.map(g => {
          const m = L.MACHINES[g.machine];
          const r = h("div", { class: "item clickable" + (cur && g.id === cur.id ? " sel" : "") }, ico(g.kind === "dos" ? "dos-16" : "win98-16", "lg-ico16"),
            h("div", { style: "flex:1;min-width:0" }, h("div", {}, g.name), h("small", { class: "muted" }, m ? m.name : g.machine)));
          r.addEventListener("click", () => { selId = g.id; show("games"); });
          r.addEventListener("dblclick", () => launch(g));
          r.addEventListener("contextmenu", (e) => { e.preventDefault(); selId = g.id; CF.contextMenu({ x: e.clientX, y: e.clientY }, [{ label: "Launch", action: () => launch(g) }, { label: "Show config", action: () => showConfig(g) }, "-", { label: "Delete", action: () => remove(g) }]); });
          return r;
        }), h("div", { class: "lg-add" }, h("button", { class: "btn", onclick: () => newGame("dos") }, ico("dos-16", "lg-ico16"), " DOS game"), h("button", { class: "btn", onclick: () => newGame("win9x") }, ico("win98-16", "lg-ico16"), " Win98 PC")));
        return [h("div", { class: "lg-split" }, side, cur ? editor(cur) : h("div", { class: "pad muted" }, "Add a game to get started."))];
      }

      function editor(g) {
        const machines = Object.values(L.MACHINES).filter(m => m.kind === g.kind);
        const f = (label, input) => [h("label", {}, label), input];
        const field = (key, ph, type = "text") => { const i = h("input", { class: "field", type, value: g[key] ?? "", placeholder: ph || "" }); i.addEventListener("change", () => { g[key] = type === "number" ? (i.value === "" ? "" : +i.value) : i.value.trim(); commit(); }); return i; };
        const name = field("name");
        const mSel = h("select", { class: "field" }, machines.map(m => h("option", { value: m.id, selected: m.id === g.machine }, m.name.includes(m.era) ? m.name : `${m.name} (${m.era})`)));
        mSel.addEventListener("change", () => { g.machine = mSel.value; commit(); show("games"); });
        const rows = [...f("Name", name), ...f("Machine", mSel)];
        if (g.kind === "dos") {
          const ipx = h("select", { class: "field" }, [["", "Off"], ["host", "Host (ipxnet startserver)"], ["join", "Join a host…"]].map(([v, l]) => h("option", { value: v, selected: (g.ipx || "") === v }, l)));
          ipx.addEventListener("change", () => { g.ipx = ipx.value; commit(); show("games"); });
          const fs = h("input", { type: "checkbox", checked: !!g.fullscreen }); fs.addEventListener("change", () => { g.fullscreen = fs.checked; commit(); });
          const ex = h("input", { type: "checkbox", checked: !!g.exitAfter }); ex.addEventListener("change", () => { g.exitAfter = ex.checked; commit(); });
          rows.push(...f("Game folder (drive C:)", field("folder", "C:\\Games\\DOOM")), ...f("Program", field("exe", "DOOM.EXE or SUBDIR\\GAME.EXE")),
            ...f("CPU speed (cycles)", field("cycles", `${L.MACHINES[g.machine]?.cycles} (preset)`, "number")), ...f("IPX network", ipx));
          if (g.ipx === "join") rows.push(...f("Host address", field("ipxHost", "192.168.1.20")));
          rows.push(h("div", {}), h("div", { class: "row" }, h("label", { class: "row clickable" }, fs, "Full screen"), h("label", { class: "row clickable" }, ex, "Exit DOSBox when the game quits")));
        } else {
          const thr = h("select", { class: "field" }, [1, 2, 4].map(n => h("option", { value: n, selected: (+g.renderThreads || 4) === n }, `${n} thread${n > 1 ? "s" : ""}`)));
          thr.addEventListener("change", () => { g.renderThreads = +thr.value; commit(); });
          rows.push(...f("86Box machine name", field("vmName", "ColeForge 98")), ...f("Memory (MB)", field("memMb", "128", "number")),
            ...f("Voodoo render threads", thr), ...f("CD-ROM image", field("cdImage", "D:\\ISO\\win98se.iso (install) or a game disc")));
        }
        const m = L.MACHINES[g.machine];
        return h("div", { class: "lg-edit" },
          h("div", { class: "group" }, h("div", { class: "legend" }, g.kind === "dos" ? "DOS game" : "Windows 98 PC"), h("div", { class: "form-grid" }, ...rows)),
          m ? hardwareSheet(m) : null,
          h("div", { class: "row lg-actions" },
            h("button", { class: "btn", onclick: () => launch(g) }, ico("launch-16", "lg-ico16"), " Launch"),
            h("button", { class: "btn", onclick: () => showConfig(g) }, ico("config-16", "lg-ico16"), " Show config"),
            h("button", { class: "btn flat", onclick: () => remove(g) }, "Delete")),
          g.kind === "win9x" ? h("p", { class: "muted" }, "First run: point the CD-ROM image at your Windows 98 SE install disc, boot, run FDISK/FORMAT C: and Setup, then install the 3dfx Voodoo3 driver inside Windows 98.") : null);
      }
      function commit() { saveGames(list); }
      function newGame(kind) {
        const g = kind === "dos" ? { id: uid(), name: "New DOS game", kind, machine: "486", folder: "", exe: "" }
          : { id: uid(), name: "New Windows 98 PC", kind, machine: "voodoo3", vmName: "ColeForge 98 " + (list.filter(x => x.kind === "win9x").length + 1), memMb: 128, renderThreads: 4, cdImage: "" };
        list.push(g); selId = g.id; commit(); show("games");
      }
      async function remove(g) {
        const r = await CF.dialog({ title: "Legacy Mode", icon: "question", message: `Remove "${g.name}" from Legacy Mode?\n\nFiles on disk (configs, 86Box disk images) are left alone.`, buttons: ["Remove", "Cancel"] });
        if (r.button !== "Remove") return;
        list = list.filter(x => x !== g); selId = list[0]?.id; commit(); show("games");
      }
      function voodoo3Mode() {
        let g = list.find(x => x.id === selId);
        if (!g || g.kind !== "win9x") g = list.find(x => x.kind === "win9x" && x.machine === "voodoo3");
        if (!g) { newGame("win9x"); g = list.find(x => x.id === selId); }
        g.machine = "voodoo3"; selId = g.id; commit(); show("games");
        CF.toast({ title: "Voodoo3 Mode", body: "Pentium II 450 · 440BX · 3dfx Voodoo3 3000 AGP · Windows 98 SE", icon: "legacy" });
      }

      /* ---------- launching ---------- */
      async function launch(g) {
        let cfg;
        try { cfg = configFor(g); } catch (e) { return CF.dialog({ title: "Legacy Mode", icon: "error", message: e.message }); }
        if (g.kind === "dos" && g.exe && !g.folder) return CF.dialog({ title: "Legacy Mode", icon: "warning", message: "Pick the game folder to mount as drive C: first." });
        if (!CF.host?.legacyPrepare) return showConfig(g, true);
        const engines = await CF.host.legacyEngines();
        const exe = g.kind === "dos" ? engines.dosbox : engines.box86;
        if (!exe) return CF.dialog({ title: "Legacy Mode", icon: "warning", message: `${g.kind === "dos" ? "DOSBox Staging" : "86Box"} isn't installed yet.\n\nRun core\\windows\\get-legacy-engines.ps1 (it installs into ${engines.home}\\engines), then try again.` });
        try {
          const prep = await CF.host.legacyPrepare({ kind: cfg.kind, name: g.kind === "dos" ? g.name : (g.vmName || g.name), text: cfg.text, diskBytes: g.kind === "win9x" ? DISK_BYTES : 0 });
          const command = g.kind === "dos" ? `"${exe}" --conf "${prep.file}"` : `"${exe}" --vmpath "${prep.dir}"` + (engines.roms ? ` --rompath "${engines.roms}"` : "");
          if (g.machine === "voodoo3") v3Splash();
          await CF.host.launchGame({ game: "legacy", command });
          CF.toast({ title: g.name, body: prep.disk ? "Created a blank 4 GB hard disk for Windows 98." : g.kind === "dos" ? "Starting DOSBox – ColeForge Edition…" : "Starting 86Box…", icon: "legacy" });
        } catch (e) { CF.dialog({ title: "Legacy Mode", icon: "error", message: e.message }); }
      }
      function showConfig(g, browserMode) {
        const cfg = configFor(g);
        const box = h("textarea", { class: "field lg-conf", readonly: true, spellcheck: "false" }, cfg.text);
        const w = CF.createWindow({ title: `${cfg.file} – ${g.name}`, icon: "legacy", w: 620, h: 520 });
        const download = () => { const a = h("a", { href: URL.createObjectURL(new Blob([cfg.text], { type: "text/plain" })), download: cfg.file }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
        w.body.append(h("div", { class: "pad lg-confwrap" },
          browserMode ? h("p", {}, g.kind === "dos"
            ? "Browser mode can't start programs. Save this as dosbox.conf and run: dosbox --conf dosbox.conf (DOSBox Staging)."
            : "Browser mode can't start programs. Save this as 86box.cfg in an empty folder and run: 86Box.exe --vmpath <that folder>. Create the hard disk in 86Box → Settings → Storage.") : null,
          box, h("div", { class: "row" }, h("button", { class: "btn", onclick: download }, "Save as " + cfg.file), h("button", { class: "btn", onclick: () => { navigator.clipboard?.writeText(cfg.text); CF.toast({ title: "Copied", body: cfg.file, icon: "legacy" }); } }, "Copy"), h("button", { class: "btn flat", onclick: () => w.close(true) }, "Close"))));
      }
      function v3Splash() {
        const veil = h("div", { class: "lg-splash" }, h("div", { class: "lg-splash-card" }, h("img", { src: art("voodoo3-mode"), alt: "" }),
          h("div", {}, "3dfx Voodoo3 3000 AGP · 16 MB · 166 MHz"), h("div", { class: "muted" }, "Pentium II 450 · Intel 440BX · Windows 98 SE")));
        document.body.append(veil);
        CF.sound("startup");
        setTimeout(() => veil.remove(), 2600);
      }

      /* ---------- machines ---------- */
      function machinesPage() {
        const card = (m) => h("div", { class: "lg-mcard" + (m.featured ? " featured" : "") }, hardwareSheet(m),
          h("button", { class: "btn", onclick: () => { const g = m.kind === "dos" ? { id: uid(), name: m.name + " game", kind: "dos", machine: m.id, folder: "", exe: "" } : { id: uid(), name: m.name, kind: "win9x", machine: m.id, vmName: "ColeForge 98 " + m.id, memMb: m.mem_kb / 1024, renderThreads: 4, cdImage: "" }; list.push(g); selId = g.id; commit(); show("games"); } }, "Use this machine"));
        return [h("div", { class: "lg-scroll" },
          h("h3", { class: "lg-h" }, ico("win98-16", "lg-ico16"), " Windows 98 PCs (86Box)"), h("div", { class: "lg-grid" }, Object.values(L.MACHINES).filter(m => m.kind === "win9x").map(card)),
          h("h3", { class: "lg-h" }, ico("dos-16", "lg-ico16"), " DOS machines (DOSBox – ColeForge Edition)"), h("div", { class: "lg-grid" }, Object.values(L.MACHINES).filter(m => m.kind === "dos").map(card)))];
      }

      /* ---------- then vs now ---------- */
      function thenPage() {
        return [h("div", { class: "lg-scroll" },
          h("p", {}, "Why a game from 1996 won't just run on a 2026 laptop, and what ColeForge does about it:"),
          h("div", { class: "lg-then" }, h("div", { class: "lg-then-row lg-then-head" }, h("b", {}, "Problem"), h("b", {}, "Then vs now"), h("b", {}, "Legacy Mode's fix")),
            ...L.THEN_VS_NOW.map(([k, then, fix]) => h("div", { class: "lg-then-row" }, h("b", {}, k), h("span", {}, then), h("span", {}, fix)))),
          h("h3", { class: "lg-h" }, "Emulating the processor"),
          h("p", {}, "DOSBox doesn't copy a specific chip: it runs a fixed number of x86 instructions per millisecond (\"cycles\"), so a 486DX2-66 is about 25,000 and a Pentium 90 about 50,000. That's what fixes games that ran too fast. 86Box goes further and emulates the real chips (8088 to Pentium II and the Mendocino Celeron) with their timings, which Windows 98 and its drivers need."),
          h("h3", { class: "lg-h" }, "Emulating the graphics card"),
          h("p", {}, "DOS games talked straight to VGA/SVGA registers, so DOSBox emulates the cards (S3 Trio64, Tseng ET4000, Paradise). 3D is harder: Glide games wanted a 3dfx chip. DOSBox Staging emulates a Voodoo Graphics for DOS Glide games; 86Box emulates the Voodoo, Voodoo2 (with SLI), Banshee and the Voodoo3 in software, spread over several CPU threads, so the Voodoo3 rig needs a fast modern CPU rather than a fast GPU."))];
      }

      /* ---------- engines ---------- */
      function enginesPage() {
        const status = h("div", { class: "lg-scroll" }, h("p", { class: "muted" }, CF.host?.legacyEngines ? "Checking installed engines…" : "Engine status is available when ColeForge runs as the desktop app (ColeForge.exe)."));
        if (CF.host?.legacyEngines) CF.host.legacyEngines().then(e => {
          const line = (icon, label, path, hint) => h("div", { class: "lg-row" }, ico(icon, "lg-ico16"), h("span", { class: "lg-k" }, label), h("span", {}, path || h("i", { class: "muted" }, hint)));
          status.replaceChildren(line("dos-16", "DOSBox Staging", e.dosbox, "not installed"), line("win98-16", "86Box", e.box86, "not installed"), line("config-16", "86Box ROMs", e.roms, "not installed"),
            h("p", {}, "Install or update both with core\\windows\\get-legacy-engines.ps1 (downloads the official releases)."),
            h("button", { class: "btn", onclick: () => CF.host.legacyOpen() }, "Open Legacy Mode folder"));
        });
        return [status, h("div", { class: "lg-scroll" },
          h("h3", { class: "lg-h" }, "What runs what"),
          h("p", {}, "DOSBox – ColeForge Edition: DOSBox Staging with ColeForge's machine presets (XT, 386, 486, Pentium, Pentium MMX + Voodoo), IPX LAN play and one-click launching. 86Box: complete Windows 98 PCs, including the Voodoo3 and Voodoo2 SLI rigs. You provide the games, Windows 98 SE media and drivers."))];
      }

      function about() {
        CF.dialog({ title: "About Legacy Mode", icon: "legacy", message: "Legacy Mode — Windows – ColeForge Edition\n\nDOSBox – ColeForge Edition runs DOSBox Staging with ColeForge presets. Windows 98 PCs and Voodoo3 Mode run in 86Box. Both are open-source (GPL-2.0) projects, downloaded from their official releases." });
      }

      win.on("args", (a) => { if (a?.voodoo3) voodoo3Mode(); });
      show("games");
      if (args?.voodoo3) voodoo3Mode();
    },
  });
})();
