"use strict";

// Bullets of Fury preview sound bank.
// Deterministic procedural synthesis; no third-party samples and no game files touched.

const fs = require("fs");
const path = require("path");

const SR = 48000;
const ROOT = __dirname;
const OUT = path.join(ROOT, "generated", "bullets-of-fury-preview");

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
function env(t, dur, attack = 0.004, release = 0.12) {
  return smoothstep(t / Math.max(attack, 1e-5)) * smoothstep((dur - t) / Math.max(release, 1e-5));
}
function panGains(pan) {
  const a = (clamp(pan, -1, 1) + 1) * Math.PI * 0.25;
  return [Math.cos(a), Math.sin(a)];
}
function wave(kind, phase) {
  const p = phase - Math.floor(phase);
  if (kind === "sine") return Math.sin(Math.PI * 2 * p);
  if (kind === "triangle") return p < 0.5 ? p * 4 - 1 : 3 - p * 4;
  if (kind === "saw") return p * 2 - 1;
  if (kind === "square") return p < 0.5 ? 1 : -1;
  return 0;
}

function add(dst, src, at = 0, gain = 1) {
  const off = Math.round(at * SR);
  const n = Math.min(src.l.length, dst.l.length - off);
  for (let i = 0; i < n; i++) {
    dst.l[off + i] += src.l[i] * gain;
    dst.r[off + i] += src.r[i] * gain;
  }
  return dst;
}

function tone(seconds, o = {}) {
  const s = sound(seconds);
  const f0 = o.f0 ?? 440, f1 = o.f1 ?? f0;
  let phase = o.phase ?? 0;
  for (let i = 0; i < s.l.length; i++) {
    const t = i / SR, q = t / s.seconds;
    const f = Math.max(18, f0 * Math.pow(Math.max(0.001, f1 / f0), q));
    phase += f / SR;
    const vibrato = o.vib ? Math.sin(Math.PI * 2 * (o.vib.hz || 6) * t) * (o.vib.depth || 0.02) : 0;
    let v = wave(o.wave || "sine", phase + vibrato);
    if (o.fm) v = Math.sin(Math.PI * 2 * phase + Math.sin(Math.PI * 2 * phase * (o.fm.ratio || 2)) * (o.fm.depth || 2));
    const a = (o.amp ?? 0.5) * env(t, s.seconds, o.attack ?? 0.003, o.release ?? 0.12);
    const p = (o.pan0 ?? o.pan ?? 0) + ((o.pan1 ?? o.pan ?? 0) - (o.pan0 ?? o.pan ?? 0)) * q;
    const [gl, gr] = panGains(p);
    s.l[i] = v * a * gl;
    s.r[i] = v * a * gr;
  }
  return s;
}

function noise(seconds, o = {}) {
  const s = sound(seconds), random = rng(o.seed ?? 1);
  let lpL = 0, lpR = 0, prevLpL = 0, prevLpR = 0;
  for (let i = 0; i < s.l.length; i++) {
    const t = i / SR, q = t / s.seconds;
    const cutoff = Math.max(40, (o.lp0 ?? o.lp ?? 9000) + ((o.lp1 ?? o.lp ?? 9000) - (o.lp0 ?? o.lp ?? 9000)) * q);
    const alpha = 1 - Math.exp(-Math.PI * 2 * cutoff / SR);
    const rawL = random() * 2 - 1, rawR = random() * 2 - 1;
    lpL += alpha * (rawL - lpL); lpR += alpha * (rawR - lpR);
    const hpCut = o.hp ?? 0;
    let vL = lpL, vR = lpR;
    if (hpCut > 0) {
      const hpa = 1 - Math.exp(-Math.PI * 2 * hpCut / SR);
      prevLpL += hpa * (lpL - prevLpL); prevLpR += hpa * (lpR - prevLpR);
      vL -= prevLpL; vR -= prevLpR;
    }
    const a = (o.amp ?? 0.45) * env(t, s.seconds, o.attack ?? 0.002, o.release ?? 0.15);
    const p = (o.pan0 ?? o.pan ?? 0) + ((o.pan1 ?? o.pan ?? 0) - (o.pan0 ?? o.pan ?? 0)) * q;
    const [gl, gr] = panGains(p);
    s.l[i] = vL * a * gl; s.r[i] = vR * a * gr;
  }
  return s;
}

function periodicNoiseFactory(seconds, seed, count = 24, minCycles = 3, maxCycles = 95) {
  const random = rng(seed), partsL = [], partsR = [];
  for (let i = 0; i < count; i++) {
    const cycles = Math.max(1, Math.round(minCycles + random() * (maxCycles - minCycles)));
    const amp = 1 / Math.pow(cycles, 0.32);
    partsL.push([cycles, random() * Math.PI * 2, amp]);
    partsR.push([cycles, random() * Math.PI * 2, amp]);
  }
  const norm = 1 / Math.sqrt(count * 0.65);
  return (t, side = 0) => {
    const p = (t % seconds) / seconds, parts = side ? partsR : partsL;
    let v = 0;
    for (const [cycles, phase, amp] of parts) v += Math.sin(Math.PI * 2 * cycles * p + phase) * amp;
    return v * norm;
  };
}

function loopBed(seconds, o = {}) {
  const s = sound(seconds);
  const pn = periodicNoiseFactory(seconds, o.seed ?? 1, o.parts ?? 28, o.minCycles ?? 2, o.maxCycles ?? 120);
  const cycles = o.pulseCycles ?? 2;
  for (let i = 0; i < s.l.length; i++) {
    const t = i / SR, p = t / s.seconds;
    const pulse = 1 + (o.pulseDepth ?? 0.15) * Math.sin(Math.PI * 2 * cycles * p);
    const basePhase = (o.baseCycles ?? 0) * p;
    const base = o.baseCycles ? Math.sin(Math.PI * 2 * basePhase) * (o.baseAmp ?? 0.18) : 0;
    const shimmer = o.shimmerCycles ? Math.sin(Math.PI * 2 * o.shimmerCycles * p + Math.sin(Math.PI * 2 * cycles * p) * 1.5) * (o.shimmerAmp ?? 0.12) : 0;
    s.l[i] = (pn(t, 0) * (o.noiseAmp ?? 0.32) + base + shimmer) * pulse;
    s.r[i] = (pn(t, 1) * (o.noiseAmp ?? 0.32) + base - shimmer * 0.4) * pulse;
  }
  return s;
}

function delayed(dst, delaySec, gain, cross = 0) {
  const d = Math.max(1, Math.round(delaySec * SR));
  for (let i = d; i < dst.l.length; i++) {
    const l = dst.l[i - d], r = dst.r[i - d];
    dst.l[i] += (l * (1 - cross) + r * cross) * gain;
    dst.r[i] += (r * (1 - cross) + l * cross) * gain;
  }
  return dst;
}

function transient(seconds, seed, bodyFreq = 105, brightness = 3600, weight = 1) {
  const s = sound(seconds);
  add(s, noise(seconds, { seed, amp: 0.8 * weight, lp0: brightness, lp1: 500, attack: 0.001, release: seconds * 0.72 }));
  add(s, tone(seconds * 0.8, { f0: bodyFreq * 1.8, f1: bodyFreq * 0.45, wave: "sine", amp: 0.75 * weight, attack: 0.001, release: seconds * 0.5 }));
  add(s, tone(seconds * 0.55, { f0: bodyFreq * 4.0, f1: bodyFreq, wave: "triangle", amp: 0.26, attack: 0.001, release: seconds * 0.35 }));
  return s;
}

function machineShot(seed, pitch = 1, pan = 0) {
  const s = sound(0.19);
  add(s, noise(0.12, { seed, amp: 0.95, lp0: 9500 * pitch, lp1: 1800, attack: 0.0005, release: 0.09, pan }));
  add(s, tone(0.17, { f0: 310 * pitch, f1: 85, wave: "saw", amp: 0.62, attack: 0.0005, release: 0.13, pan }));
  add(s, tone(0.12, { f0: 105 * pitch, f1: 58, wave: "sine", amp: 0.55, attack: 0.001, release: 0.10, pan }));
  delayed(s, 0.035, 0.17, 0.4);
  return s;
}

function machineBurst(seconds, seed, rate, heavy = false) {
  const s = sound(seconds), random = rng(seed);
  const gap = 1 / rate;
  for (let t = 0; t < seconds - 0.08; t += gap) {
    const shot = machineShot(Math.floor(random() * 1e9), (heavy ? 0.82 : 1.08) * (0.94 + random() * 0.12), -0.18 + random() * 0.36);
    add(s, shot, t, 0.72 + random() * 0.22);
  }
  add(s, noise(seconds, { seed: seed + 91, amp: 0.075, lp: 1300, attack: 0.01, release: 0.12 }));
  return s;
}

function crystalImpact(seconds, seed, large = false) {
  const s = sound(seconds), random = rng(seed);
  add(s, noise(seconds * 0.55, { seed, amp: large ? 0.8 : 0.62, lp0: 12000, lp1: 1800, hp: 900, attack: 0.001, release: seconds * 0.42 }));
  const count = large ? 12 : 8;
  for (let i = 0; i < count; i++) {
    const at = 0.01 + random() * seconds * 0.32;
    const dur = seconds * (0.34 + random() * 0.45);
    add(s, tone(dur, { f0: (1200 + random() * 5200) * (large ? 0.85 : 1), f1: 700 + random() * 1800, wave: "sine", amp: 0.13 + random() * 0.18, attack: 0.001, release: dur * 0.8, pan: random() * 1.6 - 0.8 }), at);
  }
  return delayed(s, 0.075, 0.18, 0.7);
}

function fireImpact(seconds, seed, large = false) {
  const s = sound(seconds);
  add(s, transient(seconds, seed, large ? 62 : 88, large ? 2200 : 3200, large ? 1.15 : 0.9));
  add(s, noise(seconds, { seed: seed + 4, amp: 0.48, lp0: 6500, lp1: 900, attack: 0.015, release: seconds * 0.72 }));
  return delayed(s, 0.09, 0.16, 0.55);
}

function rocketLaunch(seed, heavy = true) {
  const seconds = heavy ? 1.32 : 0.88, s = sound(seconds);
  add(s, transient(heavy ? 0.48 : 0.32, seed, heavy ? 58 : 86, heavy ? 2800 : 4300, heavy ? 1.1 : 0.9));
  add(s, noise(seconds, { seed: seed + 1, amp: heavy ? 0.64 : 0.54, lp0: 2200, lp1: 7000, attack: 0.025, release: 0.28, pan0: -0.15, pan1: 0.15 }));
  add(s, tone(seconds * 0.9, { f0: heavy ? 95 : 140, f1: heavy ? 420 : 620, wave: "saw", amp: heavy ? 0.42 : 0.32, attack: 0.008, release: 0.24 }));
  return delayed(s, 0.055, 0.18, 0.35);
}

function whoosh(seconds, seed, low = 300, high = 9000, pan0 = -0.85, pan1 = 0.85, weight = 1) {
  const s = sound(seconds);
  add(s, noise(seconds, { seed, amp: 0.8 * weight, lp0: low, lp1: high, hp: 90, attack: seconds * 0.18, release: seconds * 0.28, pan0, pan1 }));
  add(s, tone(seconds, { f0: 150, f1: 520, wave: "sine", amp: 0.24 * weight, attack: seconds * 0.18, release: seconds * 0.3, pan0, pan1 }));
  return delayed(s, 0.032, 0.16, 0.55);
}

const defs = [];
function define(name, category, description, loop, build) { defs.push({ name, category, description, loop, build }); }

define("flamethrower_loop", "Flame", "Continuous close-range flamethrower roar; seamless.", true, () => {
  const s = loopBed(2.0, { seed: 1001, parts: 38, minCycles: 4, maxCycles: 170, noiseAmp: 0.50, baseCycles: 4, baseAmp: 0.22, pulseCycles: 3, pulseDepth: 0.16 });
  add(s, loopBed(2.0, { seed: 1002, parts: 20, minCycles: 25, maxCycles: 250, noiseAmp: 0.22, pulseCycles: 5, pulseDepth: 0.28 }));
  return s;
});
define("flamethrower_ignite", "Flame", "Valve click, fuel catch, and rising flame front.", false, () => {
  const s = sound(0.88); add(s, transient(0.18, 1010, 120, 5800, 0.75));
  add(s, noise(0.84, { seed: 1011, amp: 0.75, lp0: 800, lp1: 9000, attack: 0.08, release: 0.16 }), 0.04);
  add(s, tone(0.7, { f0: 72, f1: 125, wave: "saw", amp: 0.38, attack: 0.08, release: 0.18 }), 0.08); return s;
});
define("flamethrower_release", "Flame", "Fuel cutoff and shrinking flame tail.", false, () => {
  const s = sound(0.62); add(s, noise(0.62, { seed: 1018, amp: 0.67, lp0: 7600, lp1: 550, attack: 0.002, release: 0.5 }));
  add(s, tone(0.45, { f0: 120, f1: 54, wave: "saw", amp: 0.34, attack: 0.002, release: 0.4 })); return s;
});
define("flame_projectile_launch", "Flame", "Compact burning projectile launch.", false, () => {
  const s = sound(0.58); add(s, fireImpact(0.42, 1021, false)); add(s, whoosh(0.52, 1022, 700, 7200, 0, 0, 0.65), 0.04); return s;
});
define("flame_projectile_flyby", "Flame", "Fast burning projectile crossing the stereo field.", false, () => whoosh(0.76, 1027, 500, 9500, -0.95, 0.95, 0.86));
define("flame_orb_launch", "Flame", "Heavy magical flame orb leaving the cannon.", false, () => {
  const s = sound(0.82); add(s, tone(0.76, { f0: 130, f1: 510, wave: "saw", amp: 0.48, attack: 0.008, release: 0.24, fm: { ratio: 2, depth: 1.4 } }));
  add(s, noise(0.74, { seed: 1032, amp: 0.48, lp0: 1400, lp1: 6800, attack: 0.018, release: 0.24 })); return delayed(s, 0.065, 0.15, 0.5);
});
define("flame_orb_impact", "Flame", "Large flame-orb detonation with hot debris tail.", false, () => fireImpact(1.35, 1037, true));

define("ice_breath_loop", "Ice", "Icy breath: cold air, crystalline hiss, and frost shimmer; seamless.", true, () => {
  const s = loopBed(2.4, { seed: 2001, parts: 44, minCycles: 12, maxCycles: 260, noiseAmp: 0.39, shimmerCycles: 61, shimmerAmp: 0.16, pulseCycles: 4, pulseDepth: 0.18 });
  add(s, loopBed(2.4, { seed: 2002, parts: 16, minCycles: 2, maxCycles: 36, noiseAmp: 0.17, baseCycles: 6, baseAmp: 0.09, pulseCycles: 3, pulseDepth: 0.2 })); return s;
});
define("ice_breath_start", "Ice", "Cold inhale and frost jet onset.", false, () => {
  const s = sound(0.78); add(s, noise(0.78, { seed: 2010, amp: 0.68, lp0: 900, lp1: 12000, hp: 500, attack: 0.09, release: 0.13 }));
  add(s, tone(0.7, { f0: 840, f1: 2600, wave: "sine", amp: 0.25, attack: 0.1, release: 0.15, vib: { hz: 11, depth: 0.025 } }), 0.05); return s;
});
define("ice_breath_release", "Ice", "Frost stream taper with brittle ice flecks.", false, () => crystalImpact(0.72, 2015, false));
define("ice_projectile_launch", "Ice", "Sharp frozen projectile launch.", false, () => {
  const s = sound(0.54); add(s, tone(0.52, { f0: 4200, f1: 680, wave: "sine", amp: 0.47, attack: 0.001, release: 0.28, fm: { ratio: 2.7, depth: 1.6 } }));
  add(s, noise(0.42, { seed: 2021, amp: 0.48, lp0: 13000, lp1: 2600, hp: 1200, attack: 0.001, release: 0.28 })); return s;
});
define("ice_projectile_impact", "Ice", "Frozen projectile crack and shard scatter.", false, () => crystalImpact(0.96, 2026, false));
define("ice_orb_launch", "Ice", "Large resonant ice orb launch.", false, () => {
  const s = sound(0.88); add(s, tone(0.82, { f0: 170, f1: 760, wave: "sine", amp: 0.5, attack: 0.01, release: 0.28, fm: { ratio: 3, depth: 1.8 } }));
  add(s, noise(0.78, { seed: 2031, amp: 0.36, lp0: 2600, lp1: 11500, hp: 900, attack: 0.02, release: 0.3 })); return delayed(s, 0.084, 0.2, 0.7);
});
define("ice_orb_impact", "Ice", "Large ice orb collapse and wide crystal burst.", false, () => crystalImpact(1.45, 2037, true));

define("charge_rise", "Charge", "General energy charge ramp before the ready state.", false, () => {
  const s = sound(1.65); add(s, tone(1.65, { f0: 92, f1: 1120, wave: "saw", amp: 0.34, attack: 0.08, release: 0.1, fm: { ratio: 2.03, depth: 1.7 } }));
  add(s, noise(1.65, { seed: 3001, amp: 0.28, lp0: 500, lp1: 11000, hp: 120, attack: 0.12, release: 0.1 })); return delayed(s, 0.07, 0.18, 0.65);
});
define("helix_full_charge_loop", "Charge", "Fully charged Helix Ball bed: blue/pink rotating pulse; seamless.", true, () => {
  const s = loopBed(1.6, { seed: 3010, parts: 18, minCycles: 5, maxCycles: 76, noiseAmp: 0.12, baseCycles: 8, baseAmp: 0.22, shimmerCycles: 31, shimmerAmp: 0.23, pulseCycles: 4, pulseDepth: 0.25 });
  for (let i = 0; i < s.l.length; i++) { const p = i / s.l.length; s.l[i] += Math.sin(Math.PI * 2 * 12 * p + Math.sin(Math.PI * 2 * 4 * p) * 2.4) * 0.18; s.r[i] += Math.sin(Math.PI * 2 * 12 * p - Math.sin(Math.PI * 2 * 4 * p) * 2.4) * 0.18; } return s;
});
define("rollerball_full_charge_loop", "Charge", "Falva Roller Ball fully charged: heavier rotating metallic core; seamless.", true, () => {
  const s = loopBed(1.5, { seed: 3020, parts: 22, minCycles: 3, maxCycles: 68, noiseAmp: 0.14, baseCycles: 6, baseAmp: 0.31, shimmerCycles: 27, shimmerAmp: 0.18, pulseCycles: 3, pulseDepth: 0.3 });
  for (let i = 0; i < s.l.length; i++) { const p = i / s.l.length, throb = (0.62 + 0.38 * Math.pow(0.5 + 0.5 * Math.sin(Math.PI * 2 * 3 * p), 3)); s.l[i] += Math.sin(Math.PI * 2 * 9 * p) * 0.21 * throb; s.r[i] += Math.sin(Math.PI * 2 * 9 * p + 1.2) * 0.21 * throb; } return s;
});
define("charge_ready_ping", "Charge", "Clear full-charge confirmation ping.", false, () => {
  const s = sound(0.82); add(s, tone(0.78, { f0: 880, f1: 1760, wave: "sine", amp: 0.48, attack: 0.001, release: 0.65, fm: { ratio: 2, depth: 0.7 } }));
  add(s, tone(0.62, { f0: 1320, f1: 2640, wave: "sine", amp: 0.27, attack: 0.001, release: 0.52 }), 0.08); return delayed(s, 0.12, 0.22, 0.75);
});
define("charge_release", "Charge", "Charged weapon release snap and energy throw.", false, () => {
  const s = sound(0.72); add(s, tone(0.68, { f0: 1800, f1: 95, wave: "saw", amp: 0.6, attack: 0.001, release: 0.3, fm: { ratio: 2.5, depth: 2.1 } }));
  add(s, noise(0.6, { seed: 3031, amp: 0.5, lp0: 11000, lp1: 900, attack: 0.001, release: 0.42 })); return s;
});

define("tank_rocket_launch_heavy", "Rockets", "Heavy tank rocket with ignition punch and exhaust rise.", false, () => rocketLaunch(4001, true));
define("tank_rocket_launch_fast", "Rockets", "Lighter rapid-fire tank rocket.", false, () => rocketLaunch(4007, false));
define("tank_rocket_salvo", "Rockets", "Three staggered tank rocket launches.", false, () => {
  const s = sound(1.72); add(s, rocketLaunch(4011, false), 0, 0.82); add(s, rocketLaunch(4012, false), 0.32, 0.8); add(s, rocketLaunch(4013, true), 0.69, 0.78); return s;
});
define("rocket_flyby", "Rockets", "Rocket crossing the stereo field with engine Doppler.", false, () => whoosh(1.08, 4019, 850, 9200, -1, 1, 0.95));
define("rocket_impact", "Rockets", "Armored rocket impact and low debris boom.", false, () => fireImpact(1.55, 4023, true));

define("jet_machinegun_shot_01", "Jet Guns", "Single bright aircraft cannon report A.", false, () => machineShot(5001, 1.08, -0.05));
define("jet_machinegun_shot_02", "Jet Guns", "Single bright aircraft cannon report B.", false, () => machineShot(5002, 1.0, 0.04));
define("jet_machinegun_shot_03", "Jet Guns", "Single heavy aircraft cannon report.", false, () => machineShot(5003, 0.82, 0));
define("jet_machinegun_burst_short", "Jet Guns", "Short 12-round aircraft machine-gun burst.", false, () => machineBurst(0.92, 5010, 15, false));
define("jet_machinegun_burst_long", "Jet Guns", "Long heavy aircraft cannon burst.", false, () => machineBurst(1.75, 5017, 12.5, true));

define("alien_plasma_projectile", "Alien", "Wet, unstable alien plasma bolt.", false, () => {
  const s = sound(0.72); add(s, tone(0.68, { f0: 760, f1: 145, wave: "sine", amp: 0.52, attack: 0.002, release: 0.28, fm: { ratio: 1.414, depth: 4.2 }, vib: { hz: 18, depth: 0.035 } }));
  add(s, noise(0.58, { seed: 6001, amp: 0.27, lp0: 7400, lp1: 900, attack: 0.002, release: 0.4 })); return delayed(s, 0.063, 0.25, 0.8);
});
define("alien_prism_projectile", "Alien", "Faceted prism bolt with spectral pitch split.", false, () => {
  const s = sound(0.78); [0, 0.025, 0.05].forEach((at, i) => add(s, tone(0.68, { f0: 1900 + i * 710, f1: 410 + i * 130, wave: "sine", amp: 0.31, attack: 0.001, release: 0.45, pan: [-0.55, 0, 0.55][i], fm: { ratio: 2 + i * 0.17, depth: 1.5 } }), at)); return s;
});
define("alien_laser_zap", "Alien", "Fast alien laser shot with organic modulation.", false, () => {
  const s = sound(0.46); add(s, tone(0.44, { f0: 4800, f1: 260, wave: "sine", amp: 0.62, attack: 0.001, release: 0.22, fm: { ratio: 1.73, depth: 3.8 } }));
  add(s, noise(0.3, { seed: 6014, amp: 0.22, lp0: 12000, lp1: 1800, attack: 0.001, release: 0.22 })); return s;
});
define("prism_beam_start", "Beams", "Prism beam ignition and spectral lock.", false, () => {
  const s = sound(0.62); add(s, tone(0.58, { f0: 320, f1: 2600, wave: "sine", amp: 0.45, attack: 0.008, release: 0.16, fm: { ratio: 2.5, depth: 2.2 } }));
  add(s, noise(0.5, { seed: 6101, amp: 0.25, lp0: 900, lp1: 12000, hp: 700, attack: 0.04, release: 0.12 })); return s;
});
define("prism_beam_loop", "Beams", "Sustained alien prism beam with rotating spectrum; seamless.", true, () => {
  const s = loopBed(1.6, { seed: 6110, parts: 16, minCycles: 12, maxCycles: 130, noiseAmp: 0.13, baseCycles: 7, baseAmp: 0.16, shimmerCycles: 43, shimmerAmp: 0.25, pulseCycles: 4, pulseDepth: 0.14 });
  for (let i = 0; i < s.l.length; i++) { const p = i / s.l.length; s.l[i] += Math.sin(Math.PI * 2 * 17 * p + Math.sin(Math.PI * 2 * 3 * p) * 2) * 0.19; s.r[i] += Math.sin(Math.PI * 2 * 19 * p - Math.sin(Math.PI * 2 * 3 * p) * 2) * 0.19; } return s;
});
define("laser_beam_start", "Beams", "Military laser beam attack and lock-on.", false, () => {
  const s = sound(0.48); add(s, tone(0.46, { f0: 2400, f1: 620, wave: "saw", amp: 0.48, attack: 0.001, release: 0.14, fm: { ratio: 2, depth: 1.8 } })); add(s, transient(0.2, 6120, 180, 7500, 0.45)); return s;
});
define("laser_beam_loop", "Beams", "Steady military laser beam with power ripple; seamless.", true, () => {
  const s = loopBed(1.2, { seed: 6127, parts: 13, minCycles: 16, maxCycles: 100, noiseAmp: 0.11, baseCycles: 9, baseAmp: 0.25, shimmerCycles: 36, shimmerAmp: 0.16, pulseCycles: 6, pulseDepth: 0.1 }); return s;
});
define("laser_beam_end", "Beams", "Laser power-down and emitter snap.", false, () => {
  const s = sound(0.5); add(s, tone(0.48, { f0: 900, f1: 70, wave: "saw", amp: 0.46, attack: 0.001, release: 0.38, fm: { ratio: 2, depth: 1.3 } })); add(s, noise(0.3, { seed: 6131, amp: 0.25, lp0: 8000, lp1: 600, attack: 0.001, release: 0.24 })); return s;
});

define("barrel_roll_light", "Maneuvers", "Fast light-fighter barrel-roll whoosh.", false, () => whoosh(0.68, 7001, 420, 11000, -0.95, 0.95, 0.9));
define("barrel_roll_heavy", "Maneuvers", "Heavy aircraft barrel roll with airframe weight.", false, () => whoosh(0.92, 7007, 180, 6900, -0.9, 0.9, 1.1));
define("barrel_roll_alien", "Maneuvers", "Alien spiral roll with phase-warp tail.", false, () => {
  const s = whoosh(0.8, 7013, 520, 10500, -1, 1, 0.72); add(s, tone(0.78, { f0: 260, f1: 1800, wave: "sine", amp: 0.32, attack: 0.08, release: 0.2, pan0: -0.9, pan1: 0.9, fm: { ratio: 1.5, depth: 3.1 } })); return s;
});
define("jet_flyby", "Maneuvers", "High-speed jet pass for attack runs.", false, () => whoosh(1.45, 7020, 220, 9600, -1, 1, 1.08));
define("afterburner_kick", "Maneuvers", "Afterburner ignition punch and acceleration tail.", false, () => {
  const s = sound(1.05); add(s, transient(0.32, 7027, 65, 2600, 0.95)); add(s, noise(1.0, { seed: 7028, amp: 0.6, lp0: 1000, lp1: 7200, attack: 0.04, release: 0.18 }), 0.04); add(s, tone(0.92, { f0: 70, f1: 190, wave: "saw", amp: 0.36, attack: 0.05, release: 0.18 }), 0.05); return s;
});

function dcBlock(s) {
  for (const channel of [s.l, s.r]) {
    let xm1 = 0, ym1 = 0;
    for (let i = 0; i < channel.length; i++) { const x = channel[i], y = x - xm1 + 0.995 * ym1; xm1 = x; ym1 = y; channel[i] = y; }
  }
}

function finalize(s, loop) {
  // Loop beds are built entirely from integer-cycle periodic components. Running a
  // stateful DC blocker from a zeroed history would create a false discontinuity
  // between the final sample and sample zero, so reserve it for one-shots.
  if (!loop) dcBlock(s);
  let peak = 0, sum = 0;
  for (let i = 0; i < s.l.length; i++) {
    s.l[i] = Math.tanh(s.l[i] * 1.32); s.r[i] = Math.tanh(s.r[i] * 1.32);
    peak = Math.max(peak, Math.abs(s.l[i]), Math.abs(s.r[i])); sum += s.l[i] ** 2 + s.r[i] ** 2;
  }
  const target = loop ? 0.78 : 0.91, gain = peak > 0 ? target / peak : 1;
  for (let i = 0; i < s.l.length; i++) { s.l[i] *= gain; s.r[i] *= gain; }
  let seam = 0;
  if (loop) seam = Math.max(Math.abs(s.l[0] - s.l[s.l.length - 1]), Math.abs(s.r[0] - s.r[s.r.length - 1]));
  return { peak: target, rms: Math.sqrt(sum / Math.max(1, s.l.length * 2)) * gain, seamDelta: seam * gain };
}

function chunk(tag, data) {
  const pad = data.length & 1, out = Buffer.alloc(8 + data.length + pad);
  out.write(tag, 0, 4, "ascii"); out.writeUInt32LE(data.length, 4); data.copy(out, 8); return out;
}

function wavBuffer(s, loop) {
  const fmt = Buffer.alloc(16); fmt.writeUInt16LE(1, 0); fmt.writeUInt16LE(2, 2); fmt.writeUInt32LE(SR, 4); fmt.writeUInt32LE(SR * 4, 8); fmt.writeUInt16LE(4, 12); fmt.writeUInt16LE(16, 14);
  const pcm = Buffer.alloc(s.l.length * 4);
  for (let i = 0; i < s.l.length; i++) { pcm.writeInt16LE(Math.round(clamp(s.l[i]) * 32767), i * 4); pcm.writeInt16LE(Math.round(clamp(s.r[i]) * 32767), i * 4 + 2); }
  const chunks = [chunk("fmt ", fmt)];
  if (loop) {
    const smpl = Buffer.alloc(60); smpl.writeUInt32LE(Math.round(1e9 / SR), 8); smpl.writeUInt32LE(60, 12); smpl.writeUInt32LE(1, 28);
    smpl.writeUInt32LE(0, 36); smpl.writeUInt32LE(0, 40); smpl.writeUInt32LE(0, 44); smpl.writeUInt32LE(s.l.length - 1, 48); smpl.writeUInt32LE(0, 52); smpl.writeUInt32LE(0, 56); chunks.push(chunk("smpl", smpl));
  }
  chunks.push(chunk("data", pcm));
  const size = 4 + chunks.reduce((n, c) => n + c.length, 0), head = Buffer.alloc(12); head.write("RIFF", 0); head.writeUInt32LE(size, 4); head.write("WAVE", 8); return Buffer.concat([head, ...chunks]);
}

function silence(seconds) { return sound(seconds); }
function htmlEscape(x) { return String(x).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = { title: "Bullets of Fury — ColeSFX Preview Bank", generatedAt: new Date().toISOString(), sampleRate: SR, channels: 2, format: "16-bit PCM WAV", note: "Preview-only. No Bullets of Fury game assets were replaced.", files: [] };
  const rendered = new Map();
  for (const d of defs) {
    const s = d.build(), stats = finalize(s, d.loop), file = `${d.name}.wav`;
    fs.writeFileSync(path.join(OUT, file), wavBuffer(s, d.loop)); rendered.set(d.name, s);
    manifest.files.push({ name: d.name, file, category: d.category, description: d.description, loop: d.loop, duration: Number(s.seconds.toFixed(3)), peak: Number(stats.peak.toFixed(3)), rms: Number(stats.rms.toFixed(4)), seamDelta: Number(stats.seamDelta.toFixed(5)) });
  }

  const reelOrder = ["flamethrower_loop", "ice_breath_loop", "charge_rise", "helix_full_charge_loop", "rollerball_full_charge_loop", "tank_rocket_launch_heavy", "tank_rocket_salvo", "jet_machinegun_burst_short", "jet_machinegun_burst_long", "alien_prism_projectile", "alien_plasma_projectile", "prism_beam_loop", "laser_beam_loop", "flame_orb_launch", "flame_orb_impact", "ice_orb_launch", "ice_orb_impact", "barrel_roll_light", "barrel_roll_heavy", "barrel_roll_alien", "afterburner_kick"];
  const reelSeconds = reelOrder.reduce((n, name) => n + Math.min(2.4, rendered.get(name).seconds) + 0.28, 0);
  const reel = sound(reelSeconds); let cursor = 0;
  for (const name of reelOrder) { const src = rendered.get(name), take = Math.min(src.seconds, 2.4), clip = sound(take); clip.l.set(src.l.subarray(0, clip.l.length)); clip.r.set(src.r.subarray(0, clip.r.length)); add(reel, clip, cursor, 0.88); cursor += take + 0.28; }
  finalize(reel, false); fs.writeFileSync(path.join(OUT, "bullets_of_fury_preview_reel.wav"), wavBuffer(reel, false));

  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  const groups = [...new Set(manifest.files.map(x => x.category))];
  const sections = groups.map(group => `<section><h2>${htmlEscape(group)}</h2>${manifest.files.filter(x => x.category === group).map(x => `<article><div><strong>${htmlEscape(x.name)}</strong>${x.loop ? '<span class="loop">SEAMLESS LOOP</span>' : ''}<p>${htmlEscape(x.description)}</p><small>${x.duration.toFixed(2)}s · stereo · 48 kHz</small></div><audio controls ${x.loop ? "loop" : ""} preload="none" src="${encodeURIComponent(x.file)}"></audio></article>`).join("")}</section>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bullets of Fury SFX Preview</title><style>:root{color-scheme:dark;--hot:#ff6b35;--ice:#73e9ff;--panel:#171c29}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 50% 0,#202a45,#080a10 55%);color:#f4f7ff;font:15px system-ui,sans-serif}.wrap{max-width:1100px;margin:auto;padding:32px 18px 80px}h1{font-size:clamp(28px,5vw,52px);margin:0;color:#fff;text-shadow:0 0 24px #ff5533}header p{color:#bbc7df;max-width:750px;line-height:1.5}.notice{border:1px solid #39506d;background:#111a28;padding:12px 14px;border-radius:10px;color:#9ff3ca}h2{margin-top:38px;color:var(--ice);letter-spacing:.08em;text-transform:uppercase}article{display:grid;grid-template-columns:1fr minmax(260px,420px);gap:20px;align-items:center;background:linear-gradient(135deg,var(--panel),#10131c);border:1px solid #2b354a;border-radius:12px;padding:15px 18px;margin:9px 0;box-shadow:0 8px 22px #0005}strong{font:700 16px ui-monospace,monospace;color:#fff}.loop{font:700 10px ui-monospace,monospace;color:#07151a;background:var(--ice);padding:4px 7px;border-radius:12px;margin-left:10px}p{margin:5px 0;color:#c4ccda}small{color:#7888a3}audio{width:100%;height:38px}.reel{margin:25px 0;padding:18px;border:1px solid var(--hot);border-radius:14px;background:#1b1110}.reel audio{margin-top:10px}@media(max-width:700px){article{grid-template-columns:1fr}}</style></head><body><div class="wrap"><header><h1>BULLETS OF FURY</h1><p>ColeSFX procedural weapon-audio audition bank. Generated as a separate preview set for review before anything is wired into the game.</p><div class="notice">No existing game audio was replaced. Loop files contain WAV sampler-loop metadata and are designed for gapless repetition.</div><div class="reel"><strong>Quick preview reel</strong><p>Selected sounds in sequence.</p><audio controls preload="metadata" src="bullets_of_fury_preview_reel.wav"></audio></div></header>${sections}</div></body></html>`;
  fs.writeFileSync(path.join(OUT, "index.html"), html);
  fs.writeFileSync(path.join(OUT, "README.md"), `# Bullets of Fury — ColeSFX preview bank\n\nPreview-only procedural sound set. No existing game files were replaced.\n\n- ${defs.length} individual stereo WAV sounds\n- ${defs.filter(x => x.loop).length} seamless looping beds with WAV \`smpl\` loop metadata\n- 48 kHz, 16-bit PCM\n- Deterministic synthesis with no third-party samples\n- Open \`index.html\` to audition everything\n- \`bullets_of_fury_preview_reel.wav\` is a quick sequential sampler\n\nRegenerate from the repository root with:\n\n\`\`\`powershell\nnode .\\generate_bullets_of_fury_sfx.js\n\`\`\`\n`);
  console.log(`Generated ${defs.length} sounds (${defs.filter(x => x.loop).length} seamless loops) in ${OUT}`);
}

main();
