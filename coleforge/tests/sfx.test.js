"use strict";
// SFX Lab's synth (shell/js/sfx-engine.js): presets, determinism, safe parameters, .wav output.
//   node coleforge/tests/sfx.test.js
const assert = require("assert");
const E = require("../shell/js/sfx-engine.js");

let passed = 0;
const ok = (name) => { passed++; console.log("ok -", name); };
const peak = (s) => s.reduce((m, x) => Math.max(m, Math.abs(x)), 0);

for (const name of Object.keys(E.PRESET_NAMES)) {
  for (let seed = 1; seed <= 25; seed++) {
    const p = E.preset(name, seed);
    assert.deepStrictEqual(p, E.preset(name, seed), `${name}: same seed, same sound`);
    const s = E.render(p);
    assert.ok(s.length > 0 && s.length <= 4 * E.RATE, `${name}/${seed}: length ${s.length}`);
    assert.ok(s.every((x) => Number.isFinite(x) && Math.abs(x) <= 1), `${name}/${seed}: samples in range`);
    if (name !== "random") assert.ok(peak(s) > 0.02, `${name}/${seed}: audible (peak ${peak(s)})`);
  }
}
ok("every preset renders audible, bounded, reproducible sounds");

const c = E.clean({ wave: "noise", freq: 7, slide: -9, volume: "loud", nonsense: 1 });
assert.deepStrictEqual([c.wave, c.freq, c.slide, c.volume, "nonsense" in c], [3, 1, -1, E.defaults().volume, false]);
assert.notDeepStrictEqual(E.mutate(E.preset("laser", 4), 9), E.preset("laser", 4));
ok("parameters are clamped and cleaned; mutate changes a sound");

const s = E.render(E.preset("explosion", 2));
const w16 = E.wav(s), w8 = E.wav(s, { bits: 8, rate: 22050 });
const dv = new DataView(w16.buffer);
assert.strictEqual(Buffer.from(w16.slice(0, 4)).toString(), "RIFF");
assert.strictEqual(Buffer.from(w16.slice(8, 16)).toString(), "WAVEfmt ");
assert.deepStrictEqual([dv.getUint16(22, true), dv.getUint32(24, true), dv.getUint16(34, true), dv.getUint32(40, true)], [1, 44100, 16, s.length * 2]);
assert.strictEqual(w16.length, 44 + s.length * 2);
assert.strictEqual(new DataView(w8.buffer).getUint16(34, true), 8);
const half = E.render(E.preset("explosion", 2), { rate: 22050 });
assert.ok(Math.abs(half.length * 2 - s.length) <= 2, "22 kHz renders half the samples");
ok(".wav files: RIFF header, 16-bit and 8-bit, 44.1 and 22.05 kHz");

console.log(`\nall sfx tests passed (${passed})`);
