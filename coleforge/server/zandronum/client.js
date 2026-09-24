"use strict";

// UDP side of the Zandronum integration: ask the master server for the internet server list,
// query servers for their details, and listen for LAN servers announcing themselves
// (Zandronum servers broadcast their info to UDP 15101 once a second while sv_broadcast is on).

const dgram = require("dgram");
const dns = require("dns").promises;
const net = require("net");
const Z = require("./protocol.js");

const key = (host, port) => `${host}:${port}`;

function parseAddress(text, defaultPort = Z.PORTS.SERVER) {
  const m = /^\s*([A-Za-z0-9.-]{1,253}|\[[0-9A-Fa-f:]+\])(?::(\d{1,5}))?\s*$/.exec(String(text || ""));
  if (!m) return null;
  const port = m[2] ? +m[2] : defaultPort;
  if (port < 1 || port > 65535) return null;
  return { host: m[1].replace(/^\[|\]$/g, ""), port };
}

async function resolve(host) {
  if (net.isIPv4(host)) return host;
  const { address } = await dns.lookup(host, { family: 4 });
  return address;
}

function openSocket() {
  return new Promise((ok, fail) => {
    const s = dgram.createSocket("udp4");
    s.once("error", fail);
    s.bind(0, () => { s.removeListener("error", fail); s.on("error", () => {}); ok(s); });
  });
}

/**
 * Query many servers at once over one socket.
 * @param {{host: string, port: number}[]} targets
 * @returns {Promise<{host, port, address, status, ping?, info?, error?}[]>}
 */
async function queryServers(targets, { timeout = 2500, batch = 48 } = {}) {
  const results = new Map(), pending = new Map();
  await Promise.all(targets.map(async (t) => {
    const r = { host: t.host, port: t.port, address: key(t.host, t.port), status: "timeout" };
    results.set(r.address, r);
    try { const ip = await resolve(t.host); pending.set(key(ip, t.port), { r, ip, segments: new Z.Segments() }); }
    catch { r.status = "unresolved"; }
  }));
  if (!pending.size) return [...results.values()];
  const sock = await openSocket();
  return new Promise((done) => {
    let open = pending.size;
    const finish = () => { clearTimeout(timer); try { sock.close(); } catch {} done([...results.values()]); };
    const timer = setTimeout(finish, timeout);
    sock.on("message", (msg, rinfo) => {
      const p = pending.get(key(rinfo.address, rinfo.port));
      if (!p || p.r.status === "ok") return;
      try {
        const reply = Z.parseServerPacket(msg);
        let info = null;
        if (reply.kind === "info") info = reply.info;
        else if (reply.kind === "segment") info = p.segments.add(reply)?.info;
        else { p.r.status = reply.kind; if (--open === 0) finish(); return; }
        if (!info) return;
        p.r.status = "ok"; p.r.ping = Date.now() - p.sent; p.r.info = info;
      } catch (e) { p.r.status = "error"; p.r.error = e.message; }
      if (--open === 0) finish();
    });
    // Send in small bursts so a long master list doesn't flood the network card.
    const list = [...pending.values()];
    let i = 0;
    (function burst() {
      for (const end = Math.min(list.length, i + batch); i < end; i++) {
        const p = list[i]; p.sent = Date.now();
        sock.send(Z.serverQuery(p.sent >>> 0), p.r.port, p.ip);
      }
      if (i < list.length) setTimeout(burst, 15);
    })();
  });
}

/** Ask the master server for every registered server. */
async function queryMaster({ host = Z.MASTER_HOST, port = Z.PORTS.MASTER, timeout = 4000 } = {}) {
  let ip;
  try { ip = await resolve(host); } catch (e) { return { status: "unresolved", error: e.message, servers: [] }; }
  const sock = await openSocket();
  return new Promise((done) => {
    const parts = new Map();
    let last = -1;
    const finish = (status, extra = {}) => {
      clearTimeout(timer); try { sock.close(); } catch {}
      const servers = [...parts.values()].flat();
      const seen = new Set();
      done({ status, servers: servers.filter(s => !seen.has(key(s.host, s.port)) && seen.add(key(s.host, s.port))), partial: status !== "ok", ...extra });
    };
    const timer = setTimeout(() => finish(parts.size ? "partial" : "timeout"), timeout);
    sock.on("message", (msg, rinfo) => {
      if (rinfo.address !== ip) return;
      try {
        const reply = Z.parseMasterPacket(msg);
        if (reply.status !== "ok") return finish(reply.status);
        parts.set(reply.packet, reply.servers);
        if (reply.last) last = reply.packet;
        if (last >= 0 && parts.size === last + 1) finish("ok");
      } catch (e) { finish("error", { error: e.message }); }
    });
    sock.send(Z.masterQuery(), port, ip);
  });
}

/** Listen for LAN servers' once-a-second broadcasts. */
function lanListener({ port = Z.PORTS.BROADCAST, ttl = 6000, onError = () => {} } = {}) {
  const servers = new Map();
  const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
  sock.on("error", (e) => { onError(e); try { sock.close(); } catch {} });
  sock.on("message", (msg, rinfo) => {
    try {
      const reply = Z.parseServerPacket(msg);
      if (reply.kind !== "info") return;
      servers.set(key(rinfo.address, rinfo.port), { host: rinfo.address, port: rinfo.port, address: key(rinfo.address, rinfo.port), status: "ok", ping: 0, lan: true, info: reply.info, seen: Date.now() });
    } catch { /* not a Zandronum broadcast */ }
  });
  sock.bind(port, () => sock.unref());
  return {
    list() {
      const now = Date.now();
      for (const [k, s] of servers) if (now - s.seen > ttl) servers.delete(k);
      return [...servers.values()];
    },
    close() { try { sock.close(); } catch {} },
  };
}

module.exports = { parseAddress, queryServers, queryMaster, lanListener, key };
