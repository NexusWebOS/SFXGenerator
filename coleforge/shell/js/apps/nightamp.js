"use strict";

// NightAmp: the NightCode media player, an official ColeForge program. A clean-room recreation of the
// classic Winamp 2 layout (275x116 main window, 10-band equalizer, playlist editor, shade and double
// size) with its own NightCode skin, upgraded with:
//   - every format Chromium decodes (MP3, AAC/M4A, FLAC, Opus, Vorbis, WAV, WebM, MKA), AIFF through a
//     built-in converter, MIDI and Doom .MUS through the ForgeMIDI synth;
//   - video (MP4/H.264, WebM/VP9/AV1, MKV, MOV, HLS .m3u8 via hls.js) in a video window with subtitles;
//   - internet radio, M3U/PLS playlists, and a built-in web browser (NightBrowser's engine);
//   - "NightDrop": an audio-reactive NightCode code-rain visual when there's no picture.
// No Nullsoft code or art is used: Winamp's 2024 source release doesn't allow modified versions to be
// shared, so everything here is original, including the skin sprites (art/nightcode/build_nightcode_apps.py).
(function () {
  const { h } = CF;
  const ART = "assets/art/nightapps/";
  const KEY = "cf.nightamp";
  const AUDIO_EXT = ["mp3", "mp2", "m4a", "m4b", "aac", "flac", "ogg", "oga", "opus", "wav", "wave", "weba", "mka", "aif", "aiff", "aifc", "caf", "3gp", "amr"];
  const VIDEO_EXT = ["mp4", "m4v", "webm", "mkv", "mov", "ogv", "avi", "wmv", "ts", "m3u8"];
  const MIDI_EXT = ["mid", "midi", "rmi", "kar", "mus"];
  const LIST_EXT = ["m3u", "pls"];
  const extOf = (n) => (/\.([a-z0-9]+)(?:[?#].*)?$/i.exec(String(n)) || [])[1]?.toLowerCase() || "";
  const kindOf = (name, url = "") => {
    const e = extOf(name) || extOf(url);
    if (MIDI_EXT.includes(e)) return "midi";
    if (e === "m3u8") return "hls";
    if (VIDEO_EXT.includes(e)) return "video";
    if (["aif", "aiff", "aifc"].includes(e)) return "aiff";
    if (AUDIO_EXT.includes(e)) return "audio";
    return /^https?:/.test(url) ? "stream" : "audio";
  };
  CF.associate([...AUDIO_EXT, ...VIDEO_EXT.filter(e => e !== "ts"), ...MIDI_EXT, ...LIST_EXT], "nightamp");

  /* ---------------- 4x5 bitmap font (5x6 cells) for the skinned displays ---------------- */
  const GLYPHS = {
    A: ".XX.|X..X|XXXX|X..X|X..X", B: "XXX.|X..X|XXX.|X..X|XXX.", C: ".XXX|X...|X...|X...|.XXX", D: "XXX.|X..X|X..X|X..X|XXX.", E: "XXXX|X...|XXX.|X...|XXXX",
    F: "XXXX|X...|XXX.|X...|X...", G: ".XXX|X...|X.XX|X..X|.XXX", H: "X..X|X..X|XXXX|X..X|X..X", I: "XXX.|.X..|.X..|.X..|XXX.", J: "..XX|...X|...X|X..X|.XX.",
    K: "X..X|X.X.|XX..|X.X.|X..X", L: "X...|X...|X...|X...|XXXX", M: "X..X|XXXX|XXXX|X..X|X..X", N: "X..X|XX.X|X.XX|X..X|X..X", O: ".XX.|X..X|X..X|X..X|.XX.",
    P: "XXX.|X..X|XXX.|X...|X...", Q: ".XX.|X..X|X..X|X.X.|.X.X", R: "XXX.|X..X|XXX.|X.X.|X..X", S: ".XXX|X...|.XX.|...X|XXX.", T: "XXX.|.X..|.X..|.X..|.X..",
    U: "X..X|X..X|X..X|X..X|.XX.", V: "X..X|X..X|X..X|.XX.|.XX.", W: "X..X|X..X|XXXX|XXXX|X..X", X: "X..X|X..X|.XX.|X..X|X..X", Y: "X.X.|X.X.|.X..|.X..|.X..",
    Z: "XXXX|...X|.XX.|X...|XXXX", 0: ".XX.|X.XX|XX.X|X..X|.XX.", 1: ".X..|XX..|.X..|.X..|XXX.", 2: "XXX.|...X|.XX.|X...|XXXX", 3: "XXX.|...X|.XX.|...X|XXX.",
    4: "X..X|X..X|XXXX|...X|...X", 5: "XXXX|X...|XXX.|...X|XXX.", 6: ".XX.|X...|XXX.|X..X|.XX.", 7: "XXXX|...X|..X.|.X..|.X..", 8: ".XX.|X..X|.XX.|X..X|.XX.",
    9: ".XX.|X..X|.XXX|...X|.XX.", " ": "....|....|....|....|....", ".": "....|....|....|....|.X..", ",": "....|....|....|.X..|X...", ":": "....|.X..|....|.X..|....",
    ";": "....|.X..|....|.X..|X...", "-": "....|....|XXX.|....|....", _: "....|....|....|....|XXXX", "(": ".X..|X...|X...|X...|.X..", ")": ".X..|..X.|..X.|..X.|.X..",
    "[": "XX..|X...|X...|X...|XX..", "]": ".XX.|..X.|..X.|..X.|.XX.", "/": "...X|..X.|.X..|.X..|X...", "\\": "X...|.X..|.X..|..X.|...X", "'": ".X..|.X..|....|....|....",
    '"': "X.X.|X.X.|....|....|....", "!": ".X..|.X..|.X..|....|.X..", "?": "XXX.|...X|.XX.|....|.X..", "&": ".X..|X.X.|.X..|X.X.|.X.X", "+": "....|.X..|XXX.|.X..|....",
    "=": "....|XXX.|....|XXX.|....", "#": ".X.X|XXXX|.X.X|XXXX|.X.X", "*": "....|X.X.|.X..|X.X.|....", "%": "X..X|..X.|.X..|X...|X..X", ">": "X...|.X..|..X.|.X..|X...",
    "<": "..X.|.X..|X...|.X..|..X.", "@": ".XX.|X..X|X.XX|X...|.XXX", $: ".XXX|XX..|.XX.|..XX|XXX.", "~": "....|.X.X|X.X.|....|....", "|": ".X..|.X..|.X..|.X..|.X..",
  };
  const GLYPH_BITS = Object.fromEntries(Object.entries(GLYPHS).map(([k, v]) => [k, v.split("|")]));
  function drawText(ctx, text, x, y, color) {
    ctx.fillStyle = color;
    const s = String(text).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
    for (const ch of s) {
      const g = GLYPH_BITS[ch] || GLYPH_BITS["?"];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) if (g[r][c] === "X") ctx.fillRect(x + c, y + r, 1, 1);
      x += 5;
    }
    return x;
  }
  function h_canvas(w, hh) { const c = document.createElement("canvas"); c.width = w; c.height = hh; return c; }
  const fmtTime = (s) => { if (!isFinite(s) || s < 0) return "--:--"; s = Math.floor(s); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, "0")}`; };

  /* ---------------- equalizer ---------------- */
  const BANDS = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
  const BAND_LABELS = ["60", "170", "310", "600", "1K", "3K", "6K", "12K", "14K", "16K"];
  // NightAmp's own presets (dB, preamp first).
  const PRESETS = {
    "Flat": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "Night Drive": [-1, 6, 5, 2, -1, -2, 0, 2, 4, 5, 5],
    "Bass Boost": [-3, 9, 7, 4, 1, 0, 0, 0, 0, 0, 0],
    "Treble Boost": [-3, 0, 0, 0, 0, 0, 2, 5, 7, 8, 8],
    "Loudness": [-4, 7, 5, 1, -1, -2, 0, 2, 5, 6, 6],
    "Headphones": [-2, 4, 3, 1, 0, -1, 1, 3, 4, 3, 2],
    "Laptop Speakers": [-2, -4, -2, 1, 3, 4, 4, 3, 2, 1, 0],
    "Vocal": [-2, -3, -2, 0, 3, 5, 5, 3, 1, 0, -1],
    "Doom Metal": [-3, 6, 5, 3, 0, -3, 2, 5, 6, 5, 4],
    "Synthwave": [-2, 5, 4, 1, -2, -1, 1, 3, 5, 6, 6],
    "Classical": [0, 0, 0, 0, 0, 0, -2, -4, -4, -4, -6],
    "Radio": [-1, -6, -3, 0, 3, 5, 5, 3, 0, -3, -6],
  };
  // Internet radio in the built-in browser. SomaFM runs listener-supported, free streams.
  const STATIONS = [
    ["DEF CON Radio", "https://ice1.somafm.com/defcon-128-mp3"], ["Groove Salad", "https://ice1.somafm.com/groovesalad-128-mp3"],
    ["Secret Agent", "https://ice1.somafm.com/secretagent-128-mp3"], ["Drone Zone", "https://ice1.somafm.com/dronezone-128-mp3"],
    ["Space Station", "https://ice1.somafm.com/spacestation-128-mp3"], ["Deep Space One", "https://ice1.somafm.com/deepspaceone-128-mp3"],
    ["Vaporwaves", "https://ice1.somafm.com/vaporwaves-128-mp3"], ["Underground 80s", "https://ice1.somafm.com/u80s-128-mp3"],
  ];
  const WEB_LINKS = [["SomaFM", "https://somafm.com/"], ["Live Music Archive", "https://archive.org/details/etree"], ["Free Music Archive", "https://freemusicarchive.org/"], ["Freedoom music", "https://freedoom.github.io/"]];

  /* ---------------- AIFF → WAV (Chromium can't play AIFF) ---------------- */
  function aiffToWav(b) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const id = (o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
    if (id(0) !== "FORM" || !["AIFF", "AIFC"].includes(id(8))) throw new Error("Not an AIFF file.");
    let ch = 0, bits = 0, rate = 0, data = null, little = false;
    for (let o = 12; o + 8 <= b.length;) {
      const cid = id(o), len = dv.getUint32(o + 4);
      if (cid === "COMM") {
        ch = dv.getUint16(o + 8); bits = dv.getUint16(o + 14);
        const exp = dv.getUint16(o + 16) & 0x7fff, mant = dv.getUint32(o + 18);
        rate = Math.round(mant * Math.pow(2, exp - 16383 - 31));
        if (id(8) === "AIFC" && len >= 22) { const comp = id(o + 26); if (comp === "sowt") little = true; else if (comp !== "NONE") throw new Error(`AIFF-C compression "${comp}" isn't supported.`); }
      } else if (cid === "SSND") {
        const off = dv.getUint32(o + 8);
        data = b.subarray(o + 16 + off, o + 8 + len);
      }
      o += 8 + len + (len & 1);
    }
    if (!data || !ch || !rate) throw new Error("This AIFF file has no audio.");
    const bytes = Math.ceil(bits / 8), out = new Uint8Array(44 + data.length), o = new DataView(out.buffer);
    const put = (p, s) => [...s].forEach((c, i) => { out[p + i] = c.charCodeAt(0); });
    put(0, "RIFF"); o.setUint32(4, 36 + data.length, true); put(8, "WAVEfmt "); o.setUint32(16, 16, true); o.setUint16(20, 1, true); o.setUint16(22, ch, true);
    o.setUint32(24, rate, true); o.setUint32(28, rate * ch * bytes, true); o.setUint16(32, ch * bytes, true); o.setUint16(34, bytes * 8, true); put(36, "data"); o.setUint32(40, data.length, true);
    for (let i = 0; i + bytes <= data.length; i += bytes) {
      for (let k = 0; k < bytes; k++) out[44 + i + k] = little ? data[i + k] : data[i + bytes - 1 - k];
      if (bytes === 1) out[44 + i] = (data[i] + 128) & 255;   // AIFF 8-bit is signed, WAV 8-bit unsigned
    }
    return out;
  }

  /* ---------------- quick header probe for the kbps / kHz / stereo displays ---------------- */
  function probe(b, name) {
    const s = (o, n) => String.fromCharCode(...b.subarray(o, o + n));
    try {
      if (s(0, 4) === "RIFF" && s(8, 4) === "WAVE") return { ch: b[22] | (b[23] << 8), rate: b[24] | (b[25] << 8) | (b[26] << 16) };
      if (s(0, 4) === "fLaC") return { rate: (b[18] << 12) | (b[19] << 4) | (b[20] >> 4), ch: ((b[20] >> 1) & 7) + 1 };
      if (s(0, 4) === "OggS") {
        const v = s(28, 7), op = s(28, 8);
        if (v === "\x01vorbis") return { ch: b[39], rate: b[40] | (b[41] << 8) | (b[42] << 16) };
        if (op === "OpusHead") return { ch: b[37], rate: 48000 };
      }
      if (!["mp3", "mp2", "mpga"].includes(extOf(name)) && s(0, 3) !== "ID3") return {};
      let o = 0;
      if (s(0, 3) === "ID3") o = 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9]);
      for (let i = o; i < Math.min(b.length - 4, o + 65536); i++) {
        if (b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) continue;
        const ver = (b[i + 1] >> 3) & 3, layer = (b[i + 1] >> 1) & 3, bri = b[i + 2] >> 4, sri = (b[i + 2] >> 2) & 3;
        if (ver === 1 || layer !== 1 || bri === 0 || bri === 15 || sri === 3) continue;
        const rates = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] }[ver];
        const kb = ver === 3 ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
        return { rate: rates[sri], ch: (b[i + 3] >> 6) === 3 ? 1 : 2, kbps: kb[bri] };
      }
    } catch { /* unknown */ }
    return {};
  }

  CF.register({
    id: "nightamp", name: "NightAmp", icon: "nightamp", single: true, desc: "NightAmp media player: music, video, internet radio and a built-in browser.",
    window: { w: 560, h: 470, frameless: true, resizable: false },
    open(win, args) {
      const S = Object.assign({ vol: 0.75, bal: 0, eqOn: true, eqAuto: false, eq: PRESETS.Flat.slice(), shuffle: false, repeat: false, double: true, showEq: true, showPl: true,
        showVideo: false, showWeb: false, shade: false, remaining: false, vis: "spectrum", plHeight: 200, list: [], cur: -1, splash: true, auto: {} }, CF.store.get(KEY, {}));
      const persist = () => CF.store.set(KEY, Object.assign({}, S, { list: pl.filter(t => t.persist).map(t => ({ name: t.name, url: t.url, kind: t.kind, vfs: t.vfs, duration: t.duration })), cur }));
      if (S.splash) CF.appSplash({ id: "nightamp", image: `${ART}nightamp-splash.png` });

      /* ---------- audio graph ---------- */
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = new AC();
      const fx = h("video", { class: "na-media", playsinline: "", preload: "auto" });
      fx.crossOrigin = "anonymous";
      const raw = h("video", { class: "na-media", playsinline: "", preload: "auto", hidden: true });
      const src = ac.createMediaElementSource(fx);
      const pre = ac.createGain();
      const filters = BANDS.map((f, i) => { const b = ac.createBiquadFilter(); b.type = i === 0 ? "lowshelf" : i === BANDS.length - 1 ? "highshelf" : "peaking"; b.frequency.value = f; b.Q.value = 1.1; return b; });
      const pan = ac.createStereoPanner();
      const analyser = ac.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.55;
      const vol = ac.createGain();
      src.connect(pre); filters.reduce((a, b) => (a.connect(b), b), pre).connect(pan); pan.connect(vol).connect(ac.destination); pan.connect(analyser);
      const midi = new ForgeMIDI.MidiPlayer(ac, pre);
      const freq = new Uint8Array(analyser.frequencyBinCount), wave = new Uint8Array(analyser.fftSize);
      function applyEq() {
        const on = S.eqOn;
        pre.gain.value = Math.pow(10, (on ? S.eq[0] : 0) / 20) * 0.9;
        filters.forEach((f, i) => { f.gain.value = on ? S.eq[i + 1] : 0; });
      }
      function applyVol() { vol.gain.value = S.vol * S.vol; raw.volume = S.vol; pan.pan.value = S.bal; }

      /* ---------- player state ---------- */
      const pl = S.list.map(t => Object.assign({ persist: true }, t));
      let cur = Math.min(S.cur, pl.length - 1), engine = null, active = fx, hls = null, playing = false, info = {}, midiDur = 0, probing = false, reported = false;
      // One message per track, however many ways it fails (equalized element, plain fallback, play()).
      const report = (msg) => { if (reported) return; reported = true; CF.toast({ title: "NightAmp", body: msg, icon: "nightamp" }); };
      const media = () => active;

      /* ---------- DOM: main window (275 x 116) ---------- */
      const el = (tag, x, y, w, hh, cls, extra = {}) => h(tag, Object.assign({ class: cls, style: `left:${x}px;top:${y}px;width:${w}px;height:${hh}px` }, extra));
      const mainTitle = el("div", 0, 0, 275, 14, "na-title", { "data-drag": "" });
      const titleText = h_canvas(120, 6); titleText.className = "na-titletext";
      mainTitle.append(h("img", { class: "na-ticon", src: `${ART}nightamp.png`, alt: "", title: "NightAmp menu" }), titleText,
        h("button", { class: "na-tbtn", title: "Minimize", "data-act": "min" }, "_"), h("button", { class: "na-tbtn", title: "Windowshade mode", "data-act": "shade" }, "▭"), h("button", { class: "na-tbtn close", title: "Close", "data-act": "close" }, "×"));
      const clutter = el("div", 10, 22, 8, 43, "na-clutter");
      [["O", "Options menu", () => menu(clutter)], ["V", "Video window", () => toggle("showVideo")], ["W", "Web & radio browser", () => toggle("showWeb")], ["I", "File info", fileInfo], ["D", "Double size", () => toggle("double")]]
        .forEach(([l, t, fn]) => { const c = h_canvas(8, 8); drawText(c.getContext("2d"), l, 2, 1, "#31d7e8"); const b = h("button", { class: "na-clut", title: t, "data-l": l }, c); b.addEventListener("click", fn); clutter.append(b); });
      const lcd = el("div", 20, 20, 86, 44, "na-lcd");
      const statusC = h_canvas(9, 9); statusC.className = "na-status";
      const digits = [36, 48, 60, 78, 90].map(x => el("span", x - 20, 6, 9, 13, "na-digit"));
      const colon = el("span", 71 - 20, 9, 2, 8, "na-colon");
      const visC = h_canvas(76, 16); visC.className = "na-vis"; visC.title = "Click to change the visualization";
      lcd.append(statusC, ...digits, colon, visC);
      const songBox = el("div", 108, 23, 158, 12, "na-song");
      const marquee = h_canvas(154, 6); marquee.className = "na-marquee";
      songBox.append(marquee);
      const infoC = el("canvas", 108, 38, 104, 8, "na-info"); infoC.width = 104; infoC.height = 8;
      const monoC = el("canvas", 212, 38, 54, 8, "na-mono"); monoC.width = 54; monoC.height = 8;
      const volS = slider(107, 57, 68, 13, 14, S.vol, (v) => { S.vol = v; applyVol(); flash(`VOLUME: ${Math.round(v * 100)}%`); persist(); }, "na-volume");
      const balS = slider(177, 57, 38, 13, 14, (S.bal + 1) / 2, (v) => { S.bal = Math.abs(v - 0.5) < 0.08 ? 0 : v * 2 - 1; applyVol(); flash(S.bal ? `BALANCE: ${Math.round(Math.abs(S.bal) * 100)}% ${S.bal < 0 ? "LEFT" : "RIGHT"}` : "BALANCE: CENTER"); persist(); }, "na-balance");
      const eqBtn = el("button", 219, 58, 23, 12, "na-tog", { title: "Toggle the equalizer" }); eqBtn.append(label("EQ", 23, 12));
      const plBtn = el("button", 242, 58, 23, 12, "na-tog", { title: "Toggle the playlist" }); plBtn.append(label("PL", 23, 12));
      const seek = slider(16, 72, 248, 10, 29, 0, null, "na-seek", (v) => { const d = duration(); if (d) setPos(v * d); }, (v) => { const d = duration(); flash(`SEEK TO: ${fmtTime(v * d)}/${fmtTime(d)}`); });
      const tbtns = [["prev", 16, 23, "Previous (Z)", prev], ["play", 39, 23, "Play (X)", play], ["pause", 62, 23, "Pause (C)", pause], ["stop", 85, 23, "Stop (V)", stop], ["next", 108, 22, "Next (B)", next]]
        .map(([n, x, w, t, fn], i) => { const b = el("button", x, 88, w, 18, "na-cb", { title: t }); b.style.backgroundPosition = `-${i * 23}px 0`; b.style.setProperty("--pos", `-${i * 23}px`); b.addEventListener("click", fn); return b; });
      const eject = el("button", 136, 89, 22, 16, "na-cb", { title: "Open file (L)" }); eject.style.backgroundPosition = "-115px 0"; eject.style.setProperty("--pos", "-115px"); eject.addEventListener("click", openFiles);
      const shufBtn = el("button", 164, 89, 44, 15, "na-tog wide", { title: "Shuffle (S)" }); shufBtn.append(label("SHUFFLE", 44, 15));
      const repBtn = el("button", 210, 89, 32, 15, "na-tog wide", { title: "Repeat (R)" }); repBtn.append(label("REPEAT", 32, 15));
      const logoBtn = el("button", 246, 88, 20, 18, "na-logo", { title: "About NightAmp" }); logoBtn.append(h("img", { src: "assets/art/nightcode/logo-32.png", alt: "" }));
      const main = h("div", { class: "na-win na-main" }, mainTitle, clutter, lcd, songBox, infoC, monoC, volS.el, balS.el, eqBtn, plBtn, seek.el, ...tbtns, eject, shufBtn, repBtn, logoBtn);

      /* ---------- equalizer window (275 x 116) ---------- */
      const eqTitle = el("div", 0, 0, 275, 14, "na-title", { "data-drag": "" });
      const eqTitleText = h_canvas(140, 6); eqTitleText.className = "na-titletext"; drawText(eqTitleText.getContext("2d"), "NIGHTAMP EQUALIZER", 0, 0, "#cfe6ff");
      eqTitle.append(eqTitleText, h("button", { class: "na-tbtn close", title: "Close equalizer", "data-act": "eq" }, "×"));
      const onBtn = el("button", 14, 18, 26, 12, "na-tog", { title: "Equalizer on/off" }); onBtn.append(label("ON", 26, 12));
      const autoBtn = el("button", 42, 18, 32, 12, "na-tog", { title: "Remember the equalizer for each track" }); autoBtn.append(label("AUTO", 32, 12));
      const presetBtn = el("button", 217, 18, 44, 12, "na-tog", { title: "Presets" }); presetBtn.append(label("PRESETS", 44, 12));
      const graph = el("canvas", 86, 17, 113, 19, "na-graph"); graph.width = 113; graph.height = 19;
      const eqSliders = [21, ...BANDS.map((_, i) => 78 + i * 18)].map((x, i) => {
        const s = vslider(x, 38, 14, 63, (12 - S.eq[i]) / 24, (v) => {
          S.eq[i] = Math.round((0.5 - v) * 24 * 2) / 2;
          if (Math.abs(S.eq[i]) < 0.6) S.eq[i] = 0;
          applyEq(); drawGraph(); flash(`${i ? "EQ " + BAND_LABELS[i - 1] + "HZ" : "PREAMP"}: ${S.eq[i] > 0 ? "+" : ""}${S.eq[i]} DB`); saveAuto(); persist();
        });
        return s;
      });
      const eqLabels = el("canvas", 0, 38, 275, 72, "na-eqlabels"); eqLabels.width = 275; eqLabels.height = 72;
      const lctx = eqLabels.getContext("2d");
      drawText(lctx, "PRE", 18, 66, "#5f80ab"); drawText(lctx, "+12", 44, 1, "#5f80ab"); drawText(lctx, "0", 52, 29, "#5f80ab"); drawText(lctx, "-12", 44, 57, "#5f80ab");
      BAND_LABELS.forEach((t, i) => drawText(lctx, t, 78 + i * 18 + 7 - Math.round(t.length * 5 / 2), 66, "#5f80ab"));
      const eqWin = h("div", { class: "na-win na-eq" }, eqTitle, onBtn, autoBtn, presetBtn, graph, eqLabels, ...eqSliders.map(s => s.el));

      /* ---------- playlist window ---------- */
      const plTitle = h("div", { class: "na-title na-ptitle", "data-drag": "" });
      const plTitleText = h_canvas(120, 6); plTitleText.className = "na-titletext"; drawText(plTitleText.getContext("2d"), "NIGHTAMP PLAYLIST", 0, 0, "#cfe6ff");
      plTitle.append(plTitleText, h("button", { class: "na-tbtn close", title: "Close playlist", "data-act": "pl" }, "×"));
      const plSearch = h("input", { class: "na-search", placeholder: "Search playlist…", spellcheck: "false" });
      const plList = h("div", { class: "na-list", tabindex: 0 });
      const plTotal = h("span", { class: "na-total" });
      const plBtn2 = (t, fn) => { const b = h("button", { class: "na-pbtn" }, t); b.addEventListener("click", (e) => fn(e.currentTarget)); return b; };
      const plGrip = h("div", { class: "na-pgrip", title: "Drag to resize" });
      const plWin = h("div", { class: "na-win na-pl" }, plTitle, plSearch, plList,
        h("div", { class: "na-pbar" }, plBtn2("ADD", addMenu), plBtn2("REM", remMenu), plBtn2("SEL", selMenu), plBtn2("MISC", miscMenu), plTotal, plBtn2("LIST", listMenu)), plGrip);

      /* ---------- video + web windows (the NightCode upgrade) ---------- */
      const vidTitle = h("div", { class: "na-title na-ptitle", "data-drag": "" });
      const vidTitleText = h_canvas(160, 6); vidTitleText.className = "na-titletext"; drawText(vidTitleText.getContext("2d"), "NIGHTAMP VIDEO", 0, 0, "#cfe6ff");
      const speedSel = h("select", { class: "na-mini", title: "Playback speed" }, [0.5, 0.75, 1, 1.25, 1.5, 2].map(r => h("option", { value: r, selected: r === 1 }, `${r}x`)));
      speedSel.addEventListener("change", () => { fx.playbackRate = raw.playbackRate = +speedSel.value; });
      const vbtn = (t, title, fn) => { const b = h("button", { class: "na-pbtn", title }, t); b.addEventListener("click", fn); return b; };
      vidTitle.append(vidTitleText, speedSel, vbtn("SUB", "Load subtitles (.srt / .vtt)", loadSubs), vbtn("PIP", "Picture in picture", () => media().requestPictureInPicture?.().catch(() => {})),
        vbtn("FULL", "Full screen", () => stage.requestFullscreen?.()), h("button", { class: "na-tbtn close", title: "Close video", "data-act": "video" }, "×"));
      const stage = h("div", { class: "na-stage" }, fx, raw);
      const drop = h("div", { class: "na-drop" });
      stage.append(drop);
      stage.addEventListener("dblclick", () => document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen?.());
      const vidWin = h("div", { class: "na-win na-video" }, vidTitle, stage);
      const webTitle = h("div", { class: "na-title na-ptitle", "data-drag": "" });
      const webTitleText = h_canvas(160, 6); webTitleText.className = "na-titletext"; drawText(webTitleText.getContext("2d"), "NIGHTAMP WEB & RADIO", 0, 0, "#cfe6ff");
      webTitle.append(webTitleText, h("button", { class: "na-tbtn close", title: "Close browser", "data-act": "web" }, "×"));
      const webBody = h("div", { class: "na-webbody" });
      const webWin = h("div", { class: "na-win na-web" }, webTitle, webBody);
      let web = null;

      const col1 = h("div", { class: "na-col" }, main, eqWin, plWin);
      const col2 = h("div", { class: "na-col2" }, vidWin, webWin);
      const root = h("div", { class: "na", tabindex: 0 }, col1, col2);
      win.body.append(root);
      [mainTitle, eqTitle, plTitle, vidTitle, webTitle].forEach(t => win.dragBy(t));
      root.addEventListener("click", (e) => {
        const act = e.target.closest("[data-act]")?.dataset.act;
        if (act === "min") win.minimize(); else if (act === "close") win.close(); else if (act === "shade") toggle("shade");
        else if (act === "eq") toggle("showEq"); else if (act === "pl") toggle("showPl"); else if (act === "video") toggle("showVideo"); else if (act === "web") toggle("showWeb");
      });
      mainTitle.querySelector(".na-ticon").addEventListener("click", (e) => menu(e.currentTarget));
      mainTitle.addEventListener("dblclick", (e) => { if (!e.target.closest("button")) toggle("shade"); });
      main.addEventListener("contextmenu", (e) => { e.preventDefault(); menu(null, e); });
      visC.addEventListener("click", () => { S.vis = { spectrum: "scope", scope: "off", off: "spectrum" }[S.vis]; persist(); });
      lcd.addEventListener("click", (e) => { if (e.target !== visC) { S.remaining = !S.remaining; persist(); } });
      eqBtn.addEventListener("click", () => toggle("showEq"));
      plBtn.addEventListener("click", () => toggle("showPl"));
      shufBtn.addEventListener("click", () => { S.shuffle = !S.shuffle; sync(); persist(); });
      repBtn.addEventListener("click", () => { S.repeat = !S.repeat; sync(); persist(); });
      onBtn.addEventListener("click", () => { S.eqOn = !S.eqOn; applyEq(); sync(); persist(); });
      autoBtn.addEventListener("click", () => { S.eqAuto = !S.eqAuto; sync(); persist(); });
      presetBtn.addEventListener("click", () => presetMenu(presetBtn));
      logoBtn.addEventListener("click", about);
      plGrip.addEventListener("pointerdown", (e) => {
        e.preventDefault(); plGrip.setPointerCapture(e.pointerId);
        const sy = e.clientY, sh = S.plHeight;
        const mv = (m) => { S.plHeight = Math.max(90, Math.min(700, sh + m.clientY - sy)); layout(); };
        plGrip.addEventListener("pointermove", mv);
        plGrip.addEventListener("pointerup", () => { plGrip.removeEventListener("pointermove", mv); persist(); }, { once: true });
      });

      /* ---------- small widgets ---------- */
      function label(text, w, hh) { const c = h_canvas(w, hh); drawText(c.getContext("2d"), text, Math.round((w - text.length * 5 + 1) / 2), Math.round((hh - 5) / 2), "#9fd3ff"); return c; }
      function slider(x, y, w, hh, tw, value, onInput, cls, onCommit, onDrag) {
        const s = el("div", x, y, w, hh, "na-slider " + cls);
        const thumb = h("div", { class: "na-thumb", style: `width:${tw}px` });
        const fill = h("div", { class: "na-fill" });
        s.append(fill, thumb);
        const api = { el: s, value, dragging: false, set(v) { api.value = Math.max(0, Math.min(1, v)); thumb.style.left = `${Math.round(api.value * (w - tw))}px`; fill.style.width = `${Math.round(api.value * (w - tw) + tw / 2)}px`; } };
        s.addEventListener("pointerdown", (e) => {
          e.preventDefault(); e.stopPropagation(); s.setPointerCapture(e.pointerId); api.dragging = true;
          const z = zoom();
          const at = (ev) => { const r = s.getBoundingClientRect(); api.set(((ev.clientX - r.left) / z - tw / 2) / (w - tw)); onInput?.(api.value); onDrag?.(api.value); };
          at(e);
          const mv = (ev) => at(ev);
          s.addEventListener("pointermove", mv);
          s.addEventListener("pointerup", () => { s.removeEventListener("pointermove", mv); api.dragging = false; onCommit?.(api.value); }, { once: true });
        });
        api.set(value);
        return api;
      }
      function vslider(x, y, w, hh, value, onInput) {
        const s = el("div", x, y, w, hh, "na-vslider");
        const thumb = h("div", { class: "na-vthumb" });
        const bar = h("div", { class: "na-vbar" });
        s.append(bar, thumb);
        const api = { el: s, value, set(v) { api.value = Math.max(0, Math.min(1, v)); const top = Math.round(api.value * (hh - 11)); thumb.style.top = `${top}px`; const mid = (hh - 11) / 2; bar.style.top = `${Math.min(top, mid) + 5}px`; bar.style.height = `${Math.abs(top - mid)}px`; bar.classList.toggle("down", top > mid); } };
        s.addEventListener("pointerdown", (e) => {
          e.preventDefault(); e.stopPropagation(); s.setPointerCapture(e.pointerId);
          const z = zoom();
          const at = (ev) => { const r = s.getBoundingClientRect(); api.set(((ev.clientY - r.top) / z - 5.5) / (hh - 11)); onInput(api.value); };
          at(e);
          const mv = (ev) => at(ev);
          s.addEventListener("pointermove", mv);
          s.addEventListener("pointerup", () => s.removeEventListener("pointermove", mv), { once: true });
        });
        s.addEventListener("dblclick", () => { api.set(0.5); onInput(0.5); });
        api.set(value);
        return api;
      }
      const zoom = () => S.double ? 2 : 1;
      let flashText = null, flashUntil = 0;
      function flash(t) { flashText = t; flashUntil = performance.now() + 1500; }

      /* ---------- layout & state sync ---------- */
      function layout() {
        const z = zoom();
        root.style.setProperty("--z", z);
        main.classList.toggle("shade", S.shade);
        eqWin.hidden = !S.showEq || S.shade;
        plWin.hidden = !S.showPl;
        plList.style.height = `${S.plHeight}px`;
        vidWin.hidden = !S.showVideo; webWin.hidden = !S.showWeb; col2.hidden = !S.showVideo && !S.showWeb;
        if (S.showWeb && !web) {
          web = CF.NightWeb.mount(webBody, { tabs: false, compact: true, storeless: true, home: "night://amp", homeTitle: "NightAmp Radio", homeHtml: radioHome, onMedia: (url, name) => { addTracks([{ name: name || url, url }], true); }, onEmpty: () => web.newTab("night://amp") });
          web.newTab("night://amp");
        }
        if (S.showVideo) startDrop(); else stopDrop();
        requestAnimationFrame(fit);
      }
      function fit() {
        win.el.style.width = `${root.offsetWidth}px`;
        win.el.style.height = `${root.offsetHeight}px`;
      }
      function toggle(k) { S[k] = !S[k]; layout(); sync(); persist(); }
      function sync() {
        eqBtn.classList.toggle("on", S.showEq); plBtn.classList.toggle("on", S.showPl);
        shufBtn.classList.toggle("on", S.shuffle); repBtn.classList.toggle("on", S.repeat);
        onBtn.classList.toggle("on", S.eqOn); autoBtn.classList.toggle("on", S.eqAuto);
        clutter.querySelectorAll(".na-clut").forEach(b => b.classList.toggle("on", { V: S.showVideo, W: S.showWeb, D: S.double }[b.dataset.l] || false));
        eqSliders.forEach((s, i) => s.set((12 - S.eq[i]) / 24));
        volS.set(S.vol); balS.set((S.bal + 1) / 2);
        drawGraph();
      }
      function drawGraph() {
        const g = graph.getContext("2d");
        g.clearRect(0, 0, 113, 19);
        g.fillStyle = "#0a1430"; g.fillRect(0, 0, 113, 19);
        g.fillStyle = "#13265a"; g.fillRect(0, 9, 113, 1);
        const pts = S.eq.slice(1).map((v, i) => [2 + i * 12, 9 - v / 12 * 8]);
        for (let x = 0; x < 113; x++) {
          const k = Math.min(8, Math.max(0, Math.floor((x - 2) / 12))), t = Math.max(0, Math.min(1, (x - 2 - k * 12) / 12));
          const [, y0] = pts[k], [, y1] = pts[Math.min(9, k + 1)];
          const y = Math.round(y0 + (y1 - y0) * (0.5 - Math.cos(Math.PI * t) / 2));
          g.fillStyle = S.eqOn ? (Math.abs(9 - y) > 5 ? "#9ff0ff" : "#31d7e8") : "#3a5d93"; g.fillRect(x, Math.max(0, Math.min(18, y)), 1, 1);
        }
        g.fillStyle = "#4fa3ff"; g.fillRect(0, Math.round(9 - S.eq[0] / 12 * 8), 113, 1);
        g.globalAlpha = 0.25; g.fillRect(0, Math.round(9 - S.eq[0] / 12 * 8), 113, 1); g.globalAlpha = 1;
      }

      /* ---------- playlist ---------- */
      let sel = new Set(), dragFrom = -1;
      function renderList() {
        const q = plSearch.value.trim().toLowerCase();
        const rows = [];
        pl.forEach((t, i) => {
          if (q && !t.name.toLowerCase().includes(q)) return;
          const r = h("div", { class: "na-row" + (i === cur ? " cur" : "") + (sel.has(i) ? " sel" : ""), draggable: "true", "data-i": i },
            h("span", { class: "na-idx" }, `${i + 1}.`), h("span", { class: "na-name" }, t.name), h("span", { class: "na-dur" }, t.kind === "stream" || t.kind === "hls" ? (t.kind === "hls" ? "HLS" : "LIVE") : fmtTime(t.duration)));
          r.addEventListener("click", (e) => { if (e.ctrlKey) sel.has(i) ? sel.delete(i) : sel.add(i); else if (e.shiftKey && sel.size) { const a = Math.min(...sel, i), b = Math.max(...sel, i); for (let k = a; k <= b; k++) sel.add(k); } else sel = new Set([i]); renderList(); });
          r.addEventListener("dblclick", () => { load(i, true); });
          r.addEventListener("contextmenu", (e) => { e.preventDefault(); if (!sel.has(i)) sel = new Set([i]); renderList(); CF.contextMenu({ x: e.clientX, y: e.clientY }, [
            { label: "Play", action: () => load(i, true) }, { label: "File info…", action: () => fileInfo(i) }, "-",
            { label: "Move to top", action: () => move([...sel], 0) }, { label: "Remove", key: "Del", action: removeSelected },
            t.url.startsWith("blob:") && t.kind !== "midi" ? { label: "Save to My Documents", action: () => saveTrack(t) } : null]); });
          r.addEventListener("dragstart", (e) => { dragFrom = i; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/nightamp", String(i)); });
          r.addEventListener("dragover", (e) => { if (dragFrom >= 0) { e.preventDefault(); r.classList.add("over"); } });
          r.addEventListener("dragleave", () => r.classList.remove("over"));
          r.addEventListener("drop", (e) => { if (dragFrom < 0) return; e.preventDefault(); e.stopPropagation(); move(sel.has(dragFrom) ? [...sel] : [dragFrom], i); dragFrom = -1; });
          rows.push(r);
        });
        if (!pl.length) rows.push(h("div", { class: "na-empty" }, "Drop music or video here, press L to open files, or open W for internet radio."));
        plList.replaceChildren(...rows);
        const known = pl.filter(t => isFinite(t.duration)), tot = known.reduce((a, t) => a + t.duration, 0);
        plTotal.textContent = `${cur >= 0 ? fmtTime(pl[cur]?.duration) : "0:00"}/${fmtTime(tot)}${known.length < pl.length ? "+" : ""}`;
      }
      plSearch.addEventListener("input", renderList);
      plSearch.addEventListener("keydown", (e) => { if (e.key === "Enter") { const r = plList.querySelector(".na-row"); if (r) load(+r.dataset.i, true); } e.stopPropagation(); });
      function move(idxs, to) {
        const curTrack = pl[cur];
        const items = idxs.sort((a, b) => a - b).map(i => pl[i]);
        const rest = pl.filter((_, i) => !idxs.includes(i));
        const at = Math.min(rest.length, to - idxs.filter(i => i < to).length);
        rest.splice(at, 0, ...items);
        pl.splice(0, pl.length, ...rest);
        cur = pl.indexOf(curTrack);
        sel = new Set(items.map(t => pl.indexOf(t)));
        renderList(); persist();
      }
      function removeSelected() {
        if (!sel.size) return;
        const curTrack = pl[cur];
        const keep = pl.filter((_, i) => !sel.has(i));
        if (curTrack && !keep.includes(curTrack)) stop();
        pl.splice(0, pl.length, ...keep);
        cur = pl.indexOf(curTrack);
        sel.clear(); renderList(); persist();
      }
      plList.addEventListener("keydown", (e) => {
        if (e.key === "Delete") removeSelected();
        else if (e.key === "Enter" && sel.size) load([...sel][0], true);
        else if (e.ctrlKey && e.key.toLowerCase() === "a") { e.preventDefault(); sel = new Set(pl.map((_, i) => i)); renderList(); }
      });

      /* ---------- adding tracks ---------- */
      function trackFrom({ name, url, file, vfs, kind, duration }) {
        const k = kind || kindOf(name, url);
        const shown = (name || url || "Untitled").replace(/\.(mp3|mp2|m4a|m4b|aac|flac|ogg|oga|opus|wav|wave|weba|mka|aiff?|aifc|caf|mp4|m4v|webm|mkv|mov|ogv|avi|wmv|mid|midi|rmi|kar|mus)$/i, "");
        return { name: shown, url, file, vfs, kind: k, duration: duration ?? (k === "stream" ? Infinity : NaN), persist: !!vfs || /^https?:/.test(url) };
      }
      async function addTracks(list, playNow) {
        const start = pl.length;
        for (const it of list) {
          if (LIST_EXT.includes(extOf(it.name)) || LIST_EXT.includes(extOf(it.url || ""))) { pl.push(...await readPlaylist(it)); continue; }
          pl.push(trackFrom(it));
        }
        renderList(); persist();
        if (playNow && pl.length > start) load(start, true);
        probeDurations(start);
      }
      async function readPlaylist(it) {
        let text = "";
        try { text = it.file ? await it.file.text() : await (await fetch(it.url)).text(); }
        catch { return [trackFrom({ name: it.name, url: it.url, kind: "stream" })]; }
        const out = [];
        if (/^\s*\[playlist\]/i.test(text)) {
          const files = {}, titles = {};
          for (const line of text.split(/\r?\n/)) { const m = /^(File|Title)(\d+)=(.*)$/i.exec(line.trim()); if (m) (m[1].toLowerCase() === "file" ? files : titles)[m[2]] = m[3]; }
          for (const n of Object.keys(files).sort((a, b) => a - b)) out.push(trackFrom({ name: titles[n] || files[n], url: files[n] }));
        } else {
          let title = null;
          for (const line of text.split(/\r?\n/).map(l => l.trim())) {
            if (!line) continue;
            if (line.startsWith("#EXTINF:")) { title = line.slice(line.indexOf(",") + 1); continue; }
            if (line.startsWith("#")) continue;
            const url = /^[a-z]+:/i.test(line) ? line : it.url ? new URL(line, it.url).href : line;
            out.push(trackFrom({ name: title || decodeURIComponent(url.split("/").pop() || url), url }));
            title = null;
          }
        }
        return out.length ? out : [trackFrom({ name: it.name, url: it.url })];
      }
      function probeDurations(from) {
        pl.slice(from).forEach((t) => {
          if (isFinite(t.duration) || t.kind === "stream" || t.kind === "hls" || t.kind === "midi") return;
          const probeEl = document.createElement("audio");
          probeEl.preload = "metadata";
          probeEl.src = t.url;
          probeEl.onloadedmetadata = () => { if (isFinite(probeEl.duration)) { t.duration = probeEl.duration; renderList(); persist(); } probeEl.src = ""; };
          probeEl.onerror = () => { probeEl.src = ""; };
        });
      }
      function openFiles() {
        const inp = h("input", { type: "file", multiple: true, accept: "audio/*,video/*," + [...AUDIO_EXT, ...VIDEO_EXT, ...MIDI_EXT, ...LIST_EXT].map(e => "." + e).join(",") });
        inp.addEventListener("change", () => addTracks([...inp.files].map(f => ({ name: f.name, url: URL.createObjectURL(f), file: f })), true));
        inp.click();
      }
      async function openUrl() {
        const r = await CF.dialog({ title: "Open URL", icon: "nightamp", message: "Stream, file or playlist address (http, https, .m3u, .pls, .m3u8):", input: "https://", buttons: ["Play", "Enqueue", "Cancel"] });
        if (!r.button || r.button === "Cancel" || !/^https?:\/\/./.test(r.value.trim())) return;
        const url = r.value.trim();
        addTracks([{ name: decodeURIComponent(url.split(/[?#]/)[0].split("/").pop()) || url, url }], r.button === "Play");
      }
      function fromDocuments() {
        const docs = CF.vfs.list().filter(d => CF.fileType(d.name)?.app === "nightamp");
        if (!docs.length) return CF.dialog({ title: "NightAmp", icon: "info", message: "There's no music or video in My Documents yet." });
        return addTracks(docs.map(d => vfsTrack(d.name)), false);
      }
      function vfsTrack(name) {
        const bytes = CF.vfs.readBytes(name);
        const blob = new Blob([bytes]);
        return { name, url: URL.createObjectURL(blob), file: blob, vfs: name };
      }
      async function saveTrack(t) {
        const bytes = new Uint8Array(await (await fetch(t.url)).arrayBuffer());
        const name = /\.[a-z0-9]+$/i.test(t.name) ? t.name : `${t.name}.${extOf(t.file?.name || "") || "bin"}`;
        if (CF.vfs.writeBytes(name, bytes)) { t.vfs = name; t.persist = true; persist(); CF.toast({ title: "NightAmp", body: `Saved ${name} to My Documents.`, icon: "nightamp" }); }
      }

      /* ---------- playback ---------- */
      function duration() { return engine === "midi" ? midiDur : isFinite(media().duration) ? media().duration : 0; }
      function position() { return engine === "midi" ? midi.currentTime : media().currentTime || 0; }
      function setPos(t) { if (engine === "midi") midi.seek(t); else if (isFinite(media().duration)) media().currentTime = t; }
      function halt() {
        midi.stop();
        for (const m of [fx, raw]) { m.pause(); }
        if (hls) { hls.destroy(); hls = null; }
      }
      async function load(i, autoplay) {
        if (i < 0 || i >= pl.length) return;
        halt();
        cur = i; playing = false; reported = false;
        const t = pl[i];
        info = {};
        renderList(); persist();
        if (S.eqAuto && S.auto[t.name]) { S.eq = S.auto[t.name].slice(); applyEq(); sync(); }
        try {
          if (t.kind === "midi") {
            engine = "midi";
            if (!t.song) t.song = ForgeMIDI.parse(await (t.file || await (await fetch(t.url)).blob()).arrayBuffer(), t.name);
            midi.load(t.song); midiDur = midi.duration; t.duration = midiDur; info = { ch: 2, rate: ac.sampleRate, synth: true };
            renderList();
            if (autoplay) play();
            return;
          }
          engine = "media";
          let url = t.url;
          if (t.kind === "aiff") {
            if (!t.wavUrl) { const bytes = new Uint8Array(await (t.file || await (await fetch(t.url)).blob()).arrayBuffer()); t.wavUrl = URL.createObjectURL(new Blob([aiffToWav(bytes)], { type: "audio/wav" })); }
            url = t.wavUrl;
          }
          if (t.file) t.file.slice(0, 262144).arrayBuffer().then(b => { info = Object.assign(probe(new Uint8Array(b), t.file.name || t.vfs || t.url), { size: t.file.size }); });
          const remote = /^https?:/.test(url) && !url.startsWith(location.origin);
          active = fx; raw.hidden = true; fx.hidden = false;
          await attach(fx, url, t.kind === "hls");
          if (remote) {
            probing = true;
            // Streams without CORS headers can't go through the equalizer: fall back to a plain element.
            const okFx = await new Promise(res => { const ok = () => { cleanup(); res(true); }, bad = () => { cleanup(); res(false); }; const cleanup = () => { fx.removeEventListener("loadedmetadata", ok); fx.removeEventListener("canplay", ok); fx.removeEventListener("error", bad); }; fx.addEventListener("loadedmetadata", ok); fx.addEventListener("canplay", ok); fx.addEventListener("error", bad); setTimeout(() => { cleanup(); res(!fx.error); }, 8000); });
            probing = false;
            if (!okFx) {
              fx.removeAttribute("src"); fx.load();
              active = raw; raw.hidden = false; fx.hidden = true;
              await attach(raw, url, t.kind === "hls");
              info.plain = true;
              flash("EQ AND VISUALS OFF FOR THIS STREAM");
            }
          }
          if (autoplay) play();
        } catch (e) {
          console.error(e);
          probing = false;
          report(`Can't play ${t.name}: ${e.message}`);
        }
      }
      async function attach(m, url, isHls) {
        m.playbackRate = +speedSel.value;
        if (isHls && !m.canPlayType("application/vnd.apple.mpegurl")) {
          if (!window.Hls) await new Promise((res, rej) => { const s = h("script", { src: "vendor/hls/hls.min.js" }); s.onload = res; s.onerror = () => rej(new Error("hls.js is missing")); document.head.append(s); });
          if (window.Hls?.isSupported()) { hls = new window.Hls(); hls.loadSource(url); hls.attachMedia(m); return; }
        }
        m.src = url;
      }
      function play() {
        if (cur < 0 && pl.length) return load(0, true);
        ac.resume();
        if (engine === "midi") midi.play();
        else media().play().catch((e) => { if (e.name !== "AbortError" && !probing) report(`Can't play ${pl[cur]?.name || "this file"}: ${e.message}`); });
        playing = true;
        const t = pl[cur];
        if (t && "mediaSession" in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: t.name, artist: "NightAmp", artwork: [{ src: `${ART}nightamp-64.png`, sizes: "64x64", type: "image/png" }] });
      }
      function pause() {
        if (engine === "midi") {
          if (midi.playing) { midi.pause(); playing = false; } else if (midi.song) { ac.resume(); midi.play(); playing = true; }
          return;
        }
        const m = media();
        if (!m.src && !hls) return;
        if (m.paused) { ac.resume(); m.play().catch(() => {}); playing = true; } else { m.pause(); playing = false; }
      }
      function stop() {
        midi.stop(); fx.pause(); raw.pause();
        const m = media();
        if (m.src && isFinite(m.duration)) m.currentTime = 0;
        playing = false;
      }
      function nextIndex(dir) {
        if (!pl.length) return -1;
        if (S.shuffle && pl.length > 1) { let n; do { n = Math.floor(Math.random() * pl.length); } while (n === cur); return n; }
        const n = cur + dir;
        if (n >= pl.length) return S.repeat ? 0 : -1;
        if (n < 0) return S.repeat ? pl.length - 1 : 0;
        return n;
      }
      function next() { const n = nextIndex(1); if (n >= 0) load(n, true); }
      function prev() { if (position() > 3 && engine !== "midi") return setPos(0); const n = nextIndex(-1); if (n >= 0) load(n, true); }
      function ended() { const n = nextIndex(1); if (n >= 0) load(n, true); else { playing = false; stop(); } }
      for (const m of [fx, raw]) {
        m.addEventListener("ended", () => { if (m === media()) ended(); });
        m.addEventListener("loadedmetadata", () => {
          if (m !== media()) return;
          const t = pl[cur];
          if (t && isFinite(m.duration)) { t.duration = m.duration; renderList(); persist(); }
          if (m.videoWidth && !S.showVideo) { S.showVideo = true; layout(); sync(); }
          stage.classList.toggle("has-video", !!m.videoWidth);
        });
        m.addEventListener("play", () => { if (m === media()) playing = true; });
        m.addEventListener("pause", () => { if (m === media() && !m.ended) playing = false; });
        m.addEventListener("error", () => { if (m === media() && m.error && m.src && !probing) report(`Can't play ${pl[cur]?.name || "this file"} (${["", "aborted", "network error", "decoding error", "format not supported or stream unreachable"][m.error.code] || "error"}).`); });
      }
      midi.onended = ended;
      if ("mediaSession" in navigator) {
        try {
          navigator.mediaSession.setActionHandler("play", play); navigator.mediaSession.setActionHandler("pause", pause);
          navigator.mediaSession.setActionHandler("nexttrack", next); navigator.mediaSession.setActionHandler("previoustrack", prev); navigator.mediaSession.setActionHandler("stop", stop);
        } catch { /* not supported */ }
      }

      /* ---------- subtitles ---------- */
      function loadSubs() {
        const inp = h("input", { type: "file", accept: ".srt,.vtt" });
        inp.addEventListener("change", async () => {
          const f = inp.files[0]; if (!f) return;
          let text = await f.text();
          if (!/^WEBVTT/.test(text)) text = "WEBVTT\n\n" + text.replace(/\r/g, "").replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
          [fx, raw].forEach(m => { m.querySelectorAll("track").forEach(tr => tr.remove()); const tr = h("track", { kind: "subtitles", label: f.name, srclang: "en", default: "", src: URL.createObjectURL(new Blob([text], { type: "text/vtt" })) }); m.append(tr); tr.track.mode = "showing"; });
          flash(`SUBTITLES: ${f.name}`);
        });
        inp.click();
      }

      /* ---------- NightDrop: audio-reactive code rain when there's no picture ---------- */
      let dropRain = null;
      function startDrop() { if (!dropRain && window.NightCodeRain) dropRain = NightCodeRain(drop, { logo: "fixed", logoX: 0.5, logoY: 0.45, logoSize: 0.55, fps: 30 }); }
      function stopDrop() { if (dropRain) { dropRain.stop(); dropRain = null; } }

      /* ---------- the display loop ---------- */
      const mctx = marquee.getContext("2d"), vctx = visC.getContext("2d"), sctx = statusC.getContext("2d"), tctx = titleText.getContext("2d"), ictx = infoC.getContext("2d"), moctx = monoC.getContext("2d");
      const peaks = new Float32Array(19);
      let scroll = 0, lastScroll = 0, raf = 0, lastTitle = "", dropTick = 0;
      function frame(now) {
        raf = requestAnimationFrame(frame);
        const t = pl[cur], d = duration(), p = position();
        const isPlaying = engine === "midi" ? midi.playing : !media().paused && !media().ended;
        // title bar
        const title = S.shade ? `${fmtTime(p)} ${t ? t.name : "NIGHTAMP"}` : "NIGHTAMP";
        if (title !== lastTitle) { tctx.clearRect(0, 0, 120, 6); drawText(tctx, title.slice(0, 24), S.shade ? 0 : 34, 0, "#cfe6ff"); lastTitle = title; }
        // status + time
        sctx.clearRect(0, 0, 9, 9);
        sctx.fillStyle = isPlaying ? "#3cff9e" : "#31d7e8";
        if (isPlaying) { sctx.beginPath(); sctx.moveTo(1, 0); sctx.lineTo(8, 4.5); sctx.lineTo(1, 9); sctx.fill(); }
        else if (t && (engine === "midi" ? midi.offset > 0 : p > 0)) { sctx.fillRect(1, 1, 3, 7); sctx.fillRect(5, 1, 3, 7); }
        else sctx.fillRect(1, 1, 7, 7);
        const show = S.remaining && d ? d - p : p;
        const secs = Math.floor(show), mm = Math.min(99, Math.floor(secs / 60)), ss = secs % 60;
        const cells = [S.remaining && d ? 11 : 10, Math.floor(mm / 10), mm % 10, Math.floor(ss / 10), ss % 10];
        const blink = !isPlaying && p > 0 && Math.floor(now / 500) % 2;
        digits.forEach((dg, k) => { dg.style.backgroundPosition = `-${(blink || !t ? 10 : cells[k]) * 9}px 0`; });
        // seek bar
        if (!seek.dragging) seek.set(d ? p / d : 0);
        seek.el.classList.toggle("live", !d && isPlaying);
        // marquee
        if (now - lastScroll > 60) {
          lastScroll = now;
          mctx.clearRect(0, 0, 154, 6);
          let text = flashText && now < flashUntil ? flashText : t ? `${cur + 1}. ${t.name} (${t.kind === "stream" ? "LIVE" : fmtTime(t.duration)})  ***  ` : "NIGHTAMP 1.0  ***  PRESS L TO OPEN FILES, W FOR RADIO  ***  ";
          if (flashText && now < flashUntil) drawText(mctx, text, 0, 0, "#9ff0ff");
          else {
            const w = text.length * 5;
            if (w <= 154 && t) drawText(mctx, text.replace(/\s+\*\*\*\s+$/, ""), 0, 0, "#31d7e8");
            else { scroll = (scroll + 1) % w; drawText(mctx, text, -scroll, 0, "#31d7e8"); drawText(mctx, text, w - scroll, 0, "#31d7e8"); }
          }
          // kbps / kHz / mono-stereo
          ictx.clearRect(0, 0, 104, 8); moctx.clearRect(0, 0, 54, 8);
          const kbps = info.kbps || (info.size && d ? Math.round(info.size * 8 / d / 1000) : null);
          drawText(ictx, kbps ? String(Math.min(999, kbps)).padStart(3, " ") : t?.kind === "stream" ? "LIV" : "---", 3, 1, "#31d7e8"); drawText(ictx, "KBPS", 20, 1, "#5f80ab");
          drawText(ictx, info.rate ? String(Math.round(info.rate / 1000)).padStart(2, " ") : "--", 48, 1, "#31d7e8"); drawText(ictx, "KHZ", 60, 1, "#5f80ab");
          if (info.synth) drawText(ictx, "MIDI", 80, 1, "#3cff9e");
          const ch = info.ch || (t ? 2 : 0);
          drawText(moctx, "MONO", 0, 1, ch === 1 ? "#3cff9e" : "#1d3f8f"); drawText(moctx, "STEREO", 24, 1, ch === 2 ? "#3cff9e" : "#1d3f8f");
        }
        // visualizer
        vctx.clearRect(0, 0, 76, 16);
        const live = !info.plain && isPlaying;
        if (S.vis === "spectrum") {
          if (live) analyser.getByteFrequencyData(freq); else freq.fill(0);
          for (let b = 0; b < 19; b++) {
            const lo = Math.floor(Math.pow(freq.length * 0.6, b / 19)), hi = Math.max(lo + 1, Math.floor(Math.pow(freq.length * 0.6, (b + 1) / 19)));
            let m = 0; for (let k = lo; k < hi; k++) m = Math.max(m, freq[k]);
            const v = Math.round(m / 255 * 16);
            peaks[b] = Math.max(v, peaks[b] - 0.35);
            for (let y = 0; y < v; y++) { vctx.fillStyle = y > 12 ? "#9ff0ff" : y > 8 ? "#31d7e8" : y > 4 ? "#1e78ff" : "#1d3f8f"; vctx.fillRect(b * 4, 15 - y, 3, 1); }
            if (peaks[b] > 0.5) { vctx.fillStyle = "#ffffff"; vctx.fillRect(b * 4, 15 - Math.round(peaks[b]), 3, 1); }
          }
        } else if (S.vis === "scope") {
          if (live) analyser.getByteTimeDomainData(wave); else wave.fill(128);
          vctx.fillStyle = "#31d7e8";
          for (let x = 0; x < 76; x++) { const v = wave[Math.floor(x * wave.length / 76)]; vctx.fillRect(x, Math.round((v / 255) * 15), 1, 1); }
        }
        // NightDrop reacts to the bass
        if (dropRain && (++dropTick % 6) === 0) {
          let bass = 0;
          if (live) { analyser.getByteFrequencyData(freq); for (let k = 1; k < 12; k++) bass += freq[k]; bass /= 11 * 255; }
          dropRain.set({ speed: 0.35 + bass * 3.2, rainOpacity: 0.6 + bass * 0.4 });
        }
        drop.hidden = stage.classList.contains("has-video") && media() && !media().paused;
      }
      raf = requestAnimationFrame(frame);

      /* ---------- menus ---------- */
      function at(elm, e) { if (e) return { x: e.clientX, y: e.clientY }; const r = elm.getBoundingClientRect(); return { x: r.left, y: r.bottom }; }
      function menu(elm, e) {
        CF.contextMenu(at(elm || mainTitle, e), [
          { label: "Play file…", key: "L", action: openFiles }, { label: "Play URL…", key: "Ctrl+L", action: openUrl }, { label: "Add from My Documents", action: fromDocuments }, "-",
          { label: "Main window", checked: true, disabled: true }, { label: "Equalizer", key: "Alt+G", checked: S.showEq, action: () => toggle("showEq") }, { label: "Playlist editor", key: "Alt+E", checked: S.showPl, action: () => toggle("showPl") },
          { label: "Video", key: "Alt+V", checked: S.showVideo, action: () => toggle("showVideo") }, { label: "Web & radio browser", key: "Alt+W", checked: S.showWeb, action: () => toggle("showWeb") }, "-",
          { label: "Double size", key: "Ctrl+D", checked: S.double, action: () => toggle("double") }, { label: "Windowshade mode", checked: S.shade, action: () => toggle("shade") },
          { label: "Visualization", items: [["spectrum", "Spectrum analyzer"], ["scope", "Oscilloscope"], ["off", "Off"]].map(([v, l]) => ({ label: l, checked: S.vis === v, action: () => { S.vis = v; persist(); } })) },
          { label: "Time remaining", checked: S.remaining, action: () => { S.remaining = !S.remaining; persist(); } }, "-",
          { label: "Playback", items: [{ label: "Previous", key: "Z", action: prev }, { label: "Play", key: "X", action: play }, { label: "Pause", key: "C", action: pause }, { label: "Stop", key: "V", action: stop }, { label: "Next", key: "B", action: next }, "-",
            { label: "Jump to file…", key: "J", action: jump }, { label: "Shuffle", key: "S", checked: S.shuffle, action: () => { S.shuffle = !S.shuffle; sync(); persist(); } }, { label: "Repeat", key: "R", checked: S.repeat, action: () => { S.repeat = !S.repeat; sync(); persist(); } }] },
          { label: "Show splash screen at start", checked: S.splash, action: () => { S.splash = !S.splash; persist(); } }, "-",
          { label: "About NightAmp…", action: about }, { label: "Exit", action: () => win.close() }]);
      }
      function presetMenu(elm) {
        const custom = CF.store.get(KEY + ".presets", {});
        const apply = (vals) => { S.eq = vals.slice(); applyEq(); sync(); saveAuto(); persist(); };
        CF.contextMenu(at(elm), [
          { label: "Load", items: Object.keys(PRESETS).map(n => ({ label: n, action: () => apply(PRESETS[n]) })) },
          { label: "Your presets", items: Object.keys(custom).length ? Object.keys(custom).map(n => ({ label: n, action: () => apply(custom[n]) })) : [{ label: "(none saved)", disabled: true }] },
          "-", { label: "Save preset…", action: async () => { const r = await CF.dialog({ title: "Save preset", icon: "nightamp", message: "Preset name:", input: "My preset", buttons: ["Save", "Cancel"] }); if (r.button === "Save" && r.value.trim()) { custom[r.value.trim()] = S.eq.slice(); CF.store.set(KEY + ".presets", custom); } } },
          { label: "Delete preset", items: Object.keys(custom).length ? Object.keys(custom).map(n => ({ label: n, action: () => { delete custom[n]; CF.store.set(KEY + ".presets", custom); } })) : [{ label: "(none saved)", disabled: true }] },
          { label: "Reset (flat)", action: () => apply(PRESETS.Flat) }]);
      }
      function saveAuto() { if (S.eqAuto && pl[cur]) S.auto[pl[cur].name] = S.eq.slice(); }
      function addMenu(b) { CF.contextMenu(at(b), [{ label: "Add files…", action: openFiles }, { label: "Add URL…", action: openUrl }, { label: "Add from My Documents", action: fromDocuments }, { label: "Add the ForgeMIDI demo", action: () => { const song = demoSong(); pl.push({ name: "NightCode Theme (ForgeMIDI)", url: "", kind: "midi", song, duration: song.duration, persist: false }); renderList(); } }]); }
      function remMenu(b) { CF.contextMenu(at(b), [{ label: "Remove selected", key: "Del", action: removeSelected }, { label: "Crop (keep selected)", action: () => { sel = new Set(pl.map((_, i) => i).filter(i => !sel.has(i))); removeSelected(); } }, { label: "Remove all", action: () => { stop(); pl.length = 0; cur = -1; sel.clear(); renderList(); persist(); } }, { label: "Remove dead entries", action: () => { sel = new Set(pl.map((t, i) => (t.url.startsWith("blob:") && !t.file) ? i : -1).filter(i => i >= 0)); removeSelected(); } }]); }
      function selMenu(b) { CF.contextMenu(at(b), [{ label: "Select all", action: () => { sel = new Set(pl.map((_, i) => i)); renderList(); } }, { label: "Select none", action: () => { sel.clear(); renderList(); } }, { label: "Invert selection", action: () => { sel = new Set(pl.map((_, i) => i).filter(i => !sel.has(i))); renderList(); } }]); }
      function miscMenu(b) {
        const sortBy = (fn) => { const t = pl[cur]; pl.sort(fn); cur = pl.indexOf(t); renderList(); persist(); };
        CF.contextMenu(at(b), [{ label: "Sort by title", action: () => sortBy((a, c) => a.name.localeCompare(c.name, undefined, { numeric: true })) }, { label: "Sort by length", action: () => sortBy((a, c) => (a.duration || 0) - (c.duration || 0)) },
          { label: "Randomize", action: () => sortBy(() => Math.random() - 0.5) }, { label: "Reverse", action: () => { const t = pl[cur]; pl.reverse(); cur = pl.indexOf(t); renderList(); persist(); } }, "-", { label: "File info…", action: () => fileInfo([...sel][0] ?? cur) }]);
      }
      function listMenu(b) {
        CF.contextMenu(at(b), [{ label: "Open playlist (.m3u/.pls)…", action: () => { const inp = h("input", { type: "file", accept: ".m3u,.m3u8,.pls" }); inp.addEventListener("change", () => inp.files[0] && addTracks([{ name: inp.files[0].name, url: "", file: inp.files[0] }], false)); inp.click(); } },
          { label: "Save playlist (.m3u)", action: () => CF.download("NightAmp.m3u", new TextEncoder().encode("#EXTM3U\n" + pl.map(t => `#EXTINF:${isFinite(t.duration) ? Math.round(t.duration) : -1},${t.name}\n${t.vfs ? t.vfs : t.url}`).join("\n") + "\n"), "audio/x-mpegurl") },
          { label: "New playlist", action: () => { stop(); pl.length = 0; cur = -1; renderList(); persist(); } }]);
      }
      async function jump() {
        const r = await CF.dialog({ title: "Jump to file", icon: "nightamp", message: "Type part of a title:", input: "", buttons: ["Play", "Cancel"] });
        if (r.button !== "Play" || !r.value.trim()) return;
        const i = pl.findIndex(t => t.name.toLowerCase().includes(r.value.trim().toLowerCase()));
        if (i >= 0) load(i, true); else CF.dialog({ title: "Jump to file", icon: "info", message: "No match." });
      }
      function fileInfo(i = cur) {
        const t = pl[i];
        if (!t) return;
        CF.dialog({ title: "File info", icon: "nightamp", message: [`Title: ${t.name}`, `Type: ${{ audio: "Audio", video: "Video", midi: "MIDI (ForgeMIDI synth)", stream: "Internet stream", hls: "HLS stream", aiff: "AIFF (converted to WAV)" }[t.kind] || t.kind}`,
          `Length: ${t.kind === "stream" ? "live" : fmtTime(t.duration)}`, `Location: ${t.vfs ? "My Documents\\" + t.vfs : t.url.startsWith("blob:") ? "this session (local file)" : t.url}`,
          i === cur && info.rate ? `Format: ${Math.round(info.rate / 100) / 10} kHz, ${info.ch === 1 ? "mono" : "stereo"}${info.kbps ? `, ${info.kbps} kbps` : ""}` : "",
          i === cur && info.plain ? "This stream plays without the equalizer and visuals (the server doesn't allow it)." : ""].filter(Boolean).join("\n") });
      }
      function radioHome() {
        const extra = `<h2 style="margin-top:26px">WEB</h2><div class="d">${WEB_LINKS.map(([n, u]) => `<a href="#" data-u="${CF.esc(u)}"><b>${CF.esc(n.slice(0, 2).toUpperCase())}</b><span>${CF.esc(n)}</span></a>`).join("")}</div>`;
        return CF.NightWeb.homePage({ title: "NightAmp Radio", subtitle: "INTERNET RADIO · CLICK TO PLAY", tiles: STATIONS.map(([n, u]) => [n, `nightamp://play?u=${encodeURIComponent(u)}&n=${encodeURIComponent(n)}`]), extra, stats: "SOMAFM IS LISTENER-SUPPORTED: SOMAFM.COM/SUPPORT" });
      }
      function about() {
        const w = CF.createWindow({ title: "About NightAmp", icon: "nightamp", w: 580, h: 460, resizable: false });
        w.body.append(h("div", { class: "wn-about" }, h("img", { src: `${ART}nightamp-splash.png`, alt: "NightAmp" }),
          h("p", {}, "NightAmp 1.0, the NightCode media player. An official ColeForge program."),
          h("p", { class: "muted" }, "A clean-room take on the classic Winamp 2 layout with an original NightCode skin. No Nullsoft code or art: the 2024 Winamp source release doesn't allow modified versions to be shared. HLS streaming by hls.js (Apache-2.0); MIDI by ForgeMIDI.")));
      }
      function demoSong() {
        // A short NightCode arpeggio in A minor for the synth (original).
        const ev = [], beat = 0.18, notes = [57, 60, 64, 69, 64, 60, 57, 64, 55, 59, 62, 67, 62, 59, 55, 62];
        ev.push({ t: 0, type: 0xc0, ch: 0, a: 81 }, { t: 0, type: 0xc0, ch: 1, a: 38 });
        for (let bar = 0; bar < 8; bar++) notes.forEach((n, i) => { const t0 = (bar * 16 + i) * beat; ev.push({ t: t0, type: 0x90, ch: 0, a: n + 12, b: 90 }, { t: t0 + beat * 0.9, type: 0x80, ch: 0, a: n + 12, b: 0 }); });
        for (let bar = 0; bar < 8; bar++) { const root = bar % 2 ? 43 : 45; ev.push({ t: bar * 16 * beat, type: 0x90, ch: 1, a: root, b: 100 }, { t: (bar * 16 + 15) * beat, type: 0x80, ch: 1, a: root, b: 0 }); }
        ev.sort((a, b) => a.t - b.t);
        return { events: ev, duration: 8 * 16 * beat + 1, format: "NightAmp demo" };
      }

      /* ---------- keys, drag & drop, args ---------- */
      root.addEventListener("keydown", (e) => {
        if (e.target.closest("input, select, textarea, .nb")) return;
        const k = e.key.toLowerCase();
        if (e.ctrlKey && k === "d") { e.preventDefault(); toggle("double"); }
        else if (e.ctrlKey && k === "l") { e.preventDefault(); openUrl(); }
        else if (e.altKey && ["g", "e", "v", "w"].includes(k)) { e.preventDefault(); toggle({ g: "showEq", e: "showPl", v: "showVideo", w: "showWeb" }[k]); }
        else if (e.ctrlKey || e.altKey) return;
        else if (k === "z") prev(); else if (k === "x") play(); else if (k === "c") pause(); else if (k === "v") stop(); else if (k === "b") next();
        else if (k === "l") openFiles(); else if (k === "j") jump();
        else if (k === "s") { S.shuffle = !S.shuffle; sync(); persist(); } else if (k === "r") { S.repeat = !S.repeat; sync(); persist(); }
        else if (k === "arrowleft") setPos(Math.max(0, position() - 5)); else if (k === "arrowright") setPos(position() + 5);
        else if (k === "arrowup") { S.vol = Math.min(1, S.vol + 0.05); applyVol(); sync(); flash(`VOLUME: ${Math.round(S.vol * 100)}%`); }
        else if (k === "arrowdown") { S.vol = Math.max(0, S.vol - 0.05); applyVol(); sync(); flash(`VOLUME: ${Math.round(S.vol * 100)}%`); }
        else return;
        e.preventDefault();
      });
      root.addEventListener("dragover", (e) => { if (e.dataTransfer?.types.includes("Files")) { e.preventDefault(); root.classList.add("na-dragging"); } });
      root.addEventListener("dragleave", () => root.classList.remove("na-dragging"));
      root.addEventListener("drop", (e) => {
        root.classList.remove("na-dragging");
        const files = [...(e.dataTransfer?.files || [])];
        if (!files.length) return;
        e.preventDefault();
        addTracks(files.map(f => ({ name: f.name, url: URL.createObjectURL(f), file: f })), !playing);
      });
      function handleArgs(a = {}) {
        if (a.add?.length) addTracks(a.add.map(x => ({ name: x.name, url: x.url, file: x.file })), a.play !== false);
        if (a.file) addTracks([vfsTrack(a.file)], true);
        if (a.url) addTracks([{ name: decodeURIComponent(a.url.split("/").pop()) || a.url, url: a.url }], true);
      }
      win.on("args", handleArgs);
      win.on("close", () => { cancelAnimationFrame(raf); halt(); stopDrop(); web?.destroy(); ac.close(); persist(); });
      win.on("focus", () => root.focus({ preventScroll: true }));

      // Tracks from My Documents are re-linked; local files from last session can't come back.
      pl.forEach(t => { if (t.vfs && CF.vfs.read(t.vfs)) { const v = vfsTrack(t.vfs); t.url = v.url; t.file = v.file; } });
      applyEq(); applyVol(); layout(); sync(); renderList();
      if (cur >= 0 && pl[cur]) load(cur, false);
      handleArgs(args);
      root.focus({ preventScroll: true });
    },
  });
})();
