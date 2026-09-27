"use strict";
// Free Games shelf (coleforge/desktop/freegames.js + unzip.js): catalog rules, the unzipper, and a full
// install -> play -> remove run against a local server.   node coleforge/tests/freegames.test.js
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const { unzip } = require("../desktop/unzip.js");
const { createFreeGames, CATALOG, ENGINES, ALLOWED_HOSTS } = require("../desktop/freegames.js");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nc-freegames-"));
// Test zips come from Python's zipfile (stored + deflated entries, like real game zips).
function makeZip(file, entries, { method = "deflated" } = {}) {
  execFileSync("python3", ["-c", `
import json, sys, zipfile
entries = json.loads(sys.argv[2])
with zipfile.ZipFile(sys.argv[1], "w", zipfile.ZIP_DEFLATED if sys.argv[3] == "deflated" else zipfile.ZIP_STORED) as z:
    for name, text in entries:
        if name.endswith("/"): z.writestr(zipfile.ZipInfo(name), "")
        else: z.writestr(name, text)
`, file, JSON.stringify(entries), method]);
  return file;
}
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

(async () => {
  try {
    /* ---------- catalog ---------- */
    const ids = new Set();
    for (const g of CATALOG) {
      assert.ok(!ids.has(g.id), `duplicate ${g.id}`); ids.add(g.id);
      assert.ok(g.license && g.about && g.name && g.year, g.id);
      assert.ok(g.engine === "arcade" || ENGINES[g.engine], `${g.id} engine`);
      for (const f of g.files) {
        const u = new URL(f.url);
        assert.strictEqual(u.protocol, "https:", f.url);
        assert.ok(ALLOWED_HOSTS.has(u.hostname), f.url);
        assert.match(f.sha256, /^[0-9a-f]{64}$/, f.url);
        assert.ok(f.size > 0 && f.size < 2 ** 32, f.url);
      }
    }
    for (const e of Object.values(ENGINES)) for (const f of e.files) { assert.match(f.sha256, /^[0-9a-f]{64}$/); assert.strictEqual(new URL(f.url).protocol, "https:"); }
    assert.ok(!CATALOG.some((g) => g.files.some((f) => /abandon/i.test(f.url))));
    console.log(`ok - catalog: ${CATALOG.length} games, official HTTPS sources, pinned checksums`);

    /* ---------- unzip ---------- */
    const z1 = makeZip(path.join(tmp, "nested.zip"), [["game-1.0/", ""], ["game-1.0/GAME.EXE", "MZ"], ["game-1.0/data/level1.dat", "x".repeat(5000)]]);
    let out = path.join(tmp, "u1");
    let r = unzip(z1, out);
    assert.ok(r.stripped);
    assert.strictEqual(fs.readFileSync(path.join(out, "GAME.EXE"), "utf8"), "MZ");
    assert.strictEqual(fs.readFileSync(path.join(out, "data", "level1.dat"), "utf8").length, 5000);
    const z2 = makeZip(path.join(tmp, "flat.zip"), [["vol.cat", "cat"], ["vol.dat", "dat"]], { method: "stored" });
    out = path.join(tmp, "u2");
    r = unzip(z2, out);
    assert.ok(!r.stripped);
    assert.deepStrictEqual(fs.readdirSync(out).sort(), ["vol.cat", "vol.dat"]);
    const z3 = makeZip(path.join(tmp, "evil.zip"), [["ok.txt", "fine"], ["../escaped.txt", "nope"]]);
    assert.throws(() => unzip(z3, path.join(tmp, "u3")), /Unsafe path/);
    assert.ok(!fs.existsSync(path.join(tmp, "escaped.txt")));
    fs.writeFileSync(path.join(tmp, "not.zip"), "hello");
    assert.throws(() => unzip(path.join(tmp, "not.zip"), path.join(tmp, "u4")), /Not a ZIP/);
    console.log("ok - unzip: stored + deflated, drops a single top folder, refuses ../ entries and non-zips");

    /* ---------- install / play / remove against a local server ---------- */
    const serve = path.join(tmp, "serve");
    fs.mkdirSync(serve);
    const engineZip = makeZip(path.join(serve, "engine.zip"), [["scummvm-test/", ""], ["scummvm-test/scummvm.exe", "MZ-engine"], ["scummvm-test/README", "r"]]);
    const gameZip = makeZip(path.join(serve, "game.zip"), [["sky.dnr", "dnr"], ["sky.dsk", "dsk"]]);
    const extraZip = makeZip(path.join(serve, "extra.zip"), [["music/track01.ogg", "ogg"]]);
    const srv = http.createServer((req, res) => {
      const f = path.join(serve, path.basename(req.url));
      if (!fs.existsSync(f)) return res.writeHead(404).end();
      res.writeHead(200, { "Content-Length": fs.statSync(f).size }).end(fs.readFileSync(f));
    });
    await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
    const base = `http://127.0.0.1:${srv.address().port}/`;
    const file = (name, f) => ({ url: base + name, size: fs.statSync(f).size, sha256: sha(f) });
    const catalog = [
      { id: "sky", name: "Beneath: A Test", year: 1994, by: "t", genre: "Adventure", engine: "scummvm", about: "a", license: "l", files: [file("game.zip", gameZip), file("extra.zip", extraZip)] },
      { id: "bad", name: "Bad Checksum", year: 1990, by: "t", genre: "Action", engine: "scummvm", about: "a", license: "l", files: [Object.assign(file("game.zip", gameZip), { sha256: "0".repeat(64) })] },
      { id: "far", name: "Far Away", year: 1990, by: "t", genre: "Action", engine: "scummvm", about: "a", license: "l", files: [{ url: "https://example.com/x.zip", size: 1, sha256: "0".repeat(64) }] },
    ];
    const engines = { scummvm: { name: "ScummVM test", files: [file("engine.zip", engineZip)], exe: ["scummvm.exe"] } };
    const home = path.join(tmp, "Desktop", "NightCode");
    const fg = createFreeGames({ home, catalog, engines, allowedHosts: new Set(["127.0.0.1"]) });

    let l = fg.list();
    assert.strictEqual(l.items.length, 3);
    assert.ok(!l.items[0].installed && !l.engines.scummvm.installed);
    assert.throws(() => fg.launchSpec("sky"), /isn't installed/);

    const events = [];
    const item = await fg.install("sky", (p) => events.push(Object.assign({}, p)));
    assert.ok(item.installed);
    assert.ok(events.some((e) => e.engine === "ScummVM test"), "engine fetched first");
    assert.ok(events.some((e) => e.phase === "unpack"));
    assert.strictEqual(events.at(-1).phase, "done");
    const gdir = path.join(home, "Games", "Beneath A Test");
    assert.strictEqual(item.dir, gdir);
    assert.strictEqual(fs.readFileSync(path.join(gdir, "sky.dnr"), "utf8"), "dnr");
    assert.strictEqual(fs.readFileSync(path.join(gdir, "music", "track01.ogg"), "utf8"), "ogg");
    assert.ok(fs.existsSync(path.join(home, "Games", "_Engines", "scummvm", "scummvm.exe")));
    assert.deepStrictEqual(fs.readdirSync(path.join(home, "Games", "_Downloads")), []);
    console.log("ok - install: engine first, every file checked and unpacked into Desktop\\NightCode\\Games");

    const spec = fg.launchSpec("sky");
    assert.strictEqual(spec.exe, path.join(home, "Games", "_Engines", "scummvm", "scummvm.exe"));
    assert.deepStrictEqual(spec.args, [`--path=${gdir}`, `--savepath=${path.join(home, "Games", "_Saves", "sky")}`, "--auto-detect"]);
    assert.ok(fs.existsSync(path.join(home, "Games", "_Saves", "sky")));
    console.log("ok - play: ScummVM with the game folder, saves in Games\\_Saves");

    await assert.rejects(fg.install("bad"), /checksum/);
    assert.ok(!fs.existsSync(path.join(home, "Games", "Bad Checksum")));
    assert.ok(!fs.existsSync(path.join(home, "Games", "Bad Checksum.partial")));
    await assert.rejects(fg.install("far"), /approved source/);
    console.log("ok - a wrong checksum or an unapproved host installs nothing");

    assert.ok(fg.uninstall("sky"));
    assert.ok(!fs.existsSync(gdir));
    assert.ok(fs.existsSync(path.join(home, "Games", "_Saves", "sky")), "saves kept");
    assert.ok(fg.list().engines.scummvm.installed, "engine kept for the other games");
    console.log("ok - remove keeps saves and the engine");

    srv.close();
    console.log("all freegames tests passed");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
