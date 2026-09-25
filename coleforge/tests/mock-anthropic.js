"use strict";
// A scripted stand-in for the Claude Messages API, for testing Albert without spending credit.
// It checks what the SDK sends and answers like a (very simple) model that uses Albert's tools:
//   "note ..."      -> write_document       "remember ..." -> remember
//   "play ..."      -> nightamp status      "apps"         -> list_apps
//   "calc ..."      -> run_javascript       "find ..."     -> search_documents
//   "look ..."      -> read_document of the named .png   "ramble" -> stops at max_tokens
//   "reject extras" -> 400 when the request carries caching/effort extras (tests the fallback)
//   anything else   -> a short text reply;  after tool results -> a summary of them.
// Streams (server-sent events) when the request says stream: true, like the real API.
//   node coleforge/tests/mock-anthropic.js 54400
const http = require("http");

function createMockClaude({ key = "sk-ant-test-0123456789abcdefghijklmnop" } = {}) {
  const requests = [];
  let seq = 0;
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const c of req) body += c;
    const send = (status, obj) => { res.writeHead(status, { "Content-Type": "application/json", "request-id": "req_mock" }); res.end(JSON.stringify(obj)); };
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/__requests" && req.method === "GET")                  // for browser tests
      return send(200, requests.slice(-8).map((r) => ({ model: r.body.model, stream: !!r.body.stream, thinking: r.body.thinking, output_config: r.body.output_config, cache_control: r.body.cache_control,
        system: (r.body.system || []).map((b) => ({ chars: b.text.length, cached: !!b.cache_control })), tools: (r.body.tools || []).map((t) => t.type || t.name), beta: r.headers["anthropic-beta"] || null,
        last: JSON.stringify(r.body.messages.at(-1)).slice(0, 400) })));
    if (u.pathname !== "/v1/messages" || req.method !== "POST") return send(404, { type: "error", error: { type: "not_found_error", message: "nope" } });
    if (req.headers["x-api-key"] !== key) return send(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } });
    let p;
    try { p = JSON.parse(body); } catch { return send(400, { type: "error", error: { type: "invalid_request_error", message: "bad json" } }); }
    requests.push({ headers: req.headers, body: p, beta: u.searchParams.get("beta") });
    const extras = p.cache_control || p.output_config || p.context_management;
    const last = p.messages[p.messages.length - 1];
    const blocks = Array.isArray(last.content) ? last.content : [{ type: "text", text: last.content }];
    const toolResults = blocks.filter((b) => b.type === "tool_result");
    const said = blocks.filter((b) => b.type === "text").map((b) => b.text).filter((t) => !t.startsWith("<desktop ")).join(" ");
    const cached = requests.length > 1 && p.cache_control ? 900 : 0;
    const msg = (content, stop_reason, extra) => {
      const m = { id: `msg_${++seq}`, type: "message", role: "assistant", model: p.model, content, stop_reason, stop_sequence: null, ...extra,
        usage: { input_tokens: 100, output_tokens: 20, cache_creation_input_tokens: p.cache_control ? 50 : 0, cache_read_input_tokens: cached } };
      return p.stream ? sse(m) : send(200, m);
    };
    // The real API's event stream for a finished message.
    const sse = (m) => {
      res.writeHead(200, { "Content-Type": "text/event-stream", "request-id": "req_mock" });
      const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify(Object.assign({ type }, data))}\n\n`);
      ev("message_start", { message: Object.assign({}, m, { content: [], stop_reason: null, usage: Object.assign({}, m.usage, { output_tokens: 1 }) }) });
      m.content.forEach((b, index) => {
        if (b.type === "text") {
          ev("content_block_start", { index, content_block: { type: "text", text: "" } });
          for (const piece of b.text.match(/.{1,12}/gs) || []) ev("content_block_delta", { index, delta: { type: "text_delta", text: piece } });
        } else if (b.type === "thinking") {
          ev("content_block_start", { index, content_block: { type: "thinking", thinking: "", signature: "" } });
          if (b.thinking) ev("content_block_delta", { index, delta: { type: "thinking_delta", thinking: b.thinking } });
          ev("content_block_delta", { index, delta: { type: "signature_delta", signature: b.signature } });
        } else if (b.type === "tool_use") {
          ev("content_block_start", { index, content_block: { type: "tool_use", id: b.id, name: b.name, input: {} } });
          ev("content_block_delta", { index, delta: { type: "input_json_delta", partial_json: JSON.stringify(b.input) } });
        }
        ev("content_block_stop", { index });
      });
      ev("message_delta", { delta: { stop_reason: m.stop_reason, stop_sequence: null }, usage: { output_tokens: m.usage.output_tokens } });
      ev("message_stop", {});
      res.end();
    };
    const summarized = p.thinking?.display === "summarized";
    const thinking = p.thinking ? [{ type: "thinking", thinking: summarized ? "Let me think about what Cole needs." : "", signature: `sig_${seq}` }] : [];
    const use = (name, input) => msg([...thinking, { type: "text", text: `On it.` }, { type: "tool_use", id: `toolu_${seq}_${name}`, name, input }], "tool_use");
    if (toolResults.length) {
      const summary = toolResults.map((r) => `${r.is_error ? "error: " : ""}${typeof r.content === "string" ? r.content : JSON.stringify(r.content)}`.slice(0, 160)).join(" | ");
      return msg([...thinking, { type: "text", text: `Done. ${summary}` }], "end_turn");
    }
    if (/reject extras/i.test(said) && extras) return send(400, { type: "error", error: { type: "invalid_request_error", message: "context_management: unknown field (mock)" } });
    if (/\bramble\b/i.test(said)) return msg([...thinking, { type: "text", text: "Once upon a time there was a very long answer that" }, { type: "tool_use", id: `toolu_${seq}_cut`, name: "notify", input: { body: "never" } }], "max_tokens");
    if (/\bcalc\b/i.test(said)) return use("run_javascript", { code: "let s = 0; for (let i = 1; i <= 100; i++) s += i; console.log('summing'); return s;" });
    if (/\bfind\b/i.test(said)) return use("search_documents", { query: said.replace(/.*\bfind\b/i, "").trim() || "albert" });
    if (/\blook\b/i.test(said)) return use("read_document", { name: (/[\w-]+\.png/.exec(said) || ["pic.png"])[0] });
    if (/\bnote\b/i.test(said)) return use("write_document", { name: "albert-note.txt", text: "Albert was here. " + said, mode: "overwrite" });
    if (/\bremember\b/i.test(said)) return use("remember", { note: said.replace(/.*remember( that)?/i, "").trim() || said });
    if (/\bplay\b/i.test(said)) return use("nightamp", { action: "status" });
    if (/\bapps\b/i.test(said)) return use("list_apps", {});
    if (/\brefuse\b/i.test(said)) return msg([], "refusal", { stop_details: { type: "refusal", category: null, explanation: "test" } });
    return msg([...thinking, { type: "text", text: `Hi! I'm Albert (mock). You said: **${said.slice(0, 80)}**` }], "end_turn");
  });
  return { server, requests, key };
}

module.exports = { createMockClaude };
if (require.main === module) {
  const m = createMockClaude({ key: process.env.MOCK_KEY || undefined });
  m.server.listen(+process.argv[2] || 54400, "127.0.0.1", () => console.log(`mock Claude API on http://127.0.0.1:${m.server.address().port} (key ${m.key})`));
}
