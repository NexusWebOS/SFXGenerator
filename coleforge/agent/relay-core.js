"use strict";

// Albert's link to Claude: one turn of his agent loop. The desktop runs the loop and the tools; this
// sends the conversation to the Claude API through the official SDK (the caller passes the client, so
// the same code serves the LAN server / ColeForge.exe and the website's Netlify function).
//
//   const { turn } = require("./relay-core.js");
//   const reply = await turn(client, { model, system, messages, tools });

const MODELS = {
  // Claude Opus 5 is the default. Server-side fallbacks ("default") re-run a request its safety
  // classifiers decline on Anthropic's recommended fallback model instead of returning a refusal.
  "claude-opus-5": { label: "Claude Opus 5", thinking: true, fallbacks: true, search: "web_search_20260209" },
  "claude-sonnet-5": { label: "Claude Sonnet 5", thinking: true, fallbacks: false, search: "web_search_20260209" },
  "claude-haiku-4-5": { label: "Claude Haiku 4.5", thinking: false, fallbacks: false, search: "web_search_20250305" },
};
const DEFAULT_MODEL = "claude-opus-5";
const MAX_TOKENS = 16000;

class RelayError extends Error { constructor(status, message) { super(message); this.status = status; } }

function clean(body) {
  if (!body || typeof body !== "object") throw new RelayError(400, "Send a JSON body.");
  const model = MODELS[body.model] ? body.model : DEFAULT_MODEL;
  const m = MODELS[model];
  if (!Array.isArray(body.messages) || !body.messages.length) throw new RelayError(400, "messages must be a non-empty array.");
  if (JSON.stringify(body.messages).length > 4 * 1024 * 1024) throw new RelayError(413, "The conversation is too long; start a new chat.");
  const system = typeof body.system === "string" ? body.system.slice(0, 60000) : undefined;
  const tools = Array.isArray(body.tools) ? body.tools.slice(0, 64).map((t) => {
    // The web search server tool comes in per-model versions.
    if (t && typeof t.type === "string" && t.type.startsWith("web_search_")) return Object.assign({}, t, { type: m.search });
    return t;
  }) : undefined;
  const params = { model, max_tokens: Math.max(1, Math.min(MAX_TOKENS, body.max_tokens | 0 || MAX_TOKENS)), messages: body.messages };
  if (system) params.system = system;
  if (tools?.length) params.tools = tools;
  if (m.thinking) params.thinking = { type: "adaptive" };
  return { params, model: m };
}

async function turn(client, body) {
  const { params, model } = clean(body);
  const msg = model.fallbacks
    ? await client.beta.messages.create(Object.assign({}, params, { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }))
    : await client.messages.create(params);
  return { id: msg.id, model: msg.model, content: msg.content, stop_reason: msg.stop_reason, stop_details: msg.stop_details || null, usage: msg.usage };
}

// SDK errors → a status and a sentence for Albert's window. Most specific first.
function errorOf(e, Anthropic) {
  if (e instanceof RelayError) return { status: e.status, error: e.message };
  if (Anthropic) {
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

module.exports = { MODELS, DEFAULT_MODEL, MAX_TOKENS, RelayError, clean, turn, errorOf };
