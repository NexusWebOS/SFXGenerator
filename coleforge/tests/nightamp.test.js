"use strict";
// NightAmp's skin files and Media Library tag reader.
//   node coleforge/tests/nightamp.test.js
// Tags written by mutagen (an independent implementation) are checked when it's installed;
// Ogg and MP4 headers are built by hand.
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
global.window = global;
require("../shell/js/zipkit.js");
require("../shell/js/nightamp-skin.js");
require("../shell/js/nightamp-library.js");
const ZipKit = global.ZipKit || require("../shell/js/zipkit.js");
const { NightSkin, NightLibrary } = global;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nightamp-"));
const hasMutagen = spawnSync("python3", ["-c", "import mutagen"]).status === 0;
const py = (code, ...args) => execFileSync("python3", ["-c", code, ...args], { encoding: "utf8" }).trim();
let passed = 0;
const ok = (name) => { passed++; console.log("ok -", name); };
const te = new TextEncoder();
const blobOf = (p) => new Blob([fs.readFileSync(p)]);
const concat = (...parts) => { const n = parts.reduce((a, p) => a + p.length, 0), out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const be32 = (n) => Uint8Array.of(n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
const le32 = (n) => Uint8Array.of(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24);

const SKINS = path.join(__dirname, "../shell/assets/art/nightapps/skins");
// Winamp 2 sheet sizes the sprite map expects.
const SIZES = { main: [275, 116], titlebar: [344, 87], cbuttons: [136, 36], shufrep: [92, 85], posbar: [307, 10], volume: [68, 433], balance: [68, 433],
  monoster: [56, 24], playpaus: [42, 9], numbers: [99, 13], nums_ex: [108, 13], text: [155, 18], eqmain: [275, 315], pledit: [280, 186], gen: [194, 109] };
const pngSize = (b) => [b.readUInt32BE(16), b.readUInt32BE(20)];
const bmpSize = (b) => [b.readInt32LE(18), Math.abs(b.readInt32LE(22))];

(async () => {
  /* ---------- skins ---------- */
  for (const { id, file } of NightSkin.BUILTIN) {
    for (const [sheet, [w, h]] of Object.entries(SIZES)) {
      const b = fs.readFileSync(path.join(SKINS, id, sheet + ".png"));
      assert.deepStrictEqual(pngSize(b), [w, h], `${id}/${sheet}.png size`);
    }
    const vis = NightSkin.parseViscolor(fs.readFileSync(path.join(SKINS, id, "viscolor.txt"), "latin1"));
    assert.strictEqual(vis.length, 24);
    assert.ok(vis.every(c => /^rgb\(\d+,\d+,\d+\)$/.test(c)));
    const ple = NightSkin.parsePledit(fs.readFileSync(path.join(SKINS, id, "pledit.txt"), "latin1"));
    for (const k of ["normal", "current", "normalbg", "selectedbg"]) assert.match(ple[k], /^#[0-9a-f]{6}$/i, `${id} pledit ${k}`);
    // The .wsz is a real Winamp skin: a ZIP of BMPs with Winamp's file names.
    const zip = ZipKit.readZip(fs.readFileSync(path.join(SKINS, file)));
    const names = zip.entries.map(e => e.name.toLowerCase());
    for (const [sheet, size] of Object.entries(SIZES)) {
      const e = zip.entries.find(x => x.name.toLowerCase() === sheet + ".bmp");
      assert.ok(e, `${file} has ${sheet}.bmp`);
      const bmp = Buffer.from(await ZipKit.extract(zip, e));
      assert.strictEqual(bmp.toString("latin1", 0, 2), "BM");
      assert.deepStrictEqual(bmpSize(bmp), size, `${file} ${sheet}.bmp size`);
    }
    assert.ok(names.includes("viscolor.txt") && names.includes("pledit.txt"));
    ok(`${id}: 15 sheets at Winamp sizes, viscolor/pledit, ${file}`);
  }
  // Every sprite fits inside its sheet.
  const SHEET_OF = { MAIN: "main", TITLEBAR: "titlebar", CBUTTONS: "cbuttons", SHUFREP: "shufrep", POSBAR: "posbar", VOLUME: "volume", BALANCE: "balance", MONOSTER: "monoster",
    PLAYPAUS: "playpaus", NUMBERS: "numbers", NUMS_EX: "nums_ex", EQMAIN: "eqmain", PLEDIT: "pledit", GEN: "gen" };
  let n = 0;
  for (const [sheet, sprites] of Object.entries(NightSkin.SPRITES)) {
    const size = SIZES[SHEET_OF[sheet]];
    if (!size) continue;
    for (const [name, [x, y, w0, h]] of Object.entries(sprites)) {
      const w = /WORKING_INDICATOR$/.test(name) ? 3 : w0;         // shown 3px wide (Webamp's map lists 9)
      assert.ok(x >= 0 && y >= 0 && x + w <= size[0] && y + h <= size[1], `${name} is inside ${sheet}`); n++;
    }
  }
  ok(`${n} sprites inside their sheets`);
  // Loose pledit.txt / viscolor.txt like real skins have.
  const p = NightSkin.parsePledit("[Text]\r\nNormal=00FF00\r\ncurrent = #FFFFFF\r\nNormalBG=#000000;junk\r\nSelectedBG=#0000C6\r\nFont=Arial\r\n[Other]\r\nNormal=#123456\r\n");
  assert.deepStrictEqual([p.normal, p.current, p.normalbg, p.selectedbg, p.font], ["#00FF00", "#FFFFFF", "#000000", "#0000C6", "Arial"]);
  const v = NightSkin.parseViscolor("0,0,0, // bg\n24,33,41 // dots\n300, 1, 2\n");
  assert.deepStrictEqual(v.slice(0, 3), ["rgb(0,0,0)", "rgb(24,33,41)", "rgb(255,1,2)"]);
  assert.strictEqual(v.length, 24);
  ok("pledit.txt / viscolor.txt parsing (no '#', spacing, other sections, short files)");

  /* ---------- tags ---------- */
  const want = { title: "Enter the Night", artist: "Cole Forge", album: "NightCode OST", year: "2026", genre: "Synthwave", track: 7 };
  const check = (t, label, w = want) => { for (const k of Object.keys(w)) assert.strictEqual(t[k], w[k], `${label}: ${k} = ${t[k]}`); };
  if (hasMutagen) {
    const f = path.join(tmp, "a.mp3");
    for (const [ver, enc] of [[3, 0], [3, 1], [4, 3], [4, 1]]) {
      fs.writeFileSync(f, Buffer.alloc(4096, 0xff));
      py(`import sys
from mutagen.id3 import ID3, TIT2, TPE1, TALB, TRCK, TCON, TYER, TDRC
t = ID3(); e = int(sys.argv[3])
t.add(TIT2(encoding=e, text="Enter the Night")); t.add(TPE1(encoding=e, text="Cole Forge")); t.add(TALB(encoding=e, text="NightCode OST"))
t.add(TRCK(encoding=e, text="7/12")); t.add(TCON(encoding=e, text="Synthwave"))
t.add(TDRC(encoding=e, text="2026-09-24"))
t.save(sys.argv[1], v2_version=int(sys.argv[2]))`, f, String(ver), String(enc));
      check(await NightLibrary.readTags(blobOf(f), "a.mp3"), `ID3v2.${ver} encoding ${enc}`);
    }
    ok("ID3v2.3 / 2.4 in Latin-1, UTF-16 and UTF-8 (mutagen)");
    // FLAC with Vorbis comments: a bare STREAMINFO, tagged by mutagen.
    const flac = path.join(tmp, "a.flac");
    const si = Buffer.alloc(34); si.writeUInt16BE(4096, 0); si.writeUInt16BE(4096, 2);
    si[10] = 0x0a; si[11] = 0xc4; si[12] = 0x42; si[13] = 0xf0;   // 44100 Hz, 2 ch, 16 bit
    fs.writeFileSync(flac, Buffer.concat([Buffer.from("fLaC"), Buffer.from([0x80, 0, 0, 34]), si]));
    py(`import sys
from mutagen.flac import FLAC
f = FLAC(sys.argv[1]); f["TITLE"] = "Enter the Night"; f["ARTIST"] = "Cole Forge"; f["ALBUM"] = "NightCode OST"; f["DATE"] = "2026"; f["GENRE"] = "Synthwave"; f["TRACKNUMBER"] = "7"; f.save()`, flac);
    check(await NightLibrary.readTags(blobOf(flac), "a.flac"), "FLAC");
    ok("FLAC Vorbis comments (mutagen)");
  } else console.log("skip - mutagen isn't installed (pip install mutagen)");

  // ID3v2.2 (3-letter frames) and ID3v1 by hand.
  const frame22 = (id, s) => { const body = concat(Uint8Array.of(0), te.encode(s)); return concat(te.encode(id), Uint8Array.of(0, 0, body.length), body); };
  const f22 = concat(frame22("TT2", "Enter the Night"), frame22("TP1", "Cole Forge"), frame22("TAL", "NightCode OST"), frame22("TYE", "2026"), frame22("TCO", "(17)"), frame22("TRK", "07"));
  const tag22 = concat(te.encode("ID3"), Uint8Array.of(2, 0, 0, 0, 0, (f22.length >> 7) & 127, f22.length & 127), f22);
  check(await NightLibrary.readTags(new Blob([tag22, new Uint8Array(512)]), "x.mp3"), "ID3v2.2", Object.assign({}, want, { genre: "Rock" }));
  const v1 = new Uint8Array(128); v1.set(te.encode("TAG"), 0); v1.set(te.encode("Enter the Night"), 3); v1.set(te.encode("Cole Forge"), 33); v1.set(te.encode("NightCode OST"), 63); v1.set(te.encode("2026"), 93); v1[126] = 7; v1[127] = 52;
  check(await NightLibrary.readTags(new Blob([new Uint8Array(1000).fill(0xff), v1]), "x.mp3"), "ID3v1", Object.assign({}, want, { genre: "Electronic" }));
  ok("ID3v2.2 and ID3v1 (numeric genres)");

  // Ogg Vorbis / Opus comment headers, split across pages.
  const vc = (vendor, pairs) => concat(le32(vendor.length), te.encode(vendor), le32(pairs.length), ...pairs.map(p => concat(le32(te.encode(p).length), te.encode(p))));
  const page = (payload, seq) => {
    const segs = []; let left = payload.length; while (left >= 255) { segs.push(255); left -= 255; } segs.push(left);
    return concat(te.encode("OggS"), Uint8Array.of(0, seq ? 0 : 2), new Uint8Array(8), le32(1), le32(seq), le32(0), Uint8Array.of(segs.length), Uint8Array.from(segs), payload);
  };
  const pairs = ["TITLE=Enter the Night", "ARTIST=Cole Forge", "ALBUM=NightCode OST", "DATE=2026-09-24", "GENRE=Synthwave", "TRACKNUMBER=7", "COMMENT=" + "x".repeat(400)];
  const ident = concat(Uint8Array.of(1), te.encode("vorbis"), new Uint8Array(4), Uint8Array.of(2), le32(44100), new Uint8Array(13));
  const oggV = concat(page(ident, 0), page(concat(Uint8Array.of(3), te.encode("vorbis"), vc("NightAmp test", pairs)), 1));
  check(await NightLibrary.readTags(new Blob([oggV]), "a.ogg"), "Ogg Vorbis");
  const oggO = concat(page(concat(te.encode("OpusHead"), Uint8Array.of(1, 2), new Uint8Array(9)), 0), page(concat(te.encode("OpusTags"), vc("NightAmp test", pairs)), 1));
  check(await NightLibrary.readTags(new Blob([oggO]), "a.opus"), "Opus");
  ok("Ogg Vorbis and Opus comments");

  // MP4 / M4A: ftyp, mdat before moov (like many encoders), iTunes ilst atoms, mdhd duration.
  const box = (type, ...kids) => { const body = concat(...kids); return concat(be32(8 + body.length), te.encode(type), body); };
  const data = (s) => box("data", be32(1), be32(0), te.encode(s));
  const latin = (s) => Uint8Array.from([...s].map(c => c.charCodeAt(0)));    // atom names like "\xa9nam" are single bytes
  const boxL = (type, ...kids) => { const body = concat(...kids); return concat(be32(8 + body.length), latin(type), body); };
  const ilst = boxL("ilst", boxL("\xa9nam", data("Enter the Night")), boxL("\xa9ART", data("Cole Forge")), boxL("\xa9alb", data("NightCode OST")), boxL("\xa9day", data("2026-09-24T00:00:00Z")),
    boxL("\xa9gen", data("Synthwave")), boxL("trkn", box("data", be32(0), be32(0), Uint8Array.of(0, 0, 0, 7, 0, 12, 0, 0))));
  const mdhd = box("mdhd", new Uint8Array(4), new Uint8Array(8), be32(1000), be32(215500), new Uint8Array(4));
  const moov = box("moov", box("trak", box("mdia", mdhd)), box("udta", box("meta", new Uint8Array(4), box("hdlr", new Uint8Array(25)), ilst)));
  const mp4 = concat(box("ftyp", te.encode("M4A "), be32(0), te.encode("isom")), box("mdat", new Uint8Array(3000)), moov);
  const t4 = await NightLibrary.readTags(new Blob([mp4]), "a.m4a");
  check(t4, "MP4");
  assert.ok(Math.abs(t4.duration - 215.5) < 0.01, "MP4 duration from mdhd");
  ok("MP4 / M4A atoms (moov after mdat) and duration");

  // No tags: "Artist - Title" and "07 - Artist - Title" file names.
  check(await NightLibrary.readTags(new Blob([new Uint8Array(300)]), "Cole Forge - Enter the Night.wav"), "file name", { artist: "Cole Forge", title: "Enter the Night" });
  check(await NightLibrary.readTags(new Blob([new Uint8Array(300)]), "07 - Cole Forge - Enter the Night.wav"), "numbered file name", { artist: "Cole Forge", title: "Enter the Night", track: 7 });
  check(await NightLibrary.readTags(new Blob([new Uint8Array(300)]), "night_tone.wav"), "plain file name", { artist: "", title: "night tone" });
  ok("file-name fallback");

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${passed} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
