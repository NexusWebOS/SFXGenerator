"use strict";
// nightcode.coletechsystems.com: boot NightCode-DOS with the Supabase settings from config.js.
(function () {
  const cfg = window.NIGHTCODE_CONFIG || {};
  let api = null;
  try {
    if (cfg.supabaseUrl && cfg.supabaseAnonKey) api = NightCodeAPI.create({ url: cfg.supabaseUrl, anonKey: cfg.supabaseAnonKey, redirectTo: cfg.siteUrl || location.origin + "/" });
  } catch (e) { console.error(e); }
  window.nightcode = NightTerminal.mount(document.getElementById("term"), { api, config: cfg, host: "web" });
})();
