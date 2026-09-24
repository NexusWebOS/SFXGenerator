#!/usr/bin/env node
"use strict";

// ColeForge LAN server: serves the ColeForge shell over HTTP and runs the ForgeChat hub
// (presence, channels, DMs, history, game lobbies, WebRTC call signalling) over WebSocket.
// It also answers the Forge Game Browser: Zandronum master list, server queries, LAN servers.
// Dependency-free: only Node's standard library. Usage:
//   node coleforge/server/forgechat-server.js [--port 8098] [--host 0.0.0.0]

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const P = require("../shell/js/forgechat-protocol.js");
const Zan = require("./zandronum/client.js");

const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf("--" + name); return i >= 0 ? args[i + 1] : fallback; };
const PORT = +(arg("port", process.env.PORT || 8098));
const HOST = arg("host", process.env.HOST || "0.0.0.0");
const ROOT = path.resolve(__dirname, "..", "shell");
const MAX_MESSAGE = 16 * 1024 * 1024;
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon",
  ".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".mid": "audio/midi", ".woff2": "font/woff2",
  ".wasm": "application/wasm", ".mjs": "text/javascript; charset=utf-8", ".ttf": "font/ttf", ".zip": "application/zip", ".txt": "text/plain; charset=utf-8",
};

/* ---------------- static files ---------------- */
const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400).end(); return; }
  if (rel.startsWith("/api/zandronum/")) {
    zandronumApi(req, res, new URL(req.url, "http://x")).catch((e) => { if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" }).end(JSON.stringify({ error: e.message })); });
    return;
  }
  if (rel === "/") rel = "/index.html";
  const file = path.resolve(ROOT, "." + rel);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": "no-cache" });
    fs.createReadStream(file).pipe(res);
  });
});

/* ---------------- Zandronum: Forge Game Browser API ---------------- */
// Browsers can't speak UDP, so the LAN server does it for them:
//   GET /api/zandronum/browse?internet=1&lan=1&extra=host:port,...[&refresh=1]
//   GET /api/zandronum/query?addr=host:port
// ZANDRONUM_MASTER=host:port points at another master; ZANDRONUM_LAN=0 turns the LAN listener off.
const ZAN_MASTER = Zan.parseAddress(process.env.ZANDRONUM_MASTER || "master.zandronum.com", 15300);
const zanLan = process.env.ZANDRONUM_LAN === "0" ? null
  : Zan.lanListener({ port: +(process.env.ZANDRONUM_LAN_PORT || 15101), onError: (e) => log(`Zandronum LAN listener off (${e.code || e.message}); LAN servers won't appear by themselves.`) });
const zanAnswers = new Map(); // "host:port" -> { at, result }
let zanMaster = { at: 0, status: "not asked", servers: [] }, zanMasterBusy = null;

function zanMasterList(force) {
  if (!force && zanMaster.at && Date.now() - zanMaster.at < 30000) return Promise.resolve(zanMaster);
  // The master ignores a launcher that asks twice within 10 seconds; keep the last good list then.
  if (!zanMasterBusy) zanMasterBusy = Zan.queryMaster(ZAN_MASTER).then((m) => {
    const keep = !m.servers.length && zanMaster.servers.length;
    zanMaster = { at: Date.now(), status: m.status, error: m.error, servers: keep ? zanMaster.servers : m.servers };
    return zanMaster;
  }).finally(() => { zanMasterBusy = null; });
  return zanMasterBusy;
}

async function zanQuery(targets) {
  // Servers also ignore repeat queries inside 10 seconds, so reuse answers that fresh.
  const now = Date.now(), fresh = [], ask = [];
  for (const t of targets) { const c = zanAnswers.get(Zan.key(t.host, t.port)); if (c && now - c.at < 10000) fresh.push(c.result); else ask.push(t); }
  const got = ask.length ? await Zan.queryServers(ask) : [];
  for (const r of got) zanAnswers.set(r.address, { at: Date.now(), result: r });
  if (zanAnswers.size > 4000) for (const [k, v] of zanAnswers) if (now - v.at > 60000) zanAnswers.delete(k);
  return [...fresh, ...got];
}

async function zandronumApi(req, res, url) {
  const send = (code, obj) => res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify(obj));
  if (req.method !== "GET") return send(405, { error: "GET only" });
  const q = url.searchParams;
  if (url.pathname === "/api/zandronum/query") {
    const a = Zan.parseAddress(q.get("addr"));
    if (!a) return send(400, { error: "Expected addr=host:port" });
    const [r] = await zanQuery([a]);
    return send(200, r);
  }
  if (url.pathname !== "/api/zandronum/browse") return send(404, { error: "Unknown endpoint" });
  const sources = new Map(); // "host:port" -> Set of sources
  const add = (host, port, source) => { const k = Zan.key(host, port); if (!sources.has(k)) sources.set(k, { host, port, set: new Set() }); sources.get(k).set.add(source); };
  for (const a of (q.get("extra") || "").split(",").slice(0, 64).map(x => Zan.parseAddress(x)).filter(Boolean)) add(a.host, a.port, "favorite");
  let master = null;
  if (q.get("internet") !== "0") { master = await zanMasterList(q.get("refresh") === "1"); for (const s of master.servers) add(s.host, s.port, "internet"); }
  const lanServers = zanLan && q.get("lan") !== "0" ? zanLan.list() : [];
  for (const s of lanServers) add(s.host, s.port, "lan");
  const lanByKey = new Map(lanServers.map(s => [s.address, s]));
  const answers = await zanQuery([...sources.values()].filter(s => !lanByKey.has(Zan.key(s.host, s.port))));
  const servers = [...lanServers, ...answers].map(r => ({ ...r, sources: [...(sources.get(r.address)?.set || [])] }));
  send(200, {
    master: master && { host: ZAN_MASTER.host, status: master.status, error: master.error, count: master.servers.length, at: master.at },
    lan: { listening: !!zanLan, count: lanServers.length },
    servers,
  });
}

/* ---------------- minimal RFC 6455 WebSocket ---------------- */
class Socket {
  constructor(sock) {
    this.sock = sock; this.chunks = []; this.have = 0; this.need = 2; this.frags = []; this.fragLen = 0; this.open = true;
    this.onmessage = () => {}; this.onclose = () => {};
    sock.on("data", (d) => this.receive(d));
    sock.on("close", () => this.closed());
    sock.on("error", () => this.closed());
    this.alive = true;
  }
  // Large frames arrive in many TCP chunks: buffer them and join only once a whole frame is here.
  receive(chunk) {
    this.chunks.push(chunk); this.have += chunk.length;
    if (this.have < this.need) return;
    const rest = this.parse(this.chunks.length === 1 ? this.chunks[0] : Buffer.concat(this.chunks, this.have));
    this.chunks = rest.length ? [rest] : []; this.have = rest.length;
  }
  parse(buf) {
    this.need = 2;
    while (buf.length >= 2 && this.open) {
      const b0 = buf[0], b1 = buf[1], fin = b0 & 0x80, op = b0 & 0x0f, masked = b1 & 0x80;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) { this.need = 4; break; } len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) { this.need = 10; break; } len = buf.readUInt32BE(2) * 2 ** 32 + buf.readUInt32BE(6); off = 10; }
      if (len > MAX_MESSAGE) { this.close(1009); break; }
      const need = off + (masked ? 4 : 0) + len;
      if (buf.length < need) { this.need = need; break; }
      let payload = buf.subarray(off + (masked ? 4 : 0), need);
      if (masked) { const mask = buf.subarray(off, off + 4); payload = Buffer.from(payload); for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3]; }
      buf = buf.subarray(need);
      if (op === 0x8) { this.close(1000); break; }
      if (op === 0x9) { this.frame(0xa, payload); continue; }
      if (op === 0xa) { this.alive = true; continue; }
      if (op === 0x1 || op === 0x2 || op === 0x0) {
        this.frags.push(payload); this.fragLen += payload.length;
        if (this.fragLen > MAX_MESSAGE) { this.close(1009); break; }
        if (fin) {
          const msg = Buffer.concat(this.frags); this.frags = []; this.fragLen = 0;
          if (op !== 0x2) this.onmessage(msg.toString("utf8"));
        }
      }
    }
    return Buffer.from(buf);
  }
  frame(op, data) {
    if (!this.open) return;
    const len = data.length;
    const head = len < 126 ? Buffer.from([0x80 | op, len]) : len < 65536 ? Buffer.from([0x80 | op, 126, len >> 8, len & 255]) : (() => { const b = Buffer.alloc(10); b[0] = 0x80 | op; b[1] = 127; b.writeUInt32BE(Math.floor(len / 2 ** 32), 2); b.writeUInt32BE(len >>> 0, 6); return b; })();
    this.sock.write(Buffer.concat([head, data]));
  }
  send(obj) { this.frame(0x1, Buffer.from(JSON.stringify(obj))); }
  ping() { if (!this.alive) return this.close(1001); this.alive = false; this.frame(0x9, Buffer.alloc(0)); }
  close(code = 1000) {
    if (!this.open) return;
    const b = Buffer.alloc(2); b.writeUInt16BE(code);
    this.frame(0x8, b); this.open = false; this.sock.end(); this.closed();
  }
  closed() { if (this.done) return; this.done = true; this.open = false; this.onclose(); }
}

server.on("upgrade", (req, sock) => {
  if (new URL(req.url, "http://x").pathname !== "/forgechat" || req.headers.upgrade?.toLowerCase() !== "websocket") { sock.destroy(); return; }
  const key = req.headers["sec-websocket-key"];
  const accept = crypto.createHash("sha1").update(key + WS_GUID).digest("base64");
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  sock.setNoDelay(true);
  attach(new Socket(sock), req.socket.remoteAddress);
});

/* ---------------- ForgeChat hub ---------------- */
const clients = new Set();           // { ws, user, ip }
const history = new Map();           // room -> messages
const lobbies = new Map();           // id -> lobby
const byUser = (id) => [...clients].filter(c => c.user && c.user.id === id);
const broadcast = (obj, except) => { for (const c of clients) if (c.user && c !== except) c.ws.send(obj); };
const sendLobbies = () => broadcast({ type: "lobbies", lobbies: [...lobbies.values()] });
function remember(msg) {
  const room = P.roomOf(msg);
  if (!history.has(room)) history.set(room, []);
  const list = history.get(room);
  list.push(P.forHistory(msg));
  if (list.length > P.LIMITS.historyPerRoom) list.splice(0, list.length - P.LIMITS.historyPerRoom);
}
function historyFor(userId) {
  const out = {};
  for (const [room, msgs] of history) if (room.startsWith("#") || room.slice(3).split("|").includes(userId)) out[room] = msgs;
  return out;
}

function attach(ws, ip) {
  const client = { ws, user: null, ip };
  clients.add(client);
  ws.onmessage = (text) => {
    let m;
    try { m = JSON.parse(text); } catch { return; }
    if (!m || typeof m.type !== "string") return;
    if (m.type === "hello") {
      const user = P.cleanUser(m.user);
      byUser(user.id).forEach(old => { if (old !== client) old.ws.close(4000); });
      client.user = user;
      ws.send({ type: "welcome", you: user, users: [...clients].filter(c => c.user).map(c => c.user), lobbies: [...lobbies.values()], history: historyFor(user.id), channels: P.CHANNELS });
      broadcast({ type: "presence", user, joined: true }, client);
      log(`${user.name} signed on from ${ip}`);
      return;
    }
    const me = client.user;
    if (!me) return;
    switch (m.type) {
      case "status":
        Object.assign(me, P.cleanUser({ ...me, status: m.status, away: m.away }));
        broadcast({ type: "presence", user: me });
        break;
      case "msg": {
        const msg = P.cleanMessage(m, me);
        if (!msg) return;
        remember(msg);
        if (msg.to.startsWith("#")) broadcast({ type: "msg", msg });
        else { byUser(msg.to).forEach(c => c.ws.send({ type: "msg", msg })); byUser(me.id).forEach(c => c.ws.send({ type: "msg", msg })); }
        break;
      }
      case "typing":
        if (typeof m.to !== "string") return;
        if (m.to.startsWith("#")) broadcast({ type: "typing", from: me.id, to: m.to }, client);
        else byUser(m.to).forEach(c => c.ws.send({ type: "typing", from: me.id, to: m.to }));
        break;
      case "lobby.create": {
        if ([...lobbies.values()].some(l => l.players.some(p => p.id === me.id))) return;
        const l = P.cleanLobby(m.lobby || {}, me);
        if (!l.address) l.address = ip.replace(/^::ffff:/, "");
        lobbies.set(l.id, l);
        log(`${me.name} is hosting ${l.game} (${l.map}) "${l.name}"`);
        sendLobbies();
        break;
      }
      case "rtc":
        if (typeof m.to !== "string") return;
        byUser(m.to).forEach(c => c.ws.send({ type: "rtc", from: me.id, to: m.to, kind: m.kind, data: m.data }));
        break;
      default:
        if (m.type.startsWith("lobby.")) {
          const l = lobbies.get(m.id);
          if (!l) return;
          const next = P.applyLobbyOp(l, m.type.slice(6), me, m);
          if (next) lobbies.set(l.id, next); else lobbies.delete(l.id);
          sendLobbies();
        }
    }
  };
  ws.onclose = () => {
    clients.delete(client);
    const u = client.user;
    if (!u || byUser(u.id).length) return;
    broadcast({ type: "leave", id: u.id });
    let changed = false;
    for (const l of [...lobbies.values()]) {
      if (l.host === u.id) { lobbies.delete(l.id); changed = true; }
      else if (l.players.some(p => p.id === u.id)) { P.applyLobbyOp(l, "leave", u); changed = true; }
    }
    if (changed) sendLobbies();
    log(`${u.name} signed off`);
  };
}

setInterval(() => { for (const c of clients) c.ws.ping(); }, 30000).unref();

function log(s) { console.log(`[${new Date().toLocaleTimeString()}] ${s}`); }

server.listen(PORT, HOST, () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === "IPv4" && !i.internal).map(i => i.address);
  console.log("ColeForge LAN server running");
  console.log(`  Shell:     http://localhost:${PORT}/`);
  for (const ip of ips) console.log(`  LAN:       http://${ip}:${PORT}/   ForgeChat: ws://${ip}:${PORT}/forgechat`);
  console.log("Press Ctrl+C to stop.");
});

module.exports = { server };
