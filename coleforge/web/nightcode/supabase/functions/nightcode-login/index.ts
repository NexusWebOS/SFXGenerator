// nightcode-login: sign in with a NightCode username instead of an email address.
//
//   POST { "username": "...", "password": "..." }  ->  the Supabase session (access_token, refresh_token, ...)
//
// The email address behind a username never leaves the server. Deploy with:
//   supabase functions deploy nightcode-login --no-verify-jwt
// It uses the SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY secrets every function gets.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED = (Deno.env.get("NIGHTCODE_ORIGINS") ?? "https://nightcode.coletechsystems.com,http://localhost:8098,http://127.0.0.1:8098,http://localhost:8765")
  .split(",").map((s) => s.trim()).filter(Boolean);

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  // ColeForge.exe serves its shell from localhost on a port chosen at start, so any localhost origin is let in.
  const ok = ALLOWED.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : ALLOWED[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "POST only" });
  let username = "", password = "";
  try { ({ username = "", password = "" } = await req.json()); } catch { /* bad body */ }
  username = String(username).trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(username) || !password) return json(req, 400, { error: "Enter your username and password." });

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const denied = () => json(req, 401, { error: "ACCESS DENIED: wrong username or password." });

  const { data: prof } = await admin.from("nc_profiles").select("id").ilike("username", username.replace(/_/g, "\\_")).maybeSingle();
  if (!prof) return denied();
  const { data: u } = await admin.auth.admin.getUserById(prof.id);
  const email = u?.user?.email;
  if (!email) return denied();

  const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error) {
    if (/confirm/i.test(error.message)) return json(req, 403, { error: "Your account isn't activated yet: open the link in your email." });
    return denied();
  }
  return json(req, 200, data.session);
});
