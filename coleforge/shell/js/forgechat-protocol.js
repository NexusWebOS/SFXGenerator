"use strict";

// ForgeChat protocol rules shared by the browser client (local hub) and the Node LAN server.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ForgeChatProtocol = api;
})(typeof self !== "undefined" ? self : this, function () {
  const LIMITS = {
    text: 4000,          // characters per message
    file: 8 * 1024 * 1024, // bytes per shared file / image / voice clip (as data URL)
    historyPerRoom: 200,
    historyPayload: 1.5 * 1024 * 1024, // larger attachments are dropped from stored history
    name: 24,
    away: 140,
  };
  const CHANNELS = [
    { id: "#general", name: "general", topic: "Hang out. Be excellent." },
    { id: "#games", name: "games", topic: "Doom, Quake, Duke3D and friends" },
    { id: "#lan-party", name: "lan-party", topic: "Organise tonight's frag session" },
    { id: "#music", name: "music", topic: "Share MIDIs, MODs and mixtapes" },
  ];
  const STATUSES = ["online", "away", "busy"];

  const clip = (s, n) => String(s == null ? "" : s).slice(0, n);
  const dmKey = (a, b) => "dm:" + [a, b].sort().join("|");
  const roomOf = (msg) => msg.to && msg.to.startsWith("#") ? msg.to : dmKey(msg.from, msg.to);

  function cleanUser(u) {
    u = u || {};
    return {
      id: clip(u.id, 64) || "u" + Math.random().toString(36).slice(2, 10),
      name: clip(u.name, LIMITS.name).trim() || "Guest",
      avatar: typeof u.avatar === "string" && u.avatar.length < 200000 ? u.avatar : null,
      status: STATUSES.includes(u.status) ? u.status : "online",
      away: clip(u.away, LIMITS.away),
    };
  }

  function cleanAttachment(a) {
    if (!a || typeof a.data !== "string" || !a.data.startsWith("data:")) return null;
    if (a.data.length > LIMITS.file * 1.37) return null; // base64 overhead
    return { name: clip(a.name, 120) || "file", type: clip(a.type, 80), size: +a.size || 0, data: a.data };
  }

  // A shared game server card (Forge Game Browser → ForgeChat). Only plain, short fields survive.
  const ADDRESS = /^[A-Za-z0-9.-]{1,253}:\d{1,5}$/;
  const WAD = /^[\w.\- ]{1,64}\.(wad|pk3|pk7|pke|zip|deh|bex|ipk3)$/i;
  function cleanServer(s) {
    if (!s || !ADDRESS.test(String(s.address || ""))) return null;
    const n = (v, max) => Math.max(0, Math.min(max, Math.floor(+v || 0)));
    return {
      game: s.game === "zandronum" ? "zandronum" : clip(s.game, 24).replace(/[^\w-]/g, "") || "zandronum",
      address: String(s.address), name: clip(s.name, 64), map: clip(s.map, 16).replace(/[^\w]/g, ""), mode: clip(s.mode, 32),
      players: n(s.players, 64), max: n(s.max, 64), iwad: WAD.test(s.iwad || "") ? s.iwad : "",
      pwads: (Array.isArray(s.pwads) ? s.pwads : []).map(String).filter(w => WAD.test(w)).slice(0, 16),
      password: !!s.password,
    };
  }

  // `sender` is the cleaned user object; its name travels with the message so history still
  // shows who spoke after they sign off.
  function cleanMessage(m, sender) {
    const msg = {
      id: clip(m.id, 40) || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      from: sender.id, fromName: sender.name, to: clip(m.to, 80), ts: Date.now(), text: clip(m.text, LIMITS.text),
      auto: !!m.auto,
    };
    for (const k of ["image", "file", "voice"]) { const a = cleanAttachment(m[k]); if (a) msg[k] = a; }
    if (typeof m.gif === "string" && /^(https?:|data:image\/gif)/.test(m.gif) && m.gif.length < LIMITS.file * 1.37) msg.gif = m.gif;
    const server = cleanServer(m.server);
    if (server) msg.server = server;
    if (!msg.to || (!msg.text && !msg.image && !msg.file && !msg.voice && !msg.gif && !msg.server)) return null;
    return msg;
  }

  // Strip large payloads before a message goes into long-lived history.
  function forHistory(msg) {
    const out = Object.assign({}, msg);
    for (const k of ["image", "file", "voice", "gif"]) {
      const v = out[k];
      const size = typeof v === "string" ? v.length : v && v.data ? v.data.length : 0;
      if (size > LIMITS.historyPayload) out[k] = typeof v === "string" ? null : Object.assign({}, v, { data: null, expired: true });
    }
    return out;
  }

  function cleanLobby(l, host) {
    return {
      id: "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), // never trust a client-chosen id
      name: clip(l.name, 48) || "LAN Party",
      game: clip(l.game, 32) || "doom",
      map: clip(l.map, 24) || "MAP01",
      mode: l.mode === "coop" ? "coop" : "deathmatch",
      max: Math.max(2, Math.min(16, +l.max || 4)),
      address: clip(l.address, 64),
      files: clip(l.files, 200),
      zmode: /^[a-z]{3,16}$/.test(l.zmode || "") ? l.zmode : "",
      host: host.id, hostName: host.name,
      players: [{ id: host.id, name: host.name, ready: true }],
      state: "open", created: Date.now(),
    };
  }

  // Apply a lobby operation. Returns the updated lobby, or null when the lobby closes.
  function applyLobbyOp(lobby, op, user, payload) {
    if (!lobby) return null;
    const isHost = user.id === lobby.host;
    const inIdx = lobby.players.findIndex(p => p.id === user.id);
    switch (op) {
      case "join":
        if (inIdx < 0 && lobby.state === "open" && lobby.players.length < lobby.max) lobby.players.push({ id: user.id, name: user.name, ready: false });
        break;
      case "leave":
        if (isHost) return null;
        if (inIdx >= 0) lobby.players.splice(inIdx, 1);
        break;
      case "ready":
        if (inIdx >= 0) lobby.players[inIdx].ready = !!(payload && payload.ready);
        break;
      case "start":
        if (isHost) lobby.state = "starting";
        break;
      case "close":
        if (isHost) return null;
        break;
      case "update":
        if (isHost && payload) {
          if (payload.map) lobby.map = clip(payload.map, 24);
          if (payload.address != null) lobby.address = clip(payload.address, 64);
          if (payload.mode) lobby.mode = payload.mode === "coop" ? "coop" : "deathmatch";
        }
        break;
    }
    return lobby;
  }

  return { LIMITS, CHANNELS, STATUSES, dmKey, roomOf, cleanUser, cleanMessage, cleanServer, cleanLobby, applyLobbyOp, forHistory };
});
