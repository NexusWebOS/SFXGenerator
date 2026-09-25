"use strict";

// SFX Lab: make retro game sound effects (coins, lasers, explosions, power-ups, hits, jumps, blips)
// from presets and sliders, hear them instantly, and export .wav files to your game - or save them to
// My Documents and play them in NightAmp. The synth is js/sfx-engine.js; Albert can use it too.
(function () {
  const { h } = CF;
  const KEY = "cf.sfxlab";
  const ICONS = { pickup: "🪙", laser: "🔫", explosion: "💥", powerup: "⭐", hit: "🥊", jump: "🦘", blip: "🔹", random: "🎲" };

  CF.register({
    id: "sfxlab", name: "SFX Lab", icon: "sfxlab", single: true,
    desc: "SFX Lab: retro game sound effects from presets and sliders, exported as .wav for your games.",
    window: { w: 900, h: 600 },
    open(win) {
      const E = window.SFXEngine;
      CF.appSplash({ id: "sfxlab", image: "assets/art/nightapps/sfxlab-title.png" });
      const S = Object.assign({ params: E.preset("pickup", 7), name: "pickup_1", rate: 44100, bits: 16, autoplay: true, history: [], count: {} }, CF.store.get(KEY, {}));
      S.params = E.clean(S.params);
      let samples = new Float32Array(0);
      const save = () => CF.store.set(KEY, Object.assign({}, S, { history: S.history.slice(0, 24) }));

      /* ---------- left: generators and history ---------- */
      const gen = h("div", { class: "sfx-gen" }, Object.entries(E.PRESET_NAMES).map(([id, label]) =>
        h("button", { class: "btn sfx-preset", title: `A new ${label.toLowerCase()} sound`, onclick: () => generate(id) }, h("span", { class: "sfx-emo" }, ICONS[id]), label)));
      const mutateBtn = h("button", { class: "btn", title: "Small random changes to this sound", onclick: () => { S.params = E.mutate(S.params); refresh(true); } }, "🧬 Mutate");
      const hist = h("div", { class: "sfx-hist" });

      /* ---------- centre: sliders ---------- */
      const waveBtns = E.WAVES.map((w, i) => h("button", { class: "btn sfx-wave", onclick: () => { S.params.wave = i; refresh(true); } }, w));
      const sliders = {};
      const groups = {};
      for (const [k, [, lo, hi, label, group]] of Object.entries(E.PARAMS)) {
        if (k === "wave") continue;
        const input = h("input", { type: "range", min: lo, max: hi, step: 0.001, value: S.params[k] });
        const val = h("span", { class: "sfx-val" });
        input.addEventListener("input", () => { S.params[k] = +input.value; val.textContent = (+input.value).toFixed(2); });
        input.addEventListener("change", () => refresh(true));
        input.addEventListener("dblclick", () => { S.params[k] = E.PARAMS[k][0]; refresh(true); });
        sliders[k] = { input, val };
        (groups[group] = groups[group] || []).push(h("label", { class: "sfx-row", title: "Double-click to reset" }, h("span", { class: "sfx-lab" }, label), input, val));
      }
      const panel = h("div", { class: "sfx-sliders" }, h("div", { class: "sfx-waves" }, waveBtns),
        Object.entries(groups).map(([g, rows]) => h("fieldset", { class: "sfx-group" }, h("legend", {}, g), rows)));

      /* ---------- right: the sound ---------- */
      const scope = h("canvas", { class: "sfx-scope", width: 300, height: 110 });
      const nameIn = h("input", { class: "field", value: S.name, spellcheck: false, title: "File name" });
      nameIn.addEventListener("change", () => { S.name = nameIn.value.replace(/[\\/:*?"<>|]/g, "_").trim() || "sound"; nameIn.value = S.name; save(); });
      const info = h("div", { class: "sfx-info muted" });
      const rateSel = h("select", { class: "field" }, [44100, 22050, 11025].map((r) => h("option", { value: r, selected: r === S.rate }, `${r / 1000} kHz`)));
      const bitsSel = h("select", { class: "field" }, [16, 8].map((b) => h("option", { value: b, selected: b === S.bits }, `${b}-bit`)));
      rateSel.addEventListener("change", () => { S.rate = +rateSel.value; refresh(false); });
      bitsSel.addEventListener("change", () => { S.bits = +bitsSel.value; refresh(false); });
      const auto = h("input", { type: "checkbox", checked: S.autoplay });
      auto.addEventListener("change", () => { S.autoplay = auto.checked; save(); });
      const side = h("div", { class: "sfx-side" },
        h("div", { class: "sfx-title" }, "SFX LAB"), scope, info,
        h("button", { class: "btn sfx-play", onclick: () => E.play(samples, S.rate), title: "Space" }, "▶ Play"),
        h("label", { class: "row sfx-opt" }, auto, " Play on every change"),
        h("label", { class: "row sfx-opt" }, "Name ", nameIn),
        h("div", { class: "row sfx-opt" }, rateSel, bitsSel),
        h("button", { class: "btn", onclick: exportWav }, "💾 Export .wav…"),
        h("button", { class: "btn", onclick: () => saveDoc(false) }, "📁 Save to My Documents"),
        h("button", { class: "btn", onclick: () => saveDoc(true) }, "🎵 Play in NightAmp"),
        h("div", { class: "row sfx-opt" }, h("button", { class: "btn flat", onclick: copyJson }, "Copy settings"), h("button", { class: "btn flat", onclick: pasteJson }, "Paste")),
        h("button", { class: "btn flat", onclick: askAlbert }, "🤖 Ask Albert for a sound…"));

      win.body.append(h("div", { class: "sfx" }, h("div", { class: "sfx-left" }, h("div", { class: "sfx-h" }, "GENERATE"), gen, mutateBtn, h("div", { class: "sfx-h" }, "HISTORY"), hist), panel, side));
      win.statusbar(["Space plays · double-click a slider to reset it", "SFX Lab"]);

      function generate(kind) {
        S.params = E.preset(kind, (Math.random() * 2 ** 31) | 0);
        S.count[kind] = (S.count[kind] || 0) + 1;
        S.name = `${kind}_${S.count[kind]}`;
        nameIn.value = S.name;
        S.history.unshift({ name: S.name, kind, params: S.params });
        S.history = S.history.slice(0, 24);
        refresh(true);
      }
      function refresh(play) {
        samples = E.render(S.params, { rate: S.rate });
        for (const [k, s] of Object.entries(sliders)) { s.input.value = S.params[k]; s.val.textContent = (+S.params[k]).toFixed(2); }
        waveBtns.forEach((b, i) => b.classList.toggle("on", i === S.params.wave));
        drawScope();
        const kb = Math.round((44 + samples.length * S.bits / 8) / 1024 * 10) / 10;
        info.textContent = `${(samples.length / S.rate).toFixed(2)} s · ${kb} KB · ${E.WAVES[S.params.wave]}`;
        hist.replaceChildren(...S.history.map((x) => h("div", { class: "sfx-hitem clickable" + (x.name === S.name ? " on" : ""), onclick: () => { S.params = E.clean(x.params); S.name = x.name; nameIn.value = x.name; refresh(true); } }, `${ICONS[x.kind] || "♪"} ${x.name}`)));
        if (play && S.autoplay) E.play(samples, S.rate);
        save();
      }
      function drawScope() {
        const g = scope.getContext("2d"), W = scope.width, H = scope.height;
        g.fillStyle = "#02050e"; g.fillRect(0, 0, W, H);
        g.strokeStyle = "#13265a"; g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
        if (!samples.length) return;
        const per = Math.max(1, Math.floor(samples.length / W));
        g.fillStyle = "#31d7e8";
        for (let x = 0; x < W; x++) {
          let lo = 1, hi = -1;
          for (let i = x * per; i < Math.min(samples.length, (x + 1) * per); i++) { lo = Math.min(lo, samples[i]); hi = Math.max(hi, samples[i]); }
          if (hi < lo) continue;
          g.fillRect(x, H / 2 - hi * (H / 2 - 4), 1, Math.max(1, (hi - lo) * (H / 2 - 4)));
        }
      }
      const wavBytes = () => E.wav(samples, { rate: S.rate, bits: S.bits });
      function exportWav() { CF.download(`${S.name}.wav`, wavBytes(), "audio/wav"); }
      function saveDoc(thenPlay) {
        const file = `${S.name}.wav`;
        if (!CF.vfs.writeBytes(file, wavBytes(), "audio/wav")) return;
        CF.toast({ title: "SFX Lab", body: `Saved ${file} in My Documents.`, icon: "sfxlab" });
        if (thenPlay) CF.open("nightamp", { file });
      }
      async function copyJson() {
        const text = JSON.stringify({ sfxlab: 1, name: S.name, params: S.params });
        try { await navigator.clipboard.writeText(text); CF.toast({ title: "SFX Lab", body: "Settings copied.", icon: "sfxlab" }); }
        catch { CF.dialog({ title: "SFX Lab settings", icon: "sfxlab", message: text }); }
      }
      async function pasteJson() {
        let text = "";
        try { text = await navigator.clipboard.readText(); } catch { /* ask instead */ }
        if (!text) { const r = await CF.dialog({ title: "Paste settings", icon: "sfxlab", message: "Paste SFX Lab settings (JSON):", input: "", buttons: ["OK", "Cancel"] }); if (r.button !== "OK") return; text = r.value; }
        try { const j = JSON.parse(text); S.params = E.clean(j.params || j); if (j.name) { S.name = String(j.name); nameIn.value = S.name; } refresh(true); }
        catch { CF.toast({ title: "SFX Lab", body: "That isn't SFX Lab settings.", icon: "sfxlab" }); }
      }
      function askAlbert() {
        CF.open("albert");
        CF.toast({ title: "SFX Lab", body: "Tell Albert the sound you want, e.g. “make a chunky 8-bit coin sound called coin_big”. He uses SFX Lab's synth and saves it to My Documents.", icon: "albert" });
      }
      const key = (e) => { if (e.code === "Space" && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) { e.preventDefault(); E.play(samples, S.rate); } };
      win.el.addEventListener("keydown", key);
      win.on("args", (a) => { if (a?.params) { S.params = E.clean(a.params); if (a.name) { S.name = a.name; nameIn.value = a.name; } refresh(true); } });
      refresh(false);
    },
  });
})();
