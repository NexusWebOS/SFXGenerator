"use strict";

// NightCode <-> Google Drive. Google Drive for desktop (drive.google.com/download) puts your Drive on
// this computer as a folder, usually G:\My Drive on Windows; NightCode uses the "NightCode" folder in
// it, so everything saved there shows up in Google Drive on the web and your phone, and the other way
// round. No Google sign-in inside NightCode: Drive for desktop does the syncing.
//
//   GET  /api/drive/status               { connected, folder, how, candidates }
//   POST /api/drive/folder  { folder }   use another folder ("" goes back to finding it by itself)
//   GET  /api/drive/list?path=sub/dir    { path, entries: [{ name, dir, size, modified }] }
//   GET  /api/drive/file?path=a/b.txt    the file's bytes
//   PUT  /api/drive/file?path=a/b.txt    write the request body (up to 64 MB); folders are made as needed
//   POST /api/drive/mkdir?path=new/dir
//   POST /api/drive/delete?path=a/b.txt  (Drive for desktop moves it to Drive's Trash for 30 days)
//   POST /api/drive/rename?path=a&to=b
//
// Like Albert's endpoints: loopback only, and the browser must send X-ColeForge-Drive: 1 from a
// same-origin page (other websites can't send that header without a refused CORS preflight).
// Folder choice: NIGHTCODE_DRIVE_DIR, else ~/.coleforge/drive-folder, else Drive for desktop's folder.

const fs = require("fs");
const os = require("os");
const path = require("path");

const HOME = process.env.COLEFORGE_HOME || path.join(os.homedir(), ".coleforge");
const CHOICE_FILE = path.join(HOME, "drive-folder");
const MAX_FILE = 64 * 1024 * 1024;
const FOLDER_NAME = "NightCode";

const MIME = {
  ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8", ".json": "application/json", ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".csv": "text/csv; charset=utf-8", ".log": "text/plain; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp", ".svg": "image/svg+xml",
  ".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".mid": "audio/midi", ".mp4": "video/mp4", ".webm": "video/webm",
  ".zip": "application/zip", ".pdf": "application/pdf", ".wsz": "application/zip",
};

// Where Drive for desktop keeps "My Drive" on this computer.
function myDriveCandidates() {
  const out = [];
  const home = os.homedir();
  if (process.platform === "win32") {
    for (const l of "GHIJKLMNOPQRSTUVWXYZDEF") out.push(`${l}:\\My Drive`, `${l}:\\Meine Ablage`, `${l}:\\Mi unidad`, `${l}:\\Mon Drive`);
    out.push(path.join(home, "Google Drive", "My Drive"), path.join(home, "My Drive"), path.join(home, "Google Drive"));
  } else if (process.platform === "darwin") {
    const cs = path.join(home, "Library", "CloudStorage");
    try { for (const d of fs.readdirSync(cs)) if (d.startsWith("GoogleDrive-")) out.push(path.join(cs, d, "My Drive")); } catch { /* none */ }
    out.push("/Volumes/GoogleDrive/My Drive", path.join(home, "Google Drive", "My Drive"), path.join(home, "Google Drive"));
  } else {
    out.push(path.join(home, "GoogleDrive"), path.join(home, "google-drive"), path.join(home, "Google Drive"));
  }
  return out;
}
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

function savedChoice() { try { return fs.readFileSync(CHOICE_FILE, "utf8").trim() || null; } catch { return null; } }

// Returns { folder, how } or { folder: null, why }.
function resolveFolder() {
  if (process.env.NIGHTCODE_DRIVE_DIR) {
    const f = path.resolve(process.env.NIGHTCODE_DRIVE_DIR);
    return isDir(f) ? { folder: f, how: "NIGHTCODE_DRIVE_DIR" } : { folder: null, why: `NIGHTCODE_DRIVE_DIR (${f}) isn't a folder.` };
  }
  const chosen = savedChoice();
  if (chosen) return isDir(chosen) ? { folder: chosen, how: "chosen in NightCode" } : { folder: null, why: `The folder you picked (${chosen}) isn't there. Is Google Drive for desktop running?` };
  for (const md of myDriveCandidates()) {
    if (!isDir(md)) continue;
    const f = path.join(md, FOLDER_NAME);
    try { fs.mkdirSync(f, { recursive: true }); } catch { continue; }
    return { folder: f, how: "Google Drive for desktop" };
  }
  return { folder: null, why: "Google Drive for desktop isn't installed or signed in on this computer." };
}

class DriveError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

// A path inside the NightCode folder; refuses anything that climbs out of it (.., absolute, links).
function inside(base, rel) {
  const clean = String(rel || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (clean.split("/").some((s) => s === "..")) throw new DriveError(400, "Bad path.");
  const full = path.resolve(base, clean);
  if (full !== base && !full.startsWith(base + path.sep)) throw new DriveError(400, "Bad path.");
  let real = full;
  try { real = fs.realpathSync(full); } catch { /* new file: check its folder */ try { real = path.join(fs.realpathSync(path.dirname(full)), path.basename(full)); } catch { /* folder is new too */ } }
  const realBase = fs.realpathSync(base);
  if (real !== realBase && !real.startsWith(realBase + path.sep)) throw new DriveError(400, "Bad path.");
  return full;
}
const validName = (n) => n && !/[<>:"|?*\x00-\x1f]/.test(n) && !/^\.+$/.test(n) && n.length < 240;

const isLoopback = (req) => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { const u = new URL(o); return ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) || u.host === req.headers.host; } catch { return false; }
}
const send = (res, status, body) => res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify(body));

async function readBody(req, limit) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw new DriveError(413, `Files over ${limit / 1048576} MB go straight into Google Drive.`); chunks.push(c); }
  return Buffer.concat(chunks);
}

async function handle(req, res, url) {
  try {
    if (!isLoopback(req)) return send(res, 403, { error: "Google Drive is only available on this computer." });
    if (req.headers["x-coleforge-drive"] !== "1" || !sameOrigin(req)) return send(res, 403, { error: "Not from the NightCode desktop." });
    const op = url.pathname.slice("/api/drive/".length);
    const q = url.searchParams;

    if (op === "status") {
      const r = resolveFolder();
      return send(res, 200, { connected: !!r.folder, folder: r.folder, how: r.how || null, why: r.why || null, chosen: savedChoice(),
        candidates: myDriveCandidates().filter(isDir) });
    }
    if (op === "folder" && req.method === "POST") {
      let body = {};
      try { body = JSON.parse((await readBody(req, 8192)).toString("utf8") || "{}"); } catch { throw new DriveError(400, "Bad JSON."); }
      const f = String(body.folder || "").trim();
      fs.mkdirSync(HOME, { recursive: true, mode: 0o700 });
      if (!f) { fs.rmSync(CHOICE_FILE, { force: true }); return send(res, 200, { ok: true }); }
      const abs = path.resolve(f);
      if (!isDir(abs)) throw new DriveError(400, `${abs} isn't a folder.`);
      fs.writeFileSync(CHOICE_FILE, abs + "\n");
      return send(res, 200, { ok: true, folder: abs });
    }

    const { folder, why } = resolveFolder();
    if (!folder) throw new DriveError(409, why);
    const rel = q.get("path") || "";

    if (op === "list" && req.method === "GET") {
      const dir = inside(folder, rel);
      if (!isDir(dir)) throw new DriveError(404, "That folder isn't there any more.");
      const entries = [];
      for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
        if (d.name.startsWith(".") || d.name === "desktop.ini" || d.name.startsWith("~$")) continue;
        let st; try { st = fs.statSync(path.join(dir, d.name)); } catch { continue; }
        entries.push({ name: d.name, dir: st.isDirectory(), size: st.isDirectory() ? null : st.size, modified: st.mtimeMs });
      }
      entries.sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      return send(res, 200, { path: rel, entries });
    }
    if (op === "file" && req.method === "GET") {
      const file = inside(folder, rel);
      let st; try { st = fs.statSync(file); } catch { throw new DriveError(404, "File not found."); }
      if (!st.isFile()) throw new DriveError(400, "That's a folder.");
      res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": "no-store" });
      fs.createReadStream(file).pipe(res);
      return;
    }
    if (op === "file" && req.method === "PUT") {
      const file = inside(folder, rel);
      if (!validName(path.basename(file))) throw new DriveError(400, "That name has characters Windows doesn't allow.");
      const data = await readBody(req, MAX_FILE);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = file + ".nightcode-tmp";
      fs.writeFileSync(tmp, data);
      fs.renameSync(tmp, file);
      return send(res, 200, { ok: true, size: data.length });
    }
    if (op === "mkdir" && req.method === "POST") {
      const dir = inside(folder, rel);
      if (!validName(path.basename(dir))) throw new DriveError(400, "That name has characters Windows doesn't allow.");
      fs.mkdirSync(dir, { recursive: true });
      return send(res, 200, { ok: true });
    }
    if (op === "delete" && req.method === "POST") {
      const target = inside(folder, rel);
      if (target === folder) throw new DriveError(400, "That's the whole NightCode folder.");
      if (!fs.existsSync(target)) throw new DriveError(404, "Already gone.");
      fs.rmSync(target, { recursive: true });
      return send(res, 200, { ok: true });
    }
    if (op === "rename" && req.method === "POST") {
      const from = inside(folder, rel), to = inside(folder, q.get("to"));
      if (from === folder) throw new DriveError(400, "That's the whole NightCode folder.");
      if (!validName(path.basename(to))) throw new DriveError(400, "That name has characters Windows doesn't allow.");
      if (fs.existsSync(to)) throw new DriveError(409, "Something with that name is already there.");
      fs.renameSync(from, to);
      return send(res, 200, { ok: true });
    }
    return send(res, 404, { error: "Unknown Drive request." });
  } catch (e) {
    if (res.headersSent) return;
    send(res, e.status || 500, { error: e.status ? e.message : `Drive: ${e.code || e.message}` });
  }
}

module.exports = { handle, resolveFolder, myDriveCandidates };
