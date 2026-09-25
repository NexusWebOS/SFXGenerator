"use strict";

// ColeForge's agent endpoints on the local/LAN server (and so inside ColeForge.exe):
//
//   POST /api/albert          one Claude turn for Albert (the Claude SDK runs here; the key never
//                             reaches the browser). Loopback only unless ALBERT_LAN=1.
//   GET  /api/albert/status   key source, models, MCP details (for Albert's settings)
//   POST /api/albert/key      save or clear the Anthropic API key ({ key }) in ~/.coleforge
//   POST /mcp                 Model Context Protocol (Streamable HTTP, JSON responses) so AI agent
//                             software (Claude Code, Claude Desktop, Codex, ...) can use ColeForge's
//                             tools. Needs "Authorization: Bearer <token>" (~/.coleforge/agent-token).
//   POST /api/albert/v1/ask   the Albert API: other programs (your games, scripts, bots) ask Albert
//                             something and get his answer. Same bearer token as /mcp; the desktop
//                             must be open (Albert thinks and uses his tools there, with your approval).
//   GET  /api/albert/v1/status is Albert available (desktop open, key set)?
//   GET  /api/agent/poll      the desktop picks up tool calls from MCP clients (long poll)
//   POST /api/agent/hello     the desktop publishes its tool list
//   POST /api/agent/result    the desktop returns a tool call's result
//
// Browser-facing endpoints need the header X-ColeForge-Agent: 1 and a same-origin Origin, so other
// websites open in your browser can't use them (the header forces a CORS preflight that's refused).

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const core = require("./relay-core.js");
const mcp = require("./mcp.js");

const HOME = process.env.COLEFORGE_HOME || path.join(os.homedir(), ".coleforge");
const KEY_FILE = path.join(HOME, "anthropic-key");
const TOKEN_FILE = path.join(HOME, "agent-token");
const LAN_OK = process.env.ALBERT_LAN === "1";

function ensureHome() { fs.mkdirSync(HOME, { recursive: true, mode: 0o700 }); }
function readKey() {
  if (process.env.ANTHROPIC_API_KEY) return { key: process.env.ANTHROPIC_API_KEY, source: "environment (ANTHROPIC_API_KEY)" };
  try { const k = fs.readFileSync(KEY_FILE, "utf8").trim(); if (k) return { key: k, source: "saved in ColeForge" }; } catch { /* none */ }
  return { key: null, source: "none" };
}
function saveKey(k) {
  ensureHome();
  if (!k) { fs.rmSync(KEY_FILE, { force: true }); return; }
  fs.writeFileSync(KEY_FILE, k.trim() + "\n", { mode: 0o600 });
}
function token() {
  if (process.env.COLEFORGE_AGENT_TOKEN) return process.env.COLEFORGE_AGENT_TOKEN;
  try { const t = fs.readFileSync(TOKEN_FILE, "utf8").trim(); if (t) return t; } catch { /* make one */ }
  ensureHome();
  const t = "cf_" + crypto.randomBytes(24).toString("base64url");
  fs.writeFileSync(TOKEN_FILE, t + "\n", { mode: 0o600 });
  return t;
}

const isLoopback = (req) => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { const u = new URL(o); return ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) || u.host === req.headers.host; } catch { return false; }
}
const send = (res, status, body, extra = {}) => { res.writeHead(status, Object.assign({ "Content-Type": "application/json", "Cache-Control": "no-store" }, extra)); res.end(body === undefined ? "" : JSON.stringify(body)); };
async function readJson(req, limit = 8 * 1024 * 1024) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw new core.RelayError(413, "Request too large."); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { throw new core.RelayError(400, "Bad JSON."); }
}

/* ---------------- the desktop bridge: MCP tool calls run in the ColeForge desktop ---------------- */
const bridge = {
  tools: [], seen: 0, queue: [], waiters: [], pending: new Map(), seq: 0,
  connected() { return Date.now() - this.seen < 40000; },
  call(name, args, client, ms = 180000) {
    if (!this.connected()) return Promise.reject(new Error("The ColeForge desktop isn't open. Start ColeForge (or open http://localhost:8098) and try again."));
    const id = String(++this.seq);
    const job = { id, name, args, client };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error("The desktop didn't answer in time (maybe it's waiting for you to approve).")); }, ms);
      this.pending.set(id, { resolve, reject, timer });
      const w = this.waiters.shift();
      if (w) w(job); else this.queue.push(job);
    });
  },
  poll() {
    this.seen = Date.now();
    if (this.queue.length) return Promise.resolve(this.queue.shift());
    return new Promise((resolve) => {
      const w = (job) => { clearTimeout(t); resolve(job); };
      const t = setTimeout(() => { this.waiters = this.waiters.filter((x) => x !== w); resolve(null); }, 25000);
      this.waiters.push(w);
    });
  },
  result({ id, ok, result, error }) {
    const p = this.pending.get(String(id));
    if (!p) return false;
    this.pending.delete(String(id)); clearTimeout(p.timer);
    ok ? p.resolve(result) : p.reject(new Error(error || "The tool failed."));
    return true;
  },
};

let Anthropic = null;
function sdk() {
  if (!Anthropic) { const m = require("@anthropic-ai/sdk"); Anthropic = m.default || m; }
  return Anthropic;
}

async function handle(req, res, url) {
  const p = url.pathname;
  if (p === "/mcp") return mcpHttp(req, res);
  if (p.startsWith("/api/albert/v1/")) return albertApi(req, res, p);
  const browserApi = p.startsWith("/api/albert") || p.startsWith("/api/agent/");
  if (!browserApi) return false;
  if (req.headers["x-coleforge-agent"] !== "1" || !sameOrigin(req)) { send(res, 403, { error: "Not from the ColeForge desktop." }); return true; }
  const local = isLoopback(req);
  try {
    if (p.startsWith("/api/agent/")) {
      if (!local) return send(res, 403, { error: "Only the desktop on this PC runs agent tools." }), true;
      if (p === "/api/agent/poll" && req.method === "GET") return send(res, 200, { job: await bridge.poll() }), true;
      if (p === "/api/agent/hello" && req.method === "POST") { const b = await readJson(req); bridge.tools = Array.isArray(b.tools) ? b.tools.slice(0, 100) : []; bridge.seen = Date.now(); return send(res, 200, { ok: true }), true; }
      if (p === "/api/agent/result" && req.method === "POST") return send(res, 200, { ok: bridge.result(await readJson(req)) }), true;
      return send(res, 404, { error: "Unknown agent endpoint." }), true;
    }
    if (p === "/api/albert/status" && req.method === "GET") {
      const k = readKey();
      const info = { key: k.key ? { source: k.source, hint: "…" + k.key.slice(-4) } : null, models: Object.entries(core.MODELS).map(([id, m]) => ({ id, label: m.label })), default_model: core.DEFAULT_MODEL, lan: !local };
      if (local) {
        info.mcp = { url: `http://localhost:${req.socket.localPort}/mcp`, token: token(), connected_clients: mcp.clients() };
        info.api = { url: `http://localhost:${req.socket.localPort}/api/albert/v1/ask` };
      }
      return send(res, 200, info), true;
    }
    if (!local && !LAN_OK) return send(res, 403, { error: "Albert runs on the PC that hosts ColeForge. (Its owner can allow LAN PCs with ALBERT_LAN=1.)" }), true;
    if (p === "/api/albert/key" && req.method === "POST") {
      if (!local) return send(res, 403, { error: "Set the key on the host PC." }), true;
      const b = await readJson(req);
      if (b.key && !/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(String(b.key).trim())) return send(res, 400, { error: "That doesn't look like an Anthropic API key (sk-ant-…)." }), true;
      saveKey(b.key || null);
      return send(res, 200, { ok: true }), true;
    }
    if (p === "/api/albert" && req.method === "POST") {
      const body = await readJson(req);
      const k = readKey();
      if (!k.key) return send(res, 412, { error: "Albert needs an Anthropic API key. Open Albert's settings to add one (console.anthropic.com → API Keys)." }), true;
      let A;
      try { A = sdk(); } catch { return send(res, 501, { error: "The Claude SDK isn't installed: run npm install in coleforge/agent." }), true; }
      const client = new A({ apiKey: k.key, maxRetries: 2, timeout: 600000 });
      if (!body.stream) {
        try { return send(res, 200, await core.turn(client, body, A)), true; }
        catch (e) { const r = core.errorOf(e, A); return send(res, r.status, { error: r.error }), true; }
      }
      // Live: newline-delimited JSON events, so Albert's words appear as Claude writes them.
      const ac = new AbortController();
      res.on("close", () => { if (!res.writableFinished) ac.abort(); });
      res.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
      await core.relay(client, body, A, { write: (line) => res.write(line), signal: ac.signal });
      res.end();
      return true;
    }
    return send(res, 404, { error: "Unknown endpoint." }), true;
  } catch (e) {
    send(res, e.status || 500, { error: e.status ? e.message : "Agent endpoint error." });
    return true;
  }
}

// Programs outside the desktop (MCP clients, the Albert API) prove themselves with the agent token.
function bearerOk(req) {
  const auth = req.headers.authorization || "";
  const want = "Bearer " + token();
  return auth.length === want.length && crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(want));
}

/* ---------------- the Albert API ---------------- */
async function albertApi(req, res, p) {
  if (req.headers.origin && !sameOrigin(req)) return send(res, 403, { error: "Origin not allowed." }), true;
  if (!bearerOk(req)) return send(res, 401, { error: "Missing or wrong bearer token (see ~/.coleforge/agent-token or Albert → Settings)." }, { "WWW-Authenticate": "Bearer" }), true;
  try {
    if (p === "/api/albert/v1/status" && req.method === "GET") return send(res, 200, { desktop: bridge.connected(), key: !!readKey().key }), true;
    if (p === "/api/albert/v1/ask" && req.method === "POST") {
      const b = await readJson(req, 1024 * 1024);
      const message = typeof b.message === "string" ? b.message.trim() : "";
      if (!message) return send(res, 400, { error: 'Send { "message": "..." }.' }), true;
      if (!readKey().key) return send(res, 412, { error: "Albert has no Anthropic API key yet (Albert → Settings)." }), true;
      const args = { message: message.slice(0, 20000), conversation: typeof b.conversation === "string" ? b.conversation.slice(0, 80) : "", from: String(b.from || req.headers["user-agent"] || "a program").slice(0, 80), named: typeof b.from === "string" && !!b.from };
      if (typeof b.model === "string") args.model = b.model;
      if (typeof b.effort === "string") args.effort = b.effort;
      return send(res, 200, await bridge.call("__albert_ask", args, args.from, 600000)), true;
    }
    return send(res, 404, { error: "Unknown Albert API endpoint. POST /api/albert/v1/ask or GET /api/albert/v1/status." }), true;
  } catch (e) {
    return send(res, e.status || 503, { error: e.message }), true;
  }
}

/* ---------------- MCP over Streamable HTTP ---------------- */
async function mcpHttp(req, res) {
  // DNS-rebinding guard, then the bearer token.
  if (req.headers.origin && !sameOrigin(req)) return send(res, 403, { error: "Origin not allowed." }), true;
  if (!bearerOk(req)) return send(res, 401, { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Missing or wrong bearer token (see ~/.coleforge/agent-token or Albert → Settings)." } }, { "WWW-Authenticate": "Bearer" }), true;
  if (req.method === "GET" || req.method === "DELETE") return send(res, 405, { error: "This server answers POST only (no server-sent stream)." }, { Allow: "POST" }), true;
  if (req.method !== "POST") return send(res, 405, {}), true;
  let msg;
  try { msg = await readJson(req, 4 * 1024 * 1024); } catch { return send(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }), true; }
  const client = String(req.headers["user-agent"] || "MCP client").slice(0, 80);
  const out = await mcp.handle(msg, { listTools: () => bridge.tools, callTool: (name, args, who) => bridge.call(name, args, who || client), connected: () => bridge.connected() });
  if (out === null) { res.writeHead(202); res.end(); return true; }
  return send(res, 200, out), true;
}

module.exports = { handle, bridge, readKey, saveKey, token, HOME };
