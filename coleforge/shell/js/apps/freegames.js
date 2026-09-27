"use strict";

// Free Games: the shelf of classic PC games their owners gave away (desktop/freegames.js does the work in
// ColeForge.exe). Install downloads from the official source, checks the checksum and unpacks into
// Desktop\NightCode\Games; Play starts it in ScummVM (fetched once) or, for Freedoom, in Forge Arcade.
(function () {
  const { h } = CF;
  const GENRE_HUE = { adventure: 265, action: 12, rpg: 140, shooter: 0, thriller: 300 };
  const hueOf = (genre) => { const g = genre.toLowerCase(); for (const [k, v] of Object.entries(GENRE_HUE)) if (g.includes(k)) return v; return 200; };
  const mb = (n) => (n / 1048576).toFixed(n > 10485760 ? 0 : 1) + " MB";

  CF.register({
    id: "freegames", name: "Free Games", icon: "arcade", single: true,
    desc: "Classic PC games their makers released for free: Beneath a Steel Sky, God of Thunder, DreamWeb, Freedoom and more. One-click install into the NightCode folder on your desktop.",
    window: { w: 900, h: 600 },
    open(win) {
      const host = CF.host;
      const grid = h("div", { class: "fg-grid" });
      const head = h("div", { class: "fg-head" },
        h("img", { src: CF.icon("arcade"), alt: "" }),
        h("div", { style: "flex:1" }, h("b", {}, "Free Games"), h("div", { class: "muted" }, "Freeware from the people who made them, downloaded from official sources and checked before install.")),
        h("button", { class: "btn flat", onclick: () => host?.openNightCodeFolder?.("games") }, "Open Games folder"));
      win.body.append(h("div", { class: "fg" }, head, grid));
      win.menubar([
        { label: "File", items: [{ label: "Open the NightCode folder", action: () => host?.openNightCodeFolder?.() }, { label: "Open the Games folder", action: () => host?.openNightCodeFolder?.("games") }, "-", { label: "Close", action: () => win.close() }] },
        { label: "View", items: [{ label: "Refresh", key: "F5", action: () => load() }] },
        { label: "Help", items: [{ label: "Where do these games come from?", action: about }] },
      ]);

      if (!host?.freeGames) {
        grid.replaceChildren(h("div", { class: "pad" }, h("b", {}, "Free Games installs games onto your PC"),
          h("p", {}, "Open NightCode on your computer (ColeForge.exe) to download and play them. They go into a NightCode folder on your desktop.")));
        win.statusbar(["Browser mode", "Free Games"]);
        return;
      }

      let state = null;
      const progress = {}; // id -> { phase, done, total, engine }
      const off = host.onFreeGameProgress((p) => {
        progress[p.id] = p;
        if (p.phase === "done" || p.phase === "error") { delete progress[p.id]; load(); return; }
        const bar = grid.querySelector(`[data-id="${p.id}"] .fg-bar`);
        if (bar) {
          const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
          bar.firstChild.style.width = pct + "%";
          bar.lastChild.textContent = p.phase === "unpack" ? "Unpacking…" : `${p.engine ? "Getting " + p.engine + ": " : ""}${mb(p.done || 0)} of ${mb(p.total || 0)}`;
        } else render();
      });
      win.on("close", off);

      async function load() {
        try { state = await host.freeGames(); } catch (e) { grid.replaceChildren(h("div", { class: "pad" }, e.message)); return; }
        render();
      }
      function render() {
        if (!state) return;
        grid.replaceChildren(...state.items.map(card));
        const n = state.items.filter((g) => g.installed).length;
        win.statusbar([`${state.items.length} games · ${n} installed`, state.games]);
      }
      function card(g) {
        const p = progress[g.id];
        const hue = hueOf(g.genre);
        const box = h("div", { class: "fg-box", style: `--h:${hue}` }, h("span", { class: "fg-year" }, String(g.year)), h("b", {}, g.name), h("small", {}, g.by));
        const actions = h("div", { class: "row", style: "flex-wrap:wrap" });
        if (p) actions.append(h("div", { class: "fg-bar" }, h("i"), h("span", {}, "Starting…")));
        else if (g.installed) actions.append(
          h("button", { class: "btn", onclick: () => play(g) }, "▶ Play"),
          h("button", { class: "btn flat", onclick: () => remove(g) }, "Remove"));
        else actions.append(h("button", { class: "btn", onclick: () => install(g) }, `Install (${g.sizeText})`));
        const el = h("div", { class: "fg-card" + (g.installed ? " on" : ""), "data-id": g.id }, box,
          h("div", { class: "fg-body" },
            h("div", { class: "muted", style: "font-size:11px" }, `${g.genre} · ${g.engine === "scummvm" ? "ScummVM" : "Forge Arcade"}`),
            h("p", {}, g.about), h("div", { class: "fg-lic" }, "✔ " + g.license), actions));
        el.addEventListener("dblclick", () => (g.installed ? play(g) : null));
        return el;
      }
      async function install(g) {
        const engine = g.engine !== "arcade" && state.engines[g.engine];
        const extra = engine && !engine.installed ? `\n\nThe first time, NightCode also downloads ${engine.name} (${mb(engine.size)}), which plays it.` : "";
        const r = await CF.dialog({ title: "Free Games", icon: "question", message: `Install ${g.name} (${g.sizeText}) into\n${g.dir}?${extra}`, buttons: ["Install", "Cancel"] });
        if (r.button !== "Install") return;
        progress[g.id] = { phase: "download", done: 0, total: g.size };
        render();
        try {
          await host.freeGameInstall(g.id);
          CF.toast({ title: "Free Games", body: `${g.name} is ready. Double-click it to play.`, icon: "arcade" });
          CF.sound("lobby_ready");
        } catch (e) {
          delete progress[g.id];
          CF.dialog({ title: "Free Games", icon: "error", message: `Couldn't install ${g.name}.\n${String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "")}` });
        }
        load();
      }
      async function play(g) {
        try {
          const spec = await host.freeGamePlay(g.id);
          if (spec?.arcade) {
            const cfg = CF.store.get("cf.arcade.config", {})[spec.arcade] || {};
            if (!spec.zandronum && !cfg.exePath) {
              await CF.dialog({ title: "Freedoom", icon: "info", message: `Freedoom is installed in\n${spec.dir}\n\nIt needs a Doom engine to run. Install Zandronum (core\\windows\\get-zandronum.ps1) or point Forge Arcade → Freedoom → Configure at GZDoom / Chocolate Doom, then press Play again.` });
              CF.store.set("cf.arcade.config", Object.assign(CF.store.get("cf.arcade.config", {}), { [spec.arcade]: Object.assign({}, cfg, { dataPath: spec.iwad }) }));
              return CF.open("arcade");
            }
            return CF.playArcade(spec.arcade, { dataPath: spec.iwad, exePath: spec.zandronum });
          }
          CF.toast({ title: g.name, body: "Starting in ScummVM…", icon: "arcade" });
        } catch (e) {
          CF.dialog({ title: "Free Games", icon: "error", message: String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "") });
        }
      }
      async function remove(g) {
        const r = await CF.dialog({ title: "Free Games", icon: "warning", message: `Remove ${g.name} from ${g.dir}? Your saved games stay in Games\\_Saves.`, buttons: ["Remove", "Cancel"] });
        if (r.button !== "Remove") return;
        try { await host.freeGameRemove(g.id); CF.sound("recycle"); } catch (e) { CF.dialog({ title: "Free Games", icon: "error", message: e.message }); }
        load();
      }
      function about() {
        CF.dialog({ title: "Where do these games come from?", icon: "info", message:
          "Every game here was released for free by the people who own it (or is public domain / open source), and downloads from its official home: ScummVM's freeware library (scummvm.org, with the rights holders' permission) and the Freedoom project on GitHub.\n\nEach download is checked against a pinned SHA-256 checksum before it's unpacked. Nothing comes from abandonware sites." });
      }
      load();
    },
  });
})();
