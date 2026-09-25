"use strict";

// Albert on Groq (free tier): runs a turn on an open model hosted by Groq (GPT-OSS, Llama, ...) through
// Groq's OpenAI-compatible Chat Completions API. Albert's desktop keeps every chat in the Claude
// Messages format, so this translates on the way in and out: the desktop's agent loop, tools,
// approvals, memory and the Albert API work the same whichever model answers.
//
//   in:  { model: "groq:openai/gpt-oss-120b", system, messages, tools, effort }   (Claude format)
//   out: { id, model, content: [text / tool_use blocks], stop_reason, usage }    (Claude format)
//
// Groq has no Claude server tools; web search is Groq's own browser_search on the GPT-OSS models.
// Needs Node 18+ (fetch). GROQ_BASE_URL points it somewhere else (tests).

const BASE = () => (process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/+$/, "");
const PREFIX = "groq:";
const MAX_TOKENS = 8192;

// What Albert knows about Groq's models (the live list from Groq is merged in by models()).
const KNOWN = {
  "openai/gpt-oss-120b": { label: "GPT-OSS 120B", note: "smartest free", reasoning: true, search: true },
  "openai/gpt-oss-20b": { label: "GPT-OSS 20B", note: "fastest", reasoning: true, search: true },
  "meta-llama/llama-4-maverick-17b-128e-instruct": { label: "Llama 4 Maverick", note: "sees pictures", vision: true },
  "meta-llama/llama-4-scout-17b-16e-instruct": { label: "Llama 4 Scout", note: "sees pictures", vision: true },
  "llama-3.3-70b-versatile": { label: "Llama 3.3 70B" },
  "moonshotai/kimi-k2-instruct": { label: "Kimi K2" },
  "qwen/qwen3-32b": { label: "Qwen3 32B" },
};
const DEFAULT = "groq:openai/gpt-oss-120b";
const info = (id) => KNOWN[id] || { label: id };
const isGroq = (model) => typeof model === "string" && model.startsWith(PREFIX);
const degraded = new Set();   // model ids Groq turned browser_search down for

class GroqError extends Error { constructor(status, message, extra) { super(message); this.status = status; Object.assign(this, extra); } }

/* ---------------- Claude format → OpenAI chat format ---------------- */
const textOf = (content) => (typeof content === "string" ? content : (content || []).map((b) => (b.type === "text" ? b.text : b.type === "image" ? "[a picture]" : "")).filter(Boolean).join("\n"));

function toOpenAI({ system, messages }, id) {
  const vision = !!info(id).vision;
  const out = [];
  const sys = typeof system === "string" ? system : (system || []).map((b) => b.text).join("\n\n");
  if (sys) out.push({ role: "system", content: sys });
  for (const m of messages) {
    if (m.role === "assistant") {
      const blocks = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content || [];
      const text = blocks.map((b) => (b.type === "text" ? b.text : b.type === "compaction" && typeof b.content === "string" ? `[Summary of the earlier conversation]\n${b.content}` : "")).filter(Boolean).join("\n\n");
      const calls = blocks.filter((b) => b.type === "tool_use").map((b) => ({ id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input || {}) } }));
      if (!text && !calls.length) continue;                 // thinking-only / server-tool-only turns from Claude
      out.push(Object.assign({ role: "assistant", content: text || null }, calls.length ? { tool_calls: calls } : {}));
      continue;
    }
    // user: tool results become "tool" messages (first, right after the assistant's calls), the rest a user message.
    const blocks = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content || [];
    const pics = [];                                         // pictures from tool results go after all the tool messages
    for (const b of blocks.filter((x) => x.type === "tool_result")) {
      let content = textOf(b.content);
      if (Array.isArray(b.content) && b.content.some((c) => c.type === "image")) content += vision ? "\n(The picture follows in the next message.)" : "\n(This model can't see pictures; ask Cole to switch Albert to a model that can.)";
      out.push({ role: "tool", tool_call_id: b.tool_use_id, content: (b.is_error ? "Error: " : "") + (content || "Done.") });
      if (vision && Array.isArray(b.content)) for (const c of b.content) if (c.type === "image" && c.source?.type === "base64") pics.push({ type: "image_url", image_url: { url: `data:${c.source.media_type};base64,${c.source.data}` } });
    }
    const parts = [...pics];
    for (const b of blocks) {
      if (b.type === "text" && b.text) parts.push({ type: "text", text: b.text });
      else if (b.type === "image" && b.source?.type === "base64") parts.push(vision ? { type: "image_url", image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } } : { type: "text", text: "[Cole attached a picture, but this model can't see pictures. Say so, and suggest a model that can.]" });
    }
    if (parts.length) out.push({ role: "user", content: parts.every((p) => p.type === "text") ? parts.map((p) => p.text).join("\n") : parts });
  }
  return out;
}

function toolsFor(tools, id, withSearch) {
  const out = [];
  for (const t of tools || []) {
    if (t.type && t.type.startsWith("web_search_")) { if (withSearch) out.push({ type: "browser_search" }); continue; }
    if (t.type) continue;                                   // other Claude server tools (web fetch): not on Groq
    out.push({ type: "function", function: { name: t.name, description: t.description || "", parameters: t.input_schema || { type: "object", properties: {} } } });
  }
  return out;
}

/* ---------------- one turn, streamed ---------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const safeId = (id, i) => "toolu_" + (String(id || "").replace(/[^A-Za-z0-9_-]/g, "") || `groq${Date.now().toString(36)}${i}`);

async function post(key, payload, signal) {
  let res;
  try {
    res = await fetch(BASE() + "/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "text/event-stream" }, body: JSON.stringify(payload), signal });
  } catch (e) {
    if (e.name === "AbortError") throw new GroqError(499, "Stopped.");
    throw new GroqError(502, "Can't reach Groq from here (network).");
  }
  if (res.ok) return res;
  const body = await res.json().catch(() => ({}));
  const err = body.error || {};
  const msg = err.message || `Groq said ${res.status}.`;
  if (res.status === 401) throw new GroqError(401, "The Groq API key was rejected. Set a working key in Albert's settings (console.groq.com → API Keys).");
  if (res.status === 404) throw new GroqError(404, `Groq doesn't have that model (${payload.model}). Pick another in Albert's settings.`);
  if (res.status === 429) throw new GroqError(429, "Groq's free-tier limit is used up for the moment. Wait a minute (or pick a smaller model) and try again.", { retryAfter: +res.headers.get("retry-after") || 0 });
  if (res.status === 413) throw new GroqError(413, "This chat is too long for Groq's free tier. Start a new chat.");
  throw new GroqError(res.status >= 500 ? 502 : 400, `Groq: ${msg}`, { code: err.code });
}

async function once(key, body, emit, signal, withSearch) {
  const id = body.model.slice(PREFIX.length);
  const k = info(id);
  const tools = toolsFor(body.tools, id, withSearch && k.search);
  const payload = { model: id, messages: toOpenAI(body, id), stream: true, stream_options: { include_usage: true }, max_tokens: Math.max(1, Math.min(body.max_cap | 0 || MAX_TOKENS, body.max_tokens | 0 || MAX_TOKENS, MAX_TOKENS)) };
  if (tools.length) payload.tools = tools;
  if (k.reasoning) payload.reasoning_effort = { low: "low", medium: "medium", high: "high", xhigh: "high", max: "high" }[body.effort] || "medium";
  const res = await post(key, payload, signal);

  let text = "", finish = null, usage = null, msgId = null;
  const calls = [];                                        // by index: { id, name, args }
  let textIndex = -1;
  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = "";
  const handle = (data) => {
    if (data === "[DONE]") return;
    const c = JSON.parse(data);
    if (c.error) throw new GroqError(502, `Groq: ${c.error.message || "stream error"}`);
    msgId = msgId || c.id;
    usage = c.usage || c.x_groq?.usage || usage;
    const ch = c.choices?.[0];
    if (!ch) return;
    const d = ch.delta || {};
    if (d.reasoning) emit({ t: "thinking", d: d.reasoning });
    if (d.content) { if (textIndex < 0) textIndex = 0; text += d.content; emit({ t: "text", i: 0, d: d.content }); }
    for (const tc of d.tool_calls || []) {
      const i = tc.index ?? calls.length;
      if (!calls[i]) { calls[i] = { id: tc.id, name: tc.function?.name || "", args: "" }; if (calls[i].name) emit({ t: "block", i: i + 1, type: "tool_use", name: calls[i].name }); }
      if (tc.id) calls[i].id = tc.id;
      if (tc.function?.name && !calls[i].name) calls[i].name = tc.function.name;
      if (tc.function?.arguments) calls[i].args += tc.function.arguments;
    }
    if (ch.finish_reason) finish = ch.finish_reason;
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (line.startsWith("data:")) handle(line.slice(5).trim());
    }
  }
  if (buf.trim().startsWith("data:")) handle(buf.trim().slice(5).trim());

  const content = [];
  if (text) content.push({ type: "text", text });
  calls.filter(Boolean).forEach((c, i) => {
    let input;
    try { input = c.args ? JSON.parse(c.args) : {}; } catch { input = null; }
    // A tool call whose arguments aren't JSON is sent back to the model as an error by the desktop loop.
    content.push({ type: "tool_use", id: safeId(c.id, i), name: c.name, input: input && typeof input === "object" ? input : { INVALID_JSON: c.args } });
  });
  const stop = finish === "tool_calls" || (calls.length && finish !== "length") ? "tool_use" : finish === "length" ? "max_tokens" : finish === "content_filter" ? "refusal" : "end_turn";
  return {
    id: msgId || `groq_${Date.now()}`, model: body.model, content, stop_reason: stop, stop_details: null,
    usage: { input_tokens: usage?.prompt_tokens || 0, output_tokens: usage?.completion_tokens || 0, cache_read_input_tokens: usage?.prompt_tokens_details?.cached_tokens || 0, cache_creation_input_tokens: 0 },
  };
}

// Retries: once without browser_search if Groq turns it down, once more after a short rate-limit wait,
// and once when the model wrote a broken tool call (Groq's "tool_use_failed").
async function stream(key, body, emit, signal) {
  if (!key) throw new GroqError(412, "Albert needs a Groq API key for this model. Open Albert's settings to add one (console.groq.com → API Keys, free).");
  if (!body || !Array.isArray(body.messages) || !body.messages.length) throw new GroqError(400, "messages must be a non-empty array.");
  const id = String(body.model).slice(PREFIX.length);
  let search = !degraded.has(id), waited = false, redo = false;
  for (;;) {
    try { return await once(key, body, emit, signal, search); }
    catch (e) {
      if (!(e instanceof GroqError)) throw e;
      if (e.status === 400 && search && info(id).search && /browser_search|tool type|tools/i.test(e.message)) { degraded.add(id); search = false; continue; }
      if (e.status === 400 && e.code === "tool_use_failed" && !redo) { redo = true; continue; }
      if (e.status === 429 && !waited && e.retryAfter && e.retryAfter <= 20) { waited = true; await sleep(e.retryAfter * 1000); continue; }
      throw e;
    }
  }
}

/* ---------------- the model list ---------------- */
let cache = { at: 0, key: "", list: null };
const SKIP = /whisper|tts|playai|guard|distil|prompt-guard|orpheus|embed|allam/i;
async function models(key) {
  const known = Object.entries(KNOWN).map(([id, k]) => ({ id: PREFIX + id, label: `${k.label} (Groq${k.note ? `, ${k.note}` : ""})`, provider: "groq", vision: !!k.vision }));
  if (!key) return known;
  if (cache.key === key && Date.now() - cache.at < 600000 && cache.list) return cache.list;
  try {
    const r = await fetch(BASE() + "/models", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return known;
    const live = ((await r.json()).data || []).filter((m) => m.active !== false && !SKIP.test(m.id)).map((m) => m.id);
    const list = [...known.filter((m) => live.includes(m.id.slice(PREFIX.length))),
      ...live.filter((id) => !KNOWN[id]).sort().map((id) => ({ id: PREFIX + id, label: `${id} (Groq)`, provider: "groq", vision: /vision|llama-4/i.test(id) }))];
    cache = { at: Date.now(), key, list: list.length ? list : known };
    return cache.list;
  } catch { return known; }
}

module.exports = { stream, models, isGroq, toOpenAI, toolsFor, GroqError, KNOWN, DEFAULT, PREFIX, _degraded: degraded };
