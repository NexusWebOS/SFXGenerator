"use strict";

// Forge Arcade: launcher for the classic shooter ports and the bridge that ForgeChat lobbies
// use to start LAN matches. Engines are open-source ports (GPL); game data (IWAD/PAK/GRP)
// comes from your own copies or free replacements like Freedoom.
(function () {
  const { h } = CF;
  const doomMaps = Array.from({ length: 32 }, (_, i) => "MAP" + String(i + 1).padStart(2, "0"));
  const doom1Maps = [1, 2, 3, 4].flatMap(e => Array.from({ length: 9 }, (_, m) => `E${e}M${m + 1}`));
  const warp = (map) => { const m = /^E(\d)M(\d)$/i.exec(map); if (m) return `${m[1]} ${m[2]}`; const n = /(\d+)$/.exec(map); return n ? String(+n[1]) : "1"; };

  // Command templates. {exe} {data} {warp} {map} {addr} {players} {dm} are substituted.
  // Every template is editable in Forge Arcade → Configure, since ports differ by version.
  const GAMES = {
    "doom-legacy": {
      name: "Doom Legacy – ColeForge Edition", short: "Doom Legacy", engine: "Doom Legacy", exe: "doomlegacy", data: "doom2.wad", maps: doomMaps,
      solo: "{exe} -iwad {data} -warp {warp}", host: "{exe} -iwad {data} -server {dm} -warp {warp}", join: "{exe} -iwad {data} -connect {addr}",
      dm: "-deathmatch", about: "Our fork of the Doom Legacy source port. Use doom2.wad, doom.wad, or free Freedoom IWADs.",
    },
    doom: {
      name: "Doom / Doom II", short: "Doom", engine: "Chocolate Doom", exe: "chocolate-doom", data: "doom2.wad", maps: doomMaps,
      solo: "{exe} -iwad {data} -warp {warp}", host: "{exe} -iwad {data} -server -privateserver {dm} -warp {warp}", join: "{exe} -iwad {data} -connect {addr}",
      dm: "-deathmatch", about: "Faithful vanilla Doom via Chocolate Doom. Swap in GZDoom or Odamex in Configure.",
    },
    freedoom: {
      name: "Freedoom", short: "Freedoom", engine: "Chocolate Doom", exe: "chocolate-doom", data: "freedoom2.wad", maps: doomMaps,
      solo: "{exe} -iwad {data} -warp {warp}", host: "{exe} -iwad {data} -server -privateserver {dm} -warp {warp}", join: "{exe} -iwad {data} -connect {addr}",
      dm: "-deathmatch", about: "100% free Doom-compatible game data. Great for LAN parties: everyone can have it.",
    },
    quake: {
      name: "Quake", short: "Quake", engine: "QuakeSpasm / Ironwail", exe: "quakespasm", data: "id1", maps: ["start", "e1m1", "e1m2", "e1m3", "e1m4", "e1m5", "e1m6", "e1m7", "dm1", "dm2", "dm3", "dm4", "dm5", "dm6"],
      solo: "{exe} +map {map}", host: "{exe} -listen {players} +deathmatch {dmflag} +map {map}", join: "{exe} +connect {addr}",
      dm: "", about: "Needs id1/pak0.pak (+pak1.pak) from your Quake copy.",
    },
    duke3d: {
      name: "Duke Nukem 3D", short: "Duke3D", engine: "EDuke32", exe: "eduke32", data: "duke3d.grp", maps: ["E1L1", "E1L2", "E1L3", "E2L1", "E3L1", "E4L1"],
      solo: "{exe} -gamegrp {data}", host: "{exe} -gamegrp {data} -server", join: "{exe} -gamegrp {data} -connect {addr}",
      dm: "", about: "Needs duke3d.grp from your copy. EDuke32 netplay flags vary by build; check Configure.",
    },
  };
  const cfgKey = "cf.arcade.config";
  const config = () => CF.store.get(cfgKey, {});
  function gameConf(id) { return Object.assign({}, GAMES[id], config()[id] || {}); }

  CF.games = Object.fromEntries(Object.keys(GAMES).map(id => [id, { name: GAMES[id].short, maps: GAMES[id].maps }]));

  const artCache = {};
  CF.gameArt = (id) => artCache[id] || CF.icon(id.startsWith("doom") || id === "freedoom" ? "doom" : id === "quake" ? "quake" : id === "duke3d" ? "duke" : "arcade");
  // Probe for cover art on disk (assets/art/games/<id>.png|webp|jpg).
  for (const id of Object.keys(GAMES)) for (const ext of ["png", "webp", "jpg"]) {
    const img = new Image();
    img.onload = () => { if (!artCache[id]) artCache[id] = img.src; };
    img.src = `assets/art/games/${id}.${ext}`;
  }

  function buildCommand(id, kind, lobby) {
    const g = gameConf(id);
    const map = lobby?.map || g.maps[0];
    const vars = {
      exe: g.exePath || g.exe, data: g.dataPath || g.data, warp: warp(map), map: map.toLowerCase(),
      addr: lobby?.address || "127.0.0.1", players: lobby?.max || 4, dm: lobby?.mode === "coop" ? "" : g.dm, dmflag: lobby?.mode === "coop" ? 0 : 1,
    };
    return g[kind].replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "").replace(/\s+/g, " ").trim();
  }

  async function run(id, kind, lobby) {
    const cmd = buildCommand(id, kind, lobby);
    if (CF.host && CF.host.launchGame) {
      try { await CF.host.launchGame({ game: id, command: cmd }); CF.toast({ title: gameConf(id).short, body: "Launching…", icon: "arcade" }); return; }
      catch (e) { CF.dialog({ title: "Forge Arcade", icon: "error", message: `Couldn't start ${gameConf(id).engine}.\n${e.message}\n\nCheck the engine path in Forge Arcade → Configure.` }); return; }
    }
    const box = h("textarea", { class: "field", readonly: true, style: "width:100%;height:70px;font-family:var(--mono)" }, cmd);
    const w = CF.createWindow({ title: `${gameConf(id).short} – ${kind === "solo" ? "Single player" : kind === "host" ? "Host" : "Join"}`, icon: "arcade", w: 520, h: 280, resizable: false });
    w.body.append(h("div", { class: "pad" }, h("p", {}, "Browser mode can't start programs directly. Run this command (or start ColeForge through its desktop host to launch automatically):"), box,
      h("div", { class: "row" }, h("button", { class: "btn", onclick: () => { navigator.clipboard?.writeText(cmd); CF.toast({ title: "Copied", body: cmd.slice(0, 60), icon: "arcade" }); } }, "Copy command"), h("button", { class: "btn flat", onclick: () => w.close(true) }, "Close"))));
  }

  CF.launchGame = (lobby, isHost) => run(GAMES[lobby.game] ? lobby.game : "doom", isHost ? "host" : "join", lobby);

  CF.register({
    id: "arcade", name: "Forge Arcade", icon: "arcade", single: true, desc: "Launch Doom, Quake and Duke Nukem 3D ports and LAN lobbies.",
    window: { w: 860, h: 560 },
    open(win) {
      const grid = h("div", { class: "arc-grid" });
      win.body.append(h("div", { class: "arc" }, h("div", { class: "arc-head" }, h("img", { src: CF.icon("arcade"), alt: "" }), h("div", {}, h("b", {}, "Forge Arcade"), h("div", { class: "muted" }, "Classic shooters, modern LAN. Host a lobby in ForgeChat and everyone launches together."))), grid));
      function render() {
        grid.replaceChildren(...Object.keys(GAMES).map(id => {
          const g = gameConf(id);
          const card = h("div", { class: "arc-card" + (id === "doom-legacy" ? " featured" : "") },
            h("div", { class: "arc-art", style: `background-image:url("${CF.gameArt(id)}")` }),
            h("div", { class: "arc-body" }, h("b", {}, g.name), h("div", { class: "muted", style: "font-size:11px" }, `${g.engine} · ${g.data}`), h("p", {}, g.about),
              h("div", { class: "row", style: "flex-wrap:wrap" },
                h("button", { class: "btn", onclick: () => run(id, "solo") }, "▶ Play"),
                h("button", { class: "btn flat", onclick: () => { CF.open("forgechat", { room: "lobbies" }); } }, "LAN Lobby"),
                h("button", { class: "btn flat", onclick: () => configure(id) }, "Configure"))));
          card.addEventListener("contextmenu", (e) => { e.preventDefault(); CF.contextMenu({ x: e.clientX, y: e.clientY }, [{ label: "Play", action: () => run(id, "solo") }, { label: "Host (show command)", action: () => run(id, "host") }, { label: "Join 127.0.0.1", action: () => run(id, "join") }, "-", { label: "Configure…", action: () => configure(id) }]); });
          return card;
        }));
      }
      function configure(id) {
        const g = gameConf(id), all = config();
        const f = (key, label, ph) => { const i = h("input", { class: "field", value: g[key] || "", placeholder: ph || "" }); i.dataset.key = key; return [label, i]; };
        const fields = [f("exePath", "Engine executable", `e.g. C:\\Games\\${g.exe}\\${g.exe}.exe`), f("dataPath", "Game data (IWAD/PAK/GRP)", g.data), f("solo", "Single-player command"), f("host", "Host command"), f("join", "Join command")];
        const w = CF.createWindow({ title: `Configure ${g.short}`, icon: "arcade", w: 620, h: 380 });
        w.body.append(h("div", { class: "pad form-grid" }, ...fields.flat(),
          h("div", {}), h("div", { class: "muted", style: "font-size:11px" }, "Placeholders: {exe} {data} {warp} {map} {addr} {players} {dm} {dmflag}"),
          h("div", {}), h("div", { class: "row" },
            h("button", { class: "btn", onclick: () => { all[id] = {}; w.body.querySelectorAll("input[data-key]").forEach(i => { if (i.value.trim()) all[id][i.dataset.key] = i.value.trim(); }); CF.store.set(cfgKey, all); w.close(true); render(); } }, "Save"),
            h("button", { class: "btn flat", onclick: () => { delete all[id]; CF.store.set(cfgKey, all); w.close(true); render(); } }, "Reset"),
            h("button", { class: "btn flat", onclick: () => w.close(true) }, "Cancel"))));
      }
      render();
      win.statusbar([`${Object.keys(GAMES).length} games`, CF.host ? "Desktop host: direct launch" : "Browser mode: copy commands"]);
    },
  });
})();
