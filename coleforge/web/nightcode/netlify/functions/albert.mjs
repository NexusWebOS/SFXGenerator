// Albert on the NightCode website: one turn for the desktop's Albert (POST /api/albert), streamed when the
// page asks for it ({ stream: true }); GET /api/albert says which models the site can run.
// Claude models use the official Claude SDK and ANTHROPIC_API_KEY; "groq:..." models (free open models on
// Groq) use GROQ_API_KEY. Both are Netlify environment variables and stay on the server. Callers must be
// signed in to NightCode Net; by default only the sysop may use Albert here - set ALBERT_ACCESS=members to
// open it to every member.
import Anthropic from "@anthropic-ai/sdk";
import core from "../../../../agent/relay-core.js";
import groq from "../../../../agent/groq.js";

const SB = (process.env.NIGHTCODE_SUPABASE_URL || "https://wjfzxeqztbvnrnlgarvn.supabase.co").replace(/\/+$/, "");
const SITE = "https://nightcode.coletechsystems.com";
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": SITE } });

async function member(req) {
  const anon = process.env.NIGHTCODE_SUPABASE_ANON_KEY;
  const auth = req.headers.get("authorization") || "";
  if (!anon || !/^Bearer \S+$/.test(auth)) return null;
  const u = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: anon, Authorization: auth } });
  if (!u.ok) return null;
  const user = await u.json();
  const p = await fetch(`${SB}/rest/v1/nc_profiles?id=eq.${encodeURIComponent(user.id)}&select=username,role`, { headers: { apikey: anon, Authorization: auth } });
  const [prof] = p.ok ? await p.json() : [];
  return prof || null;
}

export default async (req) => {
  if (req.method !== "POST" && req.method !== "GET") return reply(405, { error: "POST (a turn) or GET (what's available)" });
  const who = await member(req);
  if (!who) return reply(401, { error: "Sign in at the NightCode-DOS prompt first; Albert runs on your NightCode account." });
  if ((process.env.ALBERT_ACCESS || "sysop") !== "members" && who.role !== "sysop") return reply(403, { error: "Albert on the website is for the sysop for now." });
  const keys = { anthropic: process.env.ANTHROPIC_API_KEY || null, groq: process.env.GROQ_API_KEY || null };
  if (req.method === "GET") {
    const models = [...(keys.anthropic ? Object.entries(core.MODELS).map(([id, m]) => ({ id, label: m.label, provider: "anthropic", vision: true })) : []), ...(keys.groq ? await groq.models(keys.groq) : [])];
    return reply(200, { hosted: true, key: !!keys.anthropic, groq: !!keys.groq, models, default_model: keys.anthropic ? core.DEFAULT_MODEL : groq.DEFAULT });
  }
  let body;
  try { body = await req.json(); } catch { return reply(400, { error: "Send JSON." }); }
  const onGroq = groq.isGroq(body.model);
  if (onGroq && !keys.groq) return reply(412, { error: "The site has no Groq API key yet (GROQ_API_KEY on Netlify)." });
  if (!onGroq && !keys.anthropic) return reply(412, { error: keys.groq ? "The site has no Anthropic key; pick a Groq model in Albert's settings." : "The site has no API key yet (ANTHROPIC_API_KEY or GROQ_API_KEY on Netlify)." });
  const client = onGroq ? null : new Anthropic({ apiKey: keys.anthropic, maxRetries: 1, timeout: 25000 });
  body = Object.assign({}, body, { max_cap: 16000 });
  if (!body.stream) {
    try { return reply(200, onGroq ? await groq.stream(keys.groq, body, () => {}, req.signal) : await core.turn(client, body, Anthropic)); }
    catch (e) { const r = core.errorOf(e, Anthropic); return reply(r.status, { error: r.error }); }
  }
  // Streamed: Albert's words reach the page as the model writes them (newline-delimited JSON events).
  const enc = new TextEncoder();
  const out = new ReadableStream({
    async start(ctrl) {
      await core.relay(client, body, Anthropic, { write: (line) => ctrl.enqueue(enc.encode(line)), signal: req.signal, groqKey: keys.groq });
      ctrl.close();
    },
  });
  return new Response(out, { status: 200, headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": SITE } });
};

export const config = { path: "/api/albert" };
