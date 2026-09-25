"use strict";
// nightcode.coletechsystems.com: boot NightCode-DOS with the Supabase settings from config.js.
// WIN / WEB / OPS hand over to the NightCode desktop at /desktop/ (same origin, so it shares the
// signed-in session); shutting the desktop down comes back here with ?from=win.
(function () {
  const cfg = window.NIGHTCODE_CONFIG || {};
  let api = null;
  try {
    if (cfg.supabaseUrl && cfg.supabaseAnonKey) api = NightCodeAPI.create({ url: cfg.supabaseUrl, anonKey: cfg.supabaseAnonKey, redirectTo: cfg.siteUrl || location.origin + "/" });
  } catch (e) { console.error(e); }
  const params = new URLSearchParams(location.search);
  const back = params.get("from") === "win";
  if (back) history.replaceState(null, "", location.pathname + location.hash);
  function launch(target, arg) {
    const q = new URLSearchParams();
    if (target === "web") { q.set("open", "nightbrowser"); if (arg) q.set("url", arg); }
    if (target === "ops") q.set("open", "nightops");
    setTimeout(() => { location.href = "desktop/" + (q.toString() ? "?" + q : ""); }, 350);
  }
  window.nightcode = NightTerminal.mount(document.getElementById("term"), { api, config: cfg, host: "web", launch, skipBoot: back });
})();
