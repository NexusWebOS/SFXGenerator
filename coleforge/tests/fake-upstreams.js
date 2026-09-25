"use strict";
// Canned GitHub and Netlify API answers for testing NightOps (netlify/functions/ops.mjs) offline.
// install() wraps global fetch; everything else still goes to the network (the mock Supabase).
const calls = [];
const REPOS = [
  { full_name: "NexusWebOS/SFXGenerator", name: "SFXGenerator", private: false, description: "Windows – ColeForge Edition", language: "JavaScript", stargazers_count: 3, pushed_at: "2026-09-25T00:11:00Z", default_branch: "main", html_url: "https://github.com/NexusWebOS/SFXGenerator", archived: false, size: 90000, owner: { login: "NexusWebOS" } },
  { full_name: "NexusWebOS/NightCode", name: "NightCode", private: false, description: "Retro USB", language: "Python", stargazers_count: 1, pushed_at: "2026-09-24T01:45:10Z", default_branch: "main", html_url: "https://github.com/NexusWebOS/NightCode", archived: false, size: 1200, owner: { login: "NexusWebOS" } },
  { full_name: "someone/else", name: "else", private: false, pushed_at: "2026-01-01T00:00:00Z", owner: { login: "someone" } },
];
const b64 = (s) => Buffer.from(s).toString("base64");
function answer(url, init) {
  const u = new URL(url);
  const auth = (init?.headers && (init.headers.Authorization || init.headers.authorization)) || "";
  calls.push({ url, method: init?.method || "GET", auth: !!auth });
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  if (u.host === "api.github.com") {
    if (u.pathname === "/user/repos") return json(auth ? REPOS : []);
    if (u.pathname === "/users/NexusWebOS/repos") return json(REPOS.filter((r) => !r.private));
    const m = /^\/repos\/NexusWebOS\/([^/]+)\/(contents|commits)(?:\/(.*))?$/.exec(u.pathname);
    if (m && m[2] === "commits") return json([{ sha: "7ad09bd0000000000000000000000000000000000", commit: { message: "NightCode Net: nightcode.coletechsystems.com\n\nbody", author: { name: "Cole", date: "2026-09-25T00:50:00Z" } }, html_url: "https://github.com/NexusWebOS/SFXGenerator/commit/7ad09bd" }]);
    if (m && !m[3]) return json([{ name: "coleforge", path: "coleforge", type: "dir", size: 0 }, { name: "README.md", path: "README.md", type: "file", size: 120 }]);
    if (m && m[3] === "README.md") return json({ name: "README.md", path: "README.md", size: 40, encoding: "base64", content: b64("# SFXGenerator\n\nHello from the fake GitHub.\n"), html_url: "https://github.com/NexusWebOS/SFXGenerator/blob/main/README.md" });
    if (m && m[3] === "coleforge") return json([{ name: "shell", path: "coleforge/shell", type: "dir", size: 0 }, { name: "README.md", path: "coleforge/README.md", type: "file", size: 9000 }]);
    return json({ message: "Not Found" }, 404);
  }
  if (u.host === "api.netlify.com") {
    if (!auth) return json({ message: "Access Denied" }, 401);
    if (u.pathname === "/api/v1/sites") return json([
      { id: "11111111-2222-3333-4444-555555555555", name: "nightcode", ssl_url: "https://nightcode.netlify.app", custom_domain: "nightcode.coletechsystems.com", admin_url: "https://app.netlify.com/sites/nightcode", build_settings: { repo_url: "https://github.com/NexusWebOS/SFXGenerator", repo_branch: "main" }, published_deploy: { state: "ready", published_at: "2026-09-25T01:00:00Z" } },
      { id: "c922b46c-0000-0000-0000-000000000000", name: "coletechsystems", ssl_url: "https://coletechsystems.netlify.app", custom_domain: "coletechsystems.com", admin_url: "https://app.netlify.com/sites/coletechsystems", build_settings: {}, published_deploy: { state: "ready", published_at: "2026-09-20T12:00:00Z" } },
    ]);
    if (/^\/api\/v1\/sites\/[^/]+\/deploys$/.test(u.pathname)) return json([
      { id: "d1", state: "ready", context: "production", branch: "main", commit_ref: "7ad09bd", title: "NightCode Net", created_at: "2026-09-25T00:58:00Z", published_at: "2026-09-25T01:00:00Z", deploy_time: 42 },
      { id: "d0", state: "error", context: "deploy-preview", branch: "feature", commit_ref: "abc1234", title: "broken build", created_at: "2026-09-24T20:00:00Z", deploy_time: 12, error_message: "Build script returned non-zero exit code: 2" },
    ]);
    if (/^\/api\/v1\/sites\/[^/]+\/builds$/.test(u.pathname) && init?.method === "POST") return json({ id: "b1", deploy_id: "d2", created_at: new Date().toISOString() });
    return json({ message: "Not Found" }, 404);
  }
  return null;
}
function install() {
  if (globalThis.__fakeUpstreams) return;
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => answer(String(url), init) || real(url, init);
  globalThis.__fakeUpstreams = true;
}
module.exports = { install, calls };
