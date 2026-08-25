#!/usr/bin/env python3
"""Build a non-destructive Bullets of Fury style-matched SFX audition bank.

The current shipping sound bank is used as read-only source material and as the
spectral/loudness reference. Outputs are new composites and variations written
only to SFXGenerator/generated/bullets-of-fury-style-matched-v3.
"""

from __future__ import annotations

import html
import json
import math
import os
import struct
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal


SR = 44100
HERE = Path(__file__).resolve().parent
REFERENCE = Path(os.environ.get(
    "BOF_SOUND_BANK",
    HERE.parent / "BulletsOfFury" / "assets" / "game" / "sounds",
))
OUT = HERE / "generated" / "bullets-of-fury-style-matched-v3"
PEAK = 10 ** (-3.0 / 20.0)
RNG = np.random.default_rng(0xB0F2026)
_CACHE: dict[str, np.ndarray] = {}


def load(name: str) -> np.ndarray:
    if name not in _CACHE:
        data, rate = sf.read(REFERENCE / name, always_2d=True, dtype="float32")
        mono = np.mean(data, axis=1)
        if rate != SR:
            mono = signal.resample_poly(mono, SR, rate)
        _CACHE[name] = mono.astype(np.float32)
    return _CACHE[name].copy()


def seconds(x: np.ndarray) -> float:
    return len(x) / SR


def fit(x: np.ndarray, duration: float, tile: bool = False) -> np.ndarray:
    n = max(1, round(duration * SR))
    if len(x) >= n:
        return x[:n].copy()
    if tile and len(x):
        return np.tile(x, math.ceil(n / len(x)))[:n].astype(np.float32)
    y = np.zeros(n, np.float32)
    y[: len(x)] = x
    return y


def speed(x: np.ndarray, factor: float) -> np.ndarray:
    if factor <= 0:
        raise ValueError("speed factor must be positive")
    pos = np.arange(0, len(x), factor, dtype=np.float64)
    return np.interp(pos, np.arange(len(x)), x).astype(np.float32)


def reverse(x: np.ndarray) -> np.ndarray:
    return x[::-1].copy()


def filt(x: np.ndarray, kind: str, cutoff, order: int = 4) -> np.ndarray:
    ny = SR * 0.5
    if isinstance(cutoff, tuple):
        wn = [max(20, cutoff[0]) / ny, min(ny - 100, cutoff[1]) / ny]
    else:
        wn = min(ny - 100, max(20, cutoff)) / ny
    sos = signal.butter(order, wn, btype=kind, output="sos")
    return signal.sosfilt(sos, x).astype(np.float32)


def lowpass(x: np.ndarray, hz: float) -> np.ndarray:
    return filt(x, "lowpass", hz)


def highpass(x: np.ndarray, hz: float) -> np.ndarray:
    return filt(x, "highpass", hz)


def bandpass(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    return filt(x, "bandpass", (lo, hi))


def fade(x: np.ndarray, attack: float = 0.002, release: float = 0.08) -> np.ndarray:
    y = x.copy()
    a = min(len(y), round(attack * SR))
    r = min(len(y), round(release * SR))
    if a > 1:
        y[:a] *= np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    if r > 1:
        y[-r:] *= np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    return y


def envelope(x: np.ndarray, points: list[tuple[float, float]]) -> np.ndarray:
    n = len(x)
    xp = np.array([max(0, min(n - 1, round(t * SR))) for t, _ in points])
    fp = np.array([v for _, v in points])
    env = np.interp(np.arange(n), xp, fp)
    return (x * env).astype(np.float32)


def mix(duration: float, *layers) -> np.ndarray:
    y = np.zeros(max(1, round(duration * SR)), np.float32)
    for layer in layers:
        if len(layer) == 2:
            x, gain = layer
            offset = 0.0
        else:
            x, gain, offset = layer
        start = max(0, round(offset * SR))
        n = min(len(x), len(y) - start)
        if n > 0:
            y[start : start + n] += x[:n] * gain
    return y


def make_loop(x: np.ndarray, duration: float, crossfade: float = 0.12) -> np.ndarray:
    n = max(1, round(duration * SR))
    source = fit(x, duration, tile=True)
    y = source[:n].copy()
    f = min(round(crossfade * SR), n // 3)
    if f > 2:
        theta = np.linspace(0, np.pi / 2, f)
        tail = y[-f:].copy()
        head = y[:f].copy()
        y[-f:] = tail * np.cos(theta) ** 2 + head * np.sin(theta) ** 2
        y[-1] = y[0]
    return y


def noise(duration: float, lo: float, hi: float, seed: int, attack=0.002, release=0.08) -> np.ndarray:
    random = np.random.default_rng(seed)
    x = random.standard_normal(max(1, round(duration * SR))).astype(np.float32)
    if lo > 20 and hi < SR * 0.48:
        x = bandpass(x, lo, hi)
    elif lo > 20:
        x = highpass(x, lo)
    elif hi < SR * 0.48:
        x = lowpass(x, hi)
    return fade(x, attack, release)


def tone(duration: float, f0: float, f1: float | None = None, harmonics=(1.0,), attack=0.002, release=0.08) -> np.ndarray:
    n = max(1, round(duration * SR))
    t = np.arange(n) / SR
    f1 = f0 if f1 is None else f1
    freq = f0 * np.power(max(0.001, f1 / f0), t / max(duration, 1 / SR))
    phase = np.cumsum(freq) / SR
    x = np.zeros(n, np.float32)
    for h, amp in enumerate(harmonics, 1):
        x += np.sin(2 * np.pi * phase * h).astype(np.float32) * float(amp)
    return fade(x, attack, release)


def impact(duration: float, seed: int, body=95.0, brightness=2200.0) -> np.ndarray:
    return mix(
        duration,
        (noise(duration, 35, brightness, seed, 0.001, duration * 0.72), 0.7),
        (tone(duration * 0.72, body * 1.7, body * 0.55, (1.0, 0.3), 0.001, duration * 0.55), 0.8),
    )


def shot(seed: int, pitch=1.0, heavy=False) -> np.ndarray:
    base = speed(load("nsp_bof2_shot.mp3"), 1 / pitch)
    enemy = speed(load("enemyShoot.mp3"), 0.9 / pitch)
    click = speed(load("hit.mp3"), 1.15 / pitch)
    dur = 0.145 if not heavy else 0.18
    return mix(dur, (base, 0.78), (enemy, 0.33), (click, 0.24), (impact(0.11, seed, 155 if heavy else 210, 4300), 0.28))


def burst(duration: float, seed: int, rate: float, heavy=False) -> np.ndarray:
    random = np.random.default_rng(seed)
    layers = []
    for i, at in enumerate(np.arange(0, duration - 0.08, 1 / rate)):
        layers.append((shot(seed + i * 37, (0.96 + random.random() * 0.08) * (0.88 if heavy else 1.05), heavy), 0.72 + random.random() * 0.15, float(at)))
    return mix(duration, *layers)


def master(x: np.ndarray, loop: bool, target_rms: float | None = None) -> np.ndarray:
    y = np.asarray(x, np.float32).copy()
    y -= np.mean(y)
    if not loop:
        y = highpass(y, 24)
    y = np.tanh(y * 1.08).astype(np.float32)
    peak = float(np.max(np.abs(y))) if len(y) else 0
    if peak:
        y *= PEAK / peak
    if target_rms is not None:
        target = 10 ** (target_rms / 20)
        for gamma in np.linspace(0.98, 0.64, 10):
            z = np.sign(y) * np.abs(y) ** gamma
            zp = np.max(np.abs(z))
            if zp:
                z *= PEAK / zp
            if np.sqrt(np.mean(z * z)) >= target:
                y = z.astype(np.float32)
                break
    if loop:
        y[-1] = y[0]
    return y


def wav_bytes(x: np.ndarray, loop: bool) -> bytes:
    pcm = np.round(np.clip(x, -1, 1) * 32767).astype("<i2").tobytes()
    fmt = struct.pack("<HHIIHH", 1, 1, SR, SR * 2, 2, 16)
    chunks = [(b"fmt ", fmt)]
    if loop:
        smpl = struct.pack("<15I", 0, 0, round(1e9 / SR), 60, 0, 0, 0, 1, 0, 0, 0, 0, len(x) - 1, 0, 0)
        chunks.append((b"smpl", smpl))
    chunks.append((b"data", pcm))
    body = b"WAVE"
    for tag, data in chunks:
        body += tag + struct.pack("<I", len(data)) + data + (b"\0" if len(data) & 1 else b"")
    return b"RIFF" + struct.pack("<I", len(body)) + body


def features(x: np.ndarray) -> dict:
    peak = max(float(np.max(np.abs(x))), 1e-12)
    rms = max(float(np.sqrt(np.mean(x * x))), 1e-12)
    nseg = min(4096, len(x))
    freqs, psd = signal.welch(x, SR, nperseg=nseg, noverlap=nseg // 2)
    total = max(float(np.sum(psd)), 1e-15)
    centroid = float(np.sum(freqs * psd) / total)
    cumulative = np.cumsum(psd)
    rolloff = float(freqs[min(len(freqs) - 1, int(np.searchsorted(cumulative, total * 0.85)))])
    return {"peakDb": round(20 * math.log10(peak), 2), "rmsDb": round(20 * math.log10(rms), 2), "crestDb": round(20 * math.log10(peak / rms), 2), "centroidHz": round(centroid), "rolloff85Hz": round(rolloff)}


DEFS = []


def define(name, category, description, loop, builder, target_rms=None):
    DEFS.append(dict(name=name, category=category, description=description, loop=loop, builder=builder, target_rms=target_rms))


def flame_loop():
    core = make_loop(load("arc_flame_loop.wav"), 1.2, 0.11)
    texture = make_loop(bandpass(load("flame_wall.wav"), 450, 4400), 1.2, 0.14)
    return lowpass(mix(1.2, (core, 0.82), (texture, 0.26)), 4300)


def ice_loop():
    air = make_loop(highpass(load("arc_flame_loop.wav"), 1050), 1.2, 0.12)
    glass = make_loop(highpass(speed(load("shatter.wav"), 0.72), 1900), 1.2, 0.1)
    scan = make_loop(bandpass(load("nsp_scanner_sweep.mp3"), 800, 5200), 1.2, 0.12)
    return lowpass(mix(1.2, (air, 0.58), (glass, 0.12), (scan, 0.25)), 6500)


define("flamethrower_loop", "Flame", "Sustained flame matched to arc_flame_loop/flame_wall.", True, flame_loop, -11.2)
define("flamethrower_ignite", "Flame", "Dry flame ignition using the game's crackle and flame texture.", False, lambda: mix(0.78, (fit(load("crackle.wav"), 0.7), 0.55), (envelope(fit(load("arc_flame_loop.wav"), 0.75), [(0, 0), (0.12, 1), (0.65, 0.55), (0.78, 0)]), 0.72)), -13.0)
define("flamethrower_release", "Flame", "Fuel cutoff with the same mid-presence flame color.", False, lambda: fade(lowpass(reverse(fit(load("flame_wall.wav"), 0.62)), 4200), 0.002, 0.42), -15.0)
define("flame_projectile_launch", "Flame", "Compact flame projectile, short and centered like current shots.", False, lambda: mix(0.48, (speed(fit(load("arc_flame_loop.wav"), 0.5), 1.35), 0.62), (speed(load("nsp_solar_flare.mp3"), 1.8), 0.44)), -13.5)
define("flame_projectile_flyby", "Flame", "Flame bolt flyby derived from the current rocket-flyby envelope.", False, lambda: mix(0.86, (bandpass(speed(load("nsp_rocket_flyby.mp3"), 1.2), 350, 4300), 0.66), (fit(load("arc_flame_loop.wav"), 0.82), 0.28)), -14.0)
define("flame_orb_launch", "Flame", "Heavy flame orb with solar-flare body and charge release.", False, lambda: mix(0.88, (speed(load("nsp_solar_flare.mp3"), 1.15), 0.72), (lowpass(load("nsp_charge_release.mp3"), 3900), 0.45)), -11.5)
define("flame_orb_impact", "Flame", "Large flame-orb hit in the expBig/bomb family.", False, lambda: mix(1.55, (fit(load("expBig.mp3"), 1.55), 0.75), (speed(load("nsp_solar_flare.mp3"), 0.82), 0.48)), -14.5)

define("ice_breath_loop", "Ice", "Icy continuous breath matched to the dry mono flame/beam beds.", True, ice_loop, -12.0)
define("ice_breath_start", "Ice", "Cold breath onset with scanner sweep and bright shatter air.", False, lambda: mix(0.72, (speed(load("nsp_scanner_sweep.mp3"), 1.35), 0.62), (highpass(load("shatter.wav"), 1600), 0.35, 0.24)), -14.0)
define("ice_breath_release", "Ice", "Short brittle frost cutoff.", False, lambda: mix(0.52, (fit(load("shatter.wav"), 0.5), 0.78), (speed(load("nsp_shield_down.mp3"), 1.8), 0.32)), -16.0)
define("ice_projectile_launch", "Ice", "Very short bright ice bolt in the pulse-laser family.", False, lambda: mix(0.24, (speed(load("nsp_pulse_laser.mp3"), 0.78), 0.76), (speed(load("shatter.wav"), 2.2), 0.32)), -15.0)
define("ice_projectile_impact", "Ice", "Dry ice crack and compact shard spray.", False, lambda: mix(0.62, (load("shatter.wav"), 0.82), (highpass(speed(load("expSmall.mp3"), 1.45), 800), 0.34)), -16.5)
define("ice_orb_launch", "Ice", "Large cold orb launch using charge-release and scanner colors.", False, lambda: mix(0.86, (highpass(load("nsp_charge_release.mp3"), 240), 0.7), (speed(load("nsp_scanner_sweep.mp3"), 1.25), 0.38)), -12.5)
define("ice_orb_impact", "Ice", "Large orb collapse with low body and bright shatter cap.", False, lambda: mix(1.25, (fit(load("expBig.mp3"), 1.25), 0.58), (load("shatter.wav"), 0.8), (speed(load("nsp_comet_impact.mp3"), 1.18), 0.34)), -14.5)

define("charge_rise", "Charge", "Charge ramp directly matched to Falva's current charge envelope.", False, lambda: mix(1.5, (load("falvaCharge.wav"), 0.78), (lowpass(load("nsp_bof2_charge_shot.mp3"), 4300), 0.35)), -12.2)
define("helix_full_charge_loop", "Charge", "Held Helix charge using the game's charge-shot and beam tonal family.", True, lambda: make_loop(mix(1.2, (load("nsp_bof2_charge_shot.mp3"), 0.76), (bandpass(load("nsp_beam_sustain.mp3"), 250, 3600), 0.3)), 1.2, 0.13), -11.2)
define("rollerball_full_charge_loop", "Charge", "Held Roller Ball charge matched directly to Falva's existing loop.", True, lambda: make_loop(mix(1.38, (load("falvaChargeLoop.wav"), 0.88), (lowpass(speed(load("nsp_beam_sustain.mp3"), 0.92), 2800), 0.18)), 1.38, 0.12), -12.2)
define("charge_ready_ping", "Charge", "Full-charge confirmation in the current nav-lock/select family.", False, lambda: mix(0.52, (load("nsp_nav_lock.mp3"), 0.75), (speed(load("select.mp3"), 1.22), 0.42, 0.09)), -14.5)
define("charge_release", "Charge", "Charged release retaining the current helixBurst identity.", False, lambda: load("nsp_charge_release.mp3"), -10.5)

define("tank_rocket_launch_heavy", "Rockets", "Sub-heavy tank rocket matched to nsp_rocket_launch.", False, lambda: mix(1.4, (lowpass(load("nsp_rocket_launch.mp3"), 4300), 0.86), (load("grenade.mp3"), 0.38), (fit(load("expSmall.mp3"), 0.7), 0.2)), -8.9)
define("tank_rocket_launch_fast", "Rockets", "Faster tank rocket variation with the same low-end signature.", False, lambda: mix(0.92, (speed(load("nsp_rocket_launch.mp3"), 1.5), 0.86), (speed(load("grenade.mp3"), 1.2), 0.32)), -10.5)
define("tank_rocket_salvo", "Rockets", "Three dry tank launches with current-game spacing and weight.", False, lambda: mix(1.76, (speed(load("nsp_rocket_launch.mp3"), 1.45), 0.72, 0), (speed(load("nsp_rocket_launch.mp3"), 1.55), 0.68, 0.34), (load("nsp_rocket_launch.mp3"), 0.76, 0.7)), -8.8)
define("rocket_flyby", "Rockets", "Rocket pass preserving the current flyby contour.", False, lambda: mix(1.1, (load("nsp_rocket_flyby.mp3"), 0.86), (speed(load("nsp_rcs_thruster.mp3"), 1.2), 0.25, 0.18)), -12.0)
define("rocket_impact", "Rockets", "Low, dry armored impact in the expBig family.", False, lambda: mix(1.6, (fit(load("expBig.mp3"), 1.6), 0.8), (speed(load("nsp_comet_impact.mp3"), 0.9), 0.38)), -13.5)

define("jet_machinegun_shot_01", "Jet Guns", "Compact jet cannon report using current player/enemy shot colors.", False, lambda: shot(5001, 1.08, False), -15.0)
define("jet_machinegun_shot_02", "Jet Guns", "Alternate compact jet cannon report.", False, lambda: shot(5002, 0.98, False), -15.0)
define("jet_machinegun_shot_03", "Jet Guns", "Heavier jet cannon report.", False, lambda: shot(5003, 0.86, True), -13.5)
define("jet_machinegun_burst_short", "Jet Guns", "Short aircraft burst with current-game dry transient spacing.", False, lambda: burst(0.86, 5010, 15.5, False), -10.5)
define("jet_machinegun_burst_long", "Jet Guns", "Longer heavy aircraft cannon burst.", False, lambda: burst(1.6, 5017, 12.5, True), -9.8)

define("alien_plasma_projectile", "Alien", "Alien bolt built from the heavy-laser/charge family.", False, lambda: mix(0.42, (speed(load("nsp_heavy_laser.mp3"), 0.88), 0.72), (speed(load("nsp_charge_release.mp3"), 2.1), 0.34)), -12.5)
define("alien_prism_projectile", "Alien", "Faceted prism bolt using the scatter-laser color.", False, lambda: mix(0.38, (load("nsp_scatter_laser.mp3"), 0.82), (speed(load("nsp_pulse_laser.mp3"), 0.72), 0.35, 0.04)), -14.5)
define("alien_laser_zap", "Alien", "Fast alien zap in the current pulse-laser family.", False, lambda: mix(0.17, (speed(load("nsp_pulse_laser.mp3"), 0.68), 0.88), (speed(load("enemyShoot.mp3"), 0.82), 0.28)), -15.0)
define("prism_beam_start", "Beams", "Prism-beam ignition using scanner and scatter cues.", False, lambda: mix(0.58, (speed(load("nsp_scanner_sweep.mp3"), 1.55), 0.58), (load("nsp_scatter_laser.mp3"), 0.65, 0.19)), -13.5)
define("prism_beam_loop", "Beams", "Dense low-mid prism sustain with a restrained spectral edge.", True, lambda: make_loop(mix(1.4, (load("nsp_beam_sustain.mp3"), 0.82), (bandpass(load("nsp_scanner_sweep.mp3"), 900, 4500), 0.16)), 1.4, 0.13), -8.8)
define("laser_beam_start", "Beams", "Military beam onset matched to nsp_heavy_laser.", False, lambda: mix(0.34, (load("nsp_heavy_laser.mp3"), 0.9), (load("nsp_pulse_laser.mp3"), 0.24)), -11.8)
define("laser_beam_loop", "Beams", "Held beam matched to the current beam-sustain low-mid bed.", True, lambda: make_loop(lowpass(load("nsp_beam_sustain.mp3"), 3500), 1.4, 0.12), -8.4)
define("laser_beam_end", "Beams", "Dry beam cutoff from the current shield-down/release family.", False, lambda: mix(0.5, (speed(load("nsp_shield_down.mp3"), 1.45), 0.66), (speed(reverse(load("nsp_heavy_laser.mp3")), 0.92), 0.34)), -14.0)

define("barrel_roll_light", "Maneuvers", "Light roll retaining arc_barrel_roll's bright dry whoosh.", False, lambda: speed(load("arc_barrel_roll.wav"), 1.12), -12.0)
define("barrel_roll_heavy", "Maneuvers", "Heavier roll with the same presence-focused air movement.", False, lambda: lowpass(speed(load("arc_barrel_roll.wav"), 0.88), 6200), -11.5)
define("barrel_roll_alien", "Maneuvers", "Alien roll combining the current roll and scanner families.", False, lambda: mix(0.78, (speed(load("arc_barrel_roll.wav"), 0.96), 0.72), (speed(load("nsp_scanner_sweep.mp3"), 1.5), 0.27)), -12.5)
define("jet_flyby", "Maneuvers", "Jet pass shaped from the existing rocket-flyby and thruster cues.", False, lambda: mix(1.25, (speed(load("nsp_rocket_flyby.mp3"), 0.9), 0.78), (fit(load("nsp_engine_loop.mp3"), 1.2), 0.26)), -11.5)
define("afterburner_kick", "Maneuvers", "Afterburner ignition matched to booster/rocket low-end weight.", False, lambda: mix(1.05, (load("nsp_booster_ignite.mp3"), 0.75), (speed(load("nsp_rocket_launch.mp3"), 1.28), 0.38)), -10.5)


def main():
    if not REFERENCE.is_dir():
        raise SystemExit(f"Reference bank not found: {REFERENCE}")
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {
        "title": "Bullets of Fury — Current-Bank Style Match V3",
        "version": 3,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sampleRate": SR,
        "channels": 1,
        "format": "16-bit mono PCM WAV",
        "masterPeakDb": -3.0,
        "referenceBank": "../BulletsOfFury/assets/game/sounds (override with BOF_SOUND_BANK)",
        "styleProfile": "Measured from the shipping bank: centered mono, dry/compact envelopes, -3 dBFS peaks, sub-heavy rockets, presence-focused shots/flame, bright short ice/shatter, and dense low-mid sustained beams.",
        "note": "Preview-only. No Bullets of Fury game files or earlier preview banks were changed.",
        "files": [],
    }
    rendered = {}
    for d in DEFS:
        x = master(d["builder"](), d["loop"], d["target_rms"])
        filename = d["name"] + ".wav"
        (OUT / filename).write_bytes(wav_bytes(x, d["loop"]))
        rendered[d["name"]] = x
        manifest["files"].append({
            "name": d["name"], "file": filename, "category": d["category"],
            "description": d["description"], "loop": d["loop"],
            "duration": round(seconds(x), 3), **features(x),
        })

    order = ["flamethrower_loop", "ice_breath_loop", "charge_rise", "helix_full_charge_loop",
             "rollerball_full_charge_loop", "tank_rocket_launch_heavy", "tank_rocket_salvo",
             "jet_machinegun_burst_short", "jet_machinegun_burst_long", "alien_prism_projectile",
             "alien_plasma_projectile", "prism_beam_loop", "laser_beam_loop", "flame_orb_launch",
             "flame_orb_impact", "ice_orb_launch", "ice_orb_impact", "barrel_roll_light",
             "barrel_roll_heavy", "barrel_roll_alien", "afterburner_kick"]
    reel_dur = sum(min(2.2, seconds(rendered[n])) + 0.26 for n in order)
    layers, cursor = [], 0.0
    for name in order:
        clip = fit(rendered[name], min(2.2, seconds(rendered[name])))
        layers.append((clip, 0.86, cursor))
        cursor += seconds(clip) + 0.26
    reel = master(mix(reel_dur, *layers), False)
    (OUT / "bullets_of_fury_style_matched_v3_preview_reel.wav").write_bytes(wav_bytes(reel, False))
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    groups = list(dict.fromkeys(x["category"] for x in manifest["files"]))
    cards = []
    for group in groups:
        cards.append(f"<section><h2>{html.escape(group)}</h2>")
        for x in [v for v in manifest["files"] if v["category"] == group]:
            badge = '<span class="loop">LOOP</span>' if x["loop"] else ""
            cards.append(f'<article><div><strong>{html.escape(x["name"])}</strong>{badge}<p>{html.escape(x["description"])}</p><small>{x["duration"]:.2f}s · {x["rmsDb"]:.1f} dB RMS · centroid {x["centroidHz"]} Hz</small></div><audio controls {"loop" if x["loop"] else ""} preload="none" src="{x["file"]}"></audio></article>')
        cards.append("</section>")
    page = f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bullets of Fury Style Match V3</title><style>:root{{color-scheme:dark;--hot:#ff6138;--ice:#77eaff}}*{{box-sizing:border-box}}body{{margin:0;background:radial-gradient(circle at 50% 0,#24304b,#080a10 58%);color:#f4f7ff;font:15px system-ui,sans-serif}}.wrap{{max-width:1100px;margin:auto;padding:32px 18px 80px}}h1{{font-size:clamp(28px,5vw,50px);margin:0;text-shadow:0 0 25px #f53}}header p{{color:#c1cada;max-width:850px;line-height:1.5}}.notice{{border:1px solid #40627b;background:#101b29;padding:13px;border-radius:10px;color:#a5f1ce}}h2{{margin-top:38px;color:var(--ice);text-transform:uppercase;letter-spacing:.08em}}article{{display:grid;grid-template-columns:1fr minmax(260px,420px);gap:20px;align-items:center;background:linear-gradient(135deg,#171c29,#10131c);border:1px solid #2c364a;border-radius:12px;padding:15px 18px;margin:9px 0}}strong{{font:700 16px ui-monospace,monospace}}.loop{{font:700 10px ui-monospace,monospace;background:var(--ice);color:#07151a;padding:4px 7px;border-radius:12px;margin-left:9px}}p{{margin:5px 0;color:#c4ccda}}small{{color:#7f90aa}}audio{{width:100%;height:38px}}.reel{{margin:24px 0;padding:18px;border:1px solid var(--hot);border-radius:14px;background:#1c1110}}@media(max-width:700px){{article{{grid-template-columns:1fr}}}}</style></head><body><div class="wrap"><header><h1>BULLETS OF FURY — STYLE MATCH V3</h1><p>Built from measured shipping-bank fingerprints and read-only reference layers: 44.1 kHz centered mono, dry arcade envelopes, −3 dBFS peak target, category-specific bandwidth, and the same compact punch as the current game.</p><div class="notice">Separate audition bank only. The Bullets of Fury repository and V1/V2 previews remain untouched.</div><div class="reel"><strong>V3 quick reel</strong><p>Selected sounds in sequence.</p><audio controls preload="metadata" src="bullets_of_fury_style_matched_v3_preview_reel.wav"></audio></div></header>{''.join(cards)}</div></body></html>'''
    (OUT / "index.html").write_text(page, encoding="utf-8")
    (OUT / "README.md").write_text(f"""# Bullets of Fury — Style Match V3

This bank was designed against the current shipping Bullets of Fury sound bank.

- {len(DEFS)} new composite/variant WAV sounds
- {sum(1 for d in DEFS if d['loop'])} seamless loops with WAV `smpl` metadata
- 44.1 kHz, 16-bit centered mono PCM
- −3 dBFS master peak, dry compact arcade envelopes
- Current game audio is read-only reference material; no game file is changed
- V1 and V2 preview banks are preserved

Run `python generate_bullets_of_fury_style_matched_v3.py` to regenerate.
""", encoding="utf-8")
    print(f"Generated {len(DEFS)} style-matched sounds in {OUT}")


if __name__ == "__main__":
    main()
