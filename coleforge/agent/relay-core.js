"use strict";

// Albert's link to Claude: one turn of his agent loop. The desktop runs the loop and the tools; this
// sends the conversation to the Claude API through the official SDK (the caller passes the client, so
// the same code serves the LAN server / ColeForge.exe and the website's Netlify function).
//
//   const { turn, stream } = require("./relay-core.js");
//   const reply = await turn(client, { model, system, messages, tools, effort });
//   const reply = await stream(client, body, (event) => send(event), abortSignal);   // live text
//
// What makes a turn smarter and cheaper than a bare request:
//   - adaptive thinking with summarized thoughts (Albert shows them), and an effort level you pick
//   - prompt caching: the system prompt (and tools before it) get a breakpoint, and automatic caching
//     follows the conversation's tail, so each step of a tool loop re-reads the history from cache
//   - server-side compaction on Claude Opus 5: a very long chat is summarized by the API itself
//   - server-side fallbacks on Claude Opus 5: a request its safety classifiers decline is re-run on
//     Anthropic's recommended fallback model instead of coming back as a refusal
//   - web search and web fetch run on Anthropic's side (versions picked per model)
// If the API rejects one of these extras (400 before any output), the turn is retried once without
// them and they stay off for this process, so Albert keeps working.

const MODELS = {
  "claude-opus-5": { label: "Claude Opus 5", thinking: true, effort: true, fallbacks: true, compaction: true, search: "web_search_20260209", fetch: "web_fetch_20260209" },
  "claude-sonnet-5": { label: "Claude Sonnet 5", thinking: true, effort: true, fallbacks: false, compaction: false, search: "web_search_20260209", fetch: "web_fetch_20260209" },
  "claude-haiku-4-5": { label: "Claude Haiku 4.5", thinking: false, effort: false, fallbacks: false, compaction: false, search: "web_search_20250305", fetch: null },
};
const DEFAULT_MODEL = "claude-opus-5";
const MAX_TOKENS = 32000;
const EFFORTS = ["low", "medium", "high", "xhigh", "max"];
const BETA = { fallbacks: "server-side-fallback-2026-07-01", compaction: "compact-2026-01-12" };
const degraded = new Set(); // extras the API turned down in this process: "extras"

class RelayError extends Error { constructor(status, message) { super(message); this.status = status; } }

function systemBlocks(system) {
  const blocks = typeof system === "string" ? [{ type: "text", text: system }]
    : Array.isArray(system) ? system.filter((b) => b && b.type === "text" && typeof b.text === "string").map((b) => ({ type: "text", text: b.text })) : [];
  let total = 0;
  const out = blocks.filter((b) => b.text && (total += b.text.length) <= 80000);
  return out.length ? out : undefined;
}

function clean(body, { plain = false } = {}) {
  if (!body || typeof body !== "object") throw new RelayError(400, "Send a JSON body.");
  const model = MODELS[body.model] ? body.model : DEFAULT_MODEL;
  const m = MODELS[model];
  if (!Array.isArray(body.messages) || !body.messages.length) throw new RelayError(400, "messages must be a non-empty array.");
  if (JSON.stringify(body.messages).length > 12 * 1024 * 1024) throw new RelayError(413, "The conversation is too long; start a new chat.");
  const extras = !plain && !degraded.has("extras");
  const system = systemBlocks(body.system);
  const tools = Array.isArray(body.tools) ? body.tools.slice(0, 64).map((t) => {
    // Server tools come in per-model versions.
    if (t && typeof t.type === "string" && t.type.startsWith("web_search_")) return Object.assign({}, t, { type: m.search });
    if (t && typeof t.type === "string" && t.type.startsWith("web_fetch_")) return m.fetch ? Object.assign({}, t, { type: m.fetch }) : null;
    return t;
  }).filter(Boolean) : undefined;
  const params = { model, max_tokens: Math.max(1, Math.min(MAX_TOKENS, body.max_cap | 0 || MAX_TOKENS, body.max_tokens | 0 || MAX_TOKENS)), messages: body.messages };
  if (system) params.system = system;
  if (tools?.length) params.tools = tools;
  if (m.thinking) params.thinking = extras ? { type: "adaptive", display: "summarized" } : { type: "adaptive" };
  const betas = [];
  if (extras) {
    // Tools + the fixed persona (shared by every chat), then the whole system prompt (per chat).
    if (system) { system[0].cache_control = { type: "ephemeral" }; system[system.length - 1].cache_control = { type: "ephemeral" }; }
    params.cache_control = { type: "ephemeral" };                                    // the growing tail
    if (m.effort && EFFORTS.includes(body.effort)) params.output_config = { effort: body.effort };
    if (m.compaction) { betas.push(BETA.compaction); params.context_management = { edits: [{ type: "compact_20260112" }] }; }
    if (m.fallbacks) betas.push(BETA.fallbacks);
  }
  return { params, betas, model: extras ? m : Object.assign({}, m, { fallbacks: false }) };
}

function open(client, { params, betas, model }, signal) {
  const opts = signal ? { signal } : undefined;
  if (!betas.length) return client.messages.stream(params, opts);
  const p = Object.assign({}, params, { betas });
  if (model.fallbacks) p.fallbacks = "default";
  return client.beta.messages.stream(p, opts);
}
const summary = (msg) => ({ id: msg.id, model: msg.model, content: msg.content, stop_reason: msg.stop_reason, stop_details: msg.stop_details || null, usage: msg.usage });
const extrasRejected = (e, Anthropic) => Anthropic && e instanceof Anthropic.BadRequestError && !degraded.has("extras");

// One whole turn. Streamed under the hood (long turns would otherwise hit HTTP timeouts).
const turn = (client, body, Anthropic) => stream(client, body, () => {}, undefined, Anthropic);

// Streams one turn. emit() gets small events for the window:
//   { t: "text", i, d }          a piece of Albert's reply (block index i)
//   { t: "thinking", d }         a piece of his summarized thinking
//   { t: "block", i, type, name } a block starts (tool calls, web searches, ...)
// and the promise resolves with the whole message, like turn().
async function stream(client, body, emit, signal, Anthropic) {
  let started = false;
  const run = async (req) => {
    const s = open(client, req, signal);
    for await (const ev of s) {
      started = true;
      if (ev.type === "content_block_start") {
        const b = ev.content_block;
        if (b.type !== "text" && b.type !== "thinking") emit({ t: "block", i: ev.index, type: b.type, name: b.name || null, input: b.type === "server_tool_use" ? b.input : undefined });
      } else if (ev.type === "content_block_delta") {
        if (ev.delta.type === "text_delta") emit({ t: "text", i: ev.index, d: ev.delta.text });
        else if (ev.delta.type === "thinking_delta" && ev.delta.thinking) emit({ t: "thinking", d: ev.delta.thinking });
      }
    }
    return summary(await s.finalMessage());
  };
  try { return await run(clean(body)); }
  catch (e) {
    if (started || !extrasRejected(e, Anthropic)) throw e;
    degraded.add("extras");
    return run(clean(body, { plain: true }));
  }
}

// SDK errors → a status and a sentence for Albert's window. Most specific first.
function errorOf(e, Anthropic) {
  if (e instanceof RelayError) return { status: e.status, error: e.message };
  if (Anthropic) {
    if (e instanceof Anthropic.APIUserAbortError) return { status: 499, error: "Stopped." };
    if (e instanceof Anthropic.AuthenticationError) return { status: 401, error: "The Anthropic API key was rejected. Set a working key in Albert's settings." };
    if (e instanceof Anthropic.PermissionDeniedError) return { status: 403, error: "This API key isn't allowed to use that model." };
    if (e instanceof Anthropic.NotFoundError) return { status: 404, error: "That model isn't available to this API key." };
    if (e instanceof Anthropic.RateLimitError) return { status: 429, error: "Claude is busy (rate limited). Try again in a moment." };
    if (e instanceof Anthropic.BadRequestError) return { status: 400, error: `Claude couldn't take that request: ${e.message}` };
    if (e instanceof Anthropic.APIConnectionError) return { status: 502, error: "Can't reach the Claude API from here (network)." };
    if (e instanceof Anthropic.APIError) return { status: e.status && e.status >= 500 ? 502 : e.status || 502, error: `Claude API error: ${e.message}` };
  }
  return { status: 500, error: "Albert's relay hit an error." };
}

// Answers an HTTP-ish request with either one JSON reply or, when body.stream is true, a stream of
// newline-delimited JSON events ending in { t: "done", message } or { t: "error", status, error }.
// write(line) sends a chunk; the caller has already sent the headers for the chosen mode.
async function relay(client, body, Anthropic, { write, signal }) {
  const emit = (ev) => write(JSON.stringify(ev) + "\n");
  try { emit({ t: "done", message: await stream(client, body, emit, signal, Anthropic) }); }
  catch (e) { const r = errorOf(e, Anthropic); emit({ t: "error", status: r.status, error: r.error }); }
}

module.exports = { MODELS, DEFAULT_MODEL, MAX_TOKENS, EFFORTS, BETA, RelayError, clean, turn, stream, relay, errorOf, _degraded: degraded };
