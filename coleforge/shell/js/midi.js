"use strict";

// ForgeMIDI: Standard MIDI File + DMX .MUS (Doom/Heretic/Hexen) parsing and a small
// General MIDI-style WebAudio synthesizer. No soundfonts needed; everything is synthesized.
(function () {
  /* ---------------- parsing ---------------- */
  // Both parsers produce: { events: [{ t, type, ch, a, b }], duration, format }
  // type: "on" (a=note,b=vel) | "off" (a=note) | "prog" (a) | "cc" (a=ctrl,b=val) | "bend" (a=-1..1)

  function parseMidi(buf) {
    const d = new DataView(buf);
    let p = 0;
    const str = (n) => { let s = ""; for (let i = 0; i < n; i++) s += String.fromCharCode(d.getUint8(p + i)); return s; };
    // RIFF-wrapped MIDI (.rmi)
    if (str(4) === "RIFF") {
      p = 12;
      while (p < d.byteLength - 8) { const id = str(4), len = d.getUint32(p + 4, true); if (id === "data") { p += 8; break; } p += 8 + len + (len & 1); }
    }
    if (str(4) !== "MThd") throw new Error("Not a MIDI file");
    const hdrLen = d.getUint32(p + 4), format = d.getUint16(p + 8), ntracks = d.getUint16(p + 10), division = d.getUint16(p + 12);
    p += 8 + hdrLen;
    const raw = [];
    let order = 0;
    for (let tr = 0; tr < ntracks && p < d.byteLength; tr++) {
      if (str(4) !== "MTrk") { p += 8 + d.getUint32(p + 4); tr--; continue; }
      const end = p + 8 + d.getUint32(p + 4);
      p += 8;
      let tick = 0, status = 0;
      const vlq = () => { let v = 0, b; do { b = d.getUint8(p++); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };
      while (p < end) {
        tick += vlq();
        let b = d.getUint8(p);
        if (b & 0x80) { status = b; p++; } // otherwise running status
        const hi = status & 0xf0, ch = status & 0x0f;
        if (status === 0xff) {
          const type = d.getUint8(p++), len = vlq();
          if (type === 0x51) raw.push({ tick, order: order++, type: "tempo", a: (d.getUint8(p) << 16) | (d.getUint8(p + 1) << 8) | d.getUint8(p + 2) });
          p += len;
          if (type === 0x2f) break;
        } else if (status === 0xf0 || status === 0xf7) {
          p += vlq();
        } else if (hi === 0x90 || hi === 0x80 || hi === 0xa0 || hi === 0xb0 || hi === 0xe0) {
          const a = d.getUint8(p++), c = d.getUint8(p++);
          if (hi === 0x90 && c > 0) raw.push({ tick, order: order++, type: "on", ch, a, b: c });
          else if (hi === 0x90 || hi === 0x80) raw.push({ tick, order: order++, type: "off", ch, a });
          else if (hi === 0xb0) raw.push({ tick, order: order++, type: "cc", ch, a, b: c });
          else if (hi === 0xe0) raw.push({ tick, order: order++, type: "bend", ch, a: (((c << 7) | a) - 8192) / 8192 });
        } else if (hi === 0xc0 || hi === 0xd0) {
          const a = d.getUint8(p++);
          if (hi === 0xc0) raw.push({ tick, order: order++, type: "prog", ch, a });
        } else {
          p++; // unknown byte: resync
        }
      }
      p = end;
    }
    raw.sort((x, y) => x.tick - y.tick || x.order - y.order);
    const events = [];
    let usPerQ = 500000, lastTick = 0, sec = 0;
    const smpte = division & 0x8000;
    const secPerTick = () => smpte ? 1 / ((256 - (division >> 8)) * (division & 0xff)) : usPerQ / 1e6 / division;
    for (const e of raw) {
      sec += (e.tick - lastTick) * secPerTick();
      lastTick = e.tick;
      if (e.type === "tempo") { usPerQ = e.a; continue; }
      events.push({ t: sec, type: e.type, ch: e.ch, a: e.a, b: e.b });
    }
    return { events, duration: sec + 1, format: "MIDI " + format };
  }

  function parseMus(buf) {
    const d = new DataView(buf);
    if (d.getUint32(0, false) !== 0x4d55531a) throw new Error("Not a MUS file");
    const len = d.getUint16(4, true), start = d.getUint16(6, true);
    const events = [];
    const lastVel = new Array(16).fill(127);
    const ctrlMap = [null, 0, 1, 7, 10, 11, 91, 93, 64, 67]; // MUS controller -> MIDI CC (0 = program change)
    const sysMap = { 10: 120, 11: 123, 12: 126, 13: 127, 14: 121 };
    const mapCh = (c) => c === 15 ? 9 : c >= 9 ? c + 1 : c;
    let p = start, ticks = 0;
    const end = Math.min(d.byteLength, start + len);
    // Doom's music driver resets every channel to full volume before playback.
    for (let c = 0; c < 16; c++) events.push({ t: 0, type: "cc", ch: c, a: 7, b: 127 });
    while (p < end) {
      const desc = d.getUint8(p++), type = (desc >> 4) & 7, ch = mapCh(desc & 15), t = ticks / 140;
      if (type === 0) events.push({ t, type: "off", ch, a: d.getUint8(p++) & 127 });
      else if (type === 1) {
        const n = d.getUint8(p++);
        if (n & 0x80) lastVel[ch] = d.getUint8(p++) & 127;
        events.push({ t, type: lastVel[ch] ? "on" : "off", ch, a: n & 127, b: lastVel[ch] });
      } else if (type === 2) events.push({ t, type: "bend", ch, a: (d.getUint8(p++) - 128) / 128 });
      else if (type === 3) { const s = d.getUint8(p++); if (sysMap[s] != null) events.push({ t, type: "cc", ch, a: sysMap[s], b: 0 }); }
      else if (type === 4) {
        const c = d.getUint8(p++), v = d.getUint8(p++) & 127;
        if (c === 0) events.push({ t, type: "prog", ch, a: v });
        else if (ctrlMap[c] != null) events.push({ t, type: "cc", ch, a: ctrlMap[c], b: v });
      } else if (type === 6) break;
      if (desc & 0x80) { let v = 0, b; do { b = d.getUint8(p++); v = v * 128 + (b & 127); } while (b & 0x80); ticks += v; }
    }
    return { events, duration: ticks / 140 + 1, format: "DMX MUS" };
  }

  function parse(buf, name = "") {
    const d = new DataView(buf);
    if (d.byteLength >= 4 && d.getUint32(0, false) === 0x4d55531a) return parseMus(buf);
    if (/\.mus$/i.test(name)) return parseMus(buf);
    return parseMidi(buf);
  }

  /* ---------------- synth ---------------- */
  const midiHz = (n) => 440 * Math.pow(2, (n - 69) / 12);

  class MidiPlayer {
    constructor(ctx, dest) {
      this.ctx = ctx;
      this.out = ctx.createGain();
      this.out.gain.value = 0.55;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.out.connect(comp).connect(dest);
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const ch = this.noise.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      this.dist = ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 6); }
      this.dist.curve = curve;
      this.song = null; this.playing = false; this.offset = 0; this.onended = null;
      this.resetChannels();
    }
    resetChannels() {
      this.chans = Array.from({ length: 16 }, () => ({ prog: 0, vol: 100 / 127, expr: 1, pan: 0, bend: 0, sustain: false, held: [] }));
      this.voices = new Map();
      this.voiceCount = 0;
    }
    load(song) { this.stop(); this.song = song; this.offset = 0; }
    get duration() { return this.song ? this.song.duration : 0; }
    get currentTime() { return this.playing ? Math.min(this.duration, this.ctx.currentTime - this.startAt) : this.offset; }
    play() {
      if (!this.song || this.playing) return;
      this.chase(this.offset);
      this.startAt = this.ctx.currentTime + 0.05 - this.offset;
      this.idx = this.song.events.findIndex(e => e.t >= this.offset);
      if (this.idx < 0) this.idx = this.song.events.length;
      this.playing = true;
      this.timer = setInterval(() => this.pump(), 25);
      this.pump();
    }
    pause() { if (!this.playing) return; this.offset = this.currentTime; this.halt(); }
    stop() { this.halt(); this.offset = 0; }
    seek(t) { const was = this.playing; this.halt(); this.offset = Math.max(0, Math.min(t, this.duration)); if (was) this.play(); }
    halt() {
      this.playing = false;
      clearInterval(this.timer);
      const now = this.ctx.currentTime;
      for (const list of this.voices.values()) for (const v of list) this.kill(v, now, 0.03);
      this.voices.clear(); this.voiceCount = 0;
    }
    chase(t) {
      this.resetChannels();
      for (const e of this.song.events) { if (e.t >= t) break; if (e.type !== "on" && e.type !== "off") this.apply(e, this.ctx.currentTime); }
    }
    pump() {
      const ev = this.song.events, horizon = this.ctx.currentTime + 0.15;
      while (this.idx < ev.length && this.startAt + ev[this.idx].t < horizon) {
        const e = ev[this.idx++];
        this.apply(e, Math.max(this.ctx.currentTime, this.startAt + e.t));
      }
      if (this.idx >= ev.length && this.ctx.currentTime > this.startAt + this.duration) {
        this.stop();
        if (this.onended) this.onended();
      }
    }
    apply(e, when) {
      const c = this.chans[e.ch];
      switch (e.type) {
        case "on": this.noteOn(e.ch, e.a, e.b, when); break;
        case "off": this.noteOff(e.ch, e.a, when); break;
        case "prog": c.prog = e.a; break;
        case "bend":
          c.bend = e.a * 2;
          for (const [k, list] of this.voices) if ((k >> 7) === e.ch) for (const v of list) v.oscs.forEach(o => o.detune && o.detune.setValueAtTime(c.bend * 100, when));
          break;
        case "cc":
          if (e.a === 7) c.vol = e.b / 127;
          else if (e.a === 11) c.expr = e.b / 127;
          else if (e.a === 10) c.pan = (e.b - 64) / 64;
          else if (e.a === 64) { c.sustain = e.b >= 64; if (!c.sustain) { c.held.forEach(n => this.noteOff(e.ch, n, when)); c.held = []; } }
          else if (e.a === 120 || e.a === 123) { for (const [k, list] of this.voices) if ((k >> 7) === e.ch) { list.forEach(v => this.kill(v, when, 0.05)); this.voices.delete(k); } }
          else if (e.a === 121) Object.assign(c, { vol: 100 / 127, expr: 1, pan: 0, bend: 0, sustain: false });
          break;
      }
    }
    kill(v, when, rel) {
      try {
        v.gain.gain.cancelScheduledValues(when);
        v.gain.gain.setTargetAtTime(0, when, rel / 3);
        v.oscs.forEach(o => o.stop(when + rel + 0.05));
      } catch { /* already stopped */ }
      if (!v.dead) { v.dead = true; this.voiceCount--; }
    }
    noteOff(ch, note, when) {
      const c = this.chans[ch];
      if (c.sustain) { c.held.push(note); return; }
      const key = (ch << 7) | note, list = this.voices.get(key);
      if (!list || !list.length) return;
      const v = list.shift();
      if (!list.length) this.voices.delete(key);
      if (ch === 9) { if (!v.dead) { v.dead = true; this.voiceCount--; } return; } // drums ring out on their own
      this.kill(v, when, v.release);
    }
    noteOn(ch, note, vel, when) {
      if (this.voiceCount > 72) { // voice stealing: drop the oldest sounding note
        const first = this.voices.entries().next().value;
        if (first) { const [k, list] = first; this.kill(list.shift(), when, 0.02); if (!list.length) this.voices.delete(k); }
      }
      const ctx = this.ctx, c = this.chans[ch];
      const amp = (vel / 127) ** 1.6 * c.vol * c.expr;
      if (amp <= 0) return;
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      if (pan) { pan.pan.value = c.pan; gain.connect(pan).connect(this.out); } else gain.connect(this.out);
      const v = ch === 9 ? this.drum(note, amp, when, gain) : this.tone(c, note, amp, when, gain);
      if (!v) return;
      const key = (ch << 7) | note;
      if (!this.voices.has(key)) this.voices.set(key, []);
      this.voices.get(key).push(v);
      this.voiceCount++;
    }
    osc(type, freq, when, detune = 0) {
      const o = this.ctx.createOscillator();
      o.type = type; o.frequency.value = freq; o.detune.value = detune;
      o.start(when);
      return o;
    }
    tone(c, note, amp, when, gain) {
      const ctx = this.ctx, fam = c.prog >> 3, f = midiHz(note), det = c.bend * 100;
      const g = gain.gain;
      let oscs = [], release = 0.25, target = gain;
      const env = (a, peak, decay, sustainLvl) => {
        g.setValueAtTime(0, when); g.linearRampToValueAtTime(peak, when + a);
        g.setTargetAtTime(peak * sustainLvl, when + a, decay);
      };
      const filt = (type, freq, q = 0.7) => { const bq = ctx.createBiquadFilter(); bq.type = type; bq.frequency.value = freq; bq.Q.value = q; bq.connect(gain); return bq; };
      switch (fam) {
        case 0: target = filt("lowpass", 5000); oscs = [this.osc("triangle", f, when, det), this.osc("sine", f * 2, when, det)]; env(0.005, amp * 0.5, 0.6, 0.15); release = 0.3; break;
        case 1: target = gain; oscs = [this.osc("sine", f, when, det), this.osc("sine", f * 3.5, when, det)]; env(0.002, amp * 0.45, 0.35, 0.05); release = 0.5; break;
        case 2: target = gain; oscs = [this.osc("square", f, when, det), this.osc("sine", f * 2, when, det)]; env(0.01, amp * 0.18, 0.1, 1); release = 0.08; break;
        case 3: {
          const dist = c.prog >= 29 && c.prog <= 31;
          if (dist) { const pre = ctx.createGain(); pre.gain.value = 1.4; pre.connect(this.makeDist(gain)); target = pre; oscs = [this.osc("sawtooth", f, when, det), this.osc("sawtooth", f, when, det + 8)]; env(0.004, amp * 0.18, 0.8, 0.7); release = 0.12; }
          else { target = filt("lowpass", 2600); oscs = [this.osc("sawtooth", f, when, det)]; env(0.003, amp * 0.35, 0.3, 0.12); release = 0.2; }
          break;
        }
        case 4: target = filt("lowpass", 900); oscs = [this.osc("triangle", f, when, det), this.osc("sine", f / 2, when, det)]; env(0.004, amp * 0.6, 0.4, 0.55); release = 0.1; break;
        case 5: case 6: target = filt("lowpass", 2200); oscs = [this.osc("sawtooth", f, when, det - 6), this.osc("sawtooth", f, when, det + 6)]; env(0.12, amp * 0.18, 0.4, 0.85); release = 0.4; break;
        case 7: target = filt("lowpass", 2400, 1.2); oscs = [this.osc("sawtooth", f, when, det)]; env(0.04, amp * 0.28, 0.3, 0.75); release = 0.15; break;
        case 8: target = filt("lowpass", 3000); oscs = [this.osc("square", f, when, det)]; env(0.03, amp * 0.16, 0.3, 0.8); release = 0.1; break;
        case 9: target = gain; oscs = [this.osc("sine", f, when, det), this.osc("triangle", f * 2, when, det)]; env(0.05, amp * 0.3, 0.3, 0.85); release = 0.15; break;
        case 10: target = filt("lowpass", 4200); oscs = [this.osc(c.prog % 2 ? "sawtooth" : "square", f, when, det)]; env(0.005, amp * 0.2, 0.3, 0.8); release = 0.1; break;
        case 11: target = filt("lowpass", 1600); oscs = [this.osc("sawtooth", f, when, det - 9), this.osc("sawtooth", f, when, det + 9), this.osc("triangle", f / 2, when, det)]; env(0.35, amp * 0.14, 0.6, 0.9); release = 0.8; break;
        case 12: target = filt("bandpass", 1800, 2); oscs = [this.osc("sawtooth", f, when, det)]; env(0.1, amp * 0.25, 0.5, 0.6); release = 0.6; break;
        case 13: target = filt("lowpass", 3000); oscs = [this.osc("triangle", f, when, det)]; env(0.002, amp * 0.5, 0.25, 0.05); release = 0.3; break;
        case 14: target = gain; oscs = [this.osc("sine", f, when, det)]; g.setValueAtTime(amp * 0.6, when); g.exponentialRampToValueAtTime(0.001, when + 0.35); release = 0.1; break;
        default: {
          const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true; src.start(when);
          const bp = filt("bandpass", f * 4, 1.5); src.connect(bp); env(0.02, amp * 0.3, 0.3, 0.5);
          return { oscs: [src], gain, release: 0.2 };
        }
      }
      oscs.forEach(o => o.connect(target));
      return { oscs, gain, release };
    }
    makeDist(dest) {
      const ws = this.ctx.createWaveShaper();
      ws.curve = this.dist.curve;
      const lp = this.ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3400;
      ws.connect(lp).connect(dest);
      return ws;
    }
    drum(note, amp, when, gain) {
      const ctx = this.ctx, g = gain.gain;
      const noise = (hp, dur, level) => {
        const src = ctx.createBufferSource(); src.buffer = this.noise;
        const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp;
        src.connect(f).connect(gain); src.start(when, Math.random() * 0.5); src.stop(when + dur + 0.05);
        g.setValueAtTime(level, when); g.exponentialRampToValueAtTime(0.001, when + dur);
        return src;
      };
      const thump = (f0, f1, dur, level) => {
        const o = ctx.createOscillator(); o.type = "sine";
        o.frequency.setValueAtTime(f0, when); o.frequency.exponentialRampToValueAtTime(f1, when + dur);
        const og = ctx.createGain(); og.gain.setValueAtTime(level, when); og.gain.exponentialRampToValueAtTime(0.001, when + dur);
        o.connect(og).connect(gain); o.start(when); o.stop(when + dur + 0.05);
        g.setValueAtTime(1, when);
        return o;
      };
      let oscs;
      if (note === 35 || note === 36) oscs = [thump(150, 42, 0.32, amp * 1.1)];
      else if (note === 38 || note === 40 || note === 37 || note === 39) { oscs = [noise(1500, 0.18, amp * 0.55)]; const t = ctx.createOscillator(); t.frequency.value = 190; const tg = ctx.createGain(); tg.gain.setValueAtTime(amp * 0.4, when); tg.gain.exponentialRampToValueAtTime(0.001, when + 0.1); t.connect(tg).connect(this.out); t.start(when); t.stop(when + 0.15); oscs.push(t); }
      else if (note === 42 || note === 44) oscs = [noise(7000, 0.05, amp * 0.3)];
      else if (note === 46) oscs = [noise(6500, 0.3, amp * 0.28)];
      else if (note === 49 || note === 57 || note === 52 || note === 55) oscs = [noise(4000, 1.3, amp * 0.3)];
      else if (note === 51 || note === 59 || note === 53) oscs = [noise(5500, 0.6, amp * 0.18)];
      else if (note >= 41 && note <= 50) oscs = [thump(midiHz(note + 12), midiHz(note), 0.3, amp * 0.8)];
      else oscs = [noise(3000, 0.08, amp * 0.3)];
      return { oscs, gain, release: 0.05 };
    }
  }

  window.ForgeMIDI = { parse, parseMidi, parseMus, MidiPlayer };
})();
