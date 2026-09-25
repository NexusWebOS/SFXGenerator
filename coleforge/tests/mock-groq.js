"use strict";
// A scripted stand-in for Groq's OpenAI-compatible API (https://api.groq.com/openai/v1), for testing
// Albert on Groq without a key. Streams Chat Completions chunks like the real thing.
//   "note ..."    -> a write_document tool call (arguments streamed in pieces)
//   "rate ..."    -> 429 once (retry-after: 1), then a normal reply
//   "search ..."  -> 400 if browser_search is offered (tests the retry without it)
//   "broken ..."  -> 400 tool_use_failed once
//   "picture"     -> says whether it got an image
//   anything else -> a short reply (with reasoning on GPT-OSS); after tool results -> "Done. ..."
//   node coleforge/tests/mock-groq.js 54500      (then GROQ_BASE_URL=http://127.0.0.1:54500/openai/v1)
const http = require("http");

function createMockGroq({ key = "gsk_test0123456789abcdefghijklmnop" } = {}) {
  const requests = [];
  const once = new Set();
  let seq = 0;
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const c of req) body += c;
    const send = (status, obj, headers = {}) => { res.writeHead(status, Object.assign({ "Content-Type": "application/json" }, headers)); res.end(JSON.stringify(obj)); };
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/__requests") return send(200, requests.slice(-8).map((r) => ({ model: r.model, tools: (r.tools || []).map((t) => t.type === "function" ? t.function.name : t.type), reasoning_effort: r.reasoning_effort, roles: r.messages.map((m) => m.role), who: r.messages[0].role === "system" ? (/Who you are:[^.]*\./.exec(r.messages[0].content) || [""])[0] : null, last: JSON.stringify(r.messages.at(-1)).slice(0, 300) })));
    if (req.headers.authorization !== `Bearer ${key}`) return send(401, { error: { message: "Invalid API Key", type: "invalid_request_error", code: "invalid_api_key" } });
    if (u.pathname === "/openai/v1/models" && req.method === "GET")
      return send(200, { object: "list", data: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "meta-llama/llama-4-scout-17b-16e-instruct", "whisper-large-v3", "brand-new-model"].map((id) => ({ id, object: "model", active: true })) });
    if (u.pathname !== "/openai/v1/chat/completions" || req.method !== "POST") return send(404, { error: { message: "Unknown request URL" } });
    const p = JSON.parse(body);
    requests.push(p);
    const last = p.messages[p.messages.length - 1];
    const said = (m) => (typeof m.content === "string" ? m.content : (m.content || []).filter((x) => x.type === "text").map((x) => x.text).join(" "));
    const lastUser = [...p.messages].reverse().find((m) => m.role === "user");
    const words = lastUser ? said(lastUser).replace(/<desktop [^>]*\/>/, "").trim() : "";
    const has = (rx) => rx.test(words) && last.role !== "tool";
    const first = (tag) => { if (once.has(tag)) return false; once.add(tag); return true; };

    if (has(/\brate\b/) && first("rate")) return send(429, { error: { message: "Rate limit reached for model", type: "tokens", code: "rate_limit_exceeded" } }, { "retry-after": "1" });
    if (has(/\bsearch\b/) && (p.tools || []).some((t) => t.type === "browser_search")) return send(400, { error: { message: "tool type browser_search is not supported for this model", type: "invalid_request_error" } });
    if (has(/\bbroken\b/) && first("broken")) return send(400, { error: { message: "Failed to call a function. Please adjust your prompt.", type: "invalid_request_error", code: "tool_use_failed" } });

    res.writeHead(200, { "Content-Type": "text/event-stream" });
    const id = `chatcmpl-${++seq}`;
    const chunk = (delta, finish = null, extra = {}) => res.write(`data: ${JSON.stringify(Object.assign({ id, object: "chat.completion.chunk", model: p.model, choices: [{ index: 0, delta, finish_reason: finish }] }, extra))}\n\n`);
    const end = (finish) => {
      chunk({}, finish, { x_groq: { usage: { prompt_tokens: 1200, completion_tokens: 30, total_tokens: 1230 } } });
      res.write("data: [DONE]\n\n"); res.end();
    };
    const text = (t) => { chunk({ role: "assistant", content: "" }); if (/gpt-oss/.test(p.model)) chunk({ reasoning: "Thinking about it. " }); for (const piece of t.match(/.{1,10}/gs)) chunk({ content: piece }); end("stop"); };
    if (last.role === "tool") {
      const results = p.messages.slice(p.messages.findLastIndex((m) => m.role === "assistant") + 1).filter((m) => m.role === "tool");
      return text(`Done. ${results.map((r) => r.content).join(" | ").slice(0, 200)}`);
    }
    if (has(/\bnote\b/)) {
      const args = JSON.stringify({ name: "groq-note.txt", text: "Albert on Groq was here.", mode: "overwrite" });
      chunk({ role: "assistant", content: null, tool_calls: [{ index: 0, id: `call_${seq}`, type: "function", function: { name: "write_document", arguments: "" } }] });
      chunk({ tool_calls: [{ index: 0, function: { arguments: args.slice(0, 20) } }] });
      chunk({ tool_calls: [{ index: 0, function: { arguments: args.slice(20) } }] });
      return end("tool_calls");
    }
    if (has(/\bpicture\b/)) {
      const pics = (Array.isArray(lastUser.content) ? lastUser.content : []).filter((x) => x.type === "image_url").length;
      return text(`I got ${pics} picture(s).`);
    }
    return text(`Hi! I'm Albert on Groq (mock). You said: ${words.slice(0, 80)}`);
  });
  return { server, requests, key };
}

module.exports = { createMockGroq };
if (require.main === module) {
  const m = createMockGroq();
  m.server.listen(+process.argv[2] || 54500, "127.0.0.1", () => console.log(`mock Groq on http://127.0.0.1:${m.server.address().port}/openai/v1 (key ${m.key})`));
}
