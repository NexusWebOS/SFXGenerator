// NightOps: the NightCode desktop's window on GitHub and Netlify, as a Netlify Function at /api/ops.
//
//   POST /api/ops  { "action": "...", ... }   Authorization: Bearer <NightCode Net (Supabase) access token>
//
// Only NightCode Net sysops get in: the caller's token is checked with Supabase, then their nc_profiles
// role. GitHub and Netlify are reached with tokens that live only in the site's environment variables,
// so they never reach a browser:
//   GITHUB_TOKEN               fine-grained, read-only (Contents + Metadata) on the repos you pick
//   NETLIFY_API_TOKEN          a Netlify personal access token (needed for sites, deploys, rebuilds)
//   NIGHTCODE_SUPABASE_ANON_KEY  (already set for the site)
//   NIGHTOPS_GITHUB_OWNER      optional, default NexusWebOS (comma-separated for more)
const SB = (process.env.NIGHTCODE_SUPABASE_URL || "https://wjfzxeqztbvnrnlgarvn.supabase.co").replace(/\/+$/, "");
const SITE = "https://nightcode.coletechsystems.com";

function cors(req) {
  const origin = req.headers.get("origin") || "";
  // ColeForge.exe serves its shell from localhost on a port it picks at start.
  const ok = origin === SITE || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return { "Access-Control-Allow-Origin": ok ? origin : SITE, "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" };
}
const reply = (req, status, body) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json", "Cache-Control": "no-store" } });
class OpsError extends Error { constructor(status, message) { super(message); this.status = status; } }

async function sysop(req) {
  const anon = process.env.NIGHTCODE_SUPABASE_ANON_KEY;
  if (!anon) throw new OpsError(500, "NIGHTCODE_SUPABASE_ANON_KEY isn't set on the Netlify site.");
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer \S+$/.test(auth)) throw new OpsError(401, "Sign in to NightCode Net first.");
  const u = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: anon, Authorization: auth } });
  if (!u.ok) throw new OpsError(401, "Your NightCode session has ended. Sign in again at the DOS prompt.");
  const user = await u.json();
  const p = await fetch(`${SB}/rest/v1/nc_profiles?id=eq.${encodeURIComponent(user.id)}&select=username,role`, { headers: { apikey: anon, Authorization: auth } });
  const [prof] = p.ok ? await p.json() : [];
  if (prof?.role !== "sysop") throw new OpsError(403, "NightOps is for the NightCode Net sysop.");
  return prof;
}

/* ---------------- GitHub ---------------- */
const owners = () => (process.env.NIGHTOPS_GITHUB_OWNER || "NexusWebOS").split(",").map((s) => s.trim()).filter(Boolean);
async function gh(path) {
  const token = process.env.GITHUB_TOKEN;
  const r = await fetch(`https://api.github.com${path}`, {
    headers: Object.assign({ Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "NightOps" }, token ? { Authorization: `Bearer ${token}` } : {}),
  });
  if (r.status === 404) throw new OpsError(404, "Not found on GitHub (or the token can't see it).");
  if (!r.ok) throw new OpsError(502, `GitHub said ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
function repoOf(body) {
  const [owner, name] = String(body.repo || "").split("/");
  if (!owners().some((o) => o.toLowerCase() === String(owner).toLowerCase())) throw new OpsError(400, `NightOps only opens repositories of ${owners().join(", ")}.`);
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(name || "")) throw new OpsError(400, "Bad repository name.");
  return `${owner}/${name}`;
}
const cleanPath = (p) => {
  const s = String(p || "").replace(/^\/+|\/+$/g, "");
  if (s.split("/").some((x) => x === ".." || x === ".")) throw new OpsError(400, "Bad path.");
  return s.split("/").map(encodeURIComponent).join("/");
};
const refQ = (ref) => (ref && /^[A-Za-z0-9_./-]{1,200}$/.test(ref) ? `?ref=${encodeURIComponent(ref)}` : "");
const trimRepo = (r) => ({ full_name: r.full_name, name: r.name, private: r.private, description: r.description, language: r.language, stars: r.stargazers_count,
  pushed_at: r.pushed_at, default_branch: r.default_branch, html_url: r.html_url, archived: r.archived, size: r.size });

/* ---------------- Netlify ---------------- */
async function nf(path, method = "GET") {
  const token = process.env.NETLIFY_API_TOKEN;
  if (!token) throw new OpsError(501, "NETLIFY_API_TOKEN isn't set on the Netlify site.");
  const r = await fetch(`https://api.netlify.com/api/v1${path}`, { method, headers: { Authorization: `Bearer ${token}`, "User-Agent": "NightOps" } });
  if (!r.ok) throw new OpsError(502, `Netlify said ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json();
}
const siteId = (b) => { if (!/^[a-f0-9-]{8,64}$/i.test(String(b.site_id || ""))) throw new OpsError(400, "Bad site id."); return b.site_id; };
const trimDeploy = (d) => ({ id: d.id, state: d.state, context: d.context, branch: d.branch, commit_ref: d.commit_ref, title: d.title, created_at: d.created_at,
  published_at: d.published_at, deploy_time: d.deploy_time, error_message: d.error_message, deploy_ssl_url: d.deploy_ssl_url });

const ACTIONS = {
  async status() {
    return { github: { owner: owners(), token: !!process.env.GITHUB_TOKEN }, netlify: { token: !!process.env.NETLIFY_API_TOKEN }, supabase: SB };
  },
  async "github.repos"() {
    const lists = await Promise.all(owners().map(async (o) => {
      if (process.env.GITHUB_TOKEN) {
        // Private repos the token can see, then keep this owner's.
        const mine = await gh("/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member").catch(() => []);
        const pub = await gh(`/users/${encodeURIComponent(o)}/repos?per_page=100&sort=pushed`).catch(() => []);
        const seen = new Map();
        [...mine, ...pub].filter((r) => r.owner?.login?.toLowerCase() === o.toLowerCase()).forEach((r) => seen.set(r.full_name, r));
        return [...seen.values()];
      }
      return gh(`/users/${encodeURIComponent(o)}/repos?per_page=100&sort=pushed`);
    }));
    return lists.flat().map(trimRepo).sort((a, b) => String(b.pushed_at).localeCompare(String(a.pushed_at)));
  },
  async "github.contents"(b) {
    const repo = repoOf(b);
    const data = await gh(`/repos/${repo}/contents/${cleanPath(b.path)}${refQ(b.ref)}`);
    if (Array.isArray(data)) return { type: "dir", items: data.map((x) => ({ name: x.name, path: x.path, type: x.type, size: x.size })) };
    const big = data.size > 400000;
    return { type: "file", name: data.name, path: data.path, size: data.size, html_url: data.html_url, encoding: big ? null : data.encoding, content: big ? null : data.content };
  },
  async "github.commits"(b) {
    const repo = repoOf(b);
    const list = await gh(`/repos/${repo}/commits?per_page=15${b.ref ? "&sha=" + encodeURIComponent(b.ref) : ""}`);
    return list.map((c) => ({ sha: c.sha, message: c.commit.message, author: c.commit.author?.name, date: c.commit.author?.date, html_url: c.html_url }));
  },
  async "netlify.sites"() {
    const list = await nf("/sites?filter=all&per_page=100");
    return list.map((s) => ({ id: s.id, name: s.name, url: s.ssl_url || s.url, custom_domain: s.custom_domain, admin_url: s.admin_url, repo: s.build_settings?.repo_url || null,
      branch: s.build_settings?.repo_branch || null, updated_at: s.updated_at, state: s.published_deploy?.state || s.state, published_at: s.published_deploy?.published_at || null }));
  },
  async "netlify.deploys"(b) { return (await nf(`/sites/${siteId(b)}/deploys?per_page=12`)).map(trimDeploy); },
  async "netlify.build"(b) { const r = await nf(`/sites/${siteId(b)}/builds`, "POST"); return { id: r?.id, deploy_id: r?.deploy_id, created_at: r?.created_at }; },
};

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return reply(req, 405, { error: "POST only" });
  try {
    let body = {};
    try { body = await req.json(); } catch { throw new OpsError(400, "Send JSON."); }
    const fn = ACTIONS[body.action];
    if (!fn) throw new OpsError(400, `Unknown action ${body.action}`);
    const who = await sysop(req);
    return reply(req, 200, { ok: true, who: who.username, data: await fn(body) });
  } catch (e) {
    return reply(req, e.status || 500, { error: e.status ? e.message : "NightOps hit an error." });
  }
};

export const config = { path: "/api/ops" };
