"use strict";
// A stand-in for the parts of Supabase NightCode Net uses (GoTrue auth, PostgREST, the
// nightcode-login function), enforcing the same rules as the migration's row level security.
// Used by tests/nightcode.test.js and for trying the site offline:
//   node coleforge/tests/mock-supabase.js 54321
const http = require("http");
const crypto = require("crypto");

function createMock({ autoconfirm = true, tokenTtl = 3600 } = {}) {
  const ANON = "mock-anon-key";
  const users = new Map();      // id -> { id, email, password, confirmed, meta }
  const profiles = new Map();   // id -> nc_profiles row
  const posts = [];
  const tokens = new Map();     // access -> { uid, exp }
  const refreshes = new Map();  // refresh -> uid
  let postSeq = 0;
  const log = [];
  const now = () => Math.floor(Date.now() / 1000);

  function session(uid) {
    const access = crypto.randomBytes(16).toString("hex"), refresh = crypto.randomBytes(16).toString("hex");
    tokens.set(access, { uid, exp: now() + tokenTtl });
    refreshes.set(refresh, uid);
    const u = users.get(uid);
    return { access_token: access, refresh_token: refresh, token_type: "bearer", expires_in: tokenTtl, expires_at: now() + tokenTtl, user: { id: uid, email: u.email, user_metadata: u.meta } };
  }
  function authUid(req) {
    const t = (req.headers.authorization || "").replace(/^Bearer /, "");
    const s = tokens.get(t);
    return s && s.exp > now() ? s.uid : null;
  }
  // the migration's trigger
  function newProfile(uid, meta) {
    let uname = (meta.username || "").trim() || "user_" + uid.slice(0, 8);
    if (!/^[A-Za-z0-9_]{3,16}$/.test(uname)) throw { status: 422, msg: "Usernames are 3-16 letters, numbers or underscores." };
    if ([...profiles.values()].some((p) => p.username.toLowerCase() === uname.toLowerCase())) throw { status: 422, msg: "That username is taken." };
    profiles.set(uid, { id: uid, username: uname, display_name: meta.display_name || uname, bio: "", role: "user", created_at: new Date().toISOString(), last_seen: null });
  }
  const pub = (p) => ({ username: p.username, display_name: p.display_name, bio: p.bio, role: p.role, created_at: p.created_at, last_seen: p.last_seen });

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" });
      res.end(body === undefined ? "" : JSON.stringify(body));
    };
    if (req.method === "OPTIONS") return send(204);
    let body = "";
    for await (const c of req) body += c;
    let data = {};
    try { data = body ? JSON.parse(body) : {}; } catch { return send(400, { message: "bad json" }); }
    log.push(`${req.method} ${u.pathname}`);
    if (req.headers.apikey !== ANON) return send(401, { message: "No API key found in request" });
    const uid = authUid(req);
    const p = u.pathname;
    try {
      /* ---------- auth ---------- */
      if (p === "/auth/v1/health") return send(200, { name: "GoTrue" });
      if (p === "/auth/v1/signup" && req.method === "POST") {
        if ([...users.values()].some((x) => x.email === data.email)) return send(422, { msg: "User already registered" });
        if (!data.password || data.password.length < 6) return send(422, { msg: "Password should be at least 6 characters." });
        const id = crypto.randomUUID();
        users.set(id, { id, email: data.email, password: data.password, confirmed: autoconfirm, meta: data.data || {} });
        try { newProfile(id, data.data || {}); } catch (e) { users.delete(id); return send(500, { msg: "Database error saving new user" }); }
        return send(200, autoconfirm ? session(id) : { id, email: data.email, confirmation_sent_at: new Date().toISOString() });
      }
      if (p === "/auth/v1/token" && u.searchParams.get("grant_type") === "password") {
        const x = [...users.values()].find((y) => y.email === data.email && y.password === data.password);
        if (!x) return send(400, { error: "invalid_grant", error_description: "Invalid login credentials" });
        if (!x.confirmed) return send(400, { error: "invalid_grant", error_description: "Email not confirmed" });
        return send(200, session(x.id));
      }
      if (p === "/auth/v1/token" && u.searchParams.get("grant_type") === "refresh_token") {
        const id = refreshes.get(data.refresh_token);
        if (!id) return send(400, { error: "invalid_grant", error_description: "Invalid Refresh Token" });
        refreshes.delete(data.refresh_token);
        return send(200, session(id));
      }
      if (p === "/auth/v1/logout") { const t = (req.headers.authorization || "").slice(7); tokens.delete(t); return send(204); }
      if (p === "/auth/v1/recover") return send(200, {});
      if (p === "/auth/v1/user") {
        if (!uid) return send(401, { msg: "invalid JWT" });
        const x = users.get(uid);
        if (req.method === "PUT") { if (data.password) x.password = data.password; }
        return send(200, { id: x.id, email: x.email, user_metadata: x.meta });
      }
      /* ---------- nightcode-login ---------- */
      if (p === "/functions/v1/nightcode-login") {
        const prof = [...profiles.values()].find((y) => y.username.toLowerCase() === String(data.username || "").toLowerCase());
        const x = prof && users.get(prof.id);
        if (!x || x.password !== data.password) return send(401, { error: "ACCESS DENIED: wrong username or password." });
        if (!x.confirmed) return send(403, { error: "Your account isn't activated yet: open the link in your email." });
        return send(200, session(x.id));
      }
      /* ---------- rpc ---------- */
      if (p === "/rest/v1/rpc/nc_username_available") return send(200, /^[A-Za-z0-9_]{3,16}$/.test(data.name) && ![...profiles.values()].some((y) => y.username.toLowerCase() === String(data.name).toLowerCase()));
      if (!uid) return send(401, { message: "JWT expired", code: "PGRST301" });
      if (p === "/rest/v1/rpc/nc_touch") { profiles.get(uid).last_seen = new Date().toISOString(); return send(204); }
      if (p === "/rest/v1/rpc/nc_who") return send(200, [...profiles.values()].filter((y) => y.last_seen && Date.now() - Date.parse(y.last_seen) < 300000).map((y) => ({ username: y.username, role: y.role, last_seen: y.last_seen })));
      /* ---------- tables ---------- */
      const eq = (k) => { const v = u.searchParams.get(k); return v && v.startsWith("eq.") ? v.slice(3) : null; };
      if (p === "/rest/v1/nc_profiles") {
        if (req.method === "GET") {
          if (eq("id")) { const x = profiles.get(eq("id")); return send(200, x ? [x] : []); }
          const il = (u.searchParams.get("username") || "").replace(/^ilike\./, "").toLowerCase();
          return send(200, [...profiles.values()].filter((y) => y.username.toLowerCase() === il).map(pub));
        }
        if (req.method === "PATCH") {
          if (eq("id") !== uid) return send(200, []);
          const bad = Object.keys(data).filter((k) => !["display_name", "bio"].includes(k));
          if (bad.length) return send(401, { message: `permission denied for table nc_profiles`, code: "42501" });
          Object.assign(profiles.get(uid), data);
          return send(200, [profiles.get(uid)]);
        }
      }
      if (p === "/rest/v1/nc_board") {
        const b = eq("board") || "main", lim = +(u.searchParams.get("limit") || 15);
        return send(200, posts.filter((x) => x.board === b).slice().reverse().slice(0, lim).map((x) => ({ id: x.id, board: x.board, body: x.body, created_at: x.created_at, username: profiles.get(x.author).username })));
      }
      if (p === "/rest/v1/nc_posts" && req.method === "POST") {
        const author = data.author || uid;
        if (author !== uid) return send(403, { message: "new row violates row-level security policy for table \"nc_posts\"", code: "42501" });
        if (!/^[a-z0-9_]{1,16}$/.test(data.board || "main") || !data.body || data.body.length > 1000) return send(400, { message: "violates check constraint", code: "23514" });
        const row = { id: ++postSeq, author, board: data.board || "main", body: data.body, created_at: new Date().toISOString() };
        posts.push(row);
        return send(201, [row]);
      }
      if (p === "/rest/v1/nc_posts" && req.method === "DELETE") {
        const id = +eq("id"), i = posts.findIndex((x) => x.id === id);
        const sysop = profiles.get(uid).role === "sysop";
        if (i < 0 || (posts[i].author !== uid && !sysop)) return send(200, []);
        return send(200, posts.splice(i, 1));
      }
      return send(404, { message: `no route ${req.method} ${p}` });
    } catch (e) { return send(e.status || 500, { msg: e.msg || String(e) }); }
  });
  return { server, ANON, users, profiles, posts, tokens, log, confirmAll() { users.forEach((x) => { x.confirmed = true; }); } };
}

module.exports = { createMock };
if (require.main === module) {
  const m = createMock({ autoconfirm: process.env.MOCK_CONFIRM !== "1" });
  const port = +process.argv[2] || 54321;
  m.server.listen(port, "127.0.0.1", () => console.log(`mock Supabase on http://127.0.0.1:${port}  anon key: ${m.ANON}`));
}
