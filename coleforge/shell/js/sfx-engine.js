"use strict";

// SFXEngine: retro game sound effects from a handful of numbers, in the spirit of the classic sfxr
// family (written from scratch for ColeForge). One oscillator (square, saw, sine, noise or triangle)
// with a pitch slide, vibrato, arpeggio jump, duty sweep, retrigger, a flanger and swept low/high-pass
// filters, shaped by an attack / sustain / punch / decay envelope. Used by SFX Lab and by Albert's
// make_sound tool.
//
//   const p = SFXEngine.preset("laser", 42);          // a random laser from seed 42
//   const samples = SFXEngine.render(p);              // Float32Array, 44.1 kHz mono
//   const wav = SFXEngine.wav(samples);               // Uint8Array, 16-bit PCM .wav
//   SFXEngine.play(samples);
(function (root) {
  const WAVES = ["square", "saw", "sine", "noise", "triangle"];
  // Every parameter: [default, min, max, label, group]
  const PARAMS = {
    wave: [0, 0, 4, "Wave", "Wave"],
    attack: [0, 0, 1, "Attack", "Envelope"], sustain: [0.3, 0, 1, "Sustain", "Envelope"], punch: [0, 0, 1, "Punch", "Envelope"], decay: [0.4, 0, 1, "Decay", "Envelope"],
    freq: [0.3, 0, 1, "Start pitch", "Pitch"], freqMin: [0, 0, 1, "Min pitch", "Pitch"], slide: [0, -1, 1, "Slide", "Pitch"], deltaSlide: [0, -1, 1, "Slide change", "Pitch"],
    vibDepth: [0, 0, 1, "Vibrato depth", "Vibrato"], vibSpeed: [0, 0, 1, "Vibrato speed", "Vibrato"],
    arpMod: [0, -1, 1, "Jump amount", "Arpeggio"], arpSpeed: [0, 0, 1, "Jump speed", "Arpeggio"],
    duty: [0, 0, 1, "Square duty", "Duty"], dutySweep: [0, -1, 1, "Duty sweep", "Duty"],
    repeat: [0, 0, 1, "Repeat speed", "Retrigger"],
    phaserOffset: [0, -1, 1, "Flanger offset", "Flanger"], phaserSweep: [0, -1, 1, "Flanger sweep", "Flanger"],
    lpf: [1, 0, 1, "Low-pass cutoff", "Filters"], lpfSweep: [0, -1, 1, "Low-pass sweep", "Filters"], lpfRes: [0, 0, 1, "Low-pass resonance", "Filters"],
    hpf: [0, 0, 1, "High-pass cutoff", "Filters"], hpfSweep: [0, -1, 1, "High-pass sweep", "Filters"],
    volume: [0.5, 0, 1, "Volume", "Output"],
  };
  const RATE = 44100;

  function defaults() { const p = {}; for (const [k, v] of Object.entries(PARAMS)) p[k] = v[0]; return p; }
  function clean(p) {
    const out = defaults();
    for (const [k, [, lo, hi]] of Object.entries(PARAMS)) {
      let v = p?.[k];
      if (k === "wave" && typeof v === "string") v = WAVES.indexOf(v.toLowerCase());
      if (typeof v === "number" && isFinite(v)) out[k] = k === "wave" ? Math.max(0, Math.min(4, Math.round(v))) : Math.max(lo, Math.min(hi, v));
    }
    return out;
  }

  // A small seeded random number generator (mulberry32), so presets are reproducible.
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  const PRESETS = {
    pickup(r) { const p = defaults(); p.wave = r() < 0.5 ? 0 : 1; p.freq = 0.4 + r() * 0.5; p.sustain = r() * 0.1; p.decay = 0.1 + r() * 0.4; p.punch = 0.3 + r() * 0.3;
      if (r() < 0.5) { p.arpSpeed = 0.5 + r() * 0.2; p.arpMod = 0.2 + r() * 0.4; } return p; },
    laser(r) { const p = defaults(); p.wave = Math.floor(r() * 3); if (p.wave === 2 && r() < 0.5) p.wave = Math.floor(r() * 2);
      p.freq = 0.5 + r() * 0.5; p.freqMin = Math.max(0.2, p.freq - 0.2 - r() * 0.6); p.slide = -0.15 - r() * 0.2;
      if (r() < 0.33) { p.freq = 0.3 + r() * 0.6; p.freqMin = r() * 0.1; p.slide = -0.35 - r() * 0.3; }
      if (r() < 0.5) { p.duty = r() * 0.5; p.dutySweep = r() * 0.2; } else { p.duty = 0.4 + r() * 0.5; p.dutySweep = -r() * 0.7; }
      p.sustain = 0.1 + r() * 0.2; p.decay = r() * 0.4; if (r() < 0.5) p.punch = r() * 0.3;
      if (r() < 0.33) { p.phaserOffset = r() * 0.2; p.phaserSweep = -r() * 0.2; } if (r() < 0.5) p.hpf = r() * 0.3; return p; },
    explosion(r) { const p = defaults(); p.wave = 3;
      if (r() < 0.5) { p.freq = 0.1 + r() * 0.4; p.slide = -0.1 + r() * 0.4; } else { p.freq = 0.2 + r() * 0.7; p.slide = -0.2 - r() * 0.2; }
      p.freq *= p.freq; if (r() < 0.2) p.slide = 0; if (r() < 0.33) p.repeat = 0.3 + r() * 0.5;
      p.sustain = 0.1 + r() * 0.3; p.decay = r() * 0.5; p.punch = 0.2 + r() * 0.6;
      if (r() < 0.5) { p.phaserOffset = -0.3 + r() * 0.9; p.phaserSweep = -r() * 0.3; }
      if (r() < 0.33) { p.vibDepth = r() * 0.7; p.vibSpeed = r() * 0.6; } if (r() < 0.33) { p.arpSpeed = 0.6 + r() * 0.3; p.arpMod = 0.8 - r() * 1.6; } return p; },
    powerup(r) { const p = defaults();
      if (r() < 0.5) p.wave = 1; else p.duty = r() * 0.6;
      if (r() < 0.5) { p.freq = 0.2 + r() * 0.3; p.slide = 0.1 + r() * 0.4; p.repeat = 0.4 + r() * 0.4; }
      else { p.freq = 0.2 + r() * 0.3; p.slide = 0.05 + r() * 0.2; if (r() < 0.5) { p.vibDepth = r() * 0.7; p.vibSpeed = r() * 0.6; } }
      p.sustain = r() * 0.4; p.decay = 0.1 + r() * 0.4; return p; },
    hit(r) { const p = defaults(); p.wave = Math.floor(r() * 3); if (p.wave === 2) p.wave = 3; if (p.wave === 0) p.duty = r() * 0.6;
      p.freq = 0.2 + r() * 0.6; p.slide = -0.3 - r() * 0.4; p.sustain = r() * 0.1; p.decay = 0.1 + r() * 0.2; if (r() < 0.5) p.hpf = r() * 0.3; return p; },
    jump(r) { const p = defaults(); p.wave = 0; p.duty = r() * 0.6; p.freq = 0.3 + r() * 0.3; p.slide = 0.1 + r() * 0.2;
      p.sustain = 0.1 + r() * 0.3; p.decay = 0.1 + r() * 0.2; if (r() < 0.5) p.hpf = r() * 0.3; if (r() < 0.5) p.lpf = 1 - r() * 0.6; return p; },
    blip(r) { const p = defaults(); p.wave = Math.floor(r() * 2); if (p.wave === 0) p.duty = r() * 0.6;
      p.freq = 0.2 + r() * 0.4; p.sustain = 0.1 + r() * 0.1; p.decay = r() * 0.2; p.hpf = 0.1; return p; },
    random(r) { const p = defaults(); const s = (a, b) => a + r() * (b - a);
      p.wave = Math.floor(r() * 5); p.freq = Math.pow(s(-1, 1), 2); if (r() < 0.5) p.freq = Math.pow(s(-1, 1), 3) + 0.5; p.freqMin = 0;
      p.slide = Math.pow(s(-1, 1), 5); if (p.freq > 0.7 && p.slide > 0.2) p.slide = -p.slide; if (p.freq < 0.2 && p.slide < -0.05) p.slide = -p.slide;
      p.deltaSlide = Math.pow(s(-1, 1), 3); p.duty = s(-1, 1); p.dutySweep = Math.pow(s(-1, 1), 3); p.vibDepth = Math.pow(s(-1, 1), 3); p.vibSpeed = s(-1, 1);
      p.attack = Math.pow(s(-1, 1), 3); p.sustain = Math.pow(s(-1, 1), 2); p.decay = s(-1, 1); p.punch = Math.pow(r() * 0.8, 2);
      if (p.attack + p.sustain + p.decay < 0.2) { p.sustain += 0.2 + r() * 0.3; p.decay += 0.2 + r() * 0.3; }
      p.lpfRes = s(-1, 1); p.lpf = 1 - Math.pow(r(), 3); p.lpfSweep = Math.pow(s(-1, 1), 3); if (p.lpf < 0.1 && p.lpfSweep < -0.05) p.lpfSweep = -p.lpfSweep;
      p.hpf = Math.pow(r(), 5); p.hpfSweep = Math.pow(s(-1, 1), 5); p.phaserOffset = Math.pow(s(-1, 1), 3); p.phaserSweep = Math.pow(s(-1, 1), 3);
      p.repeat = s(-1, 1); p.arpSpeed = s(-1, 1); p.arpMod = s(-1, 1); return clean(p); },
  };
  const PRESET_NAMES = { pickup: "Pickup / coin", laser: "Laser / shoot", explosion: "Explosion", powerup: "Power-up", hit: "Hit / hurt", jump: "Jump", blip: "Blip / select", random: "Random" };

  function preset(name, seed = Date.now()) {
    const fn = PRESETS[name] || PRESETS.random;
    return clean(Object.assign(fn(rng(seed)), { volume: 0.5 }));
  }
  function mutate(p, seed = Date.now(), amount = 0.05) {
    const r = rng(seed), out = Object.assign({}, p);
    for (const k of Object.keys(PARAMS)) if (k !== "wave" && k !== "volume" && r() < 0.5) out[k] += (r() * 2 - 1) * amount;
    return clean(out);
  }

  // The synthesizer: 8x supersampled, like the originals, so slides and filters stay smooth.
  function render(input, { rate = RATE, maxSeconds = 4 } = {}) {
    const p = clean(input);
    let period, maxPeriod, slide, dSlide, squareDuty, dutySlide, arpMul, arpLimit, arpTime, repeatTime;
    let fltp = 0, fltdp = 0, fltw, fltwd, fltdmp, fltphp = 0, flthp, flthpd, vibPhase, vibSpeed, vibAmp;
    let phaserBuf = new Float32Array(1024), phaserPos = 0, fphase, fdphase, iphase;
    const noise = new Float32Array(32), fillNoise = () => { for (let i = 0; i < 32; i++) noise[i] = Math.random() * 2 - 1; };
    const repeatLimit = p.repeat === 0 ? 0 : Math.floor(Math.pow(1 - p.repeat, 2) * 20000 + 32);
    function reset(restart) {
      period = 100 / (p.freq * p.freq + 0.001);
      maxPeriod = 100 / (p.freqMin * p.freqMin + 0.001);
      slide = 1 - Math.pow(p.slide, 3) * 0.01;
      dSlide = -Math.pow(p.deltaSlide, 3) * 0.000001;
      squareDuty = 0.5 - p.duty * 0.5;
      dutySlide = -p.dutySweep * 0.00005;
      arpMul = p.arpMod >= 0 ? 1 - Math.pow(p.arpMod, 2) * 0.9 : 1 + Math.pow(p.arpMod, 2) * 10;
      arpTime = 0;
      arpLimit = p.arpSpeed === 1 ? 0 : Math.floor(Math.pow(1 - p.arpSpeed, 2) * 20000 + 32);
      if (!restart) {
        fltw = Math.pow(p.lpf, 3) * 0.1; fltwd = 1 + p.lpfSweep * 0.0001;
        fltdmp = Math.min(0.8, 5 / (1 + Math.pow(p.lpfRes, 2) * 20) * (0.01 + fltw));
        flthp = Math.pow(p.hpf, 2) * 0.1; flthpd = 1 + p.hpfSweep * 0.0003;
        vibPhase = 0; vibSpeed = Math.pow(p.vibSpeed, 2) * 0.01; vibAmp = p.vibDepth * 0.5;
        fphase = Math.pow(p.phaserOffset, 2) * 1020 * Math.sign(p.phaserOffset);
        fdphase = Math.pow(p.phaserSweep, 2) * Math.sign(p.phaserSweep);
        iphase = Math.abs(Math.floor(fphase));
        fillNoise();
        repeatTime = 0;
      }
    }
    reset(false);
    const envLen = [Math.pow(p.attack, 2) * 100000, Math.pow(p.sustain, 2) * 100000, Math.pow(p.decay, 2) * 100000].map((v) => Math.max(1, Math.floor(v)));
    const total = Math.min(envLen[0] + envLen[1] + envLen[2], rate === RATE ? maxSeconds * RATE : maxSeconds * RATE);
    const step = RATE / rate;                                 // for lower sample rates, average source samples
    const out = new Float32Array(Math.ceil(total / step));
    let envStage = 0, envTime = 0, phase = 0, acc = 0, accN = 0, o = 0;
    for (let t = 0; t < total; t++) {
      if (repeatLimit && ++repeatTime >= repeatLimit) { repeatTime = 0; reset(true); }
      if (arpLimit && ++arpTime >= arpLimit) { arpLimit = 0; period *= arpMul; }
      slide += dSlide; period *= slide;
      if (period > maxPeriod) { period = maxPeriod; if (p.freqMin > 0) break; }
      let rperiod = period;
      if (vibAmp > 0) { vibPhase += vibSpeed; rperiod = period * (1 + Math.sin(vibPhase) * vibAmp); }
      const iperiod = Math.max(8, Math.floor(rperiod));
      squareDuty = Math.min(0.5, Math.max(0, squareDuty + dutySlide));
      if (++envTime > envLen[envStage]) { envTime = 0; if (++envStage > 2) break; }
      const f = envTime / envLen[envStage];
      const env = envStage === 0 ? f : envStage === 1 ? 1 + Math.pow(1 - f, 1) * 2 * p.punch : 1 - f;
      fphase += fdphase; iphase = Math.min(1023, Math.abs(Math.floor(fphase)));
      if (flthpd !== 0) { flthp = Math.min(0.1, Math.max(0.00001, flthp * flthpd)); }
      let ssample = 0;
      for (let si = 0; si < 8; si++) {
        phase++;
        if (phase >= iperiod) { phase %= iperiod; if (p.wave === 3) fillNoise(); }
        const fp = phase / iperiod;
        let s;
        switch (p.wave) {
          case 0: s = fp < squareDuty ? 0.5 : -0.5; break;
          case 1: s = 1 - fp * 2; break;
          case 2: s = Math.sin(fp * 2 * Math.PI); break;
          case 3: s = noise[Math.floor(phase * 32 / iperiod) % 32]; break;
          default: s = Math.abs(1 - fp * 2) * 2 - 1;
        }
        // low-pass (resonant) then high-pass
        const pp = fltp;
        fltw = Math.min(0.1, Math.max(0, fltw * fltwd));
        if (p.lpf !== 1) { fltdp += (s - fltp) * fltw; fltdp -= fltdp * fltdmp; } else { fltp = s; fltdp = 0; }
        fltp += fltdp;
        fltphp += fltp - pp; fltphp -= fltphp * flthp;
        s = fltphp;
        // flanger
        phaserBuf[phaserPos & 1023] = s;
        s += phaserBuf[(phaserPos - iphase + 1024) & 1023];
        phaserPos = (phaserPos + 1) & 1023;
        ssample += s * env;
      }
      ssample = ssample / 8 * p.volume * 0.5;
      acc += ssample; accN++;
      if (accN >= step) { out[o++] = Math.tanh(acc / accN); acc = 0; accN = 0; }       // soft clip: loud blasts stay round
    }
    return out.subarray(0, o);
  }

  function wav(samples, { rate = RATE, bits = 16 } = {}) {
    const bytes = bits / 8, n = samples.length, buf = new ArrayBuffer(44 + n * bytes), v = new DataView(buf);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, "RIFF"); v.setUint32(4, 36 + n * bytes, true); str(8, "WAVE"); str(12, "fmt "); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * bytes, true);
    v.setUint16(32, bytes, true); v.setUint16(34, bits, true); str(36, "data"); v.setUint32(40, n * bytes, true);
    for (let i = 0; i < n; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      if (bits === 16) v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); else v.setUint8(44 + i, Math.round((s + 1) * 127.5));
    }
    return new Uint8Array(buf);
  }

  let ctx = null, playing = null;
  function play(samples, rate = RATE) {
    if (!samples.length) return;
    ctx = ctx || new (root.AudioContext || root.webkitAudioContext)();
    ctx.resume?.();
    const b = ctx.createBuffer(1, samples.length, rate);
    b.copyToChannel(samples, 0);
    try { playing?.stop(); } catch { /* already done */ }
    const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start();
    playing = s;
  }

  root.SFXEngine = { PARAMS, WAVES, PRESET_NAMES, RATE, defaults, clean, preset, mutate, render, wav, play };
  if (typeof module !== "undefined") module.exports = root.SFXEngine;
})(typeof window !== "undefined" ? window : globalThis);
