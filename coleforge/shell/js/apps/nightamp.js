"use strict";

// NightAmp: the NightCode media player, an official ColeForge program. A clean-room recreation of the
// classic Winamp 2 player that draws everything from Winamp-format skins:
//   - loads any Winamp 2.x classic skin (.wsz), so the original look (or any of the thousands of
//     community skins) comes back just by opening one; three original skins are built in:
//     NightCode (default), ColeForge Classic and ColeForge Silver (js/nightamp-skin.js,
//     art/nightcode/build_nightamp_skins.py);
//   - main window, equalizer, playlist editor with its pop-up menus, windowshade and double size, laid
//     out on Winamp's pixel grid; plus skinned video, web & radio and Media Library windows;
//   - every format Chromium decodes (MP3, AAC/M4A, FLAC, Opus, Vorbis, WAV, WebM, MKA), AIFF through a
//     built-in converter, MIDI and Doom .MUS through the ForgeMIDI synth;
//   - video (MP4/H.264, WebM/VP9/AV1, MKV, MOV, HLS .m3u8 via hls.js) with subtitles;
//   - internet radio, M3U/PLS playlists, and a built-in web browser (NightBrowser's engine);
//   - a Media Library that reads ID3 / Vorbis / MP4 tags and keeps your files between sessions;
//   - "NightDrop": an audio-reactive NightCode code-rain visual when there's no picture.
// No Nullsoft code or art is used: Winamp's 2024 source release doesn't allow modified versions to be
// shared, so the code and the built-in skins are original.
(function () {
  const { h } = CF;
  const ART = "assets/art/nightapps/";
  const KEY = "cf.nightamp";
  const AUDIO_EXT = ["mp3", "mp2", "m4a", "m4b", "aac", "flac", "ogg", "oga", "opus", "wav", "wave", "weba", "mka", "aif", "aiff", "aifc", "caf", "3gp", "amr"];
  const VIDEO_EXT = ["mp4", "m4v", "webm", "mkv", "mov", "ogv", "avi", "wmv", "ts", "m3u8"];
  const MIDI_EXT = ["mid", "midi", "rmi", "kar", "mus"];
  const LIST_EXT = ["m3u", "pls"];
  const MEDIA_EXT = [...AUDIO_EXT, ...VIDEO_EXT, ...MIDI_EXT];
  const extOf = (n) => (/\.([a-z0-9]+)(?:[?#].*)?$/i.exec(String(n)) || [])[1]?.toLowerCase() || "";
  const isSkin = (n) => ["wsz"].includes(extOf(n));
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
  CF.associate(["wsz"], "nightamp", "nightamp");

  function h_canvas(w, hh) { const c = document.createElement("canvas"); c.width = w; c.height = hh; return c; }
  const fmtTime = (s) => { if (!isFinite(s) || s < 0) return "--:--"; s = Math.floor(s); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, "0")}`; };
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

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
  const WEB_LINKS = [["Winamp Skin Museum", "https://skins.webamp.org/"], ["SomaFM", "https://somafm.com/"], ["Live Music Archive", "https://archive.org/details/etree"], ["Free Music Archive", "https://freemusicarchive.org/"], ["Freedoom music", "https://freedoom.github.io/"]];
  const SKIN_MUSEUM = "https://skins.webamp.org/";

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
    id: "nightamp", name: "NightAmp", icon: "nightamp", single: true, desc: "NightAmp media player: music, video, internet radio, Winamp skins and a media library.",
    window: { w: 560, h: 470, frameless: true, resizable: false },
    open(win, args) {
      const S = Object.assign({ vol: 0.75, bal: 0, eqOn: true, eqAuto: false, eq: PRESETS.Flat.slice(), shuffle: false, repeat: false, double: true, showEq: true, showPl: true,
        showVideo: false, showWeb: false, showLib: false, shade: false, plShade: false, remaining: false, vis: "spectrum", plHeight: 174, list: [], cur: -1, splash: true, auto: {},
        skin: "nightcode", ontop: false, libNode: "audio" }, CF.store.get(KEY, {}));
      if (S.plHeight < 116) S.plHeight = 174;                    // older versions stored the list height
      const persist = () => CF.store.set(KEY, Object.assign({}, S, { list: pl.filter(t => t.persist).map(t => ({ name: t.name, url: t.url.startsWith("blob:") ? "" : t.url, kind: t.kind, vfs: t.vfs, lib: t.lib, duration: t.duration })), cur }));
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
      let cur = Math.min(S.cur, pl.length - 1), engine = null, active = fx, hls = null, playing = false, info = {}, midiDur = 0, probing = false, reported = false, buffering = false;
      // One message per track, however many ways it fails (equalized element, plain fallback, play()).
      const report = (msg) => { if (reported) return; reported = true; CF.toast({ title: "NightAmp", body: msg, icon: "nightamp" }); };
      const media = () => active;
      let skin = null;
      const skinHooks = [];

      /* ---------- DOM helpers: everything sits on Winamp's pixel grid ---------- */
      const el = (tag, x, y, w, hh, cls, extra = {}) => h(tag, Object.assign({ class: cls, style: `left:${x}px;top:${y}px;width:${w}px;height:${hh}px` }, extra));
      const sp = (cls, x, y, w, hh, title, fn) => {
        const d = el("div", x, y, w, hh, "na-s " + cls, title ? { title, "data-nodrag": "" } : {});
        if (fn) d.addEventListener("click", (e) => { e.stopPropagation(); fn(e); });
        return d;
      };
      const cv = (cls, x, y, w, hh) => { const c = el("canvas", x, y, w, hh, "na-s " + cls); c.width = w; c.height = hh; return c; };
      const zoom = () => S.double ? 2 : 1;
      const skinText = (ctx, str, x, y) => skin ? NightSkin.text(ctx, skin, str, x, y) : x;

      // A horizontal/vertical sprite slider. Returns { el, thumb, set(v), dragging }.
      function slider(host, thumb, { len, thumbLen, vertical = false, onInput, onCommit, onDrag, draw }) {
        const api = { el: host, thumb, value: 0, dragging: false, set(v) { api.value = clamp(v); draw(api.value); } };
        host.dataset.nodrag = "";
        host.addEventListener("pointerdown", (e) => {
          if (e.button !== 0) return;
          e.preventDefault(); e.stopPropagation(); host.setPointerCapture(e.pointerId);
          api.dragging = true; thumb.classList.add("drag");
          const z = zoom();
          const r0 = thumb.getBoundingClientRect();
          const onThumb = vertical ? (e.clientY >= r0.top && e.clientY <= r0.bottom) : (e.clientX >= r0.left && e.clientX <= r0.right);
          const grab = onThumb ? (vertical ? (e.clientY - r0.top) / z : (e.clientX - r0.left) / z) : thumbLen / 2;
          const at = (ev) => {
            const r = host.getBoundingClientRect();
            const p = vertical ? (ev.clientY - r.top) / z : (ev.clientX - r.left) / z;
            api.set((p - grab) / (len - thumbLen));
            onInput?.(api.value); onDrag?.(api.value);
          };
          at(e);
          const mv = (ev) => at(ev);
          host.addEventListener("pointermove", mv);
          host.addEventListener("pointerup", () => { host.removeEventListener("pointermove", mv); api.dragging = false; thumb.classList.remove("drag"); onCommit?.(api.value); }, { once: true });
        });
        return api;
      }
      let flashText = null, flashUntil = 0;
      function flash(t) { flashText = t; flashUntil = performance.now() + 1500; }

      /* ---------- main window (275 x 116) ---------- */
      const mainTitle = sp("na-tb", 0, 0, 275, 14);
      mainTitle.append(sp("na-opt", 6, 3, 9, 9, "Options", (e) => menu(null, e)), sp("na-min", 244, 3, 9, 9, "Minimize", () => win.minimize()),
        sp("na-shd", 254, 3, 9, 9, "Windowshade mode", () => toggle("shade")), sp("na-cls", 264, 3, 9, 9, "Close", () => win.close()));
      const clutter = sp("na-clutter", 10, 22, 8, 43);
      const ck = {
        o: sp("na-ck-o", 0, 3, 8, 8, "Options menu", (e) => menu(null, e)),
        a: sp("na-ck-a", 0, 11, 8, 7, "Always on top", () => { S.ontop = !S.ontop; win.setTopmost?.(S.ontop); sync(); persist(); }),
        i: sp("na-ck-i", 0, 18, 8, 7, "File info", () => fileInfo()),
        d: sp("na-ck-d", 0, 25, 8, 8, "Double size (Ctrl+D)", () => toggle("double")),
        v: sp("na-ck-v", 0, 33, 8, 7, "Visualization", (e) => visMenu(e)),
      };
      clutter.append(...Object.values(ck));
      const ppInd = sp("na-pp", 26, 28, 9, 9), workInd = sp("na-work", 24, 28, 3, 9);
      const minus = sp("na-minus", 38, 32, 5, 1);
      const digits = [48, 60, 78, 90].map(x => sp("na-digit", x, 26, 9, 13));
      const lcdHit = sp("na-lcdhit", 36, 26, 64, 13, "Click to switch elapsed / remaining time", () => { S.remaining = !S.remaining; persist(); });
      const visC = cv("na-vis", 24, 43, 76, 16); visC.title = "Click to change the visualization"; visC.dataset.nodrag = "";
      const marquee = cv("na-marquee", 111, 27, 154, 6);
      const kbpsC = cv("na-kbps", 111, 43, 15, 6), khzC = cv("na-khz", 156, 43, 10, 6);
      const monoEl = sp("na-mono", 212, 41, 27, 12), stereoEl = sp("na-stereo", 239, 41, 29, 12);
      const volEl = sp("na-vol", 107, 57, 68, 13, "Volume"), volThumb = sp("", 0, 1, 14, 11);
      volEl.append(volThumb);
      const volS = slider(volEl, volThumb, { len: 68, thumbLen: 14, onInput: (v) => { S.vol = v; applyVol(); flash(`VOLUME: ${Math.round(v * 100)}%`); }, onCommit: persist,
        draw: (v) => { volThumb.style.left = `${Math.round(v * 54)}px`; volEl.style.backgroundPosition = `0 -${Math.min(27, Math.floor(v * 28)) * 15}px`; } });
      const balEl = sp("na-bal", 177, 57, 38, 13, "Balance"), balThumb = sp("", 0, 1, 14, 11);
      balEl.append(balThumb);
      const balS = slider(balEl, balThumb, { len: 38, thumbLen: 14,
        onInput: (v) => { S.bal = Math.abs(v - 0.5) < 0.08 ? 0 : v * 2 - 1; applyVol(); flash(S.bal ? `BALANCE: ${Math.round(Math.abs(S.bal) * 100)}% ${S.bal < 0 ? "LEFT" : "RIGHT"}` : "BALANCE: CENTER"); },
        onCommit: () => { balS.set((S.bal + 1) / 2); persist(); },
        draw: (v) => { balThumb.style.left = `${Math.round(v * 24)}px`; balEl.style.backgroundPosition = `0 -${Math.floor(Math.abs(v * 2 - 1) * 27) * 15}px`; } });
      balEl.addEventListener("dblclick", () => { S.bal = 0; applyVol(); sync(); persist(); });
      const eqBtn = sp("na-eqb", 219, 58, 23, 12, "Toggle the equalizer (Alt+G)", () => toggle("showEq"));
      const plBtn = sp("na-plb", 242, 58, 23, 12, "Toggle the playlist (Alt+E)", () => toggle("showPl"));
      const posEl = sp("na-pos", 16, 72, 248, 10, "Seek"), posThumb = sp("", 0, 0, 29, 10);
      posEl.append(posThumb);
      const seek = slider(posEl, posThumb, { len: 248, thumbLen: 29, onCommit: (v) => { const d = duration(); if (d) setPos(v * d); },
        onDrag: (v) => { const d = duration(); flash(`SEEK TO: ${fmtTime(v * d)}/${fmtTime(d)}`); }, draw: (v) => { posThumb.style.left = `${Math.round(v * 219)}px`; } });
      const tbtns = [sp("na-prev", 16, 88, 23, 18, "Previous (Z)", () => prev()), sp("na-play", 39, 88, 23, 18, "Play (X)", () => play()), sp("na-pause", 62, 88, 23, 18, "Pause (C)", () => pause()),
        sp("na-stop", 85, 88, 23, 18, "Stop (V)", () => stop()), sp("na-next", 108, 88, 22, 18, "Next (B)", () => next()), sp("na-eject", 136, 89, 22, 16, "Open file (L)", () => openFiles())];
      const shufBtn = sp("na-shuf", 164, 89, 47, 15, "Shuffle (S)", () => { S.shuffle = !S.shuffle; sync(); persist(); });
      const repBtn = sp("na-rep", 210, 89, 28, 15, "Repeat (R)", () => { S.repeat = !S.repeat; sync(); persist(); });
      const aboutHit = sp("na-hit", 253, 91, 13, 15, "About NightAmp", () => about());
      // windowshade mode pieces
      const sVis = cv("na-shade-only", 79, 5, 38, 5);
      const sTime = cv("na-shade-only", 127, 4, 25, 6);
      const sPosEl = sp("na-spos na-shade-only", 226, 4, 17, 7, "Seek"), sPosThumb = sp("", 0, 0, 3, 7);
      sPosEl.append(sPosThumb);
      const sSeek = slider(sPosEl, sPosThumb, { len: 17, thumbLen: 3, onCommit: (v) => { const d = duration(); if (d) setPos(v * d); },
        draw: (v) => { sPosThumb.style.left = `${Math.round(v * 14)}px`; sPosThumb.className = "na-s " + (v < 0.33 ? "l" : v > 0.66 ? "r" : ""); } });
      const shadeBtns = [[169, 7, "Previous", () => prev()], [176, 10, "Play", () => play()], [186, 9, "Pause", () => pause()], [195, 9, "Stop", () => stop()], [204, 10, "Next", () => next()], [215, 10, "Open file", () => openFiles()]]
        .map(([x, w, t, fn]) => sp("na-hit na-shade-only", x, 2, w, 10, t, fn));
      const main = h("div", { class: "na-win na-main sel" }, mainTitle, clutter, ppInd, workInd, minus, ...digits, lcdHit, visC, marquee, kbpsC, khzC, monoEl, stereoEl,
        volEl, balEl, eqBtn, plBtn, posEl, ...tbtns, shufBtn, repBtn, aboutHit, sVis, sTime, sPosEl, ...shadeBtns);

      /* ---------- equalizer window (275 x 116) ---------- */
      const eqTitle = sp("na-eqtb", 0, 0, 275, 14);
      eqTitle.append(sp("na-eqcls", 264, 3, 9, 9, "Close the equalizer", () => toggle("showEq")));
      const onBtn = sp("na-on", 14, 18, 26, 12, "Equalizer on/off", () => { S.eqOn = !S.eqOn; applyEq(); sync(); persist(); });
      const autoBtn = sp("na-auto", 40, 18, 32, 12, "Remember the equalizer for each track", () => { S.eqAuto = !S.eqAuto; sync(); persist(); });
      const presetBtn = sp("na-presets", 217, 18, 44, 12, "Presets", () => presetMenu(presetBtn));
      const graph = cv("na-graph", 86, 17, 113, 19);
      const eqSliders = [21, ...BANDS.map((_, i) => 78 + i * 18)].map((x, i) => {
        const band = sp("na-band", x, 38, 14, 63, i ? `${BAND_LABELS[i - 1]}Hz` : "Preamp"), thumb = sp("", 1, 0, 11, 11);
        band.append(thumb);
        const s = slider(band, thumb, { len: 63, thumbLen: 12, vertical: true,
          onInput: (v) => {
            S.eq[i] = Math.round((0.5 - v) * 24 * 2) / 2;
            if (Math.abs(S.eq[i]) < 0.6) S.eq[i] = 0;
            applyEq(); drawGraph(); flash(`${i ? "EQ " + BAND_LABELS[i - 1] + "HZ" : "PREAMP"}: ${S.eq[i] > 0 ? "+" : ""}${S.eq[i]} DB`); saveAuto();
          },
          onCommit: persist,
          draw: (v) => {
            thumb.style.top = `${Math.round(v * 51)}px`;
            const n = Math.round((1 - v) * 27);
            band.style.backgroundPosition = `-${(n % 14) * 15}px -${Math.floor(n / 14) * 65}px`;
          } });
        band.addEventListener("dblclick", () => { S.eq[i] = 0; applyEq(); sync(); persist(); });
        return s;
      });
      const eqWin = h("div", { class: "na-win na-eq" }, eqTitle, onBtn, autoBtn, presetBtn, graph, ...eqSliders.map(s => s.el));

      /* ---------- playlist editor ---------- */
      const plClose = sp("na-pl-cls", 264, 3, 9, 9, "Close the playlist", () => toggle("showPl"));
      const plShadeBtn = sp("na-pl-shd", 254, 3, 9, 9, "Windowshade mode", () => toggle("plShade"));
      const plTop = h("div", { class: "na-pl-row na-pl-top" }, h("div", { class: "na-pl-tl" }), h("div", { class: "na-pl-tf" }), h("div", { class: "na-pl-tt" }), h("div", { class: "na-pl-tf" }), h("div", { class: "na-pl-tr" }), plShadeBtn, plClose);
      const findInput = h("input", { placeholder: "Find in playlist…", spellcheck: "false" });
      const findBar = h("div", { class: "na-find", hidden: true }, findInput);
      const plList = h("div", { class: "na-list", tabindex: 0 });
      const plHandle = sp("na-pl-handle", 5, 0, 8, 18);
      const plMid = h("div", { class: "na-pl-row na-pl-mid" }, h("div", { class: "na-pl-l" }), h("div", { class: "na-pl-c" }, findBar, plList), h("div", { class: "na-pl-r" }, plHandle));
      const runC = cv("", 7, 10, 65, 6), miniC = cv("", 66, 23, 25, 6);
      const plMenus = {};
      const plBl = h("div", { class: "na-pl-bl" }, ...[["add", 14, "Add"], ["rem", 43, "Remove"], ["sel", 72, "Select"], ["misc", 101, "Miscellaneous"]].map(([k, x, t]) => (plMenus[k] = sp("na-hit", x, 8, 22, 18, t))));
      const plGrip = sp("na-pl-grip", 130, 18, 20, 20, "Drag to resize");
      const plBr = h("div", { class: "na-pl-br" }, runC, miniC, (plMenus.list = sp("na-hit", 106, 8, 22, 18, "Playlist files")),
        ...[["Previous", () => prev()], ["Play", () => play()], ["Pause", () => pause()], ["Stop", () => stop()], ["Next", () => next()], ["Open file", () => openFiles()]].map(([t, fn], i) => sp("na-hit", 3 + i * 10, 22, 10, 10, t, fn)), plGrip);
      const plBot = h("div", { class: "na-pl-row na-pl-bot" }, plBl, h("div", { class: "na-pl-bf" }), plBr);
      const plShadeRow = h("div", { class: "na-shade-pl" }, h("div", { class: "l" }), h("div", { class: "f" }), h("div", { class: "r" }));
      const plShadeText = cv("", 5, 4, 180, 6), plShadeTime = cv("", 210, 4, 35, 6);
      plShadeRow.append(plShadeText, plShadeTime, sp("na-pl-exp", 254, 3, 9, 9, "Restore the playlist", () => toggle("plShade")), sp("na-pl-cls", 264, 3, 9, 9, "Close the playlist", () => toggle("showPl")));
      const plWin = h("div", { class: "na-win na-pl" }, plTop, plMid, plBot, plShadeRow);

      /* ---------- skinned frames: video, web & radio, Media Library ---------- */
      function genWin(cls, title, key, tools = []) {
        const t = h_canvas(1, 7);
        const gc = h("div", { class: "gc" }, t);
        const drawTitle = () => {
          const w = title.length * 5;
          t.width = w; t.height = 6;
          t.style.width = `calc(${w}px * var(--z))`; t.style.height = `calc(6px * var(--z))`;
          gc.style.minWidth = `calc(${w + 10}px * var(--z))`;
          const c = t.getContext("2d"); c.clearRect(0, 0, w, 6); skinText(c, title, 0, 0);
        };
        skinHooks.push(drawTitle);
        const top = h("div", { class: "na-gen-top" }, h("div", { class: "gp g-tl" }), h("div", { class: "gf" }), h("div", { class: "gp g-tle" }), gc, h("div", { class: "gp g-tre" }), h("div", { class: "gf" }), h("div", { class: "gp g-tr" }),
          tools.length ? h("div", { class: "na-gen-tools", "data-nodrag": "" }, ...tools) : null, h("div", { class: "na-gen-close", title: "Close", "data-nodrag": "", "data-act": key }));
        const body = h("div", { class: "na-gen-body" });
        const w = h("div", { class: "na-win na-gen " + cls }, top, h("div", { class: "gp g-ml" }), body, h("div", { class: "gp g-mr" }), h("div", { class: "na-gen-bot" }, h("div", { class: "gp g-bl" }), h("div", { class: "gp g-br" })));
        return { el: w, top, body };
      }
      const speedSel = h("select", { class: "na-mini", title: "Playback speed" }, [0.5, 0.75, 1, 1.25, 1.5, 2].map(r => h("option", { value: r, selected: r === 1 }, `${r}x`)));
      speedSel.addEventListener("change", () => { fx.playbackRate = raw.playbackRate = +speedSel.value; });
      const tbtn = (t, title, fn) => { const b = h("button", { class: "na-tbtn", title }, t); b.addEventListener("click", fn); return b; };
      const vid = genWin("na-video", "NIGHTAMP VIDEO", "video", [speedSel, tbtn("SUB", "Load subtitles (.srt / .vtt)", () => loadSubs()), tbtn("PIP", "Picture in picture", () => media().requestPictureInPicture?.().catch(() => {})), tbtn("FULL", "Full screen", () => stage.requestFullscreen?.())]);
      const stage = h("div", { class: "na-stage" }, fx, raw);
      const drop = h("div", { class: "na-drop" });
      stage.append(drop);
      stage.addEventListener("dblclick", () => document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen?.());
      vid.body.append(stage);
      const webw = genWin("na-web", "NIGHTAMP WEB & RADIO", "web");
      const webBody = h("div", { class: "na-webbody" });
      webw.body.append(webBody);
      let web = null;
      const libw = genWin("na-lib", "NIGHTAMP MEDIA LIBRARY", "lib");

      const col1 = h("div", { class: "na-col" }, main, eqWin, plWin);
      const col2 = h("div", { class: "na-col2" }, vid.el, webw.el, libw.el);
      const root = h("div", { class: "na loading", tabindex: 0 }, col1, col2);
      // Until the skin is on, the sprites are invisible: show a panel instead, so nobody clicks hidden
      // buttons (or thinks the window didn't open) while the skin loads.
      const boot = h("div", { class: "na-boot" }, h("img", { src: `${ART}nightamp-64.png`, alt: "" }), h("b", {}, "NIGHTAMP"),
        h("div", { class: "na-boot-bar" }, h("i")), h("span", {}, "loading skin…"));
      win.dragBy?.(boot);
      win.body.append(root);
      [main, eqWin, plTop, plShadeRow, vid.top, webw.top, libw.top].forEach(t => win.dragBy(t));
      root.addEventListener("click", (e) => {
        const act = e.target.closest("[data-act]")?.dataset.act;
        if (act) toggle({ video: "showVideo", web: "showWeb", lib: "showLib" }[act]);
      });
      // Winamp lights the title bar of the window you last clicked.
      const wins = [main, eqWin, plWin, vid.el, webw.el, libw.el];
      root.addEventListener("pointerdown", (e) => {
        const w = e.target.closest(".na-win");
        if (w) wins.forEach(x => x.classList.toggle("sel", x === w));
        // Sprite buttons can't take focus, so keep the keyboard shortcuts working after a click.
        if (!root.contains(document.activeElement) && !e.target.closest("input, select, textarea, button, .nb, .na-list, .na-ml-table")) setTimeout(() => root.focus({ preventScroll: true }));
      }, true);
      new MutationObserver(() => root.classList.toggle("na-focused", win.el.classList.contains("active"))).observe(win.el, { attributes: true, attributeFilter: ["class"] });
      root.classList.toggle("na-focused", win.el.classList.contains("active"));
      mainTitle.addEventListener("dblclick", (e) => { if (e.target === mainTitle) toggle("double"); });
      main.addEventListener("contextmenu", (e) => { e.preventDefault(); menu(null, e); });
      eqWin.addEventListener("contextmenu", (e) => { e.preventDefault(); presetMenu(null, e); });
      visC.addEventListener("click", (e) => { e.stopPropagation(); S.vis = { spectrum: "scope", scope: "off", off: "spectrum" }[S.vis]; persist(); });
      plGrip.addEventListener("pointerdown", (e) => {
        e.preventDefault(); e.stopPropagation(); plGrip.setPointerCapture(e.pointerId);
        const sy = e.clientY, sh = S.plHeight, z = zoom();
        const mv = (m) => { S.plHeight = Math.max(116, Math.min(116 + 29 * 20, 116 + Math.round((sh - 116 + (m.clientY - sy) / z) / 29) * 29)); layout(); };
        plGrip.addEventListener("pointermove", mv);
        plGrip.addEventListener("pointerup", () => { plGrip.removeEventListener("pointermove", mv); persist(); }, { once: true });
      });

      /* ---------- skins ---------- */
      let userSkins = [];
      const refreshUserSkins = async () => { userSkins = await NightSkin.saved.list(); };
      async function setSkin(id, quiet) {
        let next;
        try {
          if (id.startsWith("wsz:")) {
            const name = id.slice(4), bytes = await NightSkin.saved.get(name);
            if (!bytes) throw new Error(`The skin "${name}" isn't saved any more.`);
            next = await NightSkin.load({ bytes, name });
          } else next = await NightSkin.load({ builtin: id });
        } catch (e) {
          console.error(e);
          if (!quiet) report2(`Couldn't load that skin: ${e.message}`);
          if (id !== "nightcode") return setSkin("nightcode", true);
          boot.querySelector("span").textContent = "couldn't load the skin";
          boot.append(h("button", { class: "btn", onclick: () => win.close() }, "Close"));
          return;
        }
        if (closed) { NightSkin.dispose(next); return; }
        NightSkin.apply(root, next, skin);
        const old = skin;
        skin = next;
        S.skin = id; persist();
        setTimeout(() => NightSkin.dispose(old), 500);
        root.classList.remove("loading"); boot.remove();
        skinHooks.forEach(fn => fn());
        drawGraph(); renderList(); lastTitle = ""; lastText = "";
        minus.classList.toggle("ex", skin.numbersEx);
        Object.assign(minus.style, skin.numbersEx ? { left: "39px", top: "26px", width: "9px", height: "13px" } : { left: "38px", top: "32px", width: "5px", height: "1px" });
        if (!quiet) flash(`SKIN: ${skin.name}`);
        requestAnimationFrame(fit);
      }
      const report2 = (msg) => CF.toast({ title: "NightAmp", body: msg, icon: "nightamp" });
      async function importSkin(name, bytes) {
        name = String(name).split(/[\\/]/).pop().replace(/\.(wsz|zip)$/i, "") || "Skin";
        try { NightSkin.dispose(await NightSkin.load({ bytes, name })); }
        catch (e) { return report2(`${name} isn't a skin NightAmp can read: ${e.message}`); }
        if (!await NightSkin.saved.put(name, bytes)) report2("The skin works, but it couldn't be saved for next time.");
        await refreshUserSkins();
        await setSkin("wsz:" + name);
      }
      async function importSkinUrl(url, name) {
        try {
          const r = await fetch(url);
          if (!r.ok) throw new Error(`the server said ${r.status}`);
          await importSkin(name || decodeURIComponent(url.split(/[?#]/)[0].split("/").pop()), new Uint8Array(await r.arrayBuffer()));
        } catch (e) { report2(`Couldn't download that skin (${e.message}). Save the .wsz and drop it on NightAmp instead.`); }
      }
      function pickSkin() {
        const inp = h("input", { type: "file", accept: ".wsz,.zip" });
        inp.addEventListener("change", async () => { const f = inp.files[0]; if (f) importSkin(f.name, new Uint8Array(await f.arrayBuffer())); });
        inp.click();
      }
      function getSkins() {
        if (!S.showWeb) toggle("showWeb");
        web?.newTab(SKIN_MUSEUM);
        CF.toast({ title: "NightAmp skins", body: "Pick a skin in the Winamp Skin Museum and download it: NightAmp puts it on straight away. You can also drop any .wsz file on NightAmp.", icon: "nightamp" });
      }
      async function exportSkin() {
        try {
          if (S.skin.startsWith("wsz:")) { const n = S.skin.slice(4); CF.download(`${n}.wsz`, await NightSkin.saved.get(n), "application/zip"); return; }
          const b = NightSkin.BUILTIN.find(x => x.id === S.skin);
          const bytes = new Uint8Array(await (await fetch(NightSkin.wszUrl(S.skin))).arrayBuffer());
          CF.download(b.file, bytes, "application/zip");
        } catch (e) { report2(`Couldn't save the skin: ${e.message}`); }
      }
      const docSkins = () => CF.vfs.list().filter(d => isSkin(d.name)).map(d => d.name);
      function skinItems() {
        const saved = userSkins.map(n => ({ label: n, checked: S.skin === "wsz:" + n, action: () => setSkin("wsz:" + n) }));
        const docs = docSkins().filter(n => !userSkins.includes(n.replace(/\.wsz$/i, ""))).map(n => ({ label: `${n} (My Documents)`, action: () => importSkin(n, CF.vfs.readBytes(n)) }));
        return [...NightSkin.BUILTIN.map(b => ({ label: b.name, checked: S.skin === b.id, action: () => setSkin(b.id) })),
          ...(saved.length || docs.length ? ["-", ...saved, ...docs] : []), "-",
          { label: "Load skin (.wsz)…", key: "Alt+S", action: pickSkin }, { label: "Get more skins (Winamp Skin Museum)…", action: getSkins },
          { label: "Save this skin as .wsz", action: exportSkin },
          userSkins.length ? { label: "Delete a skin", items: userSkins.map(n => ({ label: n, action: async () => { await NightSkin.saved.remove(n); await refreshUserSkins(); if (S.skin === "wsz:" + n) setSkin("nightcode"); } })) } : null].filter(Boolean);
      }

      /* ---------- layout & state sync ---------- */
      function layout() {
        root.style.setProperty("--z", zoom());
        main.classList.toggle("shade", S.shade);
        eqWin.hidden = !S.showEq;
        plWin.hidden = !S.showPl;
        plWin.classList.toggle("shade", S.plShade);
        plWin.style.height = S.plShade ? "14px" : `${S.plHeight}px`;
        vid.el.hidden = !S.showVideo; webw.el.hidden = !S.showWeb; libw.el.hidden = !S.showLib;
        col2.hidden = !S.showVideo && !S.showWeb && !S.showLib;
        if (S.showWeb && !web) {
          web = CF.NightWeb.mount(webBody, { tabs: false, compact: true, storeless: true, home: "night://amp", homeTitle: "NightAmp Radio", homeHtml: radioHome,
            onMedia: (url, name) => { if (isSkin(url)) importSkinUrl(url, name); else addTracks([{ name: name || url, url }], true); }, onEmpty: () => web.newTab("night://amp") });
          web.newTab("night://amp");
        }
        if (S.showLib) libOpen();
        if (S.showVideo) startDrop(); else stopDrop();
        requestAnimationFrame(fit);
        requestAnimationFrame(updateHandle);
      }
      function fit() {
        if (root.classList.contains("loading")) { win.el.style.width = "550px"; win.el.style.height = "232px"; return; }
        win.el.style.width = `${root.offsetWidth}px`;
        win.el.style.height = `${root.offsetHeight}px`;
        // The first time it shows, keep the whole player on screen when it fits.
        if (placed) return;
        placed = true;
        const room = innerHeight - (document.querySelector("#taskbar, .taskbar")?.offsetHeight || 30);
        const top = parseFloat(win.el.style.top) || 0, hgt = root.offsetHeight;
        if (top + hgt > room) win.el.style.top = `${Math.max(0, room - hgt)}px`;
      }
      // Double size doesn't fit small screens (main + equalizer + playlist): start at normal size there.
      let placed = false;
      function fitsDouble() {
        const room = innerHeight - (document.querySelector("#taskbar, .taskbar")?.offsetHeight || 30);
        return (116 + (S.showEq ? 116 : 0) + (S.showPl ? S.plHeight : 0)) * 2 <= room;
      }
      function toggle(k) { S[k] = !S[k]; layout(); sync(); persist(); }
      function sync() {
        eqBtn.classList.toggle("on", S.showEq); plBtn.classList.toggle("on", S.showPl);
        shufBtn.classList.toggle("on", S.shuffle); repBtn.classList.toggle("on", S.repeat);
        onBtn.classList.toggle("on", S.eqOn); autoBtn.classList.toggle("on", S.eqAuto);
        ck.a.classList.toggle("on", !!S.ontop); ck.d.classList.toggle("on", S.double);
        eqSliders.forEach((s, i) => s.set((12 - S.eq[i]) / 24));
        volS.set(S.vol); balS.set((S.bal + 1) / 2);
        drawGraph();
      }
      function drawGraph() {
        const g = graph.getContext("2d");
        g.clearRect(0, 0, 113, 19);
        if (!skin) return;
        const sheet = skin.sheets.EQMAIN;
        if (sheet) g.drawImage(sheet, 0, 294, 113, 19, 0, 0, 113, 19);
        const py = clamp(Math.round(9 - S.eq[0] / 12 * 9), 0, 18);
        if (sheet) g.drawImage(sheet, 0, 314, 113, 1, 0, py, 113, 1);
        const pts = S.eq.slice(1).map((v) => 9 - v / 12 * 9);
        let last = null;
        for (let x = 0; x < 113; x++) {
          const f = clamp((x - 2) / 108, 0, 1) * 9, k = Math.min(8, Math.floor(f)), t = f - k;
          const y = clamp(Math.round(pts[k] + (pts[k + 1] - pts[k]) * (0.5 - Math.cos(Math.PI * t) / 2)), 0, 18);
          const a = last == null ? y : Math.min(y, last + 1), b = last == null ? y : Math.max(y, last - 1);
          for (let yy = Math.min(a, b); yy <= Math.max(a, b); yy++) { g.fillStyle = skin.graphColors[yy]; g.fillRect(x, yy, 1, 1); }
          last = y;
        }
      }

      /* ---------- playlist ---------- */
      let sel = new Set(), dragFrom = -1;
      function renderList() {
        const q = findBar.hidden ? "" : findInput.value.trim().toLowerCase();
        const rows = [];
        pl.forEach((t, i) => {
          if (q && !t.name.toLowerCase().includes(q)) return;
          const r = h("div", { class: "na-row" + (i === cur ? " cur" : "") + (sel.has(i) ? " sel" : ""), draggable: "true", "data-i": i },
            h("span", { class: "na-name" }, `${i + 1}. ${t.name}`), h("span", { class: "na-dur" }, t.kind === "stream" || t.kind === "hls" ? (t.kind === "hls" ? "HLS" : "LIVE") : isFinite(t.duration) ? fmtTime(t.duration) : ""));
          r.addEventListener("click", (e) => { if (e.ctrlKey) sel.has(i) ? sel.delete(i) : sel.add(i); else if (e.shiftKey && sel.size) { const a = Math.min(...sel, i), b = Math.max(...sel, i); for (let k = a; k <= b; k++) sel.add(k); } else sel = new Set([i]); renderList(); });
          r.addEventListener("dblclick", () => { load(i, true); });
          r.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); if (!sel.has(i)) sel = new Set([i]); renderList(); CF.contextMenu({ x: e.clientX, y: e.clientY }, [
            { label: "Play", action: () => load(i, true) }, { label: "File info…", action: () => fileInfo(i) }, "-",
            { label: "Move to top", action: () => move([...sel], 0) }, { label: "Remove", key: "Del", action: removeSelected },
            { label: "Add to Media Library", disabled: !pl.some((x, k) => sel.has(k) && x.file && !x.lib), action: sendToLibrary },
            t.url.startsWith("blob:") && t.kind !== "midi" && !t.vfs ? { label: "Save to My Documents", action: () => saveTrack(t) } : null].filter(Boolean)); });
          r.addEventListener("dragstart", (e) => { dragFrom = i; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/nightamp", String(i)); });
          r.addEventListener("dragover", (e) => { if (dragFrom >= 0) { e.preventDefault(); r.classList.add("over"); } });
          r.addEventListener("dragleave", () => r.classList.remove("over"));
          r.addEventListener("drop", (e) => { if (dragFrom < 0) return; e.preventDefault(); e.stopPropagation(); move(sel.has(dragFrom) ? [...sel] : [dragFrom], i); dragFrom = -1; });
          rows.push(r);
        });
        if (!pl.length) rows.push(h("div", { class: "na-empty" }, "Drop music, video or a Winamp skin (.wsz) here. L opens files, Alt+L the Media Library, right-click for skins."));
        plList.replaceChildren(...rows);
        drawRunTime();
        requestAnimationFrame(updateHandle);
      }
      function drawRunTime() {
        const known = pl.filter(t => isFinite(t.duration)), tot = known.reduce((a, t) => a + t.duration, 0);
        const selTot = pl.filter((t, i) => sel.has(i) && isFinite(t.duration)).reduce((a, t) => a + t.duration, 0);
        const c = runC.getContext("2d"); c.clearRect(0, 0, 65, 6);
        skinText(c, `${fmtTime(selTot)}/${fmtTime(tot)}${known.length < pl.length ? "+" : ""}`, 0, 0);
      }
      // the skinned scroll handle
      function updateHandle() {
        const trackH = plMid.offsetHeight - 18;
        const max = plList.scrollHeight - plList.clientHeight;
        plHandle.style.top = `${max > 0 ? Math.round(plList.scrollTop / max * Math.max(0, trackH)) : 0}px`;
      }
      plList.addEventListener("scroll", updateHandle);
      plHandle.addEventListener("pointerdown", (e) => {
        e.preventDefault(); e.stopPropagation(); plHandle.setPointerCapture(e.pointerId); plHandle.classList.add("drag");
        const sy = e.clientY, st = plList.scrollTop, z = zoom();
        const mv = (m) => { const trackH = plMid.offsetHeight - 18, max = plList.scrollHeight - plList.clientHeight; if (trackH > 0) plList.scrollTop = st + (m.clientY - sy) / z / trackH * max; };
        plHandle.addEventListener("pointermove", mv);
        plHandle.addEventListener("pointerup", () => { plHandle.removeEventListener("pointermove", mv); plHandle.classList.remove("drag"); }, { once: true });
      });
      findInput.addEventListener("input", renderList);
      findInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { const r = plList.querySelector(".na-row"); if (r) load(+r.dataset.i, true); }
        else if (e.key === "Escape") { findBar.hidden = true; findInput.value = ""; renderList(); plList.focus(); }
        e.stopPropagation();
      });
      function showFind() { if (!S.showPl) toggle("showPl"); findBar.hidden = false; findInput.focus(); findInput.select(); renderList(); }
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
      const selectAll = () => { sel = new Set(pl.map((_, i) => i)); renderList(); };
      const selectNone = () => { sel.clear(); renderList(); };
      const invertSel = () => { sel = new Set(pl.map((_, i) => i).filter(i => !sel.has(i))); renderList(); };
      const crop = () => { invertSel(); removeSelected(); };
      const removeAll = () => { stop(); pl.length = 0; cur = -1; sel.clear(); renderList(); persist(); };
      plList.addEventListener("keydown", (e) => {
        if (e.key === "Delete") removeSelected();
        else if (e.key === "Enter" && sel.size) load([...sel][0], true);
        else if (e.ctrlKey && e.key.toLowerCase() === "a") { e.preventDefault(); selectAll(); }
        else return;
        e.stopPropagation();
      });

      // Winamp's pop-up sprite menus at the bottom of the playlist: press, slide, release.
      const POPUPS = {
        add: { left: 14, bar: "PLAYLIST_ADD_MENU_BAR", items: [["PLAYLIST_ADD_URL", "Add URL…", () => openUrl()], ["PLAYLIST_ADD_DIR", "Add folder…", () => addFolder()], ["PLAYLIST_ADD_FILE", "Add files…", () => openFiles()]],
          more: () => [{ label: "Add from My Documents", action: fromDocuments }, { label: "Add from the Media Library…", action: () => { if (!S.showLib) toggle("showLib"); } }, { label: "Add the ForgeMIDI demo", action: addDemo }] },
        rem: { left: 43, bar: "PLAYLIST_REMOVE_MENU_BAR", items: [["PLAYLIST_REMOVE_MISC", "Remove misc…", (e) => remMisc(e)], ["PLAYLIST_REMOVE_ALL", "Remove all", removeAll], ["PLAYLIST_CROP", "Crop", crop], ["PLAYLIST_REMOVE_SELECTED", "Remove selected", removeSelected]] },
        sel: { left: 72, bar: "PLAYLIST_SELECT_MENU_BAR", items: [["PLAYLIST_INVERT_SELECTION", "Invert selection", invertSel], ["PLAYLIST_SELECT_ZERO", "Select none", selectNone], ["PLAYLIST_SELECT_ALL", "Select all", selectAll]] },
        misc: { left: 101, bar: "PLAYLIST_MISC_MENU_BAR", items: [["PLAYLIST_SORT_LIST", "Sort list…", (e) => sortMenu(e)], ["PLAYLIST_FILE_INFO", "File info…", () => fileInfo([...sel][0] ?? cur)], ["PLAYLIST_MISC_OPTIONS", "Misc options…", (e) => miscOptions(e)]] },
        list: { right: 22, bar: "PLAYLIST_LIST_BAR", items: [["PLAYLIST_NEW_LIST", "New list", () => { stop(); pl.length = 0; cur = -1; renderList(); persist(); }], ["PLAYLIST_SAVE_LIST", "Save list…", (e) => saveMenu(e)], ["PLAYLIST_LOAD_LIST", "Load list…", () => loadList()]] },
      };
      let popup = null;
      function closePopup() { popup?.el.remove(); popup = null; document.removeEventListener("pointerdown", outside, true); }
      function outside(e) { if (popup && !popup.el.contains(e.target) && e.target !== popup.btn) closePopup(); }
      function openPopup(key, btn, e) {
        closePopup();
        const def = POPUPS[key], n = def.items.length;
        const menuEl = h("div", { class: "na-pmenu", "data-nodrag": "" });
        const bar = h("div", { class: "na-s na-bar", style: `height:${n * 18}px;background-image:var(--${def.bar})` });
        menuEl.append(bar);
        const items = def.items.map(([spr, title, fn], i) => {
          const it = h("div", { class: "na-s", title, style: `top:${i * 18}px;background-image:var(--${spr})` });
          it._spr = spr; it._fn = fn;
          menuEl.append(it);
          return it;
        });
        menuEl.style.height = `${n * 18}px`;
        const x = def.left != null ? def.left - 3 : 275 - def.right - 22 - 3;
        menuEl.style.left = `${x}px`;
        menuEl.style.bottom = "12px";
        plWin.append(menuEl);
        popup = { el: menuEl, btn, items, hot: null };
        const hot = (it) => { popup.items.forEach(o => { o.style.backgroundImage = `var(--${o._spr}${o === it ? "_SELECTED" : ""})`; }); popup.hot = it; };
        const pick = (ev) => { const it = popup?.hot; closePopup(); if (it) it._fn(ev); };
        items.forEach(it => { it.addEventListener("pointerenter", () => hot(it)); it.addEventListener("pointerleave", () => hot(null)); it.addEventListener("click", pick); });
        hot(items[n - 1]);
        // Press-drag-release: follow the pointer and choose where it's let go.
        btn.setPointerCapture?.(e.pointerId);
        const mv = (ev) => { const t = document.elementFromPoint(ev.clientX, ev.clientY); hot(items.includes(t) ? t : null); };
        btn.addEventListener("pointermove", mv);
        btn.addEventListener("pointerup", (ev) => {
          btn.removeEventListener("pointermove", mv);
          const t = document.elementFromPoint(ev.clientX, ev.clientY);
          if (items.includes(t)) pick(ev);                         // released on an item
          else if (t !== btn) closePopup();                         // released elsewhere
          else { hot(null); setTimeout(() => document.addEventListener("pointerdown", outside, true)); }   // a click: stay open
        }, { once: true });
      }
      for (const [k, b] of Object.entries(plMenus)) {
        b.addEventListener("pointerdown", (e) => { if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); openPopup(k, b, e); });
        b.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); closePopup(); const more = POPUPS[k].more?.() || [];
          CF.contextMenu({ x: e.clientX, y: e.clientY }, [...POPUPS[k].items.slice().reverse().map(([, label, fn]) => ({ label, action: () => fn(e) })), ...(more.length ? ["-", ...more] : [])]); });
      }
      function remMisc(e) {
        CF.contextMenu(at(null, e), [{ label: "Remove dead files", action: () => { sel = new Set(pl.map((t, i) => (t.url.startsWith("blob:") && !t.file) || (!t.url && !t.song && !t.lib) ? i : -1).filter(i => i >= 0)); removeSelected(); } },
          { label: "Remove duplicates", action: () => { const seen = new Set(); sel = new Set(pl.map((t, i) => { const k = t.lib || t.vfs || t.url || t.name; if (seen.has(k)) return i; seen.add(k); return -1; }).filter(i => i >= 0)); removeSelected(); } }]);
      }
      function sortMenu(e) {
        const sortBy = (fn) => { const t = pl[cur]; pl.sort(fn); cur = pl.indexOf(t); renderList(); persist(); };
        CF.contextMenu(at(null, e), [{ label: "Sort by title", action: () => sortBy((a, c) => a.name.localeCompare(c.name, undefined, { numeric: true })) },
          { label: "Sort by length", action: () => sortBy((a, c) => (a.duration || 0) - (c.duration || 0)) }, { label: "Sort by file type", action: () => sortBy((a, c) => a.kind.localeCompare(c.kind)) }, "-",
          { label: "Randomize list", action: () => sortBy(() => Math.random() - 0.5) }, { label: "Reverse list", action: () => { const t = pl[cur]; pl.reverse(); cur = pl.indexOf(t); renderList(); persist(); } }]);
      }
      function miscOptions(e) {
        CF.contextMenu(at(null, e), [{ label: "Find in playlist…", key: "Ctrl+F", action: showFind }, { label: "Jump to file…", key: "J", action: jump }, "-",
          { label: "Add selected to the Media Library", disabled: !pl.some((x, k) => sel.has(k) && x.file && !x.lib), action: sendToLibrary },
          { label: "Save selected to My Documents", disabled: !pl.some((x, k) => sel.has(k) && x.url.startsWith("blob:") && !x.vfs), action: () => pl.filter((x, k) => sel.has(k) && x.url.startsWith("blob:") && !x.vfs).forEach(saveTrack) }]);
      }
      function saveMenu(e) {
        CF.contextMenu(at(null, e), [{ label: "Save as .m3u file", action: () => CF.download("NightAmp.m3u", new TextEncoder().encode("#EXTM3U\n" + pl.map(t => `#EXTINF:${isFinite(t.duration) ? Math.round(t.duration) : -1},${t.name}\n${t.vfs ? t.vfs : t.url}`).join("\n") + "\n"), "audio/x-mpegurl") },
          { label: "Save to the Media Library…", action: savePlaylistToLibrary }]);
      }
      function loadList() {
        const inp = h("input", { type: "file", accept: ".m3u,.m3u8,.pls" });
        inp.addEventListener("change", () => inp.files[0] && addTracks([{ name: inp.files[0].name, url: "", file: inp.files[0] }], false));
        inp.click();
      }

      /* ---------- adding tracks ---------- */
      function trackFrom({ name, url, file, vfs, kind, duration, lib }) {
        const k = kind || kindOf(name, url);
        const shown = (name || url || "Untitled").replace(/\.(mp3|mp2|m4a|m4b|aac|flac|ogg|oga|opus|wav|wave|weba|mka|aiff?|aifc|caf|mp4|m4v|webm|mkv|mov|ogv|avi|wmv|mid|midi|rmi|kar|mus)$/i, "");
        return { name: shown, url: url || "", file, vfs, lib, kind: k, duration: duration ?? (k === "stream" ? Infinity : NaN), persist: !!vfs || !!lib || /^https?:/.test(url || "") };
      }
      async function addTracks(list, playNow) {
        const start = pl.length;
        for (const it of list) {
          if (isSkin(it.name) || isSkin(it.url || "")) { if (it.file) importSkin(it.name, new Uint8Array(await it.file.arrayBuffer())); else if (it.url) importSkinUrl(it.url, it.name); continue; }
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
            if (!/^[a-z]+:/i.test(url) && CF.vfs.read(url)) { out.push(trackFrom(Object.assign(vfsTrack(url), { name: title || url }))); title = null; continue; }
            out.push(trackFrom({ name: title || decodeURIComponent(url.split("/").pop() || url), url }));
            title = null;
          }
        }
        return out.length ? out : [trackFrom({ name: it.name, url: it.url })];
      }
      function probeDuration(url) {
        return new Promise((res) => {
          const p = document.createElement("audio");
          p.preload = "metadata"; p.src = url;
          p.onloadedmetadata = () => { const d = p.duration; p.src = ""; res(isFinite(d) ? d : NaN); };
          p.onerror = () => { p.src = ""; res(NaN); };
        });
      }
      function probeDurations(from) {
        pl.slice(from).forEach(async (t) => {
          if (isFinite(t.duration) || t.kind === "stream" || t.kind === "hls" || t.kind === "midi" || !t.url) return;
          const d = await probeDuration(t.url);
          if (isFinite(d)) { t.duration = d; renderList(); persist(); }
        });
      }
      const mediaAccept = "audio/*,video/*," + [...MEDIA_EXT, ...LIST_EXT, "wsz"].map(e => "." + e).join(",");
      function openFiles() {
        const inp = h("input", { type: "file", multiple: true, accept: mediaAccept });
        inp.addEventListener("change", () => addTracks([...inp.files].map(f => ({ name: f.name, url: URL.createObjectURL(f), file: f })), true));
        inp.click();
      }
      function pickFolder(fn) {
        const inp = h("input", { type: "file", multiple: true, webkitdirectory: "" });
        inp.addEventListener("change", () => {
          const files = [...inp.files].filter(f => MEDIA_EXT.includes(extOf(f.name))).sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, undefined, { numeric: true }));
          if (!files.length) return report2("There's no music or video in that folder.");
          fn(files);
        });
        inp.click();
      }
      const addFolder = () => pickFolder((files) => addTracks(files.map(f => ({ name: f.name, url: URL.createObjectURL(f), file: f })), !playing));
      async function openUrl() {
        const r = await CF.dialog({ title: "Open URL", icon: "nightamp", message: "Stream, file, playlist or skin address (http, https, .m3u, .pls, .m3u8, .wsz):", input: "https://", buttons: ["Play", "Enqueue", "Cancel"] });
        if (!r.button || r.button === "Cancel" || !/^https?:\/\/./.test(r.value.trim())) return;
        const url = r.value.trim();
        addTracks([{ name: decodeURIComponent(url.split(/[?#]/)[0].split("/").pop()) || url, url }], r.button === "Play");
      }
      function fromDocuments() {
        const docs = CF.vfs.list().filter(d => CF.fileType(d.name)?.app === "nightamp" && !isSkin(d.name));
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
      function addDemo() { const song = demoSong(); pl.push({ name: "NightCode Theme (ForgeMIDI)", url: "", kind: "midi", song, duration: song.duration, persist: false }); renderList(); }
      async function relink(t) {
        if (t.lib && !t.file) { const b = await NightLibrary.blob(t.lib).catch(() => null); if (b) { t.file = b; t.url = URL.createObjectURL(b); } }
        else if (t.vfs && !t.file && CF.vfs.read(t.vfs)) { const v = vfsTrack(t.vfs); t.url = v.url; t.file = v.file; }
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
          await relink(t);
          if (t.lib) { const rec = lib.recs.find(r => r.id === t.lib); if (rec && autoplay) { rec.plays = (rec.plays || 0) + 1; rec.last = Date.now(); NightLibrary.update(rec.id, { plays: rec.plays, last: rec.last }).catch(() => {}); } }
          if (t.kind === "midi") {
            engine = "midi";
            if (!t.song) t.song = ForgeMIDI.parse(await (t.file || await (await fetch(t.url)).blob()).arrayBuffer(), t.name);
            midi.load(t.song); midiDur = midi.duration; t.duration = midiDur; info = { ch: 2, rate: ac.sampleRate, synth: true };
            renderList();
            if (autoplay) play();
            return;
          }
          if (!t.url) throw new Error("the file is gone (local files from an earlier session can't be reopened; add them to the Media Library to keep them)");
          engine = "media";
          let url = t.url;
          if (t.kind === "aiff") {
            if (!t.wavUrl) { const bytes = new Uint8Array(await (t.file || await (await fetch(t.url)).blob()).arrayBuffer()); t.wavUrl = URL.createObjectURL(new Blob([aiffToWav(bytes)], { type: "audio/wav" })); }
            url = t.wavUrl;
          }
          if (t.file) t.file.slice(0, 262144).arrayBuffer().then(b => { info = Object.assign(probe(new Uint8Array(b), t.file.name || t.vfs || t.name || t.url), { size: t.file.size }); });
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
        m.addEventListener("waiting", () => { if (m === media()) buffering = true; });
        m.addEventListener("playing", () => { if (m === media()) buffering = false; });
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

      /* ---------- Media Library ---------- */
      const lib = { node: S.libNode, q: "", artist: null, album: null, sortKey: "artist", sortDir: 1, sel: new Set(), recs: [], loaded: false, busy: "", docTags: {} };
      const mlTree = h("div", { class: "na-ml-tree" });
      const mlMain = h("div", { class: "na-ml-main" });
      libw.body.append(h("div", { class: "na-ml" }, mlTree, mlMain));
      let libStarted = false;
      async function libOpen() { if (libStarted) return; libStarted = true; await libReload(); }
      async function libReload() {
        try { lib.recs = await NightLibrary.all(); lib.err = ""; } catch (e) { lib.recs = []; lib.err = e.message; }
        lib.loaded = true; libRender();
      }
      const playlists = () => CF.store.get(KEY + ".playlists", {});
      const isVideoRec = (r) => VIDEO_EXT.includes(extOf(r.name));
      const display = (r) => r.artist ? `${r.artist} - ${r.title}` : r.title;
      function libNodes() {
        const pls = Object.keys(playlists()).sort((a, b) => a.localeCompare(b));
        return [["h", "Local Media"], ["audio", "Audio", 1], ["video", "Video", 1], ["recent", "Recently added", 1], ["top", "Most played", 1], ["docs", "My Documents", 1],
          ["h", "Playlists"], ["now", "Now playing", 1], ...pls.map(n => ["pl:" + n, n, 1]),
          ["h", "Online"], ["radio", "Internet radio", 1], ["web", "Web & radio browser", 1], ["h", "NightAmp"], ["skins", "Skins", 1]];
      }
      function libRender() {
        // Re-rendering drops the focused button; hand the keyboard back to the player.
        if (libw.el.contains(document.activeElement) && !document.activeElement.matches("input")) setTimeout(() => { if (!root.contains(document.activeElement)) root.focus({ preventScroll: true }); });
        mlTree.replaceChildren(...libNodes().map(([id, label, d]) => {
          if (id === "h") return h("div", { class: "na-ml-node head" }, label);
          const n = h("div", { class: "na-ml-node" + (lib.node === id ? " on" : ""), style: `--d:${d}`, title: label }, label);
          n.addEventListener("click", () => {
            if (id === "web") { if (!S.showWeb) toggle("showWeb"); return; }
            lib.node = id; lib.artist = lib.album = null; lib.sel.clear(); S.libNode = id; persist(); libRender();
          });
          n.addEventListener("contextmenu", (e) => {
            if (!id.startsWith("pl:")) return;
            e.preventDefault(); e.stopPropagation();
            CF.contextMenu({ x: e.clientX, y: e.clientY }, [{ label: "Play", action: () => playRecs(playlistRecs(id.slice(3)), true) }, { label: "Delete playlist", action: () => deletePlaylist(id.slice(3)) }]);
          });
          return n;
        }));
        if (lib.node === "skins") return renderSkinsPane();
        if (lib.node === "radio") return renderTable(STATIONS.concat(CF.store.get(KEY + ".radio", [])).map(([n, u], i) => ({ id: "radio:" + i, title: n, artist: "", album: "", url: u, name: n, kind: "stream" })), { radio: true });
        if (lib.node === "now") return renderTable(pl.map((t, i) => ({ id: "now:" + i, title: t.name, artist: "", album: "", duration: t.duration, name: t.name, _t: t })), { now: true });
        if (lib.node.startsWith("pl:")) return renderTable(playlistRecs(lib.node.slice(3)), { saved: lib.node.slice(3) });
        if (lib.node === "docs") return renderDocs();
        let recs = lib.recs;
        if (lib.node === "audio") recs = recs.filter(r => !isVideoRec(r));
        else if (lib.node === "video") recs = recs.filter(isVideoRec);
        else if (lib.node === "recent") recs = recs.slice().sort((a, b) => b.added - a.added).slice(0, 100);
        else if (lib.node === "top") recs = recs.filter(r => r.plays).sort((a, b) => b.plays - a.plays).slice(0, 100);
        renderTable(recs, { library: true, panes: lib.node === "audio" });
      }
      async function renderDocs() {
        const docs = CF.vfs.list().filter(d => MEDIA_EXT.includes(extOf(d.name)));
        await Promise.all(docs.filter(d => !lib.docTags[d.name]).map(async (d) => { lib.docTags[d.name] = await NightLibrary.readTags(new Blob([CF.vfs.readBytes(d.name)]), d.name); }));
        if (lib.node !== "docs") return;
        renderTable(docs.map(d => Object.assign({ id: "doc:" + d.name, name: d.name, vfs: d.name }, lib.docTags[d.name])), { docs: true });
      }
      function playlistRecs(name) { return (playlists()[name] || []).map((t, i) => Object.assign({ id: `pl:${name}:${i}`, title: t.name, artist: "", album: "" }, t, { title: t.title || t.name })); }
      const COLS = [["artist", "Artist", 19], ["title", "Title", 28], ["album", "Album", 19], ["duration", "Length", 8], ["track", "#", 5], ["genre", "Genre", 9], ["year", "Year", 6], ["plays", "Plays", 6]];
      function renderTable(all, mode) {
        const search = h("input", { placeholder: "Search", value: lib.q, spellcheck: "false" });
        search.addEventListener("input", () => { lib.q = search.value; lib.artist = lib.album = null; paint(); });
        search.addEventListener("keydown", (e) => e.stopPropagation());
        const clear = h("button", { class: "na-ml-btn" }, "Clear");
        clear.addEventListener("click", () => { lib.q = ""; search.value = ""; lib.artist = lib.album = null; paint(); });
        const panes = h("div", { class: "na-ml-panes", hidden: !mode.panes });
        const tableWrap = h("div", { class: "na-ml-table", tabindex: 0 });
        const count = h("span", { class: "n" });
        const btn = (t, fn, title) => { const b = h("button", { class: "na-ml-btn", title: title || "" }, t); b.addEventListener("click", fn); return b; };
        const chosen = () => { const v = visible(); const s = v.filter(r => lib.sel.has(r.id)); return s.length ? s : []; };
        const foot = h("div", { class: "na-ml-foot" },
          btn("Play", () => playRecs(chosen().length ? chosen() : visible(), true), "Play the selection (or everything shown)"),
          btn("Enqueue", () => playRecs(chosen().length ? chosen() : visible(), false), "Add to the playlist"),
          mode.library || mode.docs ? btn("Add files…", () => libAddFiles(), "Add files to the Media Library") : null,
          mode.library ? btn("Add folder…", () => pickFolder((files) => libAdd(files)), "Add a folder to the Media Library") : null,
          mode.library ? btn("Remove", () => libRemove(chosen()), "Remove the selection from the Media Library") : null,
          mode.radio ? btn("Add station…", addStation) : null,
          mode.now ? btn("Save as playlist…", savePlaylistToLibrary) : null,
          mode.saved ? btn("Delete playlist", () => deletePlaylist(mode.saved)) : null,
          lib.busy ? h("span", {}, lib.busy) : null, count);
        mlMain.replaceChildren(h("div", { class: "na-ml-bar" }, search, clear), panes, tableWrap, foot);
        function filtered() {
          const q = lib.q.trim().toLowerCase();
          return q ? all.filter(r => [r.title, r.artist, r.album, r.genre, r.name].some(v => String(v || "").toLowerCase().includes(q))) : all;
        }
        function visible() {
          let v = filtered();
          if (mode.panes && lib.artist != null) v = v.filter(r => (r.artist || "") === lib.artist);
          if (mode.panes && lib.album != null) v = v.filter(r => (r.album || "") === lib.album);
          if (mode.library || mode.docs) {
            const k = lib.sortKey, d = lib.sortDir;
            v = v.slice().sort((a, b) => {
              const x = a[k], y = b[k];
              const c = typeof x === "number" || typeof y === "number" ? (x || 0) - (y || 0) : String(x || "").localeCompare(String(y || ""), undefined, { numeric: true, sensitivity: "base" });
              return (c || (a.album || "").localeCompare(b.album || "") || (a.track || 0) - (b.track || 0) || String(a.title).localeCompare(String(b.title))) * d;
            });
          }
          return v;
        }
        function pane(title, values, current, set) {
          const counts = new Map();
          values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
          const p = h("div", { class: "na-ml-pane" }, h("div", { class: "hd" }, title));
          const row = (label, val, n) => { const d = h("div", { class: current === val ? "on" : "" }, `${label} (${n})`); d.addEventListener("click", () => set(val)); return d; };
          p.append(row(`All (${counts.size} ${title.toLowerCase()}${counts.size === 1 ? "" : "s"})`, null, values.length));
          [...counts.keys()].sort((a, b) => a.localeCompare(b)).forEach(k => p.append(row(k || "(unknown)", k, counts.get(k))));
          return p;
        }
        function paint() {
          if (mode.panes) {
            const f = filtered();
            const byArtist = lib.artist == null ? f : f.filter(r => (r.artist || "") === lib.artist);
            panes.replaceChildren(pane("Artist", f.map(r => r.artist || ""), lib.artist, (v) => { lib.artist = v; lib.album = null; paint(); }),
              pane("Album", byArtist.map(r => r.album || ""), lib.album, (v) => { lib.album = v; paint(); }));
          }
          const v = visible();
          const cols = mode.library || mode.docs ? COLS.filter(c => mode.library || c[0] !== "plays") : mode.radio ? [["title", "Station", 40], ["url", "Address", 60]] : [["title", "Title", 80], ["duration", "Length", 20]];
          const head = h("tr", {}, ...cols.map(([k, label, w]) => { const th = h("th", { style: `width:${w}%` }, label + (lib.sortKey === k && (mode.library || mode.docs) ? (lib.sortDir > 0 ? " ▲" : " ▼") : "")); th.addEventListener("click", () => { if (lib.sortKey === k) lib.sortDir = -lib.sortDir; else { lib.sortKey = k; lib.sortDir = 1; } paint(); }); return th; }));
          const nowId = pl[cur]?.lib;
          const body = v.map((r) => {
            const tr = h("tr", { class: (lib.sel.has(r.id) ? "on" : "") + (nowId && r.id === nowId ? " playing" : "") },
              ...cols.map(([k]) => h("td", { title: String(r[k] ?? "") }, k === "duration" ? (r.kind === "stream" ? "live" : isFinite(r.duration) ? fmtTime(r.duration) : "") : k === "track" || k === "plays" ? (r[k] || "") : String(r[k] ?? ""))));
            tr.addEventListener("click", (e) => { if (e.ctrlKey) lib.sel.has(r.id) ? lib.sel.delete(r.id) : lib.sel.add(r.id); else lib.sel = new Set([r.id]); paint(); });
            tr.addEventListener("dblclick", () => playRecs([r], true));
            tr.addEventListener("contextmenu", (e) => {
              e.preventDefault(); e.stopPropagation();
              if (!lib.sel.has(r.id)) { lib.sel = new Set([r.id]); paint(); }
              const s = chosen();
              CF.contextMenu({ x: e.clientX, y: e.clientY }, [{ label: "Play", action: () => playRecs(s, true) }, { label: "Enqueue", action: () => playRecs(s, false) },
                mode.library ? "-" : null, mode.library ? { label: "Edit info…", disabled: s.length !== 1, action: () => editInfo(s[0]) } : null,
                mode.library ? { label: "Remove from the library", action: () => libRemove(s) } : null].filter(Boolean));
            });
            return tr;
          });
          tableWrap.replaceChildren(h("table", {}, h("thead", {}, head), h("tbody", {}, ...body)));
          const tot = v.reduce((a, r) => a + (isFinite(r.duration) ? r.duration : 0), 0);
          count.textContent = lib.err ? `Library unavailable: ${lib.err}` : !all.length && mode.library ? "Empty: add files or a folder, or drop files here." : `${v.length} item${v.length === 1 ? "" : "s"}${tot ? ` [${fmtTime(tot)}]` : ""}`;
        }
        tableWrap.addEventListener("keydown", (e) => {
          if (e.key === "Enter") { const s = chosen(); if (s.length) playRecs(s, true); }
          else if (e.key === "Delete" && mode.library) libRemove(chosen());
          else if (e.ctrlKey && e.key.toLowerCase() === "a") { e.preventDefault(); lib.sel = new Set(visible().map(r => r.id)); paint(); }
          else return;
          e.stopPropagation();
        });
        paint();
      }
      function renderSkinsPane() {
        const card = (name, sub, active, use, extra) => h("div", { style: "display:flex;gap:8px;align-items:center;margin:4px 0" },
          h("button", { class: "na-ml-btn", disabled: active, onclick: use }, active ? "In use" : "Use"), h("b", {}, name), h("span", { style: "opacity:.75" }, sub), extra || null);
        const box = h("div", { class: "na-ml-info" }, h("h3", {}, "Skins"),
          h("p", {}, "NightAmp wears Winamp 2 classic skins (.wsz). Load one of the thousands made since 1997, including Winamp's own look, or pick a built-in NightAmp skin."),
          ...NightSkin.BUILTIN.map(b => card(b.name, "built in", S.skin === b.id, () => setSkin(b.id).then(libRender))),
          ...userSkins.map(n => card(n, "your skin", S.skin === "wsz:" + n, () => setSkin("wsz:" + n).then(libRender),
            h("button", { class: "na-ml-btn", onclick: async () => { await NightSkin.saved.remove(n); await refreshUserSkins(); if (S.skin === "wsz:" + n) await setSkin("nightcode"); libRender(); } }, "Delete"))),
          h("div", { style: "display:flex;gap:6px;margin-top:10px;flex-wrap:wrap" },
            h("button", { class: "na-ml-btn", onclick: pickSkin }, "Load skin (.wsz)…"), h("button", { class: "na-ml-btn", onclick: getSkins }, "Winamp Skin Museum…"), h("button", { class: "na-ml-btn", onclick: exportSkin }, "Save this skin as .wsz")),
          h("p", { style: "opacity:.75;margin-top:12px" }, "Tip: drop a .wsz file anywhere on NightAmp. The built-in skins also ship as .wsz files, so you can use them in Winamp or Webamp."));
        mlMain.replaceChildren(box);
      }
      async function playRecs(recs, now) {
        if (!recs.length) return;
        const items = [];
        for (const r of recs) {
          if (r._t) { items.push(Object.assign({}, r._t, { file: r._t.file })); continue; }
          if (r.vfs) { items.push(Object.assign(vfsTrack(r.vfs), { name: display(r) })); continue; }
          if (typeof r.id === "number") {
            const b = await NightLibrary.blob(r.id).catch(() => null);
            items.push(b ? { name: display(r), url: URL.createObjectURL(b), file: b, lib: r.id, duration: r.duration, kind: kindOf(r.name) } : { name: display(r), url: r.url, lib: r.id, kind: r.kind || kindOf(r.name, r.url), duration: r.duration });
            continue;
          }
          items.push({ name: r.title || r.name, url: r.url, kind: r.kind || undefined, duration: r.duration });
        }
        if (now) { stop(); pl.length = 0; cur = -1; sel.clear(); }
        await addTracks(items, now);
      }
      async function libAdd(files) {
        lib.busy = "Reading tags…"; libRender();
        try {
          const recs = await NightLibrary.add(files.map(f => ({ file: f, name: f.name })), (n, all) => { lib.busy = `Adding ${n}/${all}…`; const b = mlMain.querySelector(".na-ml-foot span:not(.n)"); if (b) b.textContent = lib.busy; });
          lib.busy = "";
          await libReload();
          // durations the tags didn't give
          for (const r of recs.filter(x => !isFinite(x.duration))) {
            const b = await NightLibrary.blob(r.id); const u = URL.createObjectURL(b);
            const d = await probeDuration(u); URL.revokeObjectURL(u);
            if (isFinite(d)) { await NightLibrary.update(r.id, { duration: d }); const m = lib.recs.find(x => x.id === r.id); if (m) m.duration = d; }
          }
          libRender();
          CF.toast({ title: "Media Library", body: `Added ${recs.length} file${recs.length === 1 ? "" : "s"}.`, icon: "nightamp" });
        } catch (e) {
          lib.busy = ""; libRender();
          report2(`Couldn't add to the Media Library: ${e.message}`);
        }
      }
      function libAddFiles() {
        const inp = h("input", { type: "file", multiple: true, accept: "audio/*,video/*," + MEDIA_EXT.map(e => "." + e).join(",") });
        inp.addEventListener("change", () => inp.files.length && libAdd([...inp.files]));
        inp.click();
      }
      async function libRemove(recs) {
        const ids = recs.map(r => r.id).filter(id => typeof id === "number");
        if (!ids.length) return;
        const r = await CF.dialog({ title: "Media Library", icon: "nightamp", message: `Remove ${ids.length} item${ids.length === 1 ? "" : "s"} from the Media Library? The copies kept by NightAmp are deleted.`, buttons: ["Remove", "Cancel"] });
        if (r.button !== "Remove") return;
        await NightLibrary.remove(ids);
        lib.sel.clear();
        await libReload();
      }
      async function editInfo(r) {
        const content = h("div", { style: "display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center" });
        const fields = {};
        for (const [k, label] of [["title", "Title"], ["artist", "Artist"], ["album", "Album"], ["track", "Track #"], ["year", "Year"], ["genre", "Genre"]]) {
          fields[k] = h("input", { value: r[k] || "" });
          content.append(h("label", {}, label), fields[k]);
        }
        const res = await CF.dialog({ title: "Edit info", icon: "nightamp", content, buttons: ["Save", "Cancel"] });
        if (res.button !== "Save") return;
        const patch = Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, k === "track" ? parseInt(f.value, 10) || 0 : f.value.trim()]));
        await NightLibrary.update(r.id, patch);
        Object.assign(lib.recs.find(x => x.id === r.id) || {}, patch);
        libRender();
      }
      async function sendToLibrary() {
        const picks = pl.filter((t, i) => sel.has(i) && t.file && !t.lib);
        if (!picks.length) return;
        const recs = await NightLibrary.add(picks.map(t => ({ file: t.file, name: t.file.name || t.vfs || t.name, duration: t.duration })));
        recs.forEach((r, i) => { picks[i].lib = r.id; picks[i].persist = true; });
        persist();
        if (libStarted) await libReload();
        CF.toast({ title: "Media Library", body: `Added ${recs.length} track${recs.length === 1 ? "" : "s"} to the Media Library.`, icon: "nightamp" });
      }
      async function savePlaylistToLibrary() {
        if (!pl.length) return report2("The playlist is empty.");
        const r = await CF.dialog({ title: "Save playlist", icon: "nightamp", message: "Playlist name:", input: "My playlist", buttons: ["Save", "Cancel"] });
        if (r.button !== "Save" || !r.value.trim()) return;
        const keepable = pl.filter(t => t.lib || t.vfs || /^https?:/.test(t.url));
        const all = playlists();
        all[r.value.trim()] = keepable.map(t => ({ name: t.name, url: /^https?:/.test(t.url) ? t.url : "", lib: t.lib, vfs: t.vfs, kind: t.kind, duration: isFinite(t.duration) ? t.duration : null }));
        CF.store.set(KEY + ".playlists", all);
        if (keepable.length < pl.length) report2(`${pl.length - keepable.length} local file${pl.length - keepable.length === 1 ? " wasn't" : "s weren't"} saved: add them to the Media Library first so they're kept.`);
        if (S.showLib) libRender();
      }
      function deletePlaylist(name) { const all = playlists(); delete all[name]; CF.store.set(KEY + ".playlists", all); if (lib.node === "pl:" + name) lib.node = "now"; libRender(); }
      async function addStation() {
        const r = await CF.dialog({ title: "Add station", icon: "nightamp", message: "Stream address (http/https, .pls, .m3u):", input: "https://", buttons: ["Add", "Cancel"] });
        if (r.button !== "Add" || !/^https?:\/\/./.test(r.value.trim())) return;
        const n = await CF.dialog({ title: "Add station", icon: "nightamp", message: "Station name:", input: decodeURIComponent(r.value.trim().split("/").pop()) || "Station", buttons: ["Add", "Cancel"] });
        if (n.button !== "Add") return;
        CF.store.set(KEY + ".radio", CF.store.get(KEY + ".radio", []).concat([[n.value.trim() || r.value.trim(), r.value.trim()]]));
        libRender();
      }

      /* ---------- the display loop ---------- */
      const mctx = marquee.getContext("2d"), vctx = visC.getContext("2d"), kctx = kbpsC.getContext("2d"), zctx = khzC.getContext("2d");
      const svctx = sVis.getContext("2d"), stctx = sTime.getContext("2d"), mictx = miniC.getContext("2d"), pstx = plShadeText.getContext("2d"), pstm = plShadeTime.getContext("2d");
      const peaks = new Float32Array(19);
      let scroll = 0, lastScroll = 0, raf = 0, lastTitle = "", lastText = "", dropTick = 0, closed = false;
      function frame(now) {
        raf = requestAnimationFrame(frame);
        if (!skin) return;
        const t = pl[cur], d = duration(), p = position();
        const isPlaying = engine === "midi" ? midi.playing : !media().paused && !media().ended;
        const paused = !isPlaying && t && (engine === "midi" ? midi.offset > 0 : p > 0);
        ppInd.className = "na-s na-pp " + (isPlaying ? "play" : paused ? "pause" : "stop");
        workInd.hidden = !isPlaying;
        workInd.classList.toggle("busy", buffering || probing);
        // time: hidden when stopped, blinking when paused
        const show = S.remaining && d ? d - p : p;
        const secs = Math.floor(show), mm = Math.min(99, Math.floor(secs / 60)), ss = secs % 60;
        const blink = paused && Math.floor(now / 500) % 2;
        const hideTime = (!isPlaying && !paused) || blink;
        const cells = [Math.floor(mm / 10), mm % 10, Math.floor(ss / 10), ss % 10];
        digits.forEach((dg, k) => { dg.style.backgroundImage = hideTime ? "none" : `var(--DIGIT_${cells[k]}${skin.numbersEx ? "_EX" : ""})`; });
        minus.hidden = hideTime || !(S.remaining && d);
        // seek bars
        if (!seek.dragging) seek.set(d ? p / d : 0);
        posThumb.hidden = !d || (!isPlaying && !paused);
        if (!sSeek.dragging) sSeek.set(d ? p / d : 0);
        // marquee
        if (now - lastScroll > 35) {
          lastScroll = now;
          const text = flashText && now < flashUntil ? flashText : t ? `${cur + 1}. ${t.name} (${t.kind === "stream" ? "LIVE" : fmtTime(t.duration)})  ***  ` : "NIGHTAMP 2.0  ***  PRESS L TO OPEN FILES, ALT+L FOR THE MEDIA LIBRARY, RIGHT-CLICK FOR SKINS  ***  ";
          mctx.clearRect(0, 0, 154, 6);
          if (flashText && now < flashUntil) { skinText(mctx, text, 0, 0); scroll = 0; }
          else {
            const w = text.length * 5;
            if (text !== lastText) { scroll = 0; lastText = text; }
            if (w - 25 <= 154 && t) skinText(mctx, text.replace(/\s+\*\*\*\s+$/, ""), 0, 0);
            else { scroll = (scroll + 1) % w; skinText(mctx, text, -scroll, 0); skinText(mctx, text, w - scroll, 0); }
          }
          // kbps / kHz / mono-stereo
          kctx.clearRect(0, 0, 15, 6); zctx.clearRect(0, 0, 10, 6);
          if (t && (isPlaying || paused)) {
            const kbps = info.kbps || (info.size && d ? Math.round(info.size * 8 / d / 1000) : null);
            skinText(kctx, kbps ? String(Math.min(999, kbps)).padStart(3, " ") : "", 0, 0);
            skinText(zctx, info.rate ? String(Math.round(info.rate / 1000)).padStart(2, " ") : "", 0, 0);
          }
          const ch = t && (isPlaying || paused) ? info.ch || 2 : 0;
          monoEl.classList.toggle("on", ch === 1); stereoEl.classList.toggle("on", ch >= 2);
          // windowshade time, playlist mini time
          const tt = t && (isPlaying || paused) && !blink ? `${S.remaining && d ? "-" : " "}${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : "";
          stctx.clearRect(0, 0, 25, 6); skinText(stctx, tt.trimStart().padStart(5, " "), 0, 0);
          mictx.clearRect(0, 0, 25, 6); skinText(mictx, tt.trimStart().padStart(5, " "), 0, 0);
          if (S.plShade) {
            pstx.clearRect(0, 0, 180, 6); pstm.clearRect(0, 0, 35, 6);
            skinText(pstx, t ? `${cur + 1}. ${t.name}`.slice(0, 36) : "", 0, 0);
            skinText(pstm, t ? fmtTime(t.duration) : "", 0, 0);
          }
        }
        // title (windowshade) is part of the skin, nothing to draw
        // visualizer, in the skin's viscolor.txt colours
        const C = skin.colors;
        const live = !info.plain && isPlaying;
        vctx.fillStyle = C[0]; vctx.fillRect(0, 0, 76, 16);
        vctx.fillStyle = C[1];
        for (let y = 1; y < 16; y += 2) for (let x = 1; x < 76; x += 2) vctx.fillRect(x, y, 1, 1);
        if (S.vis === "spectrum") {
          if (live) analyser.getByteFrequencyData(freq); else freq.fill(0);
          for (let b = 0; b < 19; b++) {
            const lo = Math.floor(Math.pow(freq.length * 0.6, b / 19)), hi = Math.max(lo + 1, Math.floor(Math.pow(freq.length * 0.6, (b + 1) / 19)));
            let m = 0; for (let k = lo; k < hi; k++) m = Math.max(m, freq[k]);
            const v = Math.round(m / 255 * 16);
            peaks[b] = Math.max(v, peaks[b] - 0.35);
            for (let y = 0; y < v; y++) { vctx.fillStyle = C[2 + (15 - y)]; vctx.fillRect(b * 4, 15 - y, 3, 1); }
            if (peaks[b] > 0.5) { vctx.fillStyle = C[23]; vctx.fillRect(b * 4, 15 - Math.round(peaks[b]), 3, 1); }
          }
        } else if (S.vis === "scope") {
          if (live) analyser.getByteTimeDomainData(wave); else wave.fill(128);
          let last = null;
          for (let x = 0; x < 76; x++) {
            const y = clamp(Math.round((wave[Math.floor(x * wave.length / 76)] / 255) * 15), 0, 15);
            const a = last == null ? y : last;
            for (let yy = Math.min(a, y); yy <= Math.max(a, y); yy++) { vctx.fillStyle = C[18 + Math.min(4, Math.floor(Math.abs(yy - 8) / 2))]; vctx.fillRect(x, yy, 1, 1); }
            last = y;
          }
        }
        if (S.shade) {
          svctx.fillStyle = C[0]; svctx.fillRect(0, 0, 38, 5);
          if (live && S.vis !== "off") {
            analyser.getByteFrequencyData(freq);
            for (let b = 0; b < 19; b++) {
              const lo = Math.floor(Math.pow(freq.length * 0.6, b / 19)), hi = Math.max(lo + 1, Math.floor(Math.pow(freq.length * 0.6, (b + 1) / 19)));
              let m = 0; for (let k = lo; k < hi; k++) m = Math.max(m, freq[k]);
              const v = Math.round(m / 255 * 5);
              for (let y = 0; y < v; y++) { svctx.fillStyle = C[2 + Math.round((4 - y) * 15 / 4)]; svctx.fillRect(b * 2, 4 - y, 1, 1); }
            }
          }
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
      function at(elm, e) { if (e && e.clientX != null) return { x: e.clientX, y: e.clientY }; const r = (elm || main).getBoundingClientRect(); return { x: r.left, y: r.bottom }; }
      function visMenu(e) {
        CF.contextMenu(at(visC, e), [["spectrum", "Spectrum analyzer"], ["scope", "Oscilloscope"], ["off", "Off"]].map(([v, l]) => ({ label: l, checked: S.vis === v, action: () => { S.vis = v; persist(); } })));
      }
      function menu(elm, e) {
        CF.contextMenu(at(elm, e), [
          { label: "Play file…", key: "L", action: openFiles }, { label: "Play folder…", action: addFolder }, { label: "Play URL…", key: "Ctrl+L", action: openUrl }, { label: "Add from My Documents", action: fromDocuments }, "-",
          { label: "Main window", checked: true, disabled: true }, { label: "Equalizer", key: "Alt+G", checked: S.showEq, action: () => toggle("showEq") }, { label: "Playlist editor", key: "Alt+E", checked: S.showPl, action: () => toggle("showPl") },
          { label: "Media Library", key: "Alt+L", checked: S.showLib, action: () => toggle("showLib") },
          { label: "Video", key: "Alt+V", checked: S.showVideo, action: () => toggle("showVideo") }, { label: "Web & radio browser", key: "Alt+W", checked: S.showWeb, action: () => toggle("showWeb") }, "-",
          { label: "Skins", items: skinItems() },
          { label: "Options", items: [{ label: "Always on top", checked: !!S.ontop, action: () => { S.ontop = !S.ontop; win.setTopmost?.(S.ontop); sync(); persist(); } },
            { label: "Double size", key: "Ctrl+D", checked: S.double, action: () => toggle("double") }, { label: "Windowshade mode", checked: S.shade, action: () => toggle("shade") },
            { label: "Time remaining", checked: S.remaining, action: () => { S.remaining = !S.remaining; persist(); } }, { label: "Show splash screen at start", checked: S.splash, action: () => { S.splash = !S.splash; persist(); } }] },
          { label: "Visualization", items: [["spectrum", "Spectrum analyzer"], ["scope", "Oscilloscope"], ["off", "Off"]].map(([v, l]) => ({ label: l, checked: S.vis === v, action: () => { S.vis = v; persist(); } })) },
          { label: "Playback", items: [{ label: "Previous", key: "Z", action: prev }, { label: "Play", key: "X", action: play }, { label: "Pause", key: "C", action: pause }, { label: "Stop", key: "V", action: stop }, { label: "Next", key: "B", action: next }, "-",
            { label: "Jump to file…", key: "J", action: jump }, { label: "Shuffle", key: "S", checked: S.shuffle, action: () => { S.shuffle = !S.shuffle; sync(); persist(); } }, { label: "Repeat", key: "R", checked: S.repeat, action: () => { S.repeat = !S.repeat; sync(); persist(); } }] }, "-",
          { label: "About NightAmp…", action: about }, { label: "Exit", action: () => win.close() }]);
      }
      function presetMenu(elm, e) {
        const custom = CF.store.get(KEY + ".presets", {});
        const apply = (vals) => { S.eq = vals.slice(); applyEq(); sync(); saveAuto(); persist(); };
        CF.contextMenu(at(elm, e), [
          { label: "Load", items: Object.keys(PRESETS).map(n => ({ label: n, action: () => apply(PRESETS[n]) })) },
          { label: "Your presets", items: Object.keys(custom).length ? Object.keys(custom).map(n => ({ label: n, action: () => apply(custom[n]) })) : [{ label: "(none saved)", disabled: true }] },
          "-", { label: "Save preset…", action: async () => { const r = await CF.dialog({ title: "Save preset", icon: "nightamp", message: "Preset name:", input: "My preset", buttons: ["Save", "Cancel"] }); if (r.button === "Save" && r.value.trim()) { custom[r.value.trim()] = S.eq.slice(); CF.store.set(KEY + ".presets", custom); } } },
          { label: "Delete preset", items: Object.keys(custom).length ? Object.keys(custom).map(n => ({ label: n, action: () => { delete custom[n]; CF.store.set(KEY + ".presets", custom); } })) : [{ label: "(none saved)", disabled: true }] },
          { label: "Reset (flat)", action: () => apply(PRESETS.Flat) }]);
      }
      function saveAuto() { if (S.eqAuto && pl[cur]) S.auto[pl[cur].name] = S.eq.slice(); }
      async function jump() {
        const r = await CF.dialog({ title: "Jump to file", icon: "nightamp", message: "Type part of a title:", input: "", buttons: ["Play", "Cancel"] });
        if (r.button !== "Play" || !r.value.trim()) return;
        const i = pl.findIndex(t => t.name.toLowerCase().includes(r.value.trim().toLowerCase()));
        if (i >= 0) load(i, true); else CF.dialog({ title: "Jump to file", icon: "info", message: "No match." });
      }
      function fileInfo(i = cur) {
        const t = pl[i];
        if (!t) return CF.dialog({ title: "File info", icon: "info", message: "Nothing is loaded. Press L to open a file." });
        const rec = t.lib && lib.recs.find(r => r.id === t.lib);
        CF.dialog({ title: "File info", icon: "nightamp", message: [`Title: ${t.name}`, rec?.album ? `Album: ${rec.album}${rec.year ? ` (${rec.year})` : ""}` : "", rec?.genre ? `Genre: ${rec.genre}` : "",
          `Type: ${{ audio: "Audio", video: "Video", midi: "MIDI (ForgeMIDI synth)", stream: "Internet stream", hls: "HLS stream", aiff: "AIFF (converted to WAV)" }[t.kind] || t.kind}`,
          `Length: ${t.kind === "stream" ? "live" : fmtTime(t.duration)}`, `Location: ${t.lib ? "Media Library" : t.vfs ? "My Documents\\" + t.vfs : t.url.startsWith("blob:") ? "this session (local file)" : t.url || "(gone)"}`,
          i === cur && info.rate ? `Format: ${Math.round(info.rate / 100) / 10} kHz, ${info.ch === 1 ? "mono" : "stereo"}${info.kbps ? `, ${info.kbps} kbps` : ""}` : "",
          i === cur && info.plain ? "This stream plays without the equalizer and visuals (the server doesn't allow it)." : ""].filter(Boolean).join("\n") });
      }
      function radioHome() {
        const extra = `<h2 style="margin-top:26px">WEB</h2><div class="d">${WEB_LINKS.map(([n, u]) => `<a href="#" data-u="${CF.esc(u)}"><b>${CF.esc(n.slice(0, 2).toUpperCase())}</b><span>${CF.esc(n)}</span></a>`).join("")}</div>`;
        return CF.NightWeb.homePage({ title: "NightAmp Radio", subtitle: "INTERNET RADIO · CLICK TO PLAY", tiles: STATIONS.map(([n, u]) => [n, `nightamp://play?u=${encodeURIComponent(u)}&n=${encodeURIComponent(n)}`]), extra, stats: "SOMAFM IS LISTENER-SUPPORTED: SOMAFM.COM/SUPPORT" });
      }
      function about() {
        const w = CF.createWindow({ title: "About NightAmp", icon: "nightamp", w: 580, h: 490, resizable: false });
        w.body.append(h("div", { class: "wn-about" }, h("img", { src: `${ART}nightamp-splash.png`, alt: "NightAmp" }),
          h("p", {}, "NightAmp 2.0, the NightCode media player. An official ColeForge program."),
          h("p", { class: "muted" }, `Skin: ${skin?.name || "loading"}. NightAmp wears Winamp 2 classic skins (.wsz); the NightCode, ColeForge Classic and ColeForge Silver skins are original. No Nullsoft code or art is included: the 2024 Winamp source release doesn't allow modified versions to be shared.`),
          h("p", { class: "muted" }, "Skin sprite map from Webamp by Jordan Eldredge (MIT). HLS streaming by hls.js (Apache-2.0); MIDI by ForgeMIDI.")));
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
        else if (e.ctrlKey && k === "f") { e.preventDefault(); showFind(); }
        else if (e.altKey && k === "s") { e.preventDefault(); CF.contextMenu(at(main), skinItems()); }
        else if (e.altKey && ["g", "e", "v", "w", "l"].includes(k)) { e.preventDefault(); toggle({ g: "showEq", e: "showPl", v: "showVideo", w: "showWeb", l: "showLib" }[k]); }
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
      root.addEventListener("drop", async (e) => {
        root.classList.remove("na-dragging");
        const files = [...(e.dataTransfer?.files || [])];
        if (!files.length) return;
        e.preventDefault();
        const skins = files.filter(f => isSkin(f.name)), rest = files.filter(f => !isSkin(f.name));
        if (skins.length) importSkin(skins[0].name, new Uint8Array(await skins[0].arrayBuffer()));
        if (!rest.length) return;
        if (e.target.closest(".na-lib")) libAdd(rest.filter(f => MEDIA_EXT.includes(extOf(f.name))));
        else addTracks(rest.map(f => ({ name: f.name, url: URL.createObjectURL(f), file: f })), !playing);
      });
      function handleArgs(a = {}) {
        if (a.add?.length) addTracks(a.add.map(x => ({ name: x.name, url: x.url, file: x.file })), a.play !== false);
        if (a.file) { if (isSkin(a.file)) importSkin(a.file, CF.vfs.readBytes(a.file)); else addTracks([vfsTrack(a.file)], true); }
        if (a.url) addTracks([{ name: decodeURIComponent(a.url.split("/").pop()) || a.url, url: a.url }], true);
        if (a.skin) setSkin(a.skin);
        if (a.library && !S.showLib) toggle("showLib");
      }
      win.on("args", handleArgs);
      // For Albert and other agents (js/albert/tools.js).
      CF.nightamp = {
        status: () => ({ playing: engine === "midi" ? midi.playing : !media().paused && !media().ended, track: pl[cur]?.name || null, index: cur, position: Math.round(position()), duration: Math.round(duration()) || null,
          volume: Math.round(S.vol * 100), shuffle: S.shuffle, repeat: S.repeat, skin: skin?.name || null, playlist: pl.slice(0, 100).map((t, i) => `${i + 1}. ${t.name}`) }),
        play: () => play(), pause: () => pause(), stop: () => stop(), next: () => next(), previous: () => prev(),
        volume: (v) => { S.vol = clamp(v / 100); applyVol(); sync(); persist(); },
        playIndex: (i) => load(i, true),
        find: (q) => pl.findIndex((t) => t.name.toLowerCase().includes(String(q).toLowerCase())),
        add: (url, name, now) => addTracks([{ name: name || url, url }], now !== false),
        skin: (id) => setSkin(id),
        skins: () => [...NightSkin.BUILTIN.map((b) => b.id), ...userSkins.map((n) => "wsz:" + n)],
        toggle: (k) => { if (["showEq", "showPl", "showVideo", "showWeb", "showLib", "shuffle", "repeat", "double"].includes(k)) toggle(k); },
      };
      win.on("close", () => { delete CF.nightamp; });
      win.on("close", () => { closed = true; cancelAnimationFrame(raf); halt(); stopDrop(); closePopup(); web?.destroy(); ac.close(); persist(); NightSkin.dispose(skin); });
      win.on("focus", () => root.focus({ preventScroll: true }));

      // Tracks from My Documents and the Media Library are re-linked; local files from last session can't come back.
      pl.forEach(t => { if (t.vfs && CF.vfs.read(t.vfs)) { const v = vfsTrack(t.vfs); t.url = v.url; t.file = v.file; } });
      if (S.ontop) win.setTopmost?.(true);
      if (S.double && !fitsDouble()) S.double = false;
      win.body.append(boot);
      applyEq(); applyVol(); layout(); sync(); renderList();
      refreshUserSkins();
      setSkin(S.skin || "nightcode", true).then(() => {
        if (cur >= 0 && pl[cur]) load(cur, false);
        handleArgs(args);
        if (win.el.classList.contains("active")) root.focus({ preventScroll: true });
      });
      root.focus({ preventScroll: true });
    },
  });
})();
