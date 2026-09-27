"use strict";
// NightCode <-> Google Drive file API (coleforge/server/drive.js), against a stand-in "My Drive" folder.
//   node coleforge/tests/drive.test.js
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const PORT = 19000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nc-drive-"));
const myDrive = path.join(tmp, "My Drive", "NightCode");
fs.mkdirSync(myDrive, { recursive: true });
fs.writeFileSync(path.join(tmp, "secret.txt"), "outside");
const home = path.join(tmp, "home");

const H = { "X-ColeForge-Drive": "1" };
const req = (p, opt = {}) => fetch(BASE + "/api/drive/" + p, Object.assign({ headers: H }, opt));
const json = async (p, opt) => { const r = await req(p, opt); return { status: r.status, body: await r.json() }; };

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "../server/forgechat-server.js"), "--port", String(PORT), "--host", "127.0.0.1"],
    { env: Object.assign({}, process.env, { NIGHTCODE_DRIVE_DIR: myDrive, COLEFORGE_HOME: home, ZANDRONUM_LAN: "0" }), stdio: "ignore" });
  try {
    for (let i = 0; i < 50; i++) { try { await fetch(BASE + "/"); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }

    assert.strictEqual((await fetch(BASE + "/api/drive/status")).status, 403);
    assert.strictEqual((await fetch(BASE + "/api/drive/status", { headers: Object.assign({ Origin: "https://evil.example" }, H) })).status, 403);
    console.log("ok - needs the desktop's header and a same-origin page");

    const st = await json("status");
    assert.strictEqual(st.status, 200);
    assert.ok(st.body.connected);
    assert.strictEqual(st.body.folder, myDrive);
    console.log("ok - status finds the folder");

    assert.strictEqual((await json("file?path=" + encodeURIComponent("Game ideas/boss.md"), { method: "PUT", body: "# Boss\nbig laser" })).status, 200);
    assert.strictEqual(fs.readFileSync(path.join(myDrive, "Game ideas", "boss.md"), "utf8"), "# Boss\nbig laser");
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 255]);
    await req("file?path=ship.png", { method: "PUT", body: png });
    const got = await req("file?path=ship.png");
    assert.strictEqual(got.headers.get("content-type"), "image/png");
    assert.deepStrictEqual(Buffer.from(await got.arrayBuffer()), png);
    assert.strictEqual(await (await req("file?path=" + encodeURIComponent("Game ideas/boss.md"))).text(), "# Boss\nbig laser");
    console.log("ok - writes (making folders) and reads text and binary files");

    fs.writeFileSync(path.join(myDrive, "desktop.ini"), "x");
    const ls = await json("list?path=");
    assert.deepStrictEqual(ls.body.entries.map((e) => [e.name, e.dir]), [["Game ideas", true], ["ship.png", false]]);
    assert.strictEqual(ls.body.entries[1].size, png.length);
    console.log("ok - lists folders first and hides desktop.ini");

    assert.strictEqual((await json("mkdir?path=Music", { method: "POST" })).status, 200);
    assert.strictEqual((await json("rename?path=ship.png&to=" + encodeURIComponent("Music/ship2.png"), { method: "POST" })).status, 200);
    assert.ok(fs.existsSync(path.join(myDrive, "Music", "ship2.png")));
    assert.strictEqual((await json("delete?path=Music", { method: "POST" })).status, 200);
    assert.ok(!fs.existsSync(path.join(myDrive, "Music")));
    assert.strictEqual((await json("delete?path=", { method: "POST" })).status, 400);
    console.log("ok - mkdir, rename, delete; the NightCode folder itself can't be deleted");

    for (const bad of ["../secret.txt", "..\\secret.txt", "a/../../secret.txt", path.join(tmp, "secret.txt")]) {
      const r = await req("file?path=" + encodeURIComponent(bad));
      assert.ok(r.status === 400 || r.status === 404, `${bad} -> ${r.status}`);
      if (r.status === 404) assert.ok(!(await r.text()).includes("outside"));
    }
    assert.strictEqual((await json("file?path=" + encodeURIComponent("../escape.txt"), { method: "PUT", body: "x" })).status, 400);
    assert.ok(!fs.existsSync(path.join(tmp, "My Drive", "escape.txt")));
    if (process.platform !== "win32") {
      fs.symlinkSync(tmp, path.join(myDrive, "link"));
      assert.strictEqual((await req("file?path=" + encodeURIComponent("link/secret.txt"))).status, 400);
    }
    assert.strictEqual((await json("file?path=" + encodeURIComponent("bad:name.txt"), { method: "PUT", body: "x" })).status, 400);
    console.log("ok - nothing outside the NightCode folder can be read or written");

    console.log("all drive tests passed");
  } finally {
    srv.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
