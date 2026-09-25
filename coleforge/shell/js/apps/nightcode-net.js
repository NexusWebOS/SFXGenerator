"use strict";

// NightCode Net: nightcode.coletechsystems.com's NightCode-DOS terminal inside ColeForge (and
// ColeForge.exe), signed in to the same Supabase accounts. The engine is the website's own
// (js/nightcode-net/, kept in step by web/nightcode/sync-shell.js). The server settings come from
// the site's config.json, so the desktop follows whatever the site is connected to; they can be
// overridden in the program's right-click menu.
(function () {
  const { h } = CF;
  const SITE = "https://nightcode.coletechsystems.com/";
  const CFG_KEY = "cf.nightcodeNet.config";       // { supabaseUrl, supabaseAnonKey, siteUrl, custom }

  async function loadConfig(force) {
    const saved = CF.store.get(CFG_KEY, null);
    // On the website's desktop the site's own settings are already on the page.
    if (window.NIGHTCODE_CONFIG?.supabaseUrl && !saved?.custom) return window.NIGHTCODE_CONFIG;
    if (saved?.custom && !force) return saved;
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch(new URL("config.json", saved?.siteUrl || SITE), { signal: ctl.signal, cache: "no-store" });
      clearTimeout(t);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const cfg = await r.json();
      if (cfg.supabaseUrl && cfg.supabaseAnonKey) { CF.store.set(CFG_KEY, Object.assign({}, cfg, { custom: false })); return cfg; }
    } catch (e) { console.warn("NightCode Net: couldn't fetch config.json:", e.message); }
    return saved || { siteUrl: SITE };                 // last known settings, or guest mode
  }

  CF.register({
    id: "nightcode-net", name: "NightCode Net", icon: "nightcode", single: true,
    desc: "NightCode Net: the NightCode-DOS bulletin board (nightcode.coletechsystems.com) with your NightCode account.",
    window: { w: 860, h: 560 },
    async open(win) {
      const host = h("div", { class: "ncn" });
      win.body.append(host);
      let term = null;
      async function start(force) {
        term?.destroy();
        const cfg = await loadConfig(force);
        let api = null;
        try {
          if (cfg.supabaseUrl && cfg.supabaseAnonKey) api = NightCodeAPI.create({ url: cfg.supabaseUrl, anonKey: cfg.supabaseAnonKey, redirectTo: cfg.siteUrl || SITE });
        } catch (e) { console.error(e); }
        term = NightTerminal.mount(host, { api, config: cfg, host: "coleforge", onExit: () => win.close() });
      }
      async function settings() {
        const cur = CF.store.get(CFG_KEY, {}) || {};
        const url = h("input", { value: cur.supabaseUrl || "", placeholder: "https://<project>.supabase.co", spellcheck: "false" });
        const key = h("input", { value: cur.supabaseAnonKey || "", placeholder: "anon key", spellcheck: "false" });
        const content = h("div", { style: "display:grid;grid-template-columns:auto 1fr;gap:6px 8px;align-items:center;min-width:420px" },
          h("label", {}, "Supabase URL"), url, h("label", {}, "Anon key"), key,
          h("p", { class: "muted", style: "grid-column:1/3;margin:4px 0 0" }, `Leave both empty to use the settings published by ${SITE}. Only the anon (public) key goes here.`));
        const r = await CF.dialog({ title: "NightCode Net server", icon: "nightcode", content, buttons: ["Save", "Cancel"] });
        if (r.button !== "Save") return;
        const u = url.value.trim().replace(/\/+$/, ""), k = key.value.trim();
        if (u || k) {
          if (!/^https:\/\/[^/]+$/.test(u) || !k) return CF.dialog({ title: "NightCode Net", icon: "error", message: "Enter an https:// Supabase URL and its anon key, or leave both empty." });
          CF.store.set(CFG_KEY, { supabaseUrl: u, supabaseAnonKey: k, siteUrl: cur.siteUrl || SITE, custom: true });
        } else CF.store.set(CFG_KEY, null);
        start(true);
      }
      host.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        CF.contextMenu({ x: e.clientX, y: e.clientY }, [
          { label: "Open nightcode.coletechsystems.com", action: () => CF.open("nightbrowser", { url: SITE }) },
          { label: "Reconnect (fetch the site's settings)", action: () => start(true) },
          { label: "Server settings…", action: settings },
          "-", { label: "Close", action: () => win.close() },
        ]);
      });
      win.on("focus", () => host.querySelector(".nt-input")?.focus({ preventScroll: true }));
      win.on("close", () => term?.destroy());
      await start(false);
    },
  });
})();
