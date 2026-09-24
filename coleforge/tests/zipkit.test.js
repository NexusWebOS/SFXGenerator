"use strict";
// ZipKit (WinNight's archive engine) against independent implementations:
// Python's zipfile/tarfile, Info-ZIP's zip/unzip and, when installed, pyzipper for WinZip AES.
//   node coleforge/tests/zipkit.test.js
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
const ZipKit = require("../shell/js/zipkit.js");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zipkit-"));
const py = (code, ...args) => execFileSync("python3", ["-c", code, ...args], { encoding: "utf8" }).trim();
const has = (cmd) => spawnSync("sh", ["-c", `command -v ${cmd}`]).status === 0;
const hasPyzipper = spawnSync("python3", ["-c", "import pyzipper"]).status === 0;
const te = new TextEncoder(), td = new TextDecoder();
const hex = (b) => Buffer.from(b).toString("hex");
let passed = 0;
const ok = (name) => { passed++; console.log("ok -", name); };

const FILES = [
  { name: "readme.txt", data: te.encode("Enter the NightCode.\n".repeat(200)), mtime: new Date(2026, 8, 24, 20, 15, 30) },
  { name: "bin/random.bin", data: Uint8Array.from({ length: 5000 }, (_, i) => (i * 2654435761) >>> 24) },
  { name: "empty.txt", data: new Uint8Array(0) },
  { name: "ünïcödé/名前.txt", data: te.encode("utf-8 names") },
  { name: "docs/", dir: true },
];

(async () => {
  // 1. Building blocks.
  assert.strictEqual(ZipKit.crc32(te.encode("123456789")), 0xcbf43926);
  const key = Uint8Array.from({ length: 32 }, (_, i) => i), pt = Uint8Array.from(Buffer.from("00112233445566778899aabbccddeeff", "hex"));
  assert.strictEqual(hex(ZipKit.aes.block(ZipKit.aes.key(key), pt, new Uint8Array(16))), "8ea2b7ca516745bfeafc49904b496089");  // FIPS-197 C.3
  const k128 = Uint8Array.from({ length: 16 }, (_, i) => i);
  assert.strictEqual(hex(ZipKit.aes.block(ZipKit.aes.key(k128), pt, new Uint8Array(16))), "69c4e0d86a7b0430d8cdb78070b4c55a");  // FIPS-197 C.1
  ok("CRC-32 check value and FIPS-197 AES-128/256 vectors");

  // 2. ZipKit writes → Python and unzip read.
  const zipBytes = await ZipKit.writeZip(FILES, { comment: "WinNight test archive" });
  const zipPath = path.join(tmp, "nightcode.zip");
  fs.writeFileSync(zipPath, zipBytes);
  const pyList = JSON.parse(py(`import zipfile,sys,json
z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None
print(json.dumps({"names":z.namelist(),"comment":z.comment.decode(),"readme":z.read("readme.txt").decode()[:20],"bin":z.read("bin/random.bin").hex()[:40],"u":z.read("ünïcödé/名前.txt").decode()}))`, zipPath));
  assert.deepStrictEqual(pyList.names, FILES.map(f => f.name));
  assert.strictEqual(pyList.comment, "WinNight test archive");
  assert.strictEqual(pyList.readme, "Enter the NightCode.");
  assert.strictEqual(pyList.bin, hex(FILES[1].data).slice(0, 40));
  assert.strictEqual(pyList.u, "utf-8 names");
  if (has("unzip")) assert.match(execFileSync("unzip", ["-t", zipPath], { encoding: "utf8" }), /No errors detected/);
  ok("ZIP written by ZipKit passes Python zipfile.testzip and unzip -t (deflate, stored, UTF-8, dirs, comment)");

  // 3. ZipKit reads what Python writes.
  const pyZip = path.join(tmp, "py.zip");
  py(`import zipfile,sys
with zipfile.ZipFile(sys.argv[1],"w") as z:
  z.writestr(zipfile.ZipInfo("stored.txt"), "stored data")
  z.writestr("deflated.txt", "night "*500, compress_type=zipfile.ZIP_DEFLATED)
  z.writestr("folder/", "")
  z.comment=b"from python"`, pyZip);
  const read = ZipKit.readZip(fs.readFileSync(pyZip));
  assert.strictEqual(read.comment, "from python");
  assert.strictEqual(td.decode(await ZipKit.extract(read, read.entries[0])), "stored data");
  assert.strictEqual(td.decode(await ZipKit.extract(read, read.entries[1])), "night ".repeat(500));
  assert.ok(read.entries[2].dir);
  ok("reads Python-made ZIPs (stored + deflate + folder + comment)");

  // 4. Round trip through ZipKit itself, and a damaged CRC is caught.
  const back = ZipKit.readZip(zipBytes);
  for (const f of FILES) {
    const e = back.entries.find(x => x.name === f.name);
    if (!f.dir) assert.strictEqual(hex(await ZipKit.extract(back, e)), hex(f.data));
  }
  assert.strictEqual(back.entries[0].mtime.getTime(), FILES[0].mtime.getTime());
  const bad = zipBytes.slice();
  const e0 = back.entries[1];
  bad[e0.lfh + 30 + te.encode(e0.name).length + 5] ^= 0xff;
  await assert.rejects(ZipKit.extract(ZipKit.readZip(bad), ZipKit.readZip(bad).entries[1]), /CRC|corrupt|invalid|incorrect|error/i);
  ok("round trip keeps bytes and timestamps; corrupted data is rejected");

  // 5. WinZip AES-256: ZipKit ↔ pyzipper.
  const aesBytes = await ZipKit.writeZip(FILES, { password: "hunter2" });
  const aesZip = ZipKit.readZip(aesBytes);
  assert.ok(aesZip.entries[0].encrypted && aesZip.entries[0].aes.strength === 3);
  assert.strictEqual(td.decode(await ZipKit.extract(aesZip, aesZip.entries[0], "hunter2")).slice(0, 20), "Enter the NightCode.");
  await assert.rejects(ZipKit.extract(aesZip, aesZip.entries[0], "wrong"), /Wrong password/);
  if (hasPyzipper) {
    const p = path.join(tmp, "aes.zip");
    fs.writeFileSync(p, aesBytes);
    const out = py(`import pyzipper,sys
z=pyzipper.AESZipFile(sys.argv[1]); z.setpassword(b"hunter2")
print(z.read("readme.txt").decode()[:20], z.read("bin/random.bin").hex()[:40])`, p);
    assert.strictEqual(out, `Enter the NightCode. ${hex(FILES[1].data).slice(0, 40)}`);
    const theirs = path.join(tmp, "theirs-aes.zip");
    py(`import pyzipper,sys
with pyzipper.AESZipFile(sys.argv[1],"w",compression=pyzipper.ZIP_DEFLATED,encryption=pyzipper.WZ_AES) as z:
  z.setpassword(b"s3cret"); z.writestr("msg.txt","from pyzipper "*40)`, theirs);
    const tz = ZipKit.readZip(fs.readFileSync(theirs));
    assert.strictEqual(td.decode(await ZipKit.extract(tz, tz.entries[0], "s3cret")), "from pyzipper ".repeat(40));
    ok("AES-256 archives open in pyzipper, and pyzipper's open in ZipKit");
  } else {
    console.log("skip - pyzipper not installed (pip install pyzipper) for the AES cross-check");
  }

  // 6. Legacy ZipCrypto from Info-ZIP.
  if (has("zip")) {
    fs.writeFileSync(path.join(tmp, "old.txt"), "legacy encryption ".repeat(30));
    execFileSync("zip", ["-q", "-P", "oldpass", "legacy.zip", "old.txt"], { cwd: tmp });
    const lz = ZipKit.readZip(fs.readFileSync(path.join(tmp, "legacy.zip")));
    assert.strictEqual(td.decode(await ZipKit.extract(lz, lz.entries[0], "oldpass")), "legacy encryption ".repeat(30));
    await assert.rejects(ZipKit.extract(lz, lz.entries[0], "nope"), /Wrong password|CRC/);
    ok("reads Info-ZIP ZipCrypto archives");
  }

  // 7. Raw copies keep encrypted entries without the password (delete / comment / add).
  const kept = await ZipKit.writeZip(aesZip.entries.filter(e => e.name !== "empty.txt").map(e => ({ name: e.name, dir: e.dir, raw: { zip: aesZip, entry: e } })), { comment: "edited" });
  const kz = ZipKit.readZip(kept);
  assert.strictEqual(kz.entries.length, FILES.length - 1);
  assert.strictEqual(kz.comment, "edited");
  assert.strictEqual(hex(await ZipKit.extract(kz, kz.entries.find(e => e.name === "bin/random.bin"), "hunter2")), hex(FILES[1].data));
  ok("editing an AES archive copies entries without decrypting them");

  // 8. Repair: a streamed ZIP (data descriptors) with its directory cut off.
  if (has("zip")) {
    const streamed = execFileSync("sh", ["-c", `cd ${tmp} && printf 'stream me %.0s' $(seq 1 300) > s.txt && cat s.txt | zip -q - - && true`]);
    const cut = streamed.subarray(0, streamed.length - 40);
    assert.throws(() => ZipKit.readZip(cut));
    const fixed = await ZipKit.repairZip(cut);
    assert.strictEqual(fixed.recovered, 1);
    const fz = ZipKit.readZip(fixed.bytes);
    assert.strictEqual(td.decode(await ZipKit.extract(fz, fz.entries[0])), fs.readFileSync(path.join(tmp, "s.txt"), "utf8"));
    ok("repairs a streamed ZIP64 archive with a missing central directory");
  }
  // Python writing to a pipe uses data descriptors (sizes after the data).
  const piped = execFileSync("python3", ["-c", `import zipfile,sys
class W:
  def __init__(s): s.b=sys.stdout.buffer
  def write(s,d): return s.b.write(d)
  def flush(s): s.b.flush()
with zipfile.ZipFile(W(),"w",zipfile.ZIP_DEFLATED) as z:
  z.writestr("one.txt","first file "*80); z.writestr("two.txt","second file "*90)`]);
  const pr = await ZipKit.repairZip(piped.subarray(0, piped.length - 30));
  const prz = ZipKit.readZip(pr.bytes);
  assert.deepStrictEqual(prz.entries.map(e => e.name), ["one.txt", "two.txt"]);
  assert.strictEqual(td.decode(await ZipKit.extract(prz, prz.entries[1])), "second file ".repeat(90));
  ok("repairs a data-descriptor ZIP (sizes after the data) with a missing directory");

  // 9. TAR both ways, pax long names, .tar.gz through open().
  const longName = "very/" + "deep/".repeat(25) + "file-with-a-long-name.txt";
  const tarFiles = [{ name: "a.txt", data: te.encode("alpha") }, { name: "dir/", dir: true }, { name: longName, data: te.encode("long") }];
  const tarPath = path.join(tmp, "t.tar");
  fs.writeFileSync(tarPath, ZipKit.writeTar(tarFiles));
  const tarOut = JSON.parse(py(`import tarfile,sys,json
t=tarfile.open(sys.argv[1]); print(json.dumps([[m.name, m.isdir(), t.extractfile(m).read().decode() if m.isfile() else ""] for m in t]))`, tarPath));
  assert.deepStrictEqual(tarOut, [["a.txt", false, "alpha"], ["dir", true, ""], [longName, false, "long"]]);
  const tgzPath = path.join(tmp, "p.tar.gz");
  py(`import tarfile,sys,io
with tarfile.open(sys.argv[1],"w:gz",format=tarfile.GNU_FORMAT) as t:
  for n,d in (("x.txt",b"xray"),("${"g/".repeat(60)}long.txt",b"gnu long")):
    i=tarfile.TarInfo(n); i.size=len(d); t.addfile(i,io.BytesIO(d))`, tgzPath);
  const tgz = await ZipKit.open(fs.readFileSync(tgzPath), "p.tar.gz");
  assert.strictEqual(tgz.format, "tar.gz");
  assert.deepStrictEqual(tgz.entries.map(e => e.name), ["x.txt", "g/".repeat(60) + "long.txt"]);
  assert.strictEqual(td.decode(await tgz.read(tgz.entries[1])), "gnu long");
  const own = await ZipKit.open(await ZipKit.write("tar.gz", tarFiles), "x.tgz");
  assert.strictEqual(td.decode(await own.read(own.entries.find(e => e.name === longName))), "long");
  ok("TAR/TAR.GZ written and read (ustar, pax and GNU long names)");

  // 10. Format sniffing.
  assert.strictEqual(ZipKit.sniff(zipBytes), "zip");
  assert.strictEqual(ZipKit.sniff(Uint8Array.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 1, 0])), "rar");
  assert.strictEqual(ZipKit.sniff(Uint8Array.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])), "7z");
  assert.strictEqual(ZipKit.sniff(fs.readFileSync(tgzPath), "p.tar.gz"), "tar.gz");
  ok("recognises ZIP, RAR, 7z and TAR.GZ");

  fs.rmSync(tmp, { recursive: true });
  console.log(`all zipkit tests passed (${passed})`);
})().catch((e) => { console.error(e); process.exit(1); });
