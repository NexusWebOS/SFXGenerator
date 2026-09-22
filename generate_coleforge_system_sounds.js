"use strict";

// ColeForge OS system sound scheme.
// Deterministic procedural synthesis in the spirit of late-90s desktop chimes:
// warm detuned pads, glassy bell partials and short airy tails. Original material only.

const fs = require("fs");
const path = require("path");

const SR = 44100;
const OUT = path.join(__dirname, "coleforge", "shell", "assets", "sounds");

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sound(seconds) {
  const n = Math.max(1, Math.round(seconds * SR));
  return { l: new Float32Array(n), r: new Float32Array(n), seconds: n / SR };
}
function clamp(x, lo = -1, hi = 1) { return Math.max(lo, Math.min(hi, x)); }
function smoothstep(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
function panGains(pan) {
  const a = (clamp(pan, -1, 1) + 1) * Math.PI * 0.25;
  return [Math.cos(a), Math.sin(a)];
}
function midiHz(n) { return 440 * Math.pow(2, (n - 69) / 12); }

function add(dst, src, at = 0, gain = 1) {
  const off = Math.round(at * SR);
  const n = Math.min(src.l.length, dst.l.length - off);
  for (let i = 0; i < n; i++) { dst.l[off + i] += src.l[i] * gain; dst.r[off + i] += src.r[i] * gain; }
  return dst;
}

// Bell / electric-piano voice: inharmonic partials with individual decays.
function bell(seconds, f, o = {}) {
  const s = sound(seconds);
  const partials = o.partials || [[1, 1, 1], [2.0, 0.45, 1.6], [3.01, 0.22, 2.4], [4.2, 0.1, 3.5], [5.43, 0.05, 4.8]];
  const decay = o.decay ?? 1.4, attack = o.attack ?? 0.004, amp = o.amp ?? 0.4;
  const [gl, gr] = panGains(o.pan ?? 0);
  for (let i = 0; i < s.l.length; i++) {
    const t = i / SR;
    let v = 0;
    for (const [ratio, a, speed] of partials) v += Math.sin(Math.PI * 2 * f * ratio * t) * a * Math.exp(-t * speed / decay);
    const e = smoothstep(t / attack) * smoothstep((s.seconds - t) / 0.08) * amp;
    s.l[i] = v * e * gl; s.r[i] = v * e * gr;
  }
  return s;
}

// Pad voice: several detuned saw-ish partials through a moving one-pole lowpass.
function pad(seconds, f, o = {}) {
  const s = sound(seconds);
  const voices = o.voices ?? 5, spread = o.spread ?? 0.012, amp = o.amp ?? 0.18;
  const attack = o.attack ?? 0.6, release = o.release ?? 1.2;
  const cut0 = o.cut0 ?? 600, cut1 = o.cut1 ?? 3200;
  const phases = [], lp = [0, 0];
  const random = rng(o.seed ?? 11);
  for (let v = 0; v < voices; v++) phases.push(random());
  for (let i = 0; i < s.l.length; i++) {
    const t = i / SR, q = t / s.seconds;
    let l = 0, r = 0;
    for (let v = 0; v < voices; v++) {
      const det = 1 + (v - (voices - 1) / 2) * spread / voices;
      phases[v] += f * det / SR;
      const p = phases[v] - Math.floor(phases[v]);
      // Soft saw: sum of first harmonics keeps it warm instead of buzzy.
      const x = Math.sin(2 * Math.PI * p) + Math.sin(4 * Math.PI * p) * 0.35 + Math.sin(6 * Math.PI * p) * 0.15;
      const [gl, gr] = panGains((v / Math.max(1, voices - 1)) * 1.4 - 0.7);
      l += x * gl; r += x * gr;
    }
    const cut = cut0 + (cut1 - cut0) * Math.sin(Math.min(1, q * 1.4) * Math.PI * 0.5);
    const k = 1 - Math.exp(-2 * Math.PI * cut / SR);
    lp[0] += (l - lp[0]) * k; lp[1] += (r - lp[1]) * k;
    const e = smoothstep(t / attack) * smoothstep((s.seconds - t) / release) * amp / voices * 2;
    s.l[i] = lp[0] * e; s.r[i] = lp[1] * e;
  }
  return s;
}

function noiseSweep(seconds, o = {}) {
  const s = sound(seconds), random = rng(o.seed ?? 3);
  let bpL = 0, bpR = 0, lpL = 0, lpR = 0;
  for (let i = 0; i < s.l.length; i++) {
    const t = i / SR, q = t / s.seconds;
    const f = (o.f0 ?? 400) * Math.pow((o.f1 ?? 6000) / (o.f0 ?? 400), q);
    const k = 1 - Math.exp(-2 * Math.PI * f / SR);
    lpL += (random() * 2 - 1 - lpL) * k; lpR += (random() * 2 - 1 - lpR) * k;
    bpL += (lpL - bpL) * 0.02; bpR += (lpR - bpR) * 0.02;
    const e = smoothstep(t / (o.attack ?? 0.02)) * smoothstep((s.seconds - t) / (o.release ?? 0.1)) * (o.amp ?? 0.3);
    const p = (o.pan0 ?? 0) + ((o.pan1 ?? 0) - (o.pan0 ?? 0)) * q;
    const [gl, gr] = panGains(p);
    s.l[i] = (lpL - bpL) * e * gl; s.r[i] = (lpR - bpR) * e * gr;
  }
  return s;
}

// Cheap stereo "room": a few cross-fed feedback delays.
function reverb(s, mix = 0.28, size = 1) {
  const taps = [[0.0297, 0.0371], [0.0411, 0.0437], [0.0533, 0.0617], [0.0719, 0.0671]].map(([a, b]) => [Math.round(a * size * SR), Math.round(b * size * SR)]);
  const out = sound(s.seconds);
  const bufL = new Float32Array(s.l.length), bufR = new Float32Array(s.r.length);
  for (let i = 0; i < s.l.length; i++) {
    let wl = 0, wr = 0;
    for (const [dl, dr] of taps) {
      if (i >= dl) wl += bufR[i - dl];
      if (i >= dr) wr += bufL[i - dr];
    }
    bufL[i] = s.l[i] + wl * 0.19; bufR[i] = s.r[i] + wr * 0.19;
    out.l[i] = s.l[i] * (1 - mix) + wl * mix; out.r[i] = s.r[i] * (1 - mix) + wr * mix;
  }
  return out;
}

const defs = [];
function define(name, description, build) { defs.push({ name, description, build }); }

define("startup", "Boot chime: rising pad swell under a glassy bell arpeggio.", () => {
  const s = sound(5.2);
  for (const [n, at] of [[50, 0], [57, 0.05], [62, 0.1], [66, 0.18]]) add(s, pad(4.9 - at, midiHz(n), { seed: n, attack: 1.1, release: 1.9, cut0: 350, cut1: 2800 }), at);
  [74, 78, 81, 86, 90].forEach((n, i) => add(s, bell(3.2, midiHz(n), { amp: 0.22 - i * 0.02, pan: -0.6 + i * 0.3, decay: 1.8 }), 0.55 + i * 0.19));
  add(s, bell(3.6, midiHz(93), { amp: 0.12, decay: 2.2 }), 1.6);
  add(s, noiseSweep(1.8, { f0: 300, f1: 9000, amp: 0.05, attack: 0.9, release: 0.8, pan0: -0.7, pan1: 0.7 }), 0.1);
  return reverb(s, 0.34, 1.4);
});
define("shutdown", "Goodbye: descending bell phrase settling onto a soft low pad.", () => {
  const s = sound(3.6);
  [86, 81, 78, 74].forEach((n, i) => add(s, bell(2.4, midiHz(n), { amp: 0.2, pan: 0.5 - i * 0.33, decay: 1.5 }), i * 0.2));
  for (const n of [50, 57, 62]) add(s, pad(2.9, midiHz(n), { seed: n + 5, attack: 0.3, release: 1.8, cut0: 1800, cut1: 400 }), 0.55);
  return reverb(s, 0.34, 1.3);
});
define("logon", "Short welcome swell for signing in.", () => {
  const s = sound(2.2);
  for (const n of [62, 69, 74]) add(s, pad(2.0, midiHz(n), { seed: n, attack: 0.35, release: 1.1, cut0: 700, cut1: 3600 }));
  add(s, bell(1.6, midiHz(86), { amp: 0.2, decay: 1.4 }), 0.25);
  return reverb(s, 0.3);
});
define("ding", "Default beep: a single rounded bell.", () => reverb(bell(1.2, midiHz(81), { amp: 0.5, decay: 1.1 }), 0.25));
define("notify", "Toast notification: two-note upward glint.", () => {
  const s = sound(1.3);
  add(s, bell(1.0, midiHz(79), { amp: 0.4, pan: -0.25 }));
  add(s, bell(1.1, midiHz(86), { amp: 0.36, pan: 0.25 }), 0.11);
  return reverb(s, 0.28);
});
define("exclamation", "Warning dialog: bright minor-third stab.", () => {
  const s = sound(1.3);
  for (const n of [76, 79, 83]) add(s, bell(1.2, midiHz(n), { amp: 0.3, decay: 0.8 }));
  return reverb(s, 0.26);
});
define("critical_stop", "Error dialog: low dissonant thump with a bell cluster.", () => {
  const s = sound(1.4);
  for (const n of [57, 58, 64]) add(s, bell(1.2, midiHz(n), { amp: 0.34, decay: 0.55, partials: [[1, 1, 1], [2.02, 0.5, 2], [2.97, 0.3, 3]] }));
  add(s, bell(0.4, 55, { amp: 0.55, decay: 0.25, partials: [[1, 1, 1]] }));
  return reverb(s, 0.22);
});
define("question", "Confirmation dialog: gentle rising fourth.", () => {
  const s = sound(1.2);
  add(s, bell(0.9, midiHz(74), { amp: 0.36 }));
  add(s, bell(1.0, midiHz(79), { amp: 0.36 }), 0.13);
  return reverb(s, 0.26);
});
define("menu_click", "Start menu / button click: tight glassy tick.", () => bell(0.09, midiHz(96), { amp: 0.35, decay: 0.05, attack: 0.001 }));
define("menu_popup", "Menu open: tiny airy blip.", () => add(bell(0.16, midiHz(91), { amp: 0.2, decay: 0.08 }), noiseSweep(0.12, { f0: 2000, f1: 9000, amp: 0.06, attack: 0.005, release: 0.08 })));
define("minimize", "Window minimize: downward swoosh.", () => noiseSweep(0.32, { f0: 7000, f1: 500, amp: 0.3, attack: 0.02, release: 0.14, pan0: 0.2, pan1: -0.2 }));
define("maximize", "Window maximize / restore: upward swoosh.", () => noiseSweep(0.3, { f0: 500, f1: 7500, amp: 0.3, attack: 0.03, release: 0.1, pan0: -0.2, pan1: 0.2 }));
define("recycle", "Empty Recycle Bin: crumple of short noise bursts.", () => {
  const s = sound(0.8), random = rng(77);
  for (let i = 0; i < 14; i++) add(s, noiseSweep(0.05 + random() * 0.05, { seed: 100 + i, f0: 1500 + random() * 3000, f1: 800, amp: 0.3, attack: 0.002, release: 0.03, pan0: random() * 2 - 1, pan1: random() * 2 - 1 }), random() * 0.6);
  return s;
});
define("chat_in", "ForgeChat message received: two quick soft bells.", () => {
  const s = sound(0.8);
  add(s, bell(0.5, midiHz(84), { amp: 0.35, decay: 0.45 }));
  add(s, bell(0.6, midiHz(88), { amp: 0.32, decay: 0.45 }), 0.08);
  return reverb(s, 0.2);
});
define("chat_out", "ForgeChat message sent: soft whoosh-tick.", () => add(noiseSweep(0.18, { f0: 800, f1: 6000, amp: 0.16, attack: 0.01, release: 0.1 }), bell(0.2, midiHz(91), { amp: 0.18, decay: 0.1 }), 0.05));
define("buddy_in", "Buddy signed on: creaky door swing up into a chime.", () => {
  const s = sound(1.4);
  add(s, noiseSweep(0.55, { f0: 300, f1: 1400, amp: 0.2, attack: 0.1, release: 0.2 }));
  add(s, bell(0.9, midiHz(76), { amp: 0.28 }), 0.45);
  add(s, bell(0.9, midiHz(83), { amp: 0.26 }), 0.55);
  return reverb(s, 0.25);
});
define("buddy_out", "Buddy signed off: chime falling into a door thud.", () => {
  const s = sound(1.2);
  add(s, bell(0.7, midiHz(83), { amp: 0.26 }));
  add(s, bell(0.7, midiHz(76), { amp: 0.26 }), 0.1);
  add(s, bell(0.35, 70, { amp: 0.5, decay: 0.2, partials: [[1, 1, 1], [1.5, 0.4, 2]] }), 0.42);
  return reverb(s, 0.22);
});
define("lobby_ready", "Game lobby: all players ready fanfare.", () => {
  const s = sound(1.8);
  [67, 72, 76, 79].forEach((n, i) => add(s, bell(1.2, midiHz(n), { amp: 0.28, pan: -0.45 + i * 0.3 }), i * 0.09));
  for (const n of [55, 60, 64]) add(s, pad(1.4, midiHz(n), { seed: n, attack: 0.08, release: 0.8, cut0: 2500, cut1: 1500 }), 0.35);
  return reverb(s, 0.28);
});
define("call_ring", "ForgeChat incoming video call ring (one cycle).", () => {
  const s = sound(1.6);
  for (let k = 0; k < 2; k++) [79, 83, 86].forEach((n, i) => add(s, bell(0.45, midiHz(n), { amp: 0.3, decay: 0.3 }), k * 0.55 + i * 0.07));
  return reverb(s, 0.2);
});

function dcBlock(s) {
  for (const channel of [s.l, s.r]) {
    let xm1 = 0, ym1 = 0;
    for (let i = 0; i < channel.length; i++) { const x = channel[i], y = x - xm1 + 0.995 * ym1; xm1 = x; ym1 = y; channel[i] = y; }
  }
}

function finalize(s) {
  dcBlock(s);
  let peak = 0;
  for (let i = 0; i < s.l.length; i++) {
    s.l[i] = Math.tanh(s.l[i] * 1.1); s.r[i] = Math.tanh(s.r[i] * 1.1);
    peak = Math.max(peak, Math.abs(s.l[i]), Math.abs(s.r[i]));
  }
  const gain = peak > 0 ? 0.79 / peak : 1; // about -2 dBFS
  for (let i = 0; i < s.l.length; i++) { s.l[i] *= gain; s.r[i] *= gain; }
}

function chunk(tag, data) {
  const pad = data.length & 1, out = Buffer.alloc(8 + data.length + pad);
  out.write(tag, 0, 4, "ascii"); out.writeUInt32LE(data.length, 4); data.copy(out, 8); return out;
}

function wavBuffer(s) {
  const fmt = Buffer.alloc(16); fmt.writeUInt16LE(1, 0); fmt.writeUInt16LE(2, 2); fmt.writeUInt32LE(SR, 4); fmt.writeUInt32LE(SR * 4, 8); fmt.writeUInt16LE(4, 12); fmt.writeUInt16LE(16, 14);
  const pcm = Buffer.alloc(s.l.length * 4);
  for (let i = 0; i < s.l.length; i++) { pcm.writeInt16LE(Math.round(clamp(s.l[i]) * 32767), i * 4); pcm.writeInt16LE(Math.round(clamp(s.r[i]) * 32767), i * 4 + 2); }
  const chunks = [chunk("fmt ", fmt), chunk("data", pcm)];
  const size = 4 + chunks.reduce((n, c) => n + c.length, 0), head = Buffer.alloc(12); head.write("RIFF", 0); head.writeUInt32LE(size, 4); head.write("WAVE", 8); return Buffer.concat([head, ...chunks]);
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = [];
  for (const def of defs) {
    const s = def.build();
    finalize(s);
    fs.writeFileSync(path.join(OUT, `${def.name}.wav`), wavBuffer(s));
    manifest.push({ name: def.name, file: `${def.name}.wav`, seconds: +s.seconds.toFixed(3), description: def.description });
  }
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ scheme: "ColeForge Classic", sampleRate: SR, sounds: manifest }, null, 2) + "\n");
  console.log(`Wrote ${manifest.length} sounds to ${path.relative(__dirname, OUT)}`);
}

main();
