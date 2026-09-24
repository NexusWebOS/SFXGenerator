"use strict";

// Forge Game Browser: a 16-bit, GameSpy-style server browser for Zandronum.
// Lists internet servers (Zandronum master server), LAN servers (their UDP broadcasts),
// favourites and ForgeChat lobbies, shows who's playing, and joins through Forge Arcade.
// The UDP work happens in the ColeForge LAN server (server/zandronum/); this app calls its API.
(function () {
  const { h } = CF;
  const art = (n) => `assets/art/gamebrowser/${n}.png`;
  const ico = (n, cls = "gb-ico") => h("img", { class: cls, src: art(n), alt: "" });
  const FAV_KEY = "cf.gb.favorites", VIEW_KEY = "cf.gb.view";
  const favorites = () => CF.store.get(FAV_KEY, []);
  const setFavorites = (list) => CF.store.set(FAV_KEY, [...new Set(list)].slice(0, 64));
  const pingIcon = (p) => p == null ? null : p < 90 ? "ping-good" : p < 180 ? "ping-ok" : "ping-bad";
  const ZMODES = [["deathmatch", "Deathmatch"], ["teamplay", "Team Deathmatch"], ["ctf", "Capture the Flag"], ["duel", "Duel"], ["lastmanstanding", "Last Man Standing"],
    ["possession", "Possession"], ["terminator", "Terminator"], ["cooperative", "Co-op"], ["survival", "Survival"], ["invasion", "Invasion"]];

  const COLUMNS = [
    { k: "src", t: "", w: 26 }, { k: "lock", t: "", w: 22 }, { k: "name", t: "Server" }, { k: "ping", t: "Ping", w: 62 },
    { k: "players", t: "Players", w: 70 }, { k: "map", t: "Map", w: 66 }, { k: "mode", t: "Mode", w: 58 }, { k: "iwad", t: "IWAD", w: 104 },
    { k: "wads", t: "WADs", w: 150 }, { k: "address", t: "Address", w: 140 },
  ];

  function normalize(r, lobbyAddrs, favs) {
    const i = r.info || {};
    const sources = new Set(r.sources || []);
    if (lobbyAddrs.has(r.address)) sources.add("lobby");
    if (favs.includes(r.address)) sources.add("favorite");
    return {
      address: r.address, status: r.status, ping: r.status === "ok" ? r.ping : null, sources, info: r.info,
      name: i.name || r.address, map: i.map || "", mode: i.modeShort || "", modeName: i.modeName || "",
      players: i.numPlayers ?? null, humans: i.humans ?? 0, bots: i.bots ?? 0, max: i.maxClients ?? null,
      iwad: i.iwad || "", pwads: i.pwads || [], password: !!(i.password || i.joinPassword), version: i.version || "",
    };
  }

  CF.register({
    id: "gamebrowser", name: "Forge Game Browser", icon: "gamebrowser", single: true,
    desc: "16-bit server browser for Zandronum: internet, LAN, favourites and ForgeChat lobbies.",
    window: { w: 1000, h: 640 },
    open(win, args) {
      const view = Object.assign({ internet: true, lan: true, hideEmpty: false, hideFull: false, hideDead: true, auto: true }, CF.store.get(VIEW_KEY, {}));
      const saveView = () => CF.store.set(VIEW_KEY, view);
      let servers = [], meta = null, tab = "all", sort = { k: "players", dir: -1 }, selected = args?.select || null, busy = false, ctrl = null, error = null;
      const pendingSelect = args?.select || null;

      /* ---------- layout ---------- */
      const filterBox = h("input", { class: "field gb-filter", placeholder: "Filter: name, map, WAD…" });
      const tb = (icon, label, title, fn) => { const b = h("button", { class: "gb-tool", title }, ico(icon, "gb-tool-ico"), h("span", {}, label)); b.addEventListener("click", fn); return b; };
      const refreshBtn = tb("refresh", "Refresh", "Refresh the server list (F5)", () => refresh(true));
      const stopBtn = tb("stop", "Stop", "Stop refreshing", () => { ctrl?.abort(); setBusy(false); });
      const toolbar = h("div", { class: "gb-toolbar" },
        refreshBtn, stopBtn, h("i", { class: "gb-sep" }),
        tb("join", "Join", "Join the selected server", () => join(current())),
        tb("host", "Host", "Host your own Zandronum server", hostDialog),
        tb("add", "Add", "Add a server by address", addServer),
        tb("favorite", "Favorite", "Add or remove the selected server from favourites", () => toggleFavorite(current())),
        tb("share", "Share", "Share the selected server to ForgeChat", () => share(current())),
        h("i", { class: "gb-sep" }), ico("filter", "gb-tool-ico"), filterBox);
      const tabsEl = h("div", { class: "gb-tabs" });
      const head = h("div", { class: "gb-head" });
      const rows = h("div", { class: "gb-rows" });
      const listEl = h("div", { class: "gb-list" }, head, rows);
      const details = h("div", { class: "gb-details" });
      const splash = h("div", { class: "gb-splash" }, h("img", { src: art("logo-64"), alt: "" }), h("b", {}, "Forge Game Browser"), h("div", { class: "muted" }, "Finding servers…"));
      win.body.append(h("div", { class: "gb" }, toolbar, tabsEl, h("div", { class: "gb-main" }, listEl, splash), details));

      win.menubar([
        { label: "File", items: [{ label: "Refresh", key: "F5", action: () => refresh(true) }, { label: "Add server…", action: addServer }, { label: "Host a server…", action: hostDialog }, "-", { label: "Close", action: () => win.close() }] },
        { label: "View", items: () => [
          { label: "Internet servers", checked: view.internet, action: () => { view.internet = !view.internet; saveView(); refresh(); } },
          { label: "LAN servers", checked: view.lan, action: () => { view.lan = !view.lan; saveView(); refresh(); } }, "-",
          { label: "Hide empty servers", checked: view.hideEmpty, action: () => { view.hideEmpty = !view.hideEmpty; saveView(); render(); } },
          { label: "Hide full servers", checked: view.hideFull, action: () => { view.hideFull = !view.hideFull; saveView(); render(); } },
          { label: "Hide servers that don't answer", checked: view.hideDead, action: () => { view.hideDead = !view.hideDead; saveView(); render(); } }, "-",
          { label: "Auto-refresh every minute", checked: view.auto, action: () => { view.auto = !view.auto; saveView(); } }] },
        { label: "Server", items: () => rowMenu(current()) },
        { label: "Help", items: [{ label: "About Forge Game Browser", action: about }] },
      ]);

      /* ---------- data ---------- */
      const chatLobbyAddrs = () => new Set((CF.chat?.lobbies?.() || []).filter(l => l.game === "zandronum" && l.address).map(l => /:\d+$/.test(l.address) ? l.address : l.address + ":10666"));
      async function refresh(force) {
        ctrl?.abort();
        ctrl = new AbortController();
        const lobbyAddrs = chatLobbyAddrs(), favs = favorites();
        const extra = [...new Set([...favs, ...lobbyAddrs, ...(pendingSelect ? [pendingSelect] : [])])].slice(0, 64);
        const q = new URLSearchParams({ internet: view.internet ? "1" : "0", lan: view.lan ? "1" : "0", extra: extra.join(",") });
        if (force) q.set("refresh", "1");
        setBusy(true);
        try {
          const res = await fetch("/api/zandronum/browse?" + q, { signal: ctrl.signal });
          if (!res.ok) throw new Error(res.status === 404 ? "no-api" : "HTTP " + res.status);
          const d = await res.json();
          meta = d; error = null;
          servers = d.servers.map(r => normalize(r, lobbyAddrs, favs));
          if (pendingSelect && !selected) selected = pendingSelect;
        } catch (e) {
          if (e.name === "AbortError") return;
          error = e.message;
        }
        setBusy(false);
        render();
      }
      function setBusy(b) {
        busy = b; refreshBtn.disabled = b; stopBtn.disabled = !b;
        splash.style.display = b && !servers.length ? "" : "none";
        status();
      }
      async function requery(s) {
        if (!s) return;
        try {
          const r = await fetch("/api/zandronum/query?addr=" + encodeURIComponent(s.address)).then(res => res.json());
          const i = servers.findIndex(x => x.address === s.address);
          const fresh = normalize({ ...r, sources: [...s.sources] }, chatLobbyAddrs(), favorites());
          if (i >= 0) servers[i] = fresh; else servers.push(fresh);
          render();
        } catch { /* keep the old row */ }
      }

      /* ---------- filtering + sorting ---------- */
      const TABS = [["all", "All", "logo"], ["internet", "Internet", "internet-16"], ["lan", "LAN", "lan-16"], ["favorite", "Favorites", "favorite-16"], ["lobby", "ForgeChat Lobbies", "player"]];
      function visible() {
        const f = filterBox.value.trim().toLowerCase();
        return servers.filter(s => {
          if (tab !== "all" && !s.sources.has(tab)) return false;
          const pinned = s.sources.has("favorite") || s.sources.has("lobby");
          if (view.hideDead && s.status !== "ok" && !pinned) return false;
          if (view.hideEmpty && s.status === "ok" && !s.players) return false;
          if (view.hideFull && s.status === "ok" && s.max && s.players >= s.max) return false;
          if (f && ![s.name, s.map, s.mode, s.modeName, s.iwad, s.address, ...s.pwads.map(p => p.name)].join(" ").toLowerCase().includes(f)) return false;
          return true;
        }).sort((a, b) => {
          const v = (s) => sort.k === "ping" ? (s.ping ?? 1e9) : sort.k === "players" ? (s.players ?? -1) : sort.k === "wads" ? s.pwads.length : sort.k === "lock" ? +s.password : sort.k === "src" ? [...s.sources].join() : String(s[sort.k] ?? "").toLowerCase();
          const x = v(a), y = v(b);
          return (x < y ? -1 : x > y ? 1 : 0) * (sort.k === "ping" ? -sort.dir : sort.dir) || a.name.localeCompare(b.name);
        });
      }
      const current = () => servers.find(s => s.address === selected) || null;

      /* ---------- rendering ---------- */
      function render() {
        tabsEl.replaceChildren(...TABS.map(([id, label, icon]) => {
          const n = id === "all" ? servers.filter(s => s.status === "ok").length : servers.filter(s => s.sources.has(id) && s.status === "ok").length;
          const t = h("button", { class: "gb-tab" + (tab === id ? " on" : "") }, ico(icon), ` ${label} `, h("small", {}, `(${n})`));
          t.addEventListener("click", () => { tab = id; render(); });
          return t;
        }));
        head.replaceChildren(...COLUMNS.map(c => {
          const el = h("div", { class: "gb-th clickable" + (sort.k === c.k ? " sorted" : ""), style: c.w ? `flex:0 0 ${c.w}px` : "flex:1" }, c.t, sort.k === c.k ? (sort.dir > 0 ? " ▲" : " ▼") : "");
          el.addEventListener("click", () => { sort = sort.k === c.k ? { k: c.k, dir: -sort.dir } : { k: c.k, dir: c.k === "players" ? -1 : 1 }; render(); });
          return el;
        }));
        const list = visible();
        if (error) rows.replaceChildren(h("div", { class: "gb-empty" }, ico("stop"), h("div", {}, h("b", {}, "Can't reach the ColeForge LAN server"),
          h("div", { class: "muted" }, error === "no-api"
            ? "Forge Game Browser needs the ColeForge LAN server to talk to Zandronum servers. Start ColeForge.exe, or run: node coleforge/server/forgechat-server.js"
            : `Refresh failed: ${error}`))));
        else if (!list.length && !busy) rows.replaceChildren(h("div", { class: "gb-empty" }, ico("logo"), h("div", {}, h("b", {}, "No servers here"),
          h("div", { class: "muted" }, tab === "favorite" ? "Add servers with the Add button or right-click → Add to Favorites." : tab === "lobby" ? "Zandronum lobbies from ForgeChat show up here." : "Nothing matched. Try Refresh, clear the filter, or host your own!"))));
        else rows.replaceChildren(...list.map(rowEl));
        renderDetails();
        status();
      }
      function cell(c, content, extra = "") { return h("div", { class: "gb-td " + extra, style: c.w ? `flex:0 0 ${c.w}px` : "flex:1" }, content); }
      function rowEl(s) {
        const src = s.sources.has("lobby") ? "player" : s.sources.has("lan") ? "lan-16" : s.sources.has("favorite") ? "favorite-16" : "internet-16";
        const dead = s.status !== "ok";
        const full = s.max && s.players >= s.max;
        const [cSrc, cLock, cName, cPing, cPlayers, cMap, cMode, cIwad, cWads, cAddr] = COLUMNS;
        const el = h("div", { class: "gb-row clickable" + (s.address === selected ? " sel" : "") + (dead ? " dead" : "") },
          cell(cSrc, ico(src)), cell(cLock, s.password ? ico("lock") : ""),
          cell(cName, h("span", { class: "gb-name" }, s.name), "gb-ellip"),
          cell(cPing, dead ? h("span", { class: "muted" }, { timeout: "—", ignoring: "wait", banned: "banned", unresolved: "DNS?", error: "error" }[s.status] || "—") : [ico(pingIcon(s.ping)), ` ${s.ping}`]),
          cell(cPlayers, dead ? "" : h("span", { class: full ? "gb-full" : s.players ? "gb-some" : "" }, `${s.players}/${s.max}`)),
          cell(cMap, s.map, "gb-ellip"), cell(cMode, s.mode), cell(cIwad, s.iwad, "gb-ellip"),
          cell(cWads, s.pwads.map(p => p.name).join(", "), "gb-ellip"), cell(cAddr, s.address, "gb-ellip gb-mono"));
        el.addEventListener("click", () => { selected = s.address; rows.querySelectorAll(".sel").forEach(r => r.classList.remove("sel")); el.classList.add("sel"); renderDetails(); });
        el.addEventListener("dblclick", () => join(s));
        el.addEventListener("contextmenu", (e) => { e.preventDefault(); el.click(); CF.contextMenu({ x: e.clientX, y: e.clientY }, rowMenu(s)); });
        return el;
      }
      function rowMenu(s) {
        const fav = s && favorites().includes(s.address);
        return [
          { label: "Join", disabled: !s || s.status !== "ok", action: () => join(s) },
          { label: "Join with password…", disabled: !s || s.status !== "ok", action: () => join(s, true) },
          { label: "Refresh this server", disabled: !s, action: () => requery(s) }, "-",
          { label: fav ? "Remove from Favorites" : "Add to Favorites", disabled: !s, action: () => toggleFavorite(s) },
          { label: "Copy address", disabled: !s, action: () => { navigator.clipboard?.writeText(s.address); CF.toast({ title: "Copied", body: s.address, icon: "gamebrowser" }); } },
          { label: "Share to ForgeChat", disabled: !s || s.status !== "ok", action: () => share(s) },
          { label: "Open server website", disabled: !s?.info?.url, action: () => CF.open("browser", { url: s.info.url }) },
        ];
      }
      function renderDetails() {
        const s = current();
        if (!s) { details.replaceChildren(h("div", { class: "gb-hint muted" }, ico("logo"), " Select a server to see who's playing. Double-click to join.")); return; }
        const i = s.info || {};
        const teamName = (t) => t == null ? "" : i.teams?.[t]?.name || ["Blue", "Red", "Green", "Gold"][t] || `Team ${t + 1}`;
        const teamColor = (t) => i.teams?.[t]?.color || ["#0000ff", "#ff0000", "#008000", "#b8860b"][t] || "";
        const players = (i.players || []).slice().sort((a, b) => (a.spectator - b.spectator) || b.score - a.score);
        const pt = h("div", { class: "gb-players" },
          h("div", { class: "gb-prow gb-phead" }, h("span", {}, ""), h("span", {}, "Player"), h("span", {}, "Score"), h("span", {}, "Ping"), h("span", {}, "Team"), h("span", {}, "Time")),
          ...(players.length ? players.map(p => h("div", { class: "gb-prow" + (p.spectator ? " spec" : "") },
            h("span", {}, ico(p.bot ? "bot" : p.spectator ? "spectator" : "player")), h("span", { class: "gb-ellip" }, p.name),
            h("span", {}, p.spectator ? "—" : p.score), h("span", {}, p.bot ? "bot" : p.ping), h("span", { style: `color:${teamColor(p.team)}` }, teamName(p.team)), h("span", {}, `${p.minutes ?? 0}m`)))
            : [h("div", { class: "gb-prow muted" }, h("span", {}), h("span", {}, s.status === "ok" ? "Nobody's playing. Be first!" : "No reply from this server."))]));
        const lim = i.limits || {};
        const facts = [
          ["Address", s.address], ["Version", s.version], ["Mode", [s.modeName, i.instagib && "Instagib", i.buckshot && "Buckshot"].filter(Boolean).join(" + ")],
          ["Skill", i.skillName], ["Limits", [lim.frag && `${lim.frag} frags`, lim.time && `${lim.time} min${lim.timeLeft != null ? ` (${lim.timeLeft} left)` : ""}`, lim.point && `${lim.point} points`, lim.win && `${lim.win} wins`].filter(Boolean).join(", ")],
          ["Players", s.status === "ok" ? `${s.humans} playing, ${s.bots} bots, ${i.spectators || 0} watching · ${s.max} slots` : ""],
          ["IWAD", s.iwad], ["Country", i.country && !/^X/.test(i.country) ? i.country : ""], ["Password", s.password ? "Required" : ""],
        ].filter(([, v]) => v);
        const info = h("div", { class: "gb-info" },
          h("div", { class: "gb-title" }, s.password ? ico("lock") : null, h("b", {}, s.name)),
          h("dl", {}, ...facts.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])),
          s.pwads.length ? h("div", { class: "gb-wads" }, ...s.pwads.map(p => h("span", { class: "gb-wad", title: p.md5 || "" }, ico("wad"), " " + p.name + (p.optional ? " (optional)" : "")))) : null,
          i.url ? h("a", { class: "gb-link clickable", onclick: () => CF.open("browser", { url: i.url }) }, i.url) : null,
          h("div", { class: "row" }, h("button", { class: "btn", disabled: s.status !== "ok", onclick: () => join(s) }, ico("join"), " Join"),
            h("button", { class: "btn flat", onclick: () => share(s), disabled: s.status !== "ok" }, ico("share"), " Share"),
            h("button", { class: "btn flat", onclick: () => toggleFavorite(s) }, ico("favorite-16"), favorites().includes(s.address) ? " Unfavorite" : " Favorite")));
        details.replaceChildren(pt, info);
      }
      function status() {
        const shown = visible(), ok = servers.filter(s => s.status === "ok");
        const people = ok.reduce((n, s) => n + (s.humans || 0), 0);
        const m = meta?.master;
        win.statusbar([
          busy ? "Refreshing…" : `${shown.length} of ${ok.length} servers`,
          `${people} players online`,
          view.internet ? (m ? `Master: ${m.status === "ok" ? `${m.count} servers` : m.status}` : "Master: …") : "Internet off",
          view.lan ? (meta?.lan?.listening ? `LAN: ${meta.lan.count} found` : "LAN: not listening") : "LAN off",
        ]);
      }

      /* ---------- actions ---------- */
      async function join(s, askPassword) {
        if (!s) return CF.dialog({ title: "Forge Game Browser", icon: "info", message: "Pick a server first." });
        if (s.status !== "ok") return CF.dialog({ title: "Forge Game Browser", icon: "warning", message: `${s.address} isn't answering right now.` });
        if (s.max && s.players >= s.max) {
          const r = await CF.dialog({ title: s.name, icon: "question", message: "This server is full. Join anyway (you'll spectate until a slot opens)?", buttons: ["Join", "Cancel"] });
          if (r.button !== "Join") return;
        }
        const pw = {};
        if (s.password || askPassword) {
          const r = await CF.dialog({ title: `Join ${s.name}`, icon: "question", message: s.info?.joinPassword ? "This server needs a join password." : "This server needs a password.", input: "", buttons: ["Join", "Cancel"] });
          if (r.button !== "Join") return;
          if (s.info?.joinPassword) pw.joinPassword = r.value; else pw.password = r.value;
        }
        CF.sound("lobby_ready");
        if (CF.joinServer) CF.joinServer({ address: s.address, name: s.name, iwad: s.iwad, pwads: s.pwads }, pw);
      }
      function toggleFavorite(s) {
        if (!s) return;
        const favs = favorites(), on = favs.includes(s.address);
        setFavorites(on ? favs.filter(a => a !== s.address) : [...favs, s.address]);
        if (on) s.sources.delete("favorite"); else s.sources.add("favorite");
        CF.toast({ title: on ? "Removed from Favorites" : "Added to Favorites", body: s.name, icon: "gamebrowser" });
        render();
      }
      async function addServer() {
        const r = await CF.dialog({ title: "Add Server", icon: "question", message: "Server address (host or IP, optionally :port — Zandronum's default port is 10666):", input: "", buttons: ["Add", "Cancel"] });
        if (r.button !== "Add") return;
        const m = /^\s*([A-Za-z0-9.-]{1,253})(?::(\d{1,5}))?\s*$/.exec(r.value || "");
        if (!m || (m[2] && (+m[2] < 1 || +m[2] > 65535))) return CF.dialog({ title: "Add Server", icon: "error", message: "That doesn't look like a server address." });
        const addr = `${m[1]}:${m[2] || 10666}`;
        setFavorites([...favorites(), addr]);
        selected = addr; tab = "favorite";
        refresh();
      }
      function share(s) {
        if (!s || s.status !== "ok") return;
        const card = { game: "zandronum", address: s.address, name: s.name, map: s.map, mode: s.modeName || s.mode, players: s.players, max: s.max, iwad: s.iwad, pwads: s.pwads.filter(p => !p.optional).map(p => p.name), password: s.password };
        if (CF.chat?.online()) { CF.chat.share(card); CF.toast({ title: "Shared to ForgeChat", body: s.name, icon: "forgechat" }); }
        else { CF.open("forgechat"); CF.toast({ title: "Sign on to ForgeChat", body: "Then press Share again to post this server.", icon: "forgechat" }); }
      }
      function hostDialog() {
        const name = h("input", { class: "field", value: `${CF.settings.user}'s ColeForge Server`, maxlength: 48 });
        const mode = h("select", { class: "field" }, ZMODES.map(([v, l]) => h("option", { value: v }, l)));
        const map = h("select", { class: "field" }, (CF.games?.zandronum?.maps || ["MAP01"]).map(m => h("option", {}, m)));
        const max = h("input", { class: "field", type: "number", min: 2, max: 64, value: 8, style: "width:70px" });
        const port = h("input", { class: "field", type: "number", min: 1024, max: 65535, value: 10666, style: "width:90px" });
        const files = h("input", { class: "field", placeholder: "optional: maps.wad, mod.pk3" });
        const lobby = h("input", { type: "checkbox", checked: !!CF.chat?.online(), disabled: !CF.chat?.online() });
        const w = CF.createWindow({ title: "Host a Zandronum Server", icon: "gamebrowser", w: 460, h: 390, resizable: false });
        w.body.append(h("div", { class: "pad form-grid" }, "Server name", name, "Game mode", mode, "Map", map, "Max players", max, "Port (UDP)", port, "WADs / mods", files,
          h("div", {}), h("label", { class: "row clickable" }, lobby, CF.chat?.online() ? "Also open a ForgeChat lobby so buddies can hop in" : "Sign on to ForgeChat to announce it as a lobby"),
          h("div", {}), h("div", { class: "row" },
            h("button", { class: "btn", onclick: () => {
              const opts = { name: name.value, zmode: mode.value, map: map.value, max: +max.value, port: +port.value, files: files.value, mode: mode.value === "cooperative" ? "coop" : "deathmatch" };
              w.close(true);
              // With a lobby, the server starts when you press Start in ForgeChat, so everyone launches together.
              const ip = CF.store.get("cf.lan.ip", "");
              if (lobby.checked && CF.chat?.createLobby({ ...opts, game: "zandronum", address: ip ? `${ip}:${opts.port}` : "" })) {
                CF.open("forgechat", { room: "lobbies" });
                CF.toast({ title: "Lobby open", body: ip ? "Press Start in ForgeChat when everyone's ready." : "Set your LAN IP in the lobby so buddies can connect.", icon: "gamebrowser" });
                return;
              }
              if (CF.hostServer) CF.hostServer(opts);
              setTimeout(() => refresh(), 6000);
            } }, ico("host"), " Start Server"),
            h("button", { class: "btn flat", onclick: () => w.close(true) }, "Cancel"))));
      }
      function about() {
        CF.dialog({ title: "About Forge Game Browser", icon: "gamebrowser", message: "Forge Game Browser 1.0 — Windows – ColeForge Edition\n\nFinds Zandronum servers on the internet (master.zandronum.com) and on your LAN, shows who's playing, and joins in one click through Forge Arcade.\n\nNetwork code ported from Zandronum's launcher protocol and Huffman codec (see server/zandronum/NOTICE.md)." });
      }

      /* ---------- go ---------- */
      filterBox.addEventListener("input", render);
      win.el.addEventListener("keydown", (e) => {
        if (e.key === "F5") { e.preventDefault(); refresh(true); }
        if (e.key === "Enter" && e.target === win.el) join(current());
      });
      const timer = setInterval(() => { if (view.auto && !busy && !win.el.classList.contains("min")) refresh(); }, 60000);
      win.on("close", () => { clearInterval(timer); ctrl?.abort(); });
      win.on("args", (a) => { if (a.select) { selected = a.select; refresh(); } });
      render();
      refresh();
    },
  });
})();
