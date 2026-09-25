"use strict";
// NightCode Net: the API client against a mock Supabase, the migration's safety rules, and the
// Netlify config step.
//   node coleforge/tests/nightcode.test.js
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { createMock } = require("./mock-supabase.js");
const NightCodeAPI = require("../web/nightcode/js/nc-api.js");

const WEB = path.join(__dirname, "../web/nightcode");
let passed = 0;
const ok = (name) => { passed++; console.log("ok -", name); };
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

(async () => {
  /* ---------- client against the mock ---------- */
  const mock = createMock({ autoconfirm: true });
  await new Promise((r) => mock.server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${mock.server.address().port}`;
  const make = (storage = memory()) => NightCodeAPI.create({ url, anonKey: mock.ANON, storage });

  const a = make();
  await a.health();
  assert.strictEqual(await a.usernameAvailable("ForgeMaster"), true);
  const r = await a.signUp({ email: "cole@example.com", password: "hunter2hunter2", username: "ForgeMaster" });
  assert.ok(r.session && !r.confirm);
  assert.strictEqual(await a.usernameAvailable("forgemaster"), false, "names are case-insensitive");
  assert.strictEqual((await a.profile()).username, "ForgeMaster");
  ok("sign up, username check, profile made by the trigger");

  const b = make();
  await assert.rejects(b.signIn("ForgeMaster", "nope"), /ACCESS DENIED/);
  await b.signIn("forgemaster", "hunter2hunter2");
  assert.strictEqual((await b.profile()).username, "ForgeMaster");
  const c = make();
  await assert.rejects(c.signIn("cole@example.com", "nope"), /Invalid login credentials/);
  await c.signIn("cole@example.com", "hunter2hunter2");
  ok("sign in by username (nightcode-login) and by email");

  // Session survives a reload (storage) and refreshes when it's about to expire.
  const store = memory();
  const d = make(store);
  await d.signIn("ForgeMaster", "hunter2hunter2");
  const s = JSON.parse(store.getItem("nightcode.session"));
  s.expires_at = Math.floor(Date.now() / 1000) + 10;          // about to expire
  store.setItem("nightcode.session", JSON.stringify(s));
  const d2 = make(store);
  await d2.touch();
  assert.notStrictEqual(d2.session.access_token, s.access_token, "refreshed");
  // A token the server no longer accepts gets refreshed once and the call retried.
  mock.tokens.delete(d2.session.access_token);
  await d2.who();
  ok("session kept in storage, refreshed before expiry and after a 401");

  // Board and presence
  await a.touch();
  const p1 = await a.post("main", "hello from the NightCode crew");
  assert.ok(p1.id);
  const e = make();
  await e.signUp({ email: "nyx@example.com", password: "password123", username: "Nyx" });
  await e.post("hack", "second board");
  const main = await e.posts("main");
  assert.deepStrictEqual(main.map((x) => [x.username, x.body]), [["ForgeMaster", "hello from the NightCode crew"]]);
  assert.strictEqual((await e.deletePost(p1.id)).length, 0, "can't delete someone else's post");
  assert.strictEqual((await a.deletePost(p1.id)).length, 1, "can delete your own");
  await e.touch();
  assert.deepStrictEqual((await a.who()).map((x) => x.username).sort(), ["ForgeMaster", "Nyx"]);
  assert.strictEqual((await e.finger("forgemaster")).username, "ForgeMaster");
  ok("board posts, delete rules, WHO and FINGER");

  await e.updateProfile({ bio: "night owl" });
  assert.strictEqual((await a.finger("Nyx")).bio, "night owl");
  await assert.rejects(e.updateProfile({ role: "sysop" }), /permission denied/);
  ok("profile edits limited to display_name and bio");

  await a.updatePassword("newpassword99");
  await a.signOut();
  assert.strictEqual(a.session, null);
  await assert.rejects(a.who(), /Not signed in/);
  await make().signIn("ForgeMaster", "newpassword99");
  ok("password change and sign out");

  // Email links (activation / password reset) arrive in the URL fragment.
  const f = make();
  const tok = mock.tokens.keys().next().value;
  const link = f.fromUrl(`#access_token=${tok}&refresh_token=x&expires_in=3600&type=recovery`);
  assert.strictEqual(link.type, "recovery");
  assert.ok(f.session.access_token === tok);
  assert.deepStrictEqual(f.fromUrl("#error=access_denied&error_description=Email+link+is+invalid+or+has+expired"), { error: "Email link is invalid or has expired" });
  ok("activation / reset links from the URL fragment");

  // With email confirmation on, sign-up asks you to activate first.
  const mock2 = createMock({ autoconfirm: false });
  await new Promise((r2) => mock2.server.listen(0, "127.0.0.1", r2));
  const g = NightCodeAPI.create({ url: `http://127.0.0.1:${mock2.server.address().port}`, anonKey: mock2.ANON, storage: memory() });
  const rg = await g.signUp({ email: "z@example.com", password: "password123", username: "Zed" });
  assert.ok(rg.confirm && !rg.session);
  await assert.rejects(g.signIn("Zed", "password123"), /isn't activated/);
  mock2.confirmAll();
  await g.signIn("Zed", "password123");
  ok("email confirmation flow");
  mock2.server.close();

  // No server: a readable error.
  const h = NightCodeAPI.create({ url: "http://127.0.0.1:9", anonKey: "k", storage: memory() });
  await assert.rejects(h.health(), /NETLINK DOWN/);
  assert.throws(() => NightCodeAPI.create({ url: "", anonKey: "" }), /isn't configured/);
  ok("offline and unconfigured errors");
  mock.server.close();

  /* ---------- the migration ---------- */
  const sql = fs.readFileSync(path.join(WEB, "supabase/migrations/20260925000000_nightcode_net.sql"), "utf8");
  for (const t of ["nc_profiles", "nc_posts"]) assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`), `RLS on ${t}`);
  assert.match(sql, /nexus_bootstrap_admins/, "refuses to run in the Nexus II project");
  assert.match(sql, /grant update \(display_name, bio\) on public\.nc_profiles to authenticated/);
  assert.doesNotMatch(sql, /to anon[^;]*nc_posts|nc_posts[^;]*to anon/, "anon can't touch posts");
  assert.match(sql, /security_invoker = true/, "the board view respects RLS");
  ok("migration: RLS on every table, column grants, Nexus II guard");

  /* ---------- Netlify config step ---------- */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nc-"));
  fs.copyFileSync(path.join(WEB, "build-config.js"), path.join(tmp, "build-config.js"));
  const run = (env) => spawnSync("node", [path.join(tmp, "build-config.js")], { env: Object.assign({}, process.env, env), encoding: "utf8" });
  const jwt = (role) => ["e30", Buffer.from(JSON.stringify({ role })).toString("base64url"), "sig"].join(".");
  let res = run({ NIGHTCODE_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co", NIGHTCODE_SUPABASE_ANON_KEY: jwt("anon") });
  assert.strictEqual(res.status, 0, res.stderr);
  const cfg = JSON.parse(fs.readFileSync(path.join(tmp, "config.json"), "utf8"));
  assert.strictEqual(cfg.supabaseUrl, "https://abcdefghijklmnopqrst.supabase.co");
  assert.match(fs.readFileSync(path.join(tmp, "config.js"), "utf8"), /window\.NIGHTCODE_CONFIG = /);
  res = run({ NIGHTCODE_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co", NIGHTCODE_SUPABASE_ANON_KEY: jwt("service_role") });
  assert.notStrictEqual(res.status, 0);
  assert.match(res.stderr, /service_role/);
  res = run({ NIGHTCODE_SUPABASE_URL: "http://evil.example", NIGHTCODE_SUPABASE_ANON_KEY: jwt("anon") });
  assert.notStrictEqual(res.status, 0);
  fs.rmSync(tmp, { recursive: true, force: true });
  ok("build-config: writes config.js/json, refuses the service_role key and odd URLs");

  /* ---------- ColeForge's copy of the engine is the same ---------- */
  for (const f2 of ["nc-api.js", "nc-terminal.js"]) {
    const shell = path.join(__dirname, "../shell/js/nightcode-net", f2);
    assert.ok(fs.existsSync(shell), `${f2} is in the shell (run node coleforge/web/nightcode/sync-shell.js)`);
    assert.strictEqual(fs.readFileSync(shell, "utf8"), fs.readFileSync(path.join(WEB, "js", f2), "utf8"), `${f2} matches the website's (run node coleforge/web/nightcode/sync-shell.js)`);
  }
  ok("ColeForge.exe runs the same NightCode-DOS as the website");

  console.log(`\nall nightcode tests passed (${passed})`);
})().catch((e) => { console.error(e); process.exit(1); });
