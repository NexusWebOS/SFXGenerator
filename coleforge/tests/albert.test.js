"use strict";
// Albert and ColeForge's agent endpoints, against a mock Claude API (tests/mock-anthropic.js):
//   - the relay sends what the Claude API expects (model, adaptive thinking with summaries, server-side
//     fallbacks, prompt caching, effort, compaction, per-model server tools) and streams replies;
//   - the Albert API (/api/albert/v1/*) for other programs;
//   - /api/albert and /api/agent/* only answer the desktop (header, origin, loopback), keys stay server-side;
//   - MCP over HTTP (token, initialize, tools/list, tools/call through the desktop bridge) and over stdio.
//   node coleforge/tests/albert.test.js
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { createMockClaude } = require("./mock-anthropic.js");
const core = require("../agent/relay-core.js");

let passed = 0;
const ok = (name) => { passed++; console.log("ok -", name); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 18000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const H = { "Content-Type": "application/json", "X-ColeForge-Agent": "1" };

(async () => {
  const mock = createMockClaude();
  await new Promise((r) => mock.server.listen(0, "127.0.0.1", r));
  const mockUrl = `http://127.0.0.1:${mock.server.address().port}`;

  /* ---------- the relay with the real SDK ---------- */
  const A = (() => { const m = require("../agent/node_modules/@anthropic-ai/sdk"); return m.default || m; })();
  const client = new A({ apiKey: mock.key, baseURL: mockUrl, maxRetries: 0 });
  const r1 = await core.turn(client, { messages: [{ role: "user", content: "hello there" }], system: "You are Albert.", tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }] });
  let q = mock.requests.at(-1);
  assert.strictEqual(q.body.model, "claude-opus-5", "Claude Opus 5 by default");
  assert.deepStrictEqual(q.body.thinking, { type: "adaptive", display: "summarized" }, "adaptive thinking, with thought summaries");
  assert.strictEqual(q.body.fallbacks, "default", "server-side fallbacks on");
  assert.match(q.headers["anthropic-beta"] || "", /server-side-fallback-2026-07-01/);
  assert.match(q.headers["anthropic-beta"] || "", /compact-2026-01-12/);
  assert.deepStrictEqual(q.body.context_management, { edits: [{ type: "compact_20260112" }] }, "server-side compaction");
  assert.deepStrictEqual(q.body.cache_control, { type: "ephemeral" }, "automatic caching of the conversation");
  assert.deepStrictEqual(q.body.system, [{ type: "text", text: "You are Albert.", cache_control: { type: "ephemeral" } }], "system prompt cached");
  assert.strictEqual(q.body.output_config, undefined, "effort left to the model unless chosen");
  assert.strictEqual(q.body.max_tokens, 32000);
  assert.strictEqual(r1.stop_reason, "end_turn");
  await core.turn(client, { model: "claude-sonnet-5", effort: "max", system: [{ type: "text", text: "persona" }, { type: "text", text: "memory" }], messages: [{ role: "user", content: "hi" }], tools: [{ type: "web_fetch_20260209", name: "web_fetch" }] });
  q = mock.requests.at(-1);
  assert.deepStrictEqual(q.body.output_config, { effort: "max" });
  assert.deepStrictEqual(q.body.system.map((b) => !!b.cache_control), [true, true], "persona and whole system prompt each get a breakpoint");
  assert.strictEqual(q.body.context_management, undefined, "compaction only where supported");
  assert.strictEqual(q.body.fallbacks, undefined);
  assert.strictEqual(q.body.tools[0].type, "web_fetch_20260209");
  await core.turn(client, { model: "claude-haiku-4-5", messages: [{ role: "user", content: "hi" }], tools: [{ type: "web_search_20260209", name: "web_search" }] });
  q = mock.requests.at(-1);
  assert.strictEqual(q.body.model, "claude-haiku-4-5");
  assert.strictEqual(q.body.thinking, undefined, "no adaptive thinking on Haiku 4.5");
  assert.strictEqual(q.body.fallbacks, undefined);
  assert.strictEqual(q.body.tools[0].type, "web_search_20250305", "web search version per model");
  await core.turn(client, { model: "claude-haiku-4-5", effort: "high", messages: [{ role: "user", content: "hi" }], tools: [{ type: "web_fetch_20260209", name: "web_fetch" }] });
  q = mock.requests.at(-1);
  assert.strictEqual(q.body.tools, undefined, "no web fetch on Haiku 4.5");
  assert.strictEqual(q.body.output_config, undefined, "no effort on Haiku 4.5");
  await core.turn(client, { model: "gpt-4", messages: [{ role: "user", content: "hi" }], max_tokens: 999999 });
  q = mock.requests.at(-1);
  assert.strictEqual(q.body.model, "claude-opus-5", "unknown models fall back to the default");
  assert.strictEqual(q.body.max_tokens, 32000, "max_tokens is capped");
  await assert.rejects(core.turn(client, { messages: [] }), /non-empty/);
  const bad = new A({ apiKey: "sk-ant-wrong-key-000000000000000000", baseURL: mockUrl, maxRetries: 0 });
  try { await core.turn(bad, { messages: [{ role: "user", content: "x" }] }); assert.fail("should fail"); }
  catch (e) { assert.deepStrictEqual(core.errorOf(e, A).status, 401); assert.match(core.errorOf(e, A).error, /API key was rejected/); }
  // Streaming: events as Claude writes, then the whole message.
  const evs = [];
  const r2 = await core.stream(client, { messages: [{ role: "user", content: "please note this down" }], tools: [{ name: "write_document", description: "w", input_schema: { type: "object", properties: {} } }] }, (e) => evs.push(e), undefined, A);
  assert.strictEqual(mock.requests.at(-1).body.stream, true);
  assert.strictEqual(r2.stop_reason, "tool_use");
  assert.deepStrictEqual(r2.content.find((b) => b.type === "tool_use").input.name, "albert-note.txt", "tool input assembled from the stream");
  assert.ok(evs.some((e) => e.t === "thinking" && /think/.test(e.d)), "thought summaries stream");
  assert.strictEqual(evs.filter((e) => e.t === "text").map((e) => e.d).join(""), "On it.");
  assert.ok(evs.some((e) => e.t === "block" && e.type === "tool_use" && e.name === "write_document"));
  // An API that turns the extras down: retried once without them, and they stay off.
  const r3 = await core.turn(client, { messages: [{ role: "user", content: "reject extras please" }] }, A);
  assert.strictEqual(r3.stop_reason, "end_turn");
  assert.strictEqual(mock.requests.at(-1).body.cache_control, undefined);
  assert.ok(core._degraded.has("extras"));
  core._degraded.clear();
  ok("relay: Opus 5 default, thinking summaries, fallbacks, caching, effort, compaction, per-model server tools, caps, streaming, graceful retry, SDK errors");

  /* ---------- the server: /api/albert and friends ---------- */
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "coleforge-home-"));
  const srv = spawn(process.execPath, [path.join(__dirname, "../server/forgechat-server.js"), "--port", String(PORT), "--host", "127.0.0.1"],
    { env: Object.assign({}, process.env, { COLEFORGE_HOME: home, ANTHROPIC_BASE_URL: mockUrl, ANTHROPIC_API_KEY: "", ZANDRONUM_LAN: "0" }), stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; srv.stdout.on("data", (d) => { log += d; }); srv.stderr.on("data", (d) => { log += d; });
  for (let i = 0; i < 50; i++) { try { await fetch(BASE + "/"); break; } catch { await sleep(100); } }
  try {
    const post = (p, body, headers = H) => fetch(BASE + p, { method: "POST", headers, body: JSON.stringify(body) });
    assert.strictEqual((await post("/api/albert", { messages: [{ role: "user", content: "hi" }] }, { "Content-Type": "application/json" })).status, 403, "needs the ColeForge header");
    assert.strictEqual((await post("/api/albert", { messages: [{ role: "user", content: "hi" }] }, Object.assign({ Origin: "https://evil.example" }, H))).status, 403, "other websites are refused");
    let r = await post("/api/albert", { messages: [{ role: "user", content: "hi" }] });
    assert.strictEqual(r.status, 412, "no key yet");
    assert.strictEqual((await post("/api/albert/key", { key: "not-a-key" })).status, 400);
    assert.strictEqual((await post("/api/albert/key", { key: mock.key })).status, 200);
    const keyFile = path.join(home, "anthropic-key");
    assert.strictEqual(fs.readFileSync(keyFile, "utf8").trim(), mock.key);
    if (process.platform !== "win32") assert.strictEqual(fs.statSync(keyFile).mode & 0o777, 0o600, "the key file is private");
    const st = await (await fetch(BASE + "/api/albert/status", { headers: H })).json();
    assert.ok(st.key && st.key.hint.endsWith(mock.key.slice(-4)) && !JSON.stringify(st).includes(mock.key), "status shows a hint, never the key");
    assert.match(st.mcp.token, /^cf_/);
    r = await post("/api/albert", { messages: [{ role: "user", content: "hi from the desktop" }] });
    const turn = await r.json();
    assert.strictEqual(r.status, 200, JSON.stringify(turn));
    assert.match(turn.content.find((b) => b.type === "text").text, /hi from the desktop/);
    r = await post("/api/albert", { stream: true, messages: [{ role: "user", content: "stream me" }] });
    assert.match(r.headers.get("content-type"), /ndjson/);
    const events = (await r.text()).trim().split("\n").map((l) => JSON.parse(l));
    assert.strictEqual(events.filter((e) => e.t === "text").map((e) => e.d).join(""), events.at(-1).message.content.find((b) => b.type === "text").text);
    assert.strictEqual(events.at(-1).t, "done");
    r = await post("/api/albert", { stream: true, messages: [] });
    assert.deepStrictEqual((await r.text()).trim().split("\n").map((l) => JSON.parse(l)).at(-1).t, "error", "errors arrive in the stream");
    ok("server: /api/albert only for the desktop, key kept private in ~/.coleforge, turns relayed and streamed");

    /* ---------- MCP over HTTP ---------- */
    const token = fs.readFileSync(path.join(home, "agent-token"), "utf8").trim();
    const rpc = (msg, tok = token) => fetch(BASE + "/mcp", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${tok}`, "User-Agent": "claude-code/2.1" }, body: JSON.stringify(msg) });
    assert.strictEqual((await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, "wrong")).status, 401, "token required");
    let m = await (await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test-agent", version: "1" } } })).json();
    assert.strictEqual(m.result.protocolVersion, "2025-06-18");
    assert.strictEqual(m.result.serverInfo.name, "coleforge");
    assert.ok(m.result.capabilities.tools);
    assert.strictEqual((await rpc({ jsonrpc: "2.0", method: "notifications/initialized" })).status, 202);
    m = await (await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" })).json();
    assert.deepStrictEqual(m.result.tools, [], "no desktop open: no tools");
    m = await (await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "list_apps", arguments: {} } })).json();
    assert.strictEqual(m.result.isError, true);
    // A pretend desktop: publish tools, then answer calls.
    const tools = [{ name: "list_apps", title: "List programs", description: "Programs", input_schema: { type: "object", properties: {} }, write: false },
      { name: "write_document", title: "Write", description: "Write", input_schema: { type: "object", properties: { name: { type: "string" } } }, write: true }];
    assert.strictEqual((await post("/api/agent/hello", { tools })).status, 200);
    let answered = 0;
    const desk = (async () => {
      for (let i = 0; i < 3; i++) {
        const { job } = await (await fetch(BASE + "/api/agent/poll", { headers: H })).json();
        if (!job) continue;
        answered++;
        await post("/api/agent/result", job.name === "list_apps" ? { id: job.id, ok: true, result: [{ id: "albert", name: "Albert", client: job.client }] } : { id: job.id, ok: false, error: "The person at the desktop declined this." });
        if (answered === 2) return;
      }
    })();
    m = await (await rpc({ jsonrpc: "2.0", id: 4, method: "tools/list" })).json();
    assert.deepStrictEqual(m.result.tools.map((t) => [t.name, t.annotations.readOnlyHint]), [["list_apps", true], ["write_document", false]]);
    m = await (await rpc({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "list_apps", arguments: {} } })).json();
    assert.match(m.result.content[0].text, /Albert/);
    assert.strictEqual(m.result.structuredContent, undefined, "arrays aren't structured content");
    m = await (await rpc({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "write_document", arguments: { name: "x" } } })).json();
    assert.strictEqual(m.result.isError, true);
    assert.match(m.result.content[0].text, /declined/);
    await desk;
    m = await (await rpc([{ jsonrpc: "2.0", id: 7, method: "ping" }, { jsonrpc: "2.0", method: "notifications/initialized" }, { jsonrpc: "2.0", id: 8, method: "nope" }])).json();
    assert.deepStrictEqual(m.map((x) => [x.id, !!x.result, x.error?.code]), [[7, true, undefined], [8, false, -32601]]);
    assert.strictEqual((await fetch(BASE + "/mcp", { method: "POST", headers: { Authorization: `Bearer ${token}`, Origin: "https://evil.example" }, body: "{}" })).status, 403, "DNS-rebinding guard");
    ok("MCP over HTTP: token, initialize, tools/list and tools/call through the desktop bridge, refusals, batches, origin guard");

    /* ---------- the Albert API for other programs ---------- */
    const api = (p, body, tok = token, extra = {}) => fetch(BASE + p, { method: body ? "POST" : "GET", headers: Object.assign({ "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, extra), body: body && JSON.stringify(body) });
    assert.strictEqual((await api("/api/albert/v1/ask", { message: "hi" }, "nope")).status, 401, "token required");
    assert.strictEqual((await api("/api/albert/v1/ask", { message: "hi" }, token, { Origin: "https://evil.example" })).status, 403, "not from other websites");
    assert.strictEqual((await api("/api/albert/v1/ask", {})).status, 400);
    assert.deepStrictEqual(await (await api("/api/albert/v1/status")).json(), { desktop: true, key: true });
    const asked = (async () => {
      const { job } = await (await fetch(BASE + "/api/agent/poll", { headers: H })).json();
      assert.strictEqual(job.name, "__albert_ask");
      assert.deepStrictEqual([job.args.message, job.args.from, job.args.named, job.args.conversation], ["What's 2+2?", "SFX Generator", true, "level-1"]);
      await post("/api/agent/result", { id: job.id, ok: true, result: { text: "4.", conversation: "level-1" } });
    })();
    r = await api("/api/albert/v1/ask", { message: "What's 2+2?", from: "SFX Generator", conversation: "level-1" });
    assert.deepStrictEqual(await r.json(), { text: "4.", conversation: "level-1" });
    await asked;
    ok("Albert API: bearer token, origin guard, status, questions answered by the desktop's Albert");

    /* ---------- MCP over stdio (Claude Desktop, Codex) ---------- */
    const stdio = spawn(process.execPath, [path.join(__dirname, "../agent/mcp-stdio.js"), "--url", BASE + "/mcp"], { env: Object.assign({}, process.env, { COLEFORGE_HOME: home }) });
    const lines = [];
    let buf = "";
    stdio.stdout.on("data", (d) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { lines.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); } });
    stdio.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25" } }) + "\n");
    stdio.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    stdio.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) + "\n");
    for (let i = 0; i < 50 && lines.length < 2; i++) await sleep(50);
    stdio.kill();
    assert.strictEqual(lines.length, 2, "notifications get no reply");
    assert.strictEqual(lines.find((l) => l.id === 1).result.protocolVersion, "2025-11-25");
    assert.strictEqual(lines.find((l) => l.id === 2).result.tools.length, 2);
    ok("MCP over stdio via agent/mcp-stdio.js");
  } finally {
    srv.kill();
    mock.server.close();
    fs.rmSync(home, { recursive: true, force: true });
  }
  /* ---------- the website's Albert function (needs npm install in web/nightcode) ---------- */
  if (fs.existsSync(path.join(__dirname, "../web/nightcode/node_modules/@anthropic-ai/sdk"))) {
    const { createMock } = require("./mock-supabase.js");
    const sb = createMock({ sysops: ["Boss"] });
    await new Promise((r) => sb.server.listen(0, "127.0.0.1", r));
    const claude2 = createMockClaude();
    await new Promise((r) => claude2.server.listen(0, "127.0.0.1", r));
    const NC = require("../web/nightcode/js/nc-api.js");
    const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
    const sbUrl = `http://127.0.0.1:${sb.server.address().port}`;
    const boss = NC.create({ url: sbUrl, anonKey: sb.ANON, storage: mem() }), pleb = NC.create({ url: sbUrl, anonKey: sb.ANON, storage: mem() });
    await boss.signUp({ email: "b@example.com", password: "password123", username: "Boss" });
    await pleb.signUp({ email: "p@example.com", password: "password123", username: "Pleb" });
    Object.assign(process.env, { NIGHTCODE_SUPABASE_URL: sbUrl, NIGHTCODE_SUPABASE_ANON_KEY: sb.ANON, ANTHROPIC_BASE_URL: `http://127.0.0.1:${claude2.server.address().port}` });
    delete process.env.ANTHROPIC_API_KEY;
    const { pathToFileURL } = require("url");
    const fn = (await import(pathToFileURL(path.join(__dirname, "../web/nightcode/netlify/functions/albert.mjs")).href)).default;
    const call = async (who, body) => {
      const r = await fn(new Request("https://nightcode.coletechsystems.com/api/albert", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, who ? { Authorization: `Bearer ${await who.accessToken()}` } : {}), body: JSON.stringify(body) }));
      const text = await r.text();
      return { status: r.status, body: /ndjson/.test(r.headers.get("content-type")) ? text.trim().split("\n").map((l) => JSON.parse(l)) : JSON.parse(text) };
    };
    const msgs = { messages: [{ role: "user", content: "hello from the website" }] };
    assert.strictEqual((await call(null, msgs)).status, 401, "signed-in members only");
    assert.strictEqual((await call(pleb, msgs)).status, 403, "sysop only by default");
    assert.strictEqual((await call(boss, msgs)).status, 412, "no key on the site yet");
    process.env.ANTHROPIC_API_KEY = claude2.key;
    const r = await call(boss, msgs);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.match(r.body.content.find((b) => b.type === "text").text, /hello from the website/);
    assert.ok(claude2.requests.at(-1).body.max_tokens <= 16000, "shorter turns on Netlify");
    const streamed = await call(boss, Object.assign({ stream: true, max_tokens: 64000 }, msgs));
    assert.strictEqual(streamed.body.at(-1).t, "done", JSON.stringify(streamed.body.at(-1)));
    assert.ok(streamed.body.some((e) => e.t === "text"));
    assert.strictEqual(claude2.requests.at(-1).body.max_tokens, 16000, "the site's cap wins");
    process.env.ALBERT_ACCESS = "members";
    assert.strictEqual((await call(pleb, msgs)).status, 200, "ALBERT_ACCESS=members opens it up");
    delete process.env.ALBERT_ACCESS; delete process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_BASE_URL;
    sb.server.close(); claude2.server.close();
    ok("website Albert function: members only, sysop by default, site key, relayed (and streamed) through the Claude SDK");
  } else console.log("skip - website Albert function (npm install in coleforge/web/nightcode)");

  console.log(`\nall albert tests passed (${passed})`);
})().catch((e) => { console.error(e); process.exit(1); });
