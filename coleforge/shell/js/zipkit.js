"use strict";

// ZipKit: WinNight's archive engine. Runs in the browser, in ColeForge.exe and in Node (tests).
//
//   ZIP  read + write (stored / deflate), ZIP64 read, UTF-8 names, archive comments,
//        WinZip AES-256 (AE-2) encryption read + write, legacy ZipCrypto read,
//        repair (rebuilds the directory from local headers), raw copy of untouched entries.
//   TAR  read + write (ustar, pax long names, GNU long names), .tar.gz / .gz via the browser's
//        own gzip streams.
//   RAR, 7-Zip, XZ, BZIP2, ZSTD, ISO, CAB, LZH… read through libarchive.js (vendor/libarchive),
//        which can also write .tar.xz / .tar.bz2 / .tar.zst.
// Written from the published formats: PKWARE APPNOTE.TXT, WinZip's AES specification (AE-2),
// POSIX ustar/pax. AES is the FIPS-197 block cipher, in the counter mode WinZip specifies.
(function (g) {
  const te = new TextEncoder();
  const utf8 = new TextDecoder("utf-8", { fatal: true });

  /* ---------------- CRC-32 ---------------- */
  const CRC = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; }
  function crc32(buf, crc = 0) {
    crc = ~crc >>> 0;
    for (let i = 0; i < buf.length; i++) crc = CRC[(crc ^ buf[i]) & 255] ^ (crc >>> 8);
    return ~crc >>> 0;
  }

  /* ---------------- streams (deflate / gzip) ---------------- */
  async function pipe(bytes, stream) {
    const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await res.arrayBuffer());
  }
  const deflateRaw = (b) => pipe(b, new CompressionStream("deflate-raw"));
  const inflateRaw = (b) => pipe(b, new DecompressionStream("deflate-raw"));
  const gzip = (b) => pipe(b, new CompressionStream("gzip"));
  const gunzip = (b) => pipe(b, new DecompressionStream("gzip"));

  /* ---------------- little helpers ---------------- */
  const u16 = (b, o) => b[o] | (b[o + 1] << 8);
  const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  const u64 = (b, o) => u32(b, o) + u32(b, o + 4) * 0x100000000;
  function concat(parts) {
    const len = parts.reduce((a, p) => a + p.length, 0), out = new Uint8Array(len);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  class Writer {
    constructor() { this.parts = []; this.length = 0; }
    bytes(b) { this.parts.push(b); this.length += b.length; return this; }
    u16(v) { return this.bytes(new Uint8Array([v & 255, (v >>> 8) & 255])); }
    u32(v) { return this.bytes(new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255])); }
    done() { return concat(this.parts); }
  }
  function decodeName(bytes, isUtf8) {
    if (isUtf8) return new TextDecoder().decode(bytes);
    try { return utf8.decode(bytes); } catch { return String.fromCharCode(...bytes); }
  }
  function dosDateTime(d) {
    const y = Math.max(1980, Math.min(2107, d.getFullYear()));
    return {
      time: ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff,
      date: (((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff,
    };
  }
  const fromDos = (date, time) => new Date(((date >> 9) & 127) + 1980, ((date >> 5) & 15) - 1, date & 31 || 1, (time >> 11) & 31, (time >> 5) & 63, (time & 31) * 2);
  const subtle = () => (g.crypto && g.crypto.subtle) || null;
  const random = (n) => { const b = new Uint8Array(n); g.crypto.getRandomValues(b); return b; };

  class ZipError extends Error {
    constructor(message, code) { super(message); this.name = "ZipError"; this.code = code; }
  }

  /* ---------------- AES-256 block cipher (FIPS-197), encryption direction ---------------- */
  const SBOX = new Uint8Array(256), T = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  (function tables() {
    const d = new Uint8Array(256), th = new Uint8Array(256);
    for (let i = 0; i < 256; i++) th[(d[i] = (i << 1) ^ ((i >> 7) * 283)) ^ i] = i;
    // Walk the multiplicative group (x ← 3x) visiting every byte once, as in the Stanford JS Crypto Library.
    let x = 0, xInv = 0;
    const seen = new Uint8Array(256);
    while (!seen[x]) {
      seen[x] = 1;
      let s = xInv ^ (xInv << 1) ^ (xInv << 2) ^ (xInv << 3) ^ (xInv << 4);
      s = (s >> 8) ^ (s & 255) ^ 99;
      SBOX[x] = s;
      let tEnc = (d[s] * 0x101) ^ (s * 0x1010100);
      for (let i = 0; i < 4; i++) { tEnc = (tEnc << 24) ^ (tEnc >>> 8); T[i][x] = tEnc >>> 0; }
      x ^= d[x] || 1;
      xInv = th[xInv] || 1;
    }
  })();
  function aesKey(keyBytes) {
    const nk = keyBytes.length / 4, w = new Uint32Array(4 * nk + 28);
    for (let i = 0; i < nk; i++) w[i] = (keyBytes[4 * i] << 24 | keyBytes[4 * i + 1] << 16 | keyBytes[4 * i + 2] << 8 | keyBytes[4 * i + 3]) >>> 0;
    let rcon = 1;
    for (let i = nk; i < w.length; i++) {
      let t = w[i - 1];
      if (i % nk === 0 || (nk === 8 && i % nk === 4)) {
        t = (SBOX[t >>> 24] << 24) ^ (SBOX[(t >> 16) & 255] << 16) ^ (SBOX[(t >> 8) & 255] << 8) ^ SBOX[t & 255];
        if (i % nk === 0) { t = (t << 8) ^ (t >>> 24) ^ (rcon << 24); rcon = (rcon << 1) ^ ((rcon >> 7) * 283); }
      }
      w[i] = (w[i - nk] ^ t) >>> 0;
    }
    return w;
  }
  function aesBlock(key, inp, out) {
    const [t0, t1, t2, t3] = T, rounds = key.length / 4 - 2;
    let a = ((inp[0] << 24) | (inp[1] << 16) | (inp[2] << 8) | inp[3]) ^ key[0];
    let b = ((inp[4] << 24) | (inp[5] << 16) | (inp[6] << 8) | inp[7]) ^ key[1];
    let c = ((inp[8] << 24) | (inp[9] << 16) | (inp[10] << 8) | inp[11]) ^ key[2];
    let d = ((inp[12] << 24) | (inp[13] << 16) | (inp[14] << 8) | inp[15]) ^ key[3];
    let k = 4;
    for (let r = 0; r < rounds; r++) {
      const a2 = t0[a >>> 24] ^ t1[(b >> 16) & 255] ^ t2[(c >> 8) & 255] ^ t3[d & 255] ^ key[k];
      const b2 = t0[b >>> 24] ^ t1[(c >> 16) & 255] ^ t2[(d >> 8) & 255] ^ t3[a & 255] ^ key[k + 1];
      const c2 = t0[c >>> 24] ^ t1[(d >> 16) & 255] ^ t2[(a >> 8) & 255] ^ t3[b & 255] ^ key[k + 2];
      d = t0[d >>> 24] ^ t1[(a >> 16) & 255] ^ t2[(b >> 8) & 255] ^ t3[c & 255] ^ key[k + 3];
      a = a2; b = b2; c = c2; k += 4;
    }
    for (let i = 0; i < 4; i++) {
      const v = ((SBOX[a >>> 24] << 24) ^ (SBOX[(b >> 16) & 255] << 16) ^ (SBOX[(c >> 8) & 255] << 8) ^ SBOX[d & 255] ^ key[k++]) >>> 0;
      out[4 * i] = v >>> 24; out[4 * i + 1] = (v >> 16) & 255; out[4 * i + 2] = (v >> 8) & 255; out[4 * i + 3] = v & 255;
      const t = a; a = b; b = c; c = d; d = t;
    }
    return out;
  }
  // WinZip AES counter mode: a 16-byte little-endian counter starting at 1, XORed over the data.
  function aesCtr(key, data) {
    const w = aesKey(key), out = new Uint8Array(data.length), ctr = new Uint8Array(16), ks = new Uint8Array(16);
    for (let pos = 0; pos < data.length; pos += 16) {
      for (let i = 0; i < 16 && ++ctr[i] === 0; i++);
      aesBlock(w, ctr, ks);
      const n = Math.min(16, data.length - pos);
      for (let i = 0; i < n; i++) out[pos + i] = data[pos + i] ^ ks[i];
    }
    return out;
  }
  async function aesKeys(password, salt) {
    const s = subtle();
    if (!s) throw new ZipError("This browser has no Web Crypto, so it can't handle AES archives.", "nocrypto");
    const base = await s.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = new Uint8Array(await s.deriveBits({ name: "PBKDF2", salt, iterations: 1000, hash: "SHA-1" }, base, (32 + 32 + 2) * 8));
    return { enc: bits.subarray(0, 32), auth: bits.subarray(32, 64), verify: bits.subarray(64, 66) };
  }
  async function hmacSha1(key, data) {
    const k = await subtle().importKey("raw", key, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    return new Uint8Array(await subtle().sign("HMAC", k, data));
  }
  async function aesEncrypt(password, data) {
    const salt = random(16), keys = await aesKeys(password, salt);
    const enc = aesCtr(keys.enc, data), mac = (await hmacSha1(keys.auth, enc)).subarray(0, 10);
    return concat([salt, keys.verify, enc, mac]);
  }
  async function aesDecrypt(password, payload) {
    const salt = payload.subarray(0, 16), verify = payload.subarray(16, 18);
    const enc = payload.subarray(18, payload.length - 10), mac = payload.subarray(payload.length - 10);
    const keys = await aesKeys(password, salt);
    if (keys.verify[0] !== verify[0] || keys.verify[1] !== verify[1]) throw new ZipError("Wrong password.", "password");
    const want = (await hmacSha1(keys.auth, enc)).subarray(0, 10);
    if (want.some((v, i) => v !== mac[i])) throw new ZipError("The encrypted data is damaged (authentication check failed).", "auth");
    return aesCtr(keys.enc, enc);
  }

  /* ---------------- legacy ZipCrypto (read only; it's easily broken, WinNight writes AES) ---------------- */
  function zipCryptoDecrypt(password, payload, check) {
    let k0 = 0x12345678, k1 = 0x23456789, k2 = 0x34567890;
    const upd = (c) => {
      k0 = CRC[(k0 ^ c) & 255] ^ (k0 >>> 8);
      k1 = (Math.imul((k1 + (k0 & 255)) >>> 0, 134775813) + 1) >>> 0;
      k2 = CRC[(k2 ^ (k1 >>> 24)) & 255] ^ (k2 >>> 8);
    };
    for (const c of te.encode(password)) upd(c);
    const out = new Uint8Array(payload.length);
    for (let i = 0; i < payload.length; i++) {
      const t = (k2 | 2) & 0xffff;
      const c = payload[i] ^ ((Math.imul(t, t ^ 1) >>> 8) & 255);
      out[i] = c; upd(c);
    }
    if (out[11] !== check) throw new ZipError("Wrong password.", "password");
    return out.subarray(12);
  }

  /* ---------------- ZIP reading ---------------- */
  function findEocd(b) {
    for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) if (u32(b, i) === 0x06054b50) return i;
    return -1;
  }
  function parseExtra(extra) {
    const out = {};
    for (let o = 0; o + 4 <= extra.length;) {
      const id = u16(extra, o), len = u16(extra, o + 2);
      out[id] = extra.subarray(o + 4, o + 4 + len);
      o += 4 + len;
    }
    return out;
  }
  function readZip(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const e = findEocd(b);
    if (e < 0) throw new ZipError("This isn't a ZIP archive, or its end is missing. Try Repair.", "format");
    let count = u16(b, e + 10), cdOff = u32(b, e + 16);
    const commentLen = u16(b, e + 20);
    const comment = decodeName(b.subarray(e + 22, e + 22 + commentLen), false);
    if ((count === 0xffff || cdOff === 0xffffffff) && e >= 20 && u32(b, e - 20) === 0x07064b50) {
      const z = u64(b, e - 12);                       // ZIP64 end of central directory
      if (u32(b, z) === 0x06064b50) { count = u64(b, z + 32); cdOff = u64(b, z + 48); }
    }
    const entries = [];
    let o = cdOff;
    for (let i = 0; i < count; i++) {
      if (u32(b, o) !== 0x02014b50) throw new ZipError("The archive's directory is damaged. Try Repair.", "damaged");
      const flags = u16(b, o + 8), nameLen = u16(b, o + 28), extraLen = u16(b, o + 30), cLen = u16(b, o + 32);
      const name = decodeName(b.subarray(o + 46, o + 46 + nameLen), flags & 0x800);
      const extra = parseExtra(b.subarray(o + 46 + nameLen, o + 46 + nameLen + extraLen));
      let usize = u32(b, o + 24), csize = u32(b, o + 20), lfh = u32(b, o + 42);
      if (extra[1]) {                                  // ZIP64 sizes / offset
        let x = 0; const z = extra[1];
        if (usize === 0xffffffff) { usize = u64(z, x); x += 8; }
        if (csize === 0xffffffff) { csize = u64(z, x); x += 8; }
        if (lfh === 0xffffffff) { lfh = u64(z, x); }
      }
      let method = u16(b, o + 10), aes = null;
      if (method === 99 && extra[0x9901]) {
        const a = extra[0x9901];
        aes = { version: u16(a, 0), strength: a[4], method: u16(a, 5) };
        method = aes.method;
      }
      entries.push({
        name, dir: name.endsWith("/"), flags, method, aes, encrypted: !!(flags & 1),
        crc: u32(b, o + 16), csize, size: usize, lfh, mtime: fromDos(u16(b, o + 14), u16(b, o + 12)),
        comment: decodeName(b.subarray(o + 46 + nameLen + extraLen, o + 46 + nameLen + extraLen + cLen), flags & 0x800),
        dosTime: u16(b, o + 12), dosDate: u16(b, o + 14), rawMethod: u16(b, o + 10), rawExtra: b.subarray(o + 46 + nameLen, o + 46 + nameLen + extraLen),
      });
      o += 46 + nameLen + extraLen + cLen;
    }
    return { format: "zip", bytes: b, entries, comment };
  }
  function payloadOf(zip, entry) {
    const b = zip.bytes, o = entry.lfh;
    if (u32(b, o) !== 0x04034b50) throw new ZipError(`The data for ${entry.name} is missing. Try Repair.`, "damaged");
    const start = o + 30 + u16(b, o + 26) + u16(b, o + 28);
    return b.subarray(start, start + entry.csize);
  }
  const SUPPORTED = new Set([0, 8]);
  async function extract(zip, entry, password) {
    if (entry.dir) return new Uint8Array(0);
    let data = payloadOf(zip, entry);
    if (entry.encrypted) {
      if (password == null) throw new ZipError(`${entry.name} is encrypted. Enter the password.`, "password");
      if (entry.aes) data = await aesDecrypt(password, data);
      else data = zipCryptoDecrypt(password, data, (entry.flags & 8) ? (entry.dosTime >> 8) & 255 : entry.crc >>> 24);
    }
    if (!SUPPORTED.has(entry.method)) throw new ZipError(`${entry.name} uses compression method ${entry.method}.`, "method");
    const out = entry.method === 8 ? await inflateRaw(data) : data.slice();
    const checkCrc = !(entry.aes && entry.aes.version === 2);
    if (checkCrc && crc32(out) !== entry.crc) throw new ZipError(`CRC failed in ${entry.name}. The file is corrupt.`, "crc");
    if (out.length !== entry.size) throw new ZipError(`${entry.name} has the wrong size. The file is corrupt.`, "size");
    return out;
  }

  /* ---------------- ZIP writing ---------------- */
  // files: [{ name, data?: Uint8Array, mtime?: Date, dir?: bool, raw?: entry from readZip + zip }]
  // raw entries are copied byte for byte (no password needed to keep an encrypted file).
  async function writeZip(files, { level = "deflate", password = null, comment = "", onProgress } = {}) {
    const out = new Writer(), central = [];
    let done = 0;
    for (const f of files) {
      const name = f.dir && !f.name.endsWith("/") ? f.name + "/" : f.name;
      const nameBytes = te.encode(name);
      let rec;
      if (f.raw) {
        const e = f.raw.entry;
        rec = { method: e.rawMethod, flags: (e.flags & ~8) | 0x800, crc: e.crc, csize: e.csize, size: e.size, time: e.dosTime, date: e.dosDate,
          extra: e.aes ? e.rawExtra : new Uint8Array(0), payload: payloadOf(f.raw.zip, e), needed: e.aes ? 51 : 20 };
      } else {
        const data = f.dir ? new Uint8Array(0) : f.data;
        const crc = crc32(data);
        let method = 0, payload = data;
        if (!f.dir && level !== "store" && data.length > 32) {
          const z = await deflateRaw(data);
          if (z.length < data.length) { method = 8; payload = z; }
        }
        const { time, date } = dosDateTime(f.mtime || new Date());
        rec = { method, flags: 0x800, crc, size: data.length, time, date, extra: new Uint8Array(0), needed: method === 8 ? 20 : 10 };
        if (password && !f.dir) {
          payload = await aesEncrypt(password, payload);
          rec.extra = new Uint8Array([0x01, 0x99, 7, 0, 2, 0, 0x41, 0x45, 3, method & 255, method >> 8]);  // AE-2, AES-256
          rec.method = 99; rec.flags |= 1; rec.crc = 0; rec.needed = 51;
        }
        rec.payload = payload; rec.csize = payload.length;
      }
      const offset = out.length;
      out.u32(0x04034b50).u16(rec.needed).u16(rec.flags).u16(rec.method).u16(rec.time).u16(rec.date)
        .u32(rec.crc).u32(rec.csize).u32(rec.size).u16(nameBytes.length).u16(rec.extra.length).bytes(nameBytes).bytes(rec.extra).bytes(rec.payload);
      central.push({ rec, nameBytes, offset, dir: !!f.dir || name.endsWith("/") });
      onProgress?.(++done, files.length, name);
    }
    const cdStart = out.length;
    for (const { rec, nameBytes, offset, dir } of central) {
      out.u32(0x02014b50).u16(0x033f).u16(rec.needed).u16(rec.flags).u16(rec.method).u16(rec.time).u16(rec.date)
        .u32(rec.crc).u32(rec.csize).u32(rec.size).u16(nameBytes.length).u16(rec.extra.length).u16(0).u16(0).u16(0)
        .u32(dir ? (0o40755 << 16) | 0x10 : (0o100644 << 16) >>> 0).u32(offset).bytes(nameBytes).bytes(rec.extra);
    }
    const cdLen = out.length - cdStart, commentBytes = te.encode(comment).subarray(0, 65535);
    out.u32(0x06054b50).u16(0).u16(0).u16(central.length).u16(central.length).u32(cdLen).u32(cdStart).u16(commentBytes.length).bytes(commentBytes);
    return out.done();
  }

  /* ---------------- repair: rebuild from local headers ---------------- */
  async function repairZip(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const found = [], log = [];
    for (let o = 0; o + 30 <= b.length; o++) {
      if (u32(b, o) !== 0x04034b50) continue;
      const flags = u16(b, o + 6), nameLen = u16(b, o + 26), extraLen = u16(b, o + 28);
      if (nameLen === 0 || o + 30 + nameLen > b.length) continue;
      const name = decodeName(b.subarray(o + 30, o + 30 + nameLen), flags & 0x800);
      const dataStart = o + 30 + nameLen + extraLen;
      let csize = u32(b, o + 18), size = u32(b, o + 22), crc = u32(b, o + 14);
      const extra = parseExtra(b.subarray(o + 30 + nameLen, dataStart));
      if (flags & 8) {                                      // sizes follow the data: find the descriptor
        let p = dataStart;
        while (p + 16 <= b.length && !(u32(b, p) === 0x08074b50 && u32(b, p + 8) === p - dataStart)) p++;
        if (p + 16 > b.length) { log.push(`${name}: end of data not found`); continue; }
        crc = u32(b, p + 4);
        if (extra[1]) { csize = u64(b, p + 8); size = u64(b, p + 16); }   // ZIP64 descriptor: 8-byte sizes
        else { csize = u32(b, p + 8); size = u32(b, p + 12); }
      } else if (extra[1] && (csize === 0xffffffff || size === 0xffffffff) && extra[1].length >= 16) {
        size = u64(extra[1], 0); csize = u64(extra[1], 8);  // ZIP64 sizes in the local header
      }
      if (dataStart + csize > b.length) { log.push(`${name}: truncated`); continue; }
      let method = u16(b, o + 8), aes = null;
      if (method === 99 && extra[0x9901]) { const a = extra[0x9901]; aes = { version: u16(a, 0), strength: a[4], method: u16(a, 5) }; method = aes.method; }
      found.push({ name, dir: name.endsWith("/"), flags: flags & ~8, method, aes, encrypted: !!(flags & 1), crc, csize, size, lfh: o,
        dosTime: u16(b, o + 10), dosDate: u16(b, o + 12), rawMethod: u16(b, o + 8), rawExtra: b.subarray(o + 30 + nameLen, dataStart), mtime: fromDos(u16(b, o + 12), u16(b, o + 10)) });
      o = dataStart + csize - 1;
    }
    // Local headers with a data descriptor still carry zero sizes; point copies at a fixed header.
    const zip = { format: "zip", bytes: b, entries: found, comment: "" };
    const keep = [];
    for (const e of found) {
      if (!e.encrypted && !e.dir) {
        try { await extract({ bytes: b }, Object.assign({}, e), null); } catch (err) { log.push(`${e.name}: ${err.message}`); continue; }
      }
      keep.push(e);
    }
    const files = [];
    for (const e of keep) {
      if (e.encrypted || e.dir) files.push({ name: e.name, dir: e.dir, raw: { zip, entry: e } });
      else files.push({ name: e.name, data: await extract(zip, e, null), mtime: e.mtime });
    }
    return { bytes: await writeZip(files), recovered: keep.length, found: found.length, log };
  }

  /* ---------------- TAR ---------------- */
  const cstr = (b, o, n) => { let e = o; while (e < o + n && b[e]) e++; return new TextDecoder().decode(b.subarray(o, e)); };
  const oct = (b, o, n) => parseInt(cstr(b, o, n).trim() || "0", 8) || 0;
  function readTar(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const entries = [];
    let o = 0, longName = null, pax = {};
    while (o + 512 <= b.length) {
      if (b.subarray(o, o + 512).every(v => v === 0)) break;
      const type = String.fromCharCode(b[o + 156] || 48);
      const size = oct(b, o + 124, 12), data = o + 512;
      let name = cstr(b, o, 100);
      if (cstr(b, o + 257, 5) === "ustar") { const pre = cstr(b, o + 345, 155); if (pre) name = pre + "/" + name; }
      if (type === "L") { longName = cstr(b, data, size); }
      else if (type === "x") {
        const txt = new TextDecoder().decode(b.subarray(data, data + size));
        for (const line of txt.split("\n")) { const m = /^\d+ ([^=]+)=(.*)$/.exec(line); if (m) pax[m[1]] = m[2]; }
      } else if (type === "g") { /* global pax header: ignored */ }
      else {
        name = pax.path || longName || name;
        const dir = type === "5" || name.endsWith("/");
        if (type === "0" || type === "\0" || type === "7" || dir) {
          entries.push({ name: dir && !name.endsWith("/") ? name + "/" : name, dir, size: dir ? 0 : size, csize: dir ? 0 : size, method: 0,
            mtime: new Date((pax.mtime ? parseFloat(pax.mtime) : oct(b, o + 136, 12)) * 1000), offset: data });
        }
        longName = null; pax = {};
      }
      o = data + Math.ceil(size / 512) * 512;
    }
    return { format: "tar", bytes: b, entries, comment: "" };
  }
  function tarHeader(name, size, mtime, type) {
    const h = new Uint8Array(512), put = (s, o, n) => h.set(te.encode(s).subarray(0, n), o);
    const num = (v, o, n) => put(v.toString(8).padStart(n - 1, "0"), o, n - 1);
    put(name, 0, 100); num(type === "5" ? 0o755 : 0o644, 100, 8); num(0, 108, 8); num(0, 116, 8);
    num(size, 124, 12); num(Math.floor(mtime.getTime() / 1000), 136, 12);
    h.fill(32, 148, 156); h[156] = type.charCodeAt(0);
    put("ustar", 257, 6); put("00", 263, 2); put("nightcode", 265, 32); put("nightcode", 297, 32);
    let sum = 0; for (const v of h) sum += v;
    put(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8);
    return h;
  }
  function writeTar(files) {
    const parts = [];
    const pad = (n) => new Uint8Array((512 - (n % 512)) % 512);
    for (const f of files) {
      const dir = !!f.dir, name = dir && !f.name.endsWith("/") ? f.name + "/" : f.name, data = dir ? new Uint8Array(0) : f.data;
      const mtime = f.mtime || new Date();
      if (te.encode(name).length > 99) {                 // pax extended header for long names
        const rec = (k, v) => {
          const body = ` ${k}=${v}\n`, bl = te.encode(body).length;
          let len = bl + 1;
          while (String(len).length + bl !== len) len = String(len).length + bl;   // the length counts its own digits
          return `${len}${body}`;
        };
        const paxData = te.encode(rec("path", name));
        parts.push(tarHeader("PaxHeader/" + name.slice(-80), paxData.length, mtime, "x"), paxData, pad(paxData.length));
      }
      parts.push(tarHeader(name.slice(0, 99), data.length, mtime, dir ? "5" : "0"), data, pad(data.length));
    }
    parts.push(new Uint8Array(1024));
    return concat(parts);
  }

  /* ---------------- format detection ---------------- */
  function sniff(b, name = "") {
    const n = name.toLowerCase(), has = (sig, o = 0) => sig.every((v, i) => b[o + i] === v);
    if (has([0x50, 0x4b, 3, 4]) || has([0x50, 0x4b, 5, 6]) || has([0x50, 0x4b, 7, 8])) return "zip";
    if (has([0x1f, 0x8b])) return /\.(tgz|tar\.gz)$/.test(n) ? "tar.gz" : "gz";
    if (b.length > 262 && cstr(b, 257, 5) === "ustar") return "tar";
    if (has([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])) return "rar";
    if (has([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return "7z";
    if (has([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0])) return /\.(tar\.xz|txz)$/.test(n) ? "tar.xz" : "xz";
    if (has([0x42, 0x5a, 0x68])) return /\.(tar\.bz2|tbz2?)$/.test(n) ? "tar.bz2" : "bz2";
    if (has([0x28, 0xb5, 0x2f, 0xfd])) return /\.(tar\.zst|tzst)$/.test(n) ? "tar.zst" : "zst";
    if (has([0x4d, 0x53, 0x43, 0x46])) return "cab";
    if (b.length > 32774 && cstr(b, 32769, 5) === "CD001") return "iso";
    if (/\.zip$/.test(n) && findEocd(b) >= 0) return "zip";
    if (/\.tar$/.test(n)) return "tar";
    return "unknown";
  }

  /* ---------------- libarchive.js (RAR, 7z, xz, bz2, zstd, iso, cab…) ---------------- */
  let libPromise = null;
  function libarchive() {
    if (!libPromise) {
      const base = g.document ? new URL("vendor/libarchive/libarchive.js", g.document.baseURI).href : null;
      if (!base) return Promise.reject(new ZipError("libarchive is only available in the browser.", "nolib"));
      libPromise = import(base);
    }
    return libPromise;
  }
  async function openWithLibarchive(bytes, name, password) {
    const { Archive } = await libarchive();
    const archive = await Archive.open(new File([bytes], name || "archive"));
    if (password) await archive.usePassword(password);
    const list = await archive.getFilesArray();
    const entries = list.map(({ file, path }) => ({
      name: path + file.name, dir: false, size: file.size, csize: null, method: null,
      mtime: file.lastModified ? new Date(file.lastModified > 1e14 ? file.lastModified / 1e6 : file.lastModified) : null, lib: file,
    }));
    return { format: sniff(bytes, name), bytes, entries, comment: "", archive, encrypted: await archive.hasEncryptedData().catch(() => null) };
  }
  async function writeWithLibarchive(files, format, compression) {
    const { Archive } = await libarchive();
    const out = await Archive.write({
      files: files.filter(f => !f.dir).map(f => ({ file: new File([f.data], f.name.split("/").pop()), pathname: f.name })),
      outputFileName: "archive", compression, format: format, passphrase: null,
    });
    return new Uint8Array(await out.arrayBuffer());
  }

  /* ---------------- one interface for WinNight ---------------- */
  // open(bytes, name) → { format, entries, comment, writable, read(entry, password) }
  async function open(bytes, name = "", password = null) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const kind = sniff(b, name);
    if (kind === "zip") {
      const zip = readZip(b);
      const native = zip.entries.every(e => SUPPORTED.has(e.method));
      return Object.assign(zip, { writable: true, native, read: (e, pw) => extract(zip, e, pw ?? password) });
    }
    if (kind === "tar" || kind === "tar.gz") {
      const tarBytes = kind === "tar" ? b : await gunzip(b);
      const tar = readTar(tarBytes);
      tar.format = kind;
      tar.compressed = b.length;
      return Object.assign(tar, { writable: true, native: true, read: async (e) => tarBytes.slice(e.offset, e.offset + e.size) });
    }
    if (kind === "gz") {
      const data = await gunzip(b);
      if (data.length > 262 && cstr(data, 257, 5) === "ustar") {
        const tar = readTar(data);
        return Object.assign(tar, { format: "tar.gz", compressed: b.length, writable: true, native: true, read: async (e) => data.slice(e.offset, e.offset + e.size) });
      }
      const inner = name.replace(/\.gz$/i, "") || "file";
      return { format: "gz", bytes: b, comment: "", writable: false, native: true,
        entries: [{ name: inner.split("/").pop(), dir: false, size: data.length, csize: b.length, method: 8, mtime: null }],
        read: async () => data };
    }
    const lib = await openWithLibarchive(b, name, password);
    return Object.assign(lib, { writable: false, native: false, read: async (e) => new Uint8Array(await (await e.lib.extract()).arrayBuffer()) });
  }

  // Write entries in a chosen format: zip (optionally AES), tar, tar.gz, or tar.xz/.bz2/.zst via libarchive.
  async function write(format, files, opts = {}) {
    if (format === "zip") return writeZip(files, opts);
    const plain = files;   // other formats need the file data itself (no raw copies)
    if (format === "tar") return writeTar(plain);
    if (format === "tar.gz") return gzip(writeTar(plain));
    const comp = { "tar.xz": "xz", "tar.bz2": "bzip2", "tar.zst": "zstd" }[format];
    if (comp) return writeWithLibarchive(plain, "ustar", comp);
    throw new ZipError(`WinNight can't write ${format} archives.`, "format");
  }

  // Force libarchive (for ZIP entries using methods the browser can't inflate: Deflate64, BZIP2, LZMA…).
  async function openLib(bytes, name, password) {
    const lib = await openWithLibarchive(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), name, password);
    return Object.assign(lib, { read: async (e) => new Uint8Array(await (await e.lib.extract()).arrayBuffer()) });
  }

  const ZipKit = { openLib, crc32, deflateRaw, inflateRaw, gzip, gunzip, readZip, writeZip, extract, repairZip, readTar, writeTar, sniff, open, write,
    aes: { key: aesKey, block: aesBlock, ctr: aesCtr, encrypt: aesEncrypt, decrypt: aesDecrypt }, ZipError, fromDos,
    WRITE_FORMATS: [["zip", "ZIP"], ["tar", "TAR"], ["tar.gz", "TAR.GZ"], ["tar.xz", "TAR.XZ"], ["tar.bz2", "TAR.BZ2"], ["tar.zst", "TAR.ZST"]] };
  g.ZipKit = ZipKit;
  if (typeof module !== "undefined" && module.exports) module.exports = ZipKit;
})(typeof window !== "undefined" ? window : globalThis);
