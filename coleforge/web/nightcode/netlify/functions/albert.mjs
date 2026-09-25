// Albert on the NightCode website: one Claude turn for the desktop's Albert (POST /api/albert).
// The Claude SDK and the Anthropic API key (ANTHROPIC_API_KEY, a Netlify environment variable) stay on
// the server. Callers must be signed in to NightCode Net; by default only the sysop may use Albert here
// (each turn costs API credit) - set ALBERT_ACCESS=members to open it to every member.
import Anthropic from "@anthropic-ai/sdk";
import core from "../../../../agent/relay-core.js";

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
  if (req.method !== "POST") return reply(405, { error: "POST only" });
  const who = await member(req);
  if (!who) return reply(401, { error: "Sign in at the NightCode-DOS prompt first; Albert runs on your NightCode account." });
  if ((process.env.ALBERT_ACCESS || "sysop") !== "members" && who.role !== "sysop") return reply(403, { error: "Albert on the website is for the sysop for now." });
  if (!process.env.ANTHROPIC_API_KEY) return reply(412, { error: "The site has no Anthropic API key yet (ANTHROPIC_API_KEY on Netlify)." });
  let body;
  try { body = await req.json(); } catch { return reply(400, { error: "Send JSON." }); }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 25000 });
  try { return reply(200, await core.turn(client, Object.assign({}, body, { max_tokens: Math.min(body.max_tokens || 8000, 8000) }))); }
  catch (e) { const r = core.errorOf(e, Anthropic); return reply(r.status, { error: r.error }); }
};

export const config = { path: "/api/albert" };
