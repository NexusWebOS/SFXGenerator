"use strict";
// Serves web/nightcode the way Netlify will: the headers and redirects from its netlify.toml (so the
// CSPs get tested), 404.html, and the /api/ops function. No Netlify CLI needed.
//   node coleforge/web/nightcode/build-config.js      (writes config.js and desktop/ first)
//   node coleforge/tests/netlify-dev.js 8200 [--fake-upstreams]
// --fake-upstreams answers GitHub and Netlify API calls with canned data (tests/fake-upstreams.js).
const http = require("http");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const ROOT = path.join(__dirname, "../web/nightcode");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".ttf": "font/ttf", ".woff2": "font/woff2", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg",
  ".wasm": "application/wasm", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown", ".wsz": "application/zip", ".zip": "application/zip", ".webp": "image/webp", ".cur": "image/x-icon", ".ani": "application/octet-stream" };

// Just enough TOML for netlify.toml: [[headers]] / [headers.values] / [[redirects]] with string, number and bool values.
function parseNetlifyToml(text) {
  const out = { headers: [], redirects: [] };
  let cur = null, mode = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line === "[[headers]]") { cur = { for: "", values: {} }; out.headers.push(cur); mode = "header"; continue; }
    if (line === "[headers.values]") { mode = "values"; continue; }
    if (line === "[[redirects]]") { cur = {}; out.redirects.push(cur); mode = "redirect"; continue; }
    if (line.startsWith("[")) { mode = null; continue; }
    const m = /^([\w.-]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|(\d+)|(true|false))\s*$/.exec(line);
    if (!m || !mode) continue;
    const v = m[2] !== undefined ? m[2].replace(/\\"/g, '"') : m[3] !== undefined ? +m[3] : m[4] === "true";
    if (mode === "values") cur.values[m[1]] = v; else if (mode === "header" && m[1] === "for") cur.for = v; else if (mode === "redirect") cur[m[1]] = v;
  }
  return out;
}
const matches = (pattern, p) => {
  if (pattern === p) return true;
  const re = new RegExp("^" + pattern.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
  return re.test(p);
};

async function start(port, { fakeUpstreams = false, connect = process.env.NETLIFY_DEV_CONNECT || "" } = {}) {
  // A local mock Supabase isn't https://*.supabase.co: let the page's CSP reach it.
  const allowConnect = (headers) => { if (connect && headers["Content-Security-Policy"]) headers["Content-Security-Policy"] = headers["Content-Security-Policy"].replace("connect-src ", `connect-src ${connect} `); };
  if (fakeUpstreams) require("./fake-upstreams.js").install();
  const conf = parseNetlifyToml(fs.readFileSync(path.join(ROOT, "netlify.toml"), "utf8"));
  const ops = (await import(pathToFileURL(path.join(ROOT, "netlify/functions/ops.mjs")).href)).default;
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://localhost");
    let p = decodeURIComponent(u.pathname);
    const headers = {};
    for (const hd of conf.headers) if (matches(hd.for, p)) Object.assign(headers, hd.values);
    allowConnect(headers);
    if (p === "/api/ops") {
      let body = "";
      for await (const c of req) body += c;
      const r = await ops(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers: req.headers, body: ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : body }));
      res.writeHead(r.status, Object.fromEntries(r.headers));
      return res.end(Buffer.from(await r.arrayBuffer()));
    }
    for (const rd of conf.redirects) {
      if (matches(rd.from, p) && rd.force && rd.status === 404) {
        res.writeHead(404, Object.assign({ "Content-Type": MIME[".html"] }, headers));
        return res.end(fs.readFileSync(path.join(ROOT, "404.html")));
      }
    }
    let file = path.join(ROOT, p);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!p.endsWith("/")) { res.writeHead(301, { Location: p + "/" + u.search }); return res.end(); }
      file = path.join(file, "index.html");
      p += "index.html";
      for (const hd of conf.headers) if (matches(hd.for, p)) Object.assign(headers, hd.values);
      allowConnect(headers);
    }
    if (!fs.existsSync(file)) {
      res.writeHead(404, Object.assign({ "Content-Type": MIME[".html"] }, headers));
      return res.end(fs.readFileSync(path.join(ROOT, "404.html")));
    }
    res.writeHead(200, Object.assign({ "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" }, headers));
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  return server;
}

module.exports = { start, parseNetlifyToml, matches };
if (require.main === module) {
  const port = +process.argv[2] || 8200;
  start(port, { fakeUpstreams: process.argv.includes("--fake-upstreams") }).then(() => console.log(`NightCode site on http://127.0.0.1:${port}`));
}
