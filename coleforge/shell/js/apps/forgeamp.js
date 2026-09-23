"use strict";

// ForgeAmp: ColeForge Edition music player.
// Streams mp3/wav/ogg/opus/flac/m4a/aac/mp4/webm through the platform decoder and plays
// .mid/.midi/.rmi/.kar and Doom-style .mus through the built-in ForgeMIDI synthesizer.
(function () {
  const { h } = CF;
  const MIDI_EXT = /\.(mid|midi|rmi|kar|mus)$/i;
  const TRACKER_EXT = /\.(mod|xm|s3m|it|mptm)$/i;
  const AUDIO_EXT = /\.(mp3|wav|wave|ogg|oga|opus|flac|m4a|aac|mp4|m4b|webm|weba|mka|aif|aiff|caf|3gp)$/i;
  CF.audioExtensions = "mp3, wav, ogg, opus, flac, m4a, aac, mp4, webm, aiff, mid, midi, rmi, kar, mus";

  let actx = null;
  CF.audioCtx = () => {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
    return actx;
  };

  // An original demo tune so the MIDI synth can be heard with no files loaded.
  function demoSong() {
    const ev = [], bpm = 132, beat = 60 / bpm;
    const note = (t, ch, n, len, vel = 100) => { ev.push({ t: t * beat, type: "on", ch, a: n, b: vel }); ev.push({ t: (t + len) * beat - 0.01, type: "off", ch, a: n }); };
    ev.push({ t: 0, type: "prog", ch: 0, a: 30 }, { t: 0, type: "prog", ch: 1, a: 33 }, { t: 0, type: "prog", ch: 2, a: 81 }, { t: 0, type: "prog", ch: 3, a: 89 });
    const roots = [40, 40, 43, 38, 40, 40, 45, 43];
    for (let bar = 0; bar < 16; bar++) {
      const r = roots[bar % 8], t0 = bar * 4;
      for (let i = 0; i < 8; i++) { note(t0 + i / 2, 1, r - 12 + (i % 4 === 3 ? 7 : 0), 0.45, 110); note(t0 + i / 2, 0, r + (i % 2 ? 7 : 0), 0.4, 90); }
      if (bar >= 4) [0, 1.5, 2, 3].forEach(b => note(t0 + b, 9, 36, 0.2, 120));
      if (bar >= 4) [1, 3].forEach(b => note(t0 + b, 9, 38, 0.2, 110));
      for (let i = 0; i < 8; i++) if (bar >= 2) note(t0 + i / 2, 9, 42, 0.1, 70);
      if (bar % 4 === 0) note(t0, 3, r + 24, 16, 60), note(t0, 3, r + 31, 16, 50);
      if (bar >= 8) {
        const lick = [0, 3, 5, 7, 10, 7, 5, 3];
        lick.forEach((d, i) => note(t0 + i / 2, 2, r + 24 + d, 0.45, 95));
      }
      if (bar === 15) note(t0 + 3, 9, 49, 1, 120);
    }
    ev.sort((a, b) => a.t - b.t);
    return { events: ev, duration: 64 * beat + 1.5, format: "ForgeMIDI demo" };
  }

  CF.register({
    id: "forgeamp", name: "ForgeAmp", icon: "forgeamp", single: true, desc: "Music player for MP3, OGG, WAV, FLAC, M4A/MP4, MIDI and Doom .MUS.",
    window: { w: 470, h: 560 },
    open(win, args) {
      const ctx = CF.audioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      const master = ctx.createGain();
      master.gain.value = CF.settings.volume;
      analyser.connect(master).connect(ctx.destination);
      const audio = new Audio();
      audio.preload = "auto";
      const mediaSrc = ctx.createMediaElementSource(audio);
      mediaSrc.connect(analyser);
      const midi = new ForgeMIDI.MidiPlayer(ctx, analyser);

      const playlist = []; // { name, file?, song?, kind }
      let cur = -1, kind = null, shuffle = false, repeat = "all", scope = false, raf = 0, objectUrl = null;

      const canvas = h("canvas", { class: "amp-vis clickable", width: 440, height: 110, title: "Click to switch visualizer" });
      const titleEl = h("div", { class: "amp-title" }, "ForgeAmp — drop music here");
      const timeEl = h("div", { class: "amp-time" }, "0:00 / 0:00");
      const fmtEl = h("div", { class: "amp-fmt" }, "");
      const seek = h("input", { type: "range", min: 0, max: 1000, value: 0, class: "amp-seek" });
      const vol = h("input", { type: "range", min: 0, max: 1, step: 0.01, value: CF.settings.volume, title: "Volume" });
      const btn = (label, title, fn) => { const b = h("button", { class: "btn icon", title }, label); b.addEventListener("click", fn); return b; };
      const playBtn = btn("▶", "Play / Pause", () => toggle());
      const shufBtn = btn("⤮", "Shuffle", () => { shuffle = !shuffle; shufBtn.classList.toggle("flat", !shuffle); });
      const repBtn = btn("🔁", "Repeat: all", () => { repeat = { all: "one", one: "off", off: "all" }[repeat]; repBtn.title = "Repeat: " + repeat; repBtn.textContent = repeat === "one" ? "🔂" : "🔁"; repBtn.classList.toggle("flat", repeat === "off"); });
      shufBtn.classList.add("flat");
      const list = h("div", { class: "list amp-list", tabindex: 0 });

      win.body.append(h("div", { class: "amp" },
        h("div", { class: "amp-screen" }, canvas, h("div", { class: "amp-info" }, titleEl, h("div", { class: "row", style: "margin:0;justify-content:space-between" }, fmtEl, timeEl))),
        seek,
        h("div", { class: "amp-ctrl" }, btn("⏮", "Previous", () => step(-1)), playBtn, btn("⏹", "Stop", stop), btn("⏭", "Next", () => step(1)), shufBtn, repBtn, h("span", { style: "flex:1" }), h("img", { src: CF.icon("volume"), alt: "", style: "width:18px" }), vol),
        h("div", { class: "amp-btns" }, btn("+ Files", "Add files", addFiles), btn("+ Folder", "Add a folder", addFolder), btn("♫ Demo", "Play the ForgeMIDI demo", addDemo), btn("Clear", "Clear playlist", clear)),
        list));
      win.menubar([
        { label: "File", items: [{ label: "Add Files…", action: addFiles }, { label: "Add Folder…", action: addFolder }, "-", { label: "Close", action: () => win.close() }] },
        { label: "Play", items: () => [{ label: "Play/Pause", key: "Space", action: toggle }, { label: "Stop", action: stop }, { label: "Next", action: () => step(1) }, { label: "Previous", action: () => step(-1) }, "-", { label: "Shuffle", checked: shuffle, action: () => shufBtn.click() }] },
        { label: "Help", items: [{ label: "Supported formats", action: () => CF.dialog({ title: "ForgeAmp", icon: "forgeamp", message: `Plays: ${CF.audioExtensions}.\n\nMIDI and Doom .MUS files are rendered by the built-in ForgeMIDI synth.\nTracker modules (.mod/.xm/.s3m/.it) are planned via libopenmpt.` }) }] },
      ]);

      function addFiles() { pick(false); }
      function addFolder() { pick(true); }
      function pick(folder) {
        const inp = h("input", { type: "file", multiple: true, accept: folder ? null : "audio/*,video/mp4,.mid,.midi,.rmi,.kar,.mus,.mod,.xm,.s3m,.it" });
        if (folder) inp.webkitdirectory = true;
        inp.addEventListener("change", () => enqueue([...inp.files]));
        inp.click();
      }
      function enqueue(files) {
        const start = playlist.length;
        let skipped = 0;
        for (const f of files) {
          if (MIDI_EXT.test(f.name)) playlist.push({ name: f.name, file: f, kind: "midi" });
          else if (AUDIO_EXT.test(f.name) || f.type.startsWith("audio/")) playlist.push({ name: f.name, file: f, kind: "audio" });
          else if (TRACKER_EXT.test(f.name)) skipped++;
          else skipped++;
        }
        if (skipped) CF.toast({ title: "ForgeAmp", body: `${skipped} file(s) skipped (unsupported type).`, icon: "warning" });
        render();
        if (cur < 0 && playlist.length > start) load(start, true);
      }
      function addDemo() { playlist.push({ name: "ColeForge Theme (ForgeMIDI demo).mid", song: demoSong(), kind: "midi" }); render(); load(playlist.length - 1, true); }
      function clear() { stop(); playlist.length = 0; cur = -1; titleEl.textContent = "ForgeAmp — drop music here"; fmtEl.textContent = ""; render(); }
      function render() {
        list.replaceChildren(...playlist.map((t, i) => {
          const row = h("div", { class: "item clickable" + (i === cur ? " sel" : "") }, h("span", { class: "muted", style: "width:26px" }, i + 1 + "."), h("span", { style: "flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" }, t.name), h("small", { class: "muted" }, t.kind === "midi" ? "MIDI" : (t.name.split(".").pop() || "").toUpperCase()));
          row.addEventListener("dblclick", () => load(i, true));
          row.addEventListener("contextmenu", (e) => { e.preventDefault(); CF.contextMenu({ x: e.clientX, y: e.clientY }, [{ label: "Play", action: () => load(i, true) }, { label: "Remove from playlist", action: () => { playlist.splice(i, 1); if (i === cur) { stop(); cur = -1; } else if (i < cur) cur--; render(); } }]); });
          return row;
        }));
        win.statusbar([`${playlist.length} track(s)`, kind === "midi" ? "ForgeMIDI synth" : "Media decoder"]);
      }
      async function load(i, autoplay) {
        if (i < 0 || i >= playlist.length) return;
        stop(true);
        cur = i;
        const t = playlist[i];
        kind = t.kind;
        titleEl.textContent = t.name.replace(/\.[^.]+$/, "");
        win.setTitle(`${titleEl.textContent} - ForgeAmp`);
        try {
          if (t.kind === "midi") {
            if (!t.song) t.song = ForgeMIDI.parse(await t.file.arrayBuffer(), t.name);
            midi.load(t.song);
            midi.onended = ended;
            fmtEl.textContent = t.song.format;
          } else {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            objectUrl = URL.createObjectURL(t.file);
            audio.src = objectUrl;
            fmtEl.textContent = (t.name.split(".").pop() || "").toUpperCase();
          }
          render();
          if (autoplay) play();
        } catch (e) {
          CF.dialog({ title: "ForgeAmp", icon: "error", message: `Couldn't open ${t.name}:\n${e.message}` });
        }
      }
      function play() {
        CF.audioCtx();
        if (cur < 0) { if (playlist.length) return load(0, true); return addFiles(); }
        if (kind === "midi") midi.play();
        else audio.play().catch(err => CF.dialog({ title: "ForgeAmp", icon: "error", message: "This file's codec isn't supported on this system.\n" + err.message }));
        playBtn.textContent = "⏸";
      }
      function pause() { if (kind === "midi") midi.pause(); else audio.pause(); playBtn.textContent = "▶"; }
      function isPlaying() { return kind === "midi" ? midi.playing : !audio.paused; }
      function toggle() { isPlaying() ? pause() : play(); }
      function stop(silent) { midi.stop(); audio.pause(); if (audio.src) audio.currentTime = 0; playBtn.textContent = "▶"; if (!silent) seek.value = 0; }
      function nextIndex(dir) {
        if (!playlist.length) return -1;
        if (shuffle && playlist.length > 1) { let n; do n = Math.floor(Math.random() * playlist.length); while (n === cur); return n; }
        const n = cur + dir;
        if (n >= playlist.length) return repeat === "all" ? 0 : -1;
        if (n < 0) return playlist.length - 1;
        return n;
      }
      function step(dir) { const n = nextIndex(dir); if (n >= 0) load(n, true); }
      function ended() {
        if (repeat === "one") return load(cur, true);
        const n = nextIndex(1);
        if (n >= 0) load(n, true); else { playBtn.textContent = "▶"; }
      }
      audio.addEventListener("ended", ended);

      const fmt = (s) => !isFinite(s) ? "0:00" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
      const pos = () => kind === "midi" ? [midi.currentTime, midi.duration] : [audio.currentTime, audio.duration];
      let seeking = false;
      seek.addEventListener("input", () => { seeking = true; const [, d] = pos(); timeEl.textContent = `${fmt(seek.value / 1000 * d)} / ${fmt(d)}`; });
      seek.addEventListener("change", () => { const [, d] = pos(); const t = seek.value / 1000 * d; if (kind === "midi") midi.seek(t); else audio.currentTime = t; seeking = false; });
      vol.addEventListener("input", () => { master.gain.value = +vol.value; });
      canvas.addEventListener("click", () => { scope = !scope; });

      const g = canvas.getContext("2d");
      const freq = new Uint8Array(analyser.frequencyBinCount), wave = new Uint8Array(analyser.fftSize);
      const peaks = new Float32Array(48);
      function draw() {
        raf = requestAnimationFrame(draw);
        const W = canvas.width, H = canvas.height;
        g.fillStyle = "#020812"; g.fillRect(0, 0, W, H);
        if (scope) {
          analyser.getByteTimeDomainData(wave);
          g.strokeStyle = "#7fd0ff"; g.lineWidth = 2; g.shadowColor = "#1f6fff"; g.shadowBlur = 8; g.beginPath();
          for (let i = 0; i < wave.length; i += 4) { const x = i / wave.length * W, y = wave[i] / 255 * H; i ? g.lineTo(x, y) : g.moveTo(x, y); }
          g.stroke(); g.shadowBlur = 0;
        } else {
          analyser.getByteFrequencyData(freq);
          const bars = peaks.length, bw = W / bars;
          for (let b = 0; b < bars; b++) {
            const lo = Math.floor(Math.pow(b / bars, 2) * 600) + 1, hi = Math.floor(Math.pow((b + 1) / bars, 2) * 600) + 2;
            let v = 0; for (let k = lo; k < hi; k++) v = Math.max(v, freq[k]);
            const bh = v / 255 * (H - 6);
            peaks[b] = Math.max(bh, peaks[b] - 1.2);
            const grad = g.createLinearGradient(0, H, 0, 0);
            grad.addColorStop(0, "#0b3a9c"); grad.addColorStop(0.6, "#3f8cff"); grad.addColorStop(1, "#bfe3ff");
            g.fillStyle = grad;
            for (let y = 0; y < bh; y += 4) g.fillRect(b * bw + 1, H - y - 3, bw - 2, 3);
            g.fillStyle = "#e6f3ff"; g.fillRect(b * bw + 1, H - peaks[b] - 4, bw - 2, 2);
          }
        }
        const [t, d] = pos();
        if (!seeking) { seek.value = d ? t / d * 1000 : 0; timeEl.textContent = `${fmt(t)} / ${fmt(d)}`; }
      }
      draw();

      win.body.addEventListener("dragover", (e) => { e.preventDefault(); });
      win.body.addEventListener("drop", (e) => { e.preventDefault(); enqueue([...e.dataTransfer.files]); });
      win.el.addEventListener("keydown", (e) => { if (e.code === "Space" && !e.target.closest("input")) { e.preventDefault(); toggle(); } });
      const offVol = CF.on("volume", (v) => { vol.value = v; master.gain.value = v; });
      win.on("args", (a) => a.files && enqueue(a.files));
      win.on("close", () => { cancelAnimationFrame(raf); stop(); midi.halt(); mediaSrc.disconnect(); master.disconnect(); if (objectUrl) URL.revokeObjectURL(objectUrl); offVol(); });
      render();
      if (args.files) enqueue(args.files);
    },
  });
})();
