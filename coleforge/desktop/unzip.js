"use strict";

// Minimal ZIP extractor for the Free Games shelf (stored and deflated entries, no encryption), so
// installs don't depend on tar/PowerShell. Refuses entries that would land outside the target folder.
// When every entry sits under one top folder (bass-cd-1.2/..., freedoom-0.13.0/...) that folder is
// dropped, so the game's files end up directly in `dest`.

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function readCentralDirectory(fd, size) {
  const tailLen = Math.min(size, 65557);
  const tail = Buffer.alloc(tailLen);
  fs.readSync(fd, tail, 0, tailLen, size - tailLen);
  let eocd = -1;
  for (let i = tailLen - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("Not a ZIP file (no end of central directory).");
  const count = tail.readUInt16LE(eocd + 10), cdSize = tail.readUInt32LE(eocd + 12), cdOffset = tail.readUInt32LE(eocd + 16);
  if (count === 0xffff || cdOffset === 0xffffffff) throw new Error("ZIP64 archives aren't supported.");
  const cd = Buffer.alloc(cdSize);
  fs.readSync(fd, cd, 0, cdSize, cdOffset);
  const entries = [];
  for (let p = 0, n = 0; n < count; n++) {
    if (cd.readUInt32LE(p) !== 0x02014b50) throw new Error("Damaged ZIP central directory.");
    const flags = cd.readUInt16LE(p + 8), method = cd.readUInt16LE(p + 10);
    const csize = cd.readUInt32LE(p + 20), usize = cd.readUInt32LE(p + 24);
    const nameLen = cd.readUInt16LE(p + 28), extraLen = cd.readUInt16LE(p + 30), commentLen = cd.readUInt16LE(p + 32);
    const localOffset = cd.readUInt32LE(p + 42);
    const name = cd.toString(flags & 0x800 ? "utf8" : "latin1", p + 46, p + 46 + nameLen).replace(/\\/g, "/");
    entries.push({ name, method, csize, usize, localOffset, encrypted: !!(flags & 1) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function unzip(zipFile, dest, { stripSingleRoot = true } = {}) {
  const fd = fs.openSync(zipFile, "r");
  try {
    const all = readCentralDirectory(fd, fs.fstatSync(fd).size);
    const files = all.filter((e) => e.name.replace(/\/+$/, "") && !e.name.startsWith("__MACOSX/"));
    const tops = new Set(files.map((e) => e.name.split("/")[0]));
    const strip = stripSingleRoot && tops.size === 1 && files.every((e) => e.name.includes("/"));
    const root = path.resolve(dest);
    fs.mkdirSync(root, { recursive: true });
    let written = 0, bytes = 0;
    for (const e of files) {
      const parts = e.name.split("/").filter(Boolean).slice(strip ? 1 : 0);
      if (!parts.length) continue;
      if (parts.some((s) => s === ".." || /^[A-Za-z]:/.test(s))) throw new Error(`Unsafe path in archive: ${e.name}`);
      const out = path.resolve(root, ...parts);
      if (!out.startsWith(root + path.sep)) throw new Error(`Unsafe path in archive: ${e.name}`);
      if (e.name.endsWith("/")) { fs.mkdirSync(out, { recursive: true }); continue; }
      if (e.encrypted) throw new Error(`${e.name} is encrypted.`);
      const head = Buffer.alloc(30);
      fs.readSync(fd, head, 0, 30, e.localOffset);
      if (head.readUInt32LE(0) !== 0x04034b50) throw new Error(`Damaged ZIP entry: ${e.name}`);
      const dataStart = e.localOffset + 30 + head.readUInt16LE(26) + head.readUInt16LE(28);
      const packed = Buffer.alloc(e.csize);
      fs.readSync(fd, packed, 0, e.csize, dataStart);
      let data;
      if (e.method === 0) data = packed;
      else if (e.method === 8) data = zlib.inflateRawSync(packed);
      else throw new Error(`${e.name} uses a compression method this unzipper doesn't know (${e.method}).`);
      if (data.length !== e.usize) throw new Error(`${e.name} unpacked to the wrong size.`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, data);
      written++; bytes += data.length;
    }
    return { files: written, bytes, stripped: strip };
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = { unzip };
