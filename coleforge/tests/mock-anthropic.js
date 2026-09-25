"use strict";
// A scripted stand-in for the Claude Messages API, for testing Albert without spending credit.
// It checks what the SDK sends and answers like a (very simple) model that uses Albert's tools:
//   "note ..."      -> write_document       "remember ..." -> remember
//   "play ..."      -> nightamp status      "apps"         -> list_apps
//   anything else   -> a short text reply;  after tool results -> a summary of them.
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
    if (u.pathname !== "/v1/messages" || req.method !== "POST") return send(404, { type: "error", error: { type: "not_found_error", message: "nope" } });
    if (req.headers["x-api-key"] !== key) return send(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } });
    let p;
    try { p = JSON.parse(body); } catch { return send(400, { type: "error", error: { type: "invalid_request_error", message: "bad json" } }); }
    requests.push({ headers: req.headers, body: p, beta: u.searchParams.get("beta") });
    const last = p.messages[p.messages.length - 1];
    const blocks = Array.isArray(last.content) ? last.content : [{ type: "text", text: last.content }];
    const toolResults = blocks.filter((b) => b.type === "tool_result");
    const said = blocks.filter((b) => b.type === "text").map((b) => b.text).filter((t) => !t.startsWith("<desktop ")).join(" ");
    const msg = (content, stop_reason) => send(200, { id: `msg_${++seq}`, type: "message", role: "assistant", model: p.model, content, stop_reason, stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } });
    const thinking = p.thinking ? [{ type: "thinking", thinking: "", signature: `sig_${seq}` }] : [];
    const use = (name, input) => msg([...thinking, { type: "text", text: `On it.` }, { type: "tool_use", id: `toolu_${seq}_${name}`, name, input }], "tool_use");
    if (toolResults.length) {
      const summary = toolResults.map((r) => `${r.is_error ? "error: " : ""}${typeof r.content === "string" ? r.content : JSON.stringify(r.content)}`.slice(0, 160)).join(" | ");
      return msg([...thinking, { type: "text", text: `Done. ${summary}` }], "end_turn");
    }
    if (/\bnote\b/i.test(said)) return use("write_document", { name: "albert-note.txt", text: "Albert was here. " + said, mode: "overwrite" });
    if (/\bremember\b/i.test(said)) return use("remember", { note: said.replace(/.*remember( that)?/i, "").trim() || said });
    if (/\bplay\b/i.test(said)) return use("nightamp", { action: "status" });
    if (/\bapps\b/i.test(said)) return use("list_apps", {});
    if (/\brefuse\b/i.test(said)) return send(200, { id: `msg_${++seq}`, type: "message", role: "assistant", model: p.model, content: [], stop_reason: "refusal", stop_details: { type: "refusal", category: null, explanation: "test" }, usage: { input_tokens: 1, output_tokens: 0 } });
    return msg([...thinking, { type: "text", text: `Hi! I'm Albert (mock). You said: **${said.slice(0, 80)}**` }], "end_turn");
  });
  return { server, requests, key };
}

module.exports = { createMockClaude };
if (require.main === module) {
  const m = createMockClaude({ key: process.env.MOCK_KEY || undefined });
  m.server.listen(+process.argv[2] || 54400, "127.0.0.1", () => console.log(`mock Claude API on http://127.0.0.1:${m.server.address().port} (key ${m.key})`));
}
