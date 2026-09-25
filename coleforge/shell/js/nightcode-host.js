"use strict";

// The NightCode desktop on nightcode.coletechsystems.com/desktop/. Loaded only in that build (web/nightcode/
// build-config.js adds it, after /config.js and before the shell), it:
//   - logs you on as your NightCode Net account (signed in at the NightCode-DOS prompt, same origin);
//   - keeps the desktop (settings, My Documents, NightAmp, ... every cf.* key) in your Supabase project
//     (table nc_desktop), so it follows you from browser to browser;
//   - opens what DOS asked for (?open=nightbrowser&url=..., ?open=nightops);
//   - sends Shut Down back to NightCode-DOS and Log Off to the DOS login.
(function () {
  const cfg = window.NIGHTCODE_CONFIG || {};
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const SITE = new URL("../", location.href).href;
  const META = "nightcode.cloud.meta";
  const EXCLUDE = new Set(["cf.nightcodeNet.config"]);     // per-device, never synced
  const MAX = 5 * 1024 * 1024;
  const session = read("nightcode.session"), profile = read("nightcode.profile");
  const signedIn = !!(session?.access_token && cfg.supabaseUrl && cfg.supabaseAnonKey);
  const status = { enabled: signedIn, lastSync: null, lastError: null, keys: 0, bytes: 0 };
  window.NIGHTCODE_HOSTED = { site: SITE, profile: signedIn ? profile : null, cloud: status, sync: () => push(true) };

  let api = null;
  const getApi = () => {
    if (!api && signedIn && window.NightCodeAPI) api = NightCodeAPI.create({ url: cfg.supabaseUrl, anonKey: cfg.supabaseAnonKey, redirectTo: cfg.siteUrl || SITE });
    return api;
  };
  // FNV-1a over the stored string: cheap enough to run over every key every few seconds.
  const hash = (s) => { if (s == null) return null; let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193); } return (x >>> 0).toString(36) + ":" + s.length; };
  const localKeys = () => { const out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("cf.") && !EXCLUDE.has(k) && /^cf\.[A-Za-z0-9_.-]{1,80}$/.test(k)) out.push(k); } return out; };
  const loadMeta = () => read(META) || { owner: null, keys: {} };
  const saveMeta = (m) => { try { localStorage.setItem(META, JSON.stringify(m)); } catch { /* full */ } };

  /* ---------- pull: before the desktop boots ---------- */
  async function pull() {
    const a = getApi();
    if (!a) return;
    let uid = a.user?.id;
    if (!uid) uid = (await a.getUser()).id;
    const meta = loadMeta();
    // Someone else used the desktop in this browser: their copy is in their cloud, start clean.
    if (meta.owner && meta.owner !== uid) { localKeys().forEach((k) => localStorage.removeItem(k)); meta.keys = {}; }
    const first = meta.owner !== uid;
    const rows = await a.desktopList();
    let changed = false;
    const inCloud = new Set();
    for (const r of rows) {
      inCloud.add(r.key);
      const local = localStorage.getItem(r.key);
      const localEdited = !first && local != null && meta.keys[r.key] && hash(local) !== meta.keys[r.key];
      if (localEdited) continue;                                  // changed here since the last sync: this copy wins
      if (local !== r.value) { try { localStorage.setItem(r.key, r.value); changed = true; } catch { continue; } }
      meta.keys[r.key] = hash(r.value);
    }
    // Deleted on another device, untouched here: delete here too.
    if (!first) for (const k of Object.keys(meta.keys)) {
      if (inCloud.has(k)) continue;
      const local = localStorage.getItem(k);
      if (local != null && hash(local) === meta.keys[k]) { localStorage.removeItem(k); changed = true; }
      delete meta.keys[k];
    }
    meta.owner = uid;
    saveMeta(meta);
    status.lastSync = new Date();
    // The shell read its settings when it loaded; start again once with the cloud copy in place.
    if (changed && !sessionStorage.getItem("nightcode.cloud.reloaded")) {
      sessionStorage.setItem("nightcode.cloud.reloaded", "1");
      location.reload();
      await new Promise(() => {});
    }
    sessionStorage.removeItem("nightcode.cloud.reloaded");
  }

  /* ---------- push: whatever changed, every few seconds and on the way out ---------- */
  let pushing = null, paused = false;
  async function push(force) {
    const a = getApi();
    if (!a || paused) return;
    if (pushing) return force ? pushing : undefined;
    pushing = (async () => {
      const meta = loadMeta();
      if (meta.owner && a.user?.id && meta.owner !== a.user.id) return;
      const keys = localKeys();
      const rows = [], tooBig = [];
      let bytes = 0;
      for (const k of keys) {
        const v = localStorage.getItem(k);
        bytes += v.length;
        if (hash(v) === meta.keys[k]) continue;
        if (v.length > MAX) { tooBig.push(k); continue; }
        rows.push({ key: k, value: v });
      }
      const gone = Object.keys(meta.keys).filter((k) => !keys.includes(k));
      status.keys = keys.length; status.bytes = bytes;
      if (!rows.length && !gone.length) return;
      // In small batches so one request never gets huge.
      for (let i = 0; i < rows.length;) {
        const batch = [];
        let size = 0;
        while (i < rows.length && (batch.length === 0 || size + rows[i].value.length < 1024 * 1024)) { size += rows[i].value.length; batch.push(rows[i++]); }
        await a.desktopSave(batch);
        batch.forEach((r) => { meta.keys[r.key] = hash(r.value); });
        saveMeta(meta);
      }
      if (gone.length) { await a.desktopDelete(gone); gone.forEach((k) => delete meta.keys[k]); }
      saveMeta(meta);
      status.lastSync = new Date(); status.lastError = tooBig.length ? `Too big to save in the cloud: ${tooBig.join(", ")}` : null;
    })().catch((e) => {
      status.lastError = e.message;
      if (e.status === 401) { paused = true; window.CF?.toast?.({ title: "Cloud save paused", body: "Your NightCode session ended. Shut Down, sign in again at the DOS prompt, and type WIN.", icon: "warning" }); }
    }).finally(() => { pushing = null; });
    return pushing;
  }

  if (signedIn) {
    window.CF_BOOT_HOOKS = (window.CF_BOOT_HOOKS || []).concat(async () => {
      try { await pull(); } catch (e) { status.lastError = e.message; console.warn("NightCode cloud:", e); }
      setInterval(() => push(), 15000);
      addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") push(true); });
    });
    window.CF_AUTO_LOGON = () => profile?.display_name || profile?.username || null;
  }

  // Shut Down goes back to DOS; Log Off signs out of NightCode Net too.
  window.CF_POWER_HOOK = (action) => {
    if (action === "restart") return false;
    const leave = async () => {
      try { await Promise.race([push(true), new Promise((r) => setTimeout(r, 4000))]); } catch { /* best effort */ }
      if (action === "logoff") {
        try { await getApi()?.signOut(); } catch { /* already out */ }
        try { localStorage.removeItem("nightcode.profile"); } catch { /* blocked */ }
        location.href = SITE;
      } else location.href = SITE + "?from=win";
    };
    leave();
    return true;
  };

  // WEB / OPS from DOS: open the program once the desktop is up.
  document.addEventListener("DOMContentLoaded", () => {
    const q = new URLSearchParams(location.search);
    const app = q.get("open");
    if (!app || !window.CF) return;
    const off = CF.on("logon", () => {
      off();
      history.replaceState(null, "", location.pathname);
      setTimeout(() => { if (CF.apps?.[app]) CF.open(app, q.get("url") ? { url: q.get("url") } : {}); }, 400);
    });
  });
})();
