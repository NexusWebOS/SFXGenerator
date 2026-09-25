"use strict";

// NightCode Net API: a small Supabase client (Auth + REST) with no dependencies, shared by
// nightcode.coletechsystems.com and ColeForge.exe's NightCode Net program.
//   const api = NightCodeAPI.create({ url, anonKey });
// The session is kept in localStorage under "nightcode.session" and refreshed before it expires.
(function (root) {
  class NCError extends Error {
    constructor(message, status, data) { super(message); this.name = "NCError"; this.status = status; this.data = data; }
  }
  const messageOf = (data, status) => {
    if (data && typeof data === "object") return data.error_description || data.msg || data.message || data.error || `HTTP ${status}`;
    return typeof data === "string" && data ? data : `HTTP ${status}`;
  };
  const memoryStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

  function create({ url, anonKey, redirectTo, storage, storageKey = "nightcode.session", fetch: fetchImpl } = {}) {
    if (!url || !anonKey) throw new NCError("NightCode Net isn't configured (Supabase URL and anon key).", 0);
    const base = String(url).replace(/\/+$/, "");
    const f = fetchImpl || root.fetch.bind(root);
    let store = storage;
    if (!store) { try { store = root.localStorage; store.getItem("x"); } catch { store = memoryStorage(); } }
    let session = null;
    try { session = JSON.parse(store.getItem(storageKey) || "null"); } catch { session = null; }
    const listeners = new Set();
    const now = () => Math.floor(Date.now() / 1000);

    function save(s) {
      session = s;
      try { if (s) store.setItem(storageKey, JSON.stringify(s)); else store.removeItem(storageKey); } catch { /* storage full or blocked */ }
      listeners.forEach((fn) => { try { fn(s); } catch { /* listener error */ } });
    }
    function fromToken(t) {
      if (!t || !t.access_token) return null;
      return { access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at || now() + (t.expires_in || 3600), user: t.user || null };
    }

    let refreshing = null;
    async function refresh() {
      if (!session?.refresh_token) throw new NCError("Not signed in.", 401);
      if (!refreshing) {
        refreshing = raw("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: session.refresh_token }, bearer: anonKey })
          .then((t) => { save(fromToken(t)); return session; })
          .catch((e) => { if (e.status >= 400 && e.status < 500) save(null); throw e; })
          .finally(() => { refreshing = null; });
      }
      return refreshing;
    }
    async function token() {
      if (!session) return null;
      if (session.expires_at - now() < 60) await refresh();
      return session?.access_token || null;
    }

    async function raw(path, { method = "GET", body, bearer, headers = {} } = {}) {
      let r;
      try {
        r = await f(base + path, {
          method,
          headers: Object.assign({ apikey: anonKey, Authorization: `Bearer ${bearer || anonKey}` }, body !== undefined ? { "Content-Type": "application/json" } : {}, headers),
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
      } catch (e) { throw new NCError(`NETLINK DOWN: ${e.message || "can't reach the server"}`, 0); }
      const text = await r.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      if (!r.ok) throw new NCError(messageOf(data, r.status), r.status, data);
      return data;
    }
    // Signed-in request: refreshes the token first, and once more if the server says it expired.
    async function call(path, opts = {}) {
      const t = await token();
      if (!t) throw new NCError("Not signed in. Type LOGIN.", 401);
      try { return await raw(path, Object.assign({}, opts, { bearer: t })); }
      catch (e) {
        if (e.status !== 401 || !session?.refresh_token) throw e;
        await refresh();
        return raw(path, Object.assign({}, opts, { bearer: session.access_token }));
      }
    }
    const redirect = () => (redirectTo ? `redirect_to=${encodeURIComponent(redirectTo)}` : "");
    const q = (s) => encodeURIComponent(s);

    const api = {
      NCError,
      get session() { return session; },
      get user() { return session?.user || null; },
      onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      async health() { await raw("/auth/v1/health"); return true; },

      /* ---------- accounts ---------- */
      async signUp({ email, password, username }) {
        const data = await raw(`/auth/v1/signup${redirectTo ? "?" + redirect() : ""}`, { method: "POST", body: { email, password, data: { username, display_name: username } } });
        const s = fromToken(data);
        if (s) save(s);
        return { session: s, user: data?.user || data, confirm: !s };
      },
      async signIn(login, password) {
        login = String(login || "").trim();
        let t;
        if (login.includes("@")) t = await raw("/auth/v1/token?grant_type=password", { method: "POST", body: { email: login, password } });
        else {
          try { t = await raw("/functions/v1/nightcode-login", { method: "POST", body: { username: login, password } }); }
          catch (e) {
            if (e.status === 404) throw new NCError("Username sign-in isn't switched on yet (nightcode-login). Sign in with your email address.", 404);
            throw e;
          }
        }
        const s = fromToken(t);
        if (!s) throw new NCError("The server didn't return a session.", 500);
        save(s);
        if (!s.user) { try { s.user = await call("/auth/v1/user"); save(s); } catch { /* keep going */ } }
        return s;
      },
      async signOut() {
        const t = session?.access_token;
        save(null);
        if (t) { try { await raw("/auth/v1/logout", { method: "POST", bearer: t }); } catch { /* already gone */ } }
      },
      recover(email) { return raw(`/auth/v1/recover${redirectTo ? "?" + redirect() : ""}`, { method: "POST", body: { email } }); },
      async updatePassword(password) { const u = await call("/auth/v1/user", { method: "PUT", body: { password } }); if (session) { session.user = u; save(session); } return u; },
      async getUser() { const u = await call("/auth/v1/user"); if (session) { session.user = u; save(session); } return u; },
      // Links in Supabase emails come back with the session in the URL fragment.
      fromUrl(hash) {
        const p = new URLSearchParams(String(hash || "").replace(/^#/, ""));
        if (p.get("error_description") || p.get("error")) return { error: p.get("error_description") || p.get("error") };
        if (!p.get("access_token")) return null;
        const s = fromToken({ access_token: p.get("access_token"), refresh_token: p.get("refresh_token"), expires_in: +p.get("expires_in") || 3600, expires_at: +p.get("expires_at") || undefined });
        save(s);
        return { type: p.get("type") || "magiclink", session: s };
      },
      refresh,

      /* ---------- NightCode Net data ---------- */
      usernameAvailable(name) { return raw("/rest/v1/rpc/nc_username_available", { method: "POST", body: { name } }); },
      async profile() { const uid = session?.user?.id || (await api.getUser()).id; return (await call(`/rest/v1/nc_profiles?id=eq.${q(uid)}&select=*`))[0] || null; },
      async updateProfile(patch) { const uid = session?.user?.id; return (await call(`/rest/v1/nc_profiles?id=eq.${q(uid)}`, { method: "PATCH", body: patch, headers: { Prefer: "return=representation" } }))[0]; },
      async finger(username) { return (await call(`/rest/v1/nc_profiles?username=ilike.${q(String(username).replace(/[%*]/g, ""))}&select=username,display_name,bio,role,created_at,last_seen`))[0] || null; },
      touch() { return call("/rest/v1/rpc/nc_touch", { method: "POST", body: {} }); },
      who() { return call("/rest/v1/rpc/nc_who", { method: "POST", body: {} }); },
      posts(board = "main", limit = 15) { return call(`/rest/v1/nc_board?board=eq.${q(board)}&order=created_at.desc&limit=${Math.min(100, limit | 0 || 15)}&select=id,board,body,created_at,username`); },
      async post(board, body) { return (await call("/rest/v1/nc_posts", { method: "POST", body: { board, body }, headers: { Prefer: "return=representation" } }))[0]; },
      deletePost(id) { return call(`/rest/v1/nc_posts?id=eq.${q(id)}`, { method: "DELETE", headers: { Prefer: "return=representation" } }); },
      boards() { return call("/rest/v1/nc_posts?select=board&order=board&limit=1000"); },
    };
    return api;
  }

  const NightCodeAPI = { create, NCError };
  if (typeof module === "object" && module.exports) module.exports = NightCodeAPI;
  root.NightCodeAPI = NightCodeAPI;
})(typeof window !== "undefined" ? window : globalThis);
