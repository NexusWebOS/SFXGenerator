"use strict";

// NightLibrary: NightAmp's Media Library store and tag reader.
//   - Tags: ID3v2.2/2.3/2.4 and ID3v1 (MP3), Vorbis comments (FLAC, Ogg Vorbis, Opus) and iTunes-style
//     MP4 atoms (M4A/M4B/MP4), with "Artist - Title" file names as the fallback.
//   - Storage: IndexedDB, so tracks added to the library (the files themselves, not just their names)
//     are still there next session. Streams are stored as addresses.
(function () {
  const td = (enc) => new TextDecoder(enc);
  const latin1 = td("latin1"), utf8 = td("utf-8");
  const GENRES = ["Blues", "Classic Rock", "Country", "Dance", "Disco", "Funk", "Grunge", "Hip-Hop", "Jazz", "Metal", "New Age", "Oldies", "Other", "Pop", "R&B", "Rap",
    "Reggae", "Rock", "Techno", "Industrial", "Alternative", "Ska", "Death Metal", "Pranks", "Soundtrack", "Euro-Techno", "Ambient", "Trip-Hop", "Vocal", "Jazz+Funk",
    "Fusion", "Trance", "Classical", "Instrumental", "Acid", "House", "Game", "Sound Clip", "Gospel", "Noise", "AlternRock", "Bass", "Soul", "Punk", "Space",
    "Meditative", "Instrumental Pop", "Instrumental Rock", "Ethnic", "Gothic", "Darkwave", "Techno-Industrial", "Electronic", "Pop-Folk", "Eurodance", "Dream",
    "Southern Rock", "Comedy", "Cult", "Gangsta", "Top 40", "Christian Rap", "Pop/Funk", "Jungle", "Native American", "Cabaret", "New Wave", "Psychedelic", "Rave",
    "Showtunes", "Trailer", "Lo-Fi", "Tribal", "Acid Punk", "Acid Jazz", "Polka", "Retro", "Musical", "Rock & Roll", "Hard Rock"];
  const genreName = (g) => {
    const m = /^\((\d+)\)(.*)$/.exec(g || "") || /^(\d+)$/.exec(g || "");
    if (!m) return g || "";
    return (m[2] && m[2].trim()) || GENRES[+m[1]] || g;
  };
  const clean = (s) => String(s || "").replace(/\0+$/g, "").replace(/\0/g, " / ").trim();

  /* ---------------- ID3 ---------------- */
  function id3Text(b) {
    const enc = b[0], body = b.subarray(1);
    if (enc === 0) return clean(latin1.decode(body));
    if (enc === 3) return clean(utf8.decode(body));
    if (enc === 1) {
      const le = body[0] === 0xff && body[1] === 0xfe, bom = (body[0] === 0xff && body[1] === 0xfe) || (body[0] === 0xfe && body[1] === 0xff);
      return clean(td(le || !bom ? "utf-16le" : "utf-16be").decode(bom ? body.subarray(2) : body));
    }
    if (enc === 2) return clean(td("utf-16be").decode(body));
    return "";
  }
  function unsync(b) {
    const out = [];
    for (let i = 0; i < b.length; i++) { out.push(b[i]); if (b[i] === 0xff && b[i + 1] === 0) i++; }
    return Uint8Array.from(out);
  }
  function readId3v2(b) {
    if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return null;
    const ver = b[3], flags = b[5];
    const size = (b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9];
    let body = b.subarray(10, 10 + size);
    if (flags & 0x80 && ver < 4) body = unsync(body);
    let o = 0;
    if (flags & 0x40 && ver >= 3) o = ver === 4 ? ((body[0] << 21) | (body[1] << 14) | (body[2] << 7) | body[3]) : 4 + ((body[0] << 24) | (body[1] << 16) | (body[2] << 8) | body[3]);
    const tags = {};
    const map = { TIT2: "title", TT2: "title", TPE1: "artist", TP1: "artist", TALB: "album", TAL: "album", TYER: "year", TYE: "year", TDRC: "year",
      TRCK: "track", TRK: "track", TCON: "genre", TCO: "genre", TPE2: "albumArtist", TP2: "albumArtist" };
    while (o + (ver === 2 ? 6 : 10) <= body.length) {
      let id, len, hdr;
      if (ver === 2) { id = latin1.decode(body.subarray(o, o + 3)); len = (body[o + 3] << 16) | (body[o + 4] << 8) | body[o + 5]; hdr = 6; }
      else {
        id = latin1.decode(body.subarray(o, o + 4));
        len = ver === 4 ? ((body[o + 4] << 21) | (body[o + 5] << 14) | (body[o + 6] << 7) | body[o + 7]) : ((body[o + 4] << 24) | (body[o + 5] << 16) | (body[o + 6] << 8) | body[o + 7]) >>> 0;
        hdr = 10;
      }
      if (!/^[A-Z0-9]{3,4}$/.test(id) || len <= 0 || o + hdr + len > body.length) break;
      let data = body.subarray(o + hdr, o + hdr + len);
      if (ver === 4 && (body[o + 9] & 0x02)) data = unsync(data);
      const key = map[id];
      if (key && !tags[key]) tags[key] = id3Text(data);
      o += hdr + len;
    }
    if (tags.genre) tags.genre = genreName(tags.genre);
    if (tags.year) tags.year = tags.year.slice(0, 4);
    return tags;
  }
  function readId3v1(b) {
    if (b.length < 128 || latin1.decode(b.subarray(0, 3)) !== "TAG") return null;
    const f = (a, n) => clean(latin1.decode(b.subarray(a, a + n)));
    const t = { title: f(3, 30), artist: f(33, 30), album: f(63, 30), year: f(93, 4) };
    if (b[125] === 0 && b[126]) t.track = String(b[126]);
    if (b[127] < GENRES.length) t.genre = GENRES[b[127]];
    return t;
  }

  /* ---------------- Vorbis comments (FLAC, Ogg) ---------------- */
  function vorbisComments(b, o) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const tags = {};
    try {
      const vlen = dv.getUint32(o, true); o += 4 + vlen;
      const n = dv.getUint32(o, true); o += 4;
      for (let i = 0; i < n && o + 4 <= b.length; i++) {
        const len = dv.getUint32(o, true); o += 4;
        const s = utf8.decode(b.subarray(o, o + len)); o += len;
        const eq = s.indexOf("=");
        if (eq < 0) continue;
        const k = s.slice(0, eq).toUpperCase(), v = s.slice(eq + 1).trim();
        const key = { TITLE: "title", ARTIST: "artist", ALBUM: "album", DATE: "year", YEAR: "year", TRACKNUMBER: "track", GENRE: "genre", ALBUMARTIST: "albumArtist" }[k];
        if (key && !tags[key]) tags[key] = key === "year" ? v.slice(0, 4) : v;
      }
    } catch { /* truncated */ }
    return tags;
  }
  function readFlac(b) {
    if (latin1.decode(b.subarray(0, 4)) !== "fLaC") return null;
    for (let o = 4; o + 4 <= b.length;) {
      const last = b[o] & 0x80, type = b[o] & 0x7f, len = (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];
      if (type === 4) return vorbisComments(b.subarray(o + 4, o + 4 + len), 0);
      if (last) break;
      o += 4 + len;
    }
    return {};
  }
  function readOgg(b) {
    if (latin1.decode(b.subarray(0, 4)) !== "OggS") return null;
    // Join the page payloads of the first few pages, then look for the comment header.
    const parts = [];
    for (let o = 0; o + 27 <= b.length && parts.length < 8;) {
      if (latin1.decode(b.subarray(o, o + 4)) !== "OggS") break;
      const segs = b[o + 26];
      let len = 0;
      for (let i = 0; i < segs; i++) len += b[o + 27 + i];
      parts.push(b.subarray(o + 27 + segs, o + 27 + segs + len));
      o += 27 + segs + len;
    }
    const all = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
    let k = 0; for (const p of parts) { all.set(p, k); k += p.length; }
    const s = latin1.decode(all);
    let i = s.indexOf("\x03vorbis");
    if (i >= 0) return vorbisComments(all, i + 7);
    i = s.indexOf("OpusTags");
    if (i >= 0) return vorbisComments(all, i + 8);
    return {};
  }

  /* ---------------- MP4 / M4A ---------------- */
  async function readMp4(blob) {
    const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    if (latin1.decode(head.subarray(4, 8)) !== "ftyp") return null;
    const be = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
    let o = 0, moov = null;
    for (let n = 0; o + 8 <= blob.size && n < 64; n++) {        // walk the top-level boxes for moov
      const h = new Uint8Array(await blob.slice(o, o + 16).arrayBuffer());
      let size = be(h, 0);
      const type = latin1.decode(h.subarray(4, 8));
      if (size === 1) size = be(h, 8) * 4294967296 + be(h, 12);
      else if (size === 0) size = blob.size - o;
      if (size < 8) break;
      if (type === "moov") { if (size > 64 * 1024 * 1024) return {}; moov = new Uint8Array(await blob.slice(o, o + size).arrayBuffer()); break; }
      o += size;
    }
    if (!moov) return {};
    const tags = {};
    const walk = (b, from, to, path) => {
      for (let p = from; p + 8 <= to;) {
        const size = be(b, p), type = latin1.decode(b.subarray(p + 4, p + 8));
        if (size < 8 || p + size > to) break;
        if (["moov", "udta", "ilst", "trak", "mdia"].includes(type)) walk(b, p + 8, p + size, path + "/" + type);
        else if (type === "meta") walk(b, p + 12, p + size, path + "/meta");
        else if (type === "mdhd" && !tags._dur) {
          const v = b[p + 8];
          const scale = be(b, p + (v === 1 ? 28 : 20)), dur = v === 1 ? be(b, p + 32) * 4294967296 + be(b, p + 36) : be(b, p + 24);
          if (scale) tags._dur = dur / scale;
        } else if (path.endsWith("/ilst")) {
          const d = p + 8;
          if (latin1.decode(b.subarray(d + 4, d + 8)) === "data") {
            const dlen = be(b, d), kind = be(b, d + 8) & 0xffffff, val = b.subarray(d + 16, d + dlen);
            const key = { "\xa9nam": "title", "\xa9ART": "artist", "\xa9alb": "album", "\xa9day": "year", "\xa9gen": "genre", aART: "albumArtist", trkn: "track", gnre: "genre" }[type];
            if (key) {
              if (type === "trkn") tags.track = String((val[2] << 8) | val[3]);
              else if (type === "gnre") tags.genre = GENRES[((val[0] << 8) | val[1]) - 1] || "";
              else if (kind === 1) tags[key] = utf8.decode(val).trim();
              if (key === "year" && tags.year) tags.year = tags.year.slice(0, 4);
            }
          }
        }
        p += size;
      }
    };
    walk(moov, 0, moov.length, "");
    return tags;
  }

  function fromName(name) {
    const base = String(name || "").split(/[\\/]/).pop().replace(/\.[a-z0-9]{2,5}$/i, "").replace(/_/g, " ");
    const m = /^(?:(\d{1,3})[\s.-]+)?(.+?)\s+-\s+(.+)$/.exec(base);
    if (m) return { artist: m[2].trim(), title: m[3].trim(), track: m[1] };
    return { title: base };
  }

  async function readTags(blob, name) {
    let t = null;
    try {
      const head = new Uint8Array(await blob.slice(0, 262144).arrayBuffer());
      if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) {
        const size = 10 + ((head[6] << 21) | (head[7] << 14) | (head[8] << 7) | head[9]);
        t = readId3v2(size > head.length ? new Uint8Array(await blob.slice(0, size).arrayBuffer()) : head);
      }
      if (!t) t = readFlac(head) || readOgg(head);
      if (!t) t = await readMp4(blob);
      if ((!t || !t.title) && blob.size > 128) {
        const v1 = readId3v1(new Uint8Array(await blob.slice(blob.size - 128).arrayBuffer()));
        if (v1) t = Object.assign(v1, t || {});
      }
    } catch (e) { console.warn("NightLibrary tags:", e); }
    t = t || {};
    const guess = fromName(name);
    const out = { title: t.title || guess.title, artist: t.artist || guess.artist || "", album: t.album || "", year: t.year || "", genre: t.genre || "",
      track: parseInt(t.track || guess.track || "", 10) || 0, albumArtist: t.albumArtist || "" };
    if (t._dur) out.duration = t._dur;
    return out;
  }

  /* ---------------- IndexedDB store ---------------- */
  const DB = "nightamp-library";
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error("This browser has no IndexedDB."));
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore("tracks", { keyPath: "id", autoIncrement: true });
        d.createObjectStore("blobs");
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    dbp.catch(() => { dbp = null; });
    return dbp;
  }
  const done = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  const txDone = (tx) => new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error("aborted")); });

  async function all() { const d = await db(); return done(d.transaction("tracks").objectStore("tracks").getAll()); }
  // items: [{ file: Blob, name } | { url, name, kind }]
  async function add(items, onProgress) {
    const d = await db();
    const out = [];
    let n = 0;
    for (const it of items) {
      const tags = it.file ? await readTags(it.file, it.name) : Object.assign(fromName(it.name), { album: "", year: "", genre: "", track: 0 });
      const rec = Object.assign(tags, { name: it.name, kind: it.kind || "", size: it.file?.size || 0, type: it.file?.type || "", url: it.file ? "" : it.url, added: Date.now(), plays: 0 });
      if (it.duration && !rec.duration) rec.duration = it.duration;
      const tx = d.transaction(["tracks", "blobs"], "readwrite");
      const id = await done(tx.objectStore("tracks").add(rec));
      if (it.file) tx.objectStore("blobs").put(it.file, id);
      await txDone(tx);
      rec.id = id;
      out.push(rec);
      onProgress?.(++n, items.length);
    }
    return out;
  }
  async function update(id, patch) {
    const d = await db();
    const tx = d.transaction("tracks", "readwrite"), st = tx.objectStore("tracks");
    const rec = await done(st.get(id));
    if (rec) st.put(Object.assign(rec, patch));
    await txDone(tx);
    return rec;
  }
  async function remove(ids) {
    const d = await db();
    const tx = d.transaction(["tracks", "blobs"], "readwrite");
    for (const id of ids) { tx.objectStore("tracks").delete(id); tx.objectStore("blobs").delete(id); }
    await txDone(tx);
  }
  async function blob(id) { const d = await db(); return done(d.transaction("blobs").objectStore("blobs").get(id)); }
  async function clear() { const d = await db(); const tx = d.transaction(["tracks", "blobs"], "readwrite"); tx.objectStore("tracks").clear(); tx.objectStore("blobs").clear(); await txDone(tx); }

  window.NightLibrary = { readTags, readId3v2, readId3v1, readFlac, readOgg, readMp4, fromName, all, add, update, remove, blob, clear, GENRES };
})();
