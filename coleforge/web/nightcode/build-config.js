"use strict";
// Netlify build step: writes config.js and config.json from environment variables.
//   NIGHTCODE_SUPABASE_URL       https://<ref>.supabase.co
//   NIGHTCODE_SUPABASE_ANON_KEY  the project's anon (public) key
//   NIGHTCODE_SITE_URL           optional, defaults to https://nightcode.coletechsystems.com/
// ColeForge.exe reads config.json, so the desktop program follows the site's settings.
const fs = require("fs");
const path = require("path");
const url = (process.env.NIGHTCODE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
const anonKey = (process.env.NIGHTCODE_SUPABASE_ANON_KEY || "").trim();
const siteUrl = (process.env.NIGHTCODE_SITE_URL || "https://nightcode.coletechsystems.com/").trim();
if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(url) && !process.env.NIGHTCODE_ALLOW_CUSTOM_URL) {
  console.error(`NIGHTCODE_SUPABASE_URL doesn't look like a Supabase project URL: ${url}`);
  process.exit(1);
}
if (/service_role/.test(Buffer.from((anonKey.split(".")[1] || ""), "base64").toString())) {
  console.error("NIGHTCODE_SUPABASE_ANON_KEY is the service_role key. Use the anon key: the service key must never reach a browser.");
  process.exit(1);
}
if (!url || !anonKey) console.warn("NightCode: NIGHTCODE_SUPABASE_URL / NIGHTCODE_SUPABASE_ANON_KEY aren't set; the site boots in guest mode.");
const cfg = { supabaseUrl: url, supabaseAnonKey: anonKey, siteUrl };
fs.writeFileSync(path.join(__dirname, "config.js"), `window.NIGHTCODE_CONFIG = ${JSON.stringify(cfg, null, 2)};\n`);
fs.writeFileSync(path.join(__dirname, "config.json"), JSON.stringify(cfg, null, 2) + "\n");
console.log(`NightCode: config written (${url || "no backend"}).`);
