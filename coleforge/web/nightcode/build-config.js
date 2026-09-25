"use strict";
// Netlify build step: assembles dist/ (the published site) with config.js and config.json written from
// environment variables.
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
// Everything Netlify publishes goes into dist/: the site's own files, the config and the desktop. The
// backend source, the build scripts and node_modules stay out of it.
const OUT = path.join(__dirname, "dist");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of ["index.html", "404.html", "css", "js", "assets"]) {
  const src = path.join(__dirname, f);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(OUT, f), { recursive: true });
}
const cfg = { supabaseUrl: url, supabaseAnonKey: anonKey, siteUrl };
fs.writeFileSync(path.join(OUT, "config.js"), `window.NIGHTCODE_CONFIG = ${JSON.stringify(cfg, null, 2)};\n`);
fs.writeFileSync(path.join(OUT, "config.json"), JSON.stringify(cfg, null, 2) + "\n");
console.log(`NightCode: config written (${url || "no backend"}).`);

// The NightCode desktop (WIN at the DOS prompt) is the ColeForge shell, copied in at build time so the
// website and ColeForge.exe run the same code. It gets the site's config and the NightCode host script,
// which logs you on with your NightCode account and saves the desktop to your Supabase project.
const shell = path.join(__dirname, "../../shell");
const desk = path.join(OUT, "desktop");
if (fs.existsSync(shell)) {
  fs.rmSync(desk, { recursive: true, force: true });
  fs.cpSync(shell, desk, { recursive: true });
  const indexFile = path.join(desk, "index.html");
  let html = fs.readFileSync(indexFile, "utf8");
  const first = '<script src="js/icons.js"></script>';
  if (!html.includes(first)) { console.error("desktop/index.html: can't find where the scripts start"); process.exit(1); }
  html = html.replace(first, `<script src="../config.js"></script>\n  <script src="js/nightcode-host.js"></script>\n  ${first}`)
    .replace("<title>Windows – ColeForge Edition</title>", "<title>NightCode Windows</title>");
  fs.writeFileSync(indexFile, html);
  console.log("NightCode: desktop copied to dist/desktop/.");
} else console.warn("NightCode: ../../shell isn't here; the site has no desktop (WIN).");
