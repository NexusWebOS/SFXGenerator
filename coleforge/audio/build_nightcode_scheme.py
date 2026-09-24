"""Synthesize the "NightCode" sound scheme: chiptune / cyber system sounds for the NightCode theme.

Square and saw arpeggios in A minor, bit-crushed glitches, modem chirps and a sub-bass drop,
all generated from code (no samples), peak-normalized to about -2 dBFS and written as 44.1 kHz
16-bit stereo WAVs (the format Windows sound schemes need) to coleforge/shell/assets/sounds/nightcode/.

    python coleforge/audio/build_nightcode_scheme.py
"""

import json
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / "shell" / "assets" / "sounds" / "nightcode"
SR = 44100
PEAK = 0.79
rng = np.random.default_rng(1337)


def note(n):
    """Frequency of a note name like 'A4' or 'C#5'."""
    names = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "B": 2}
    return 440.0 * 2 ** ((names[n[:-1]] + 12 * (int(n[-1]) - 4)) / 12)


def t_(sec):
    return np.arange(int(sec * SR)) / SR


def osc(kind, freq, sec, duty=0.5):
    """freq may be a number or an array (for sweeps)."""
    n = int(sec * SR)
    f = np.full(n, float(freq)) if np.isscalar(freq) else np.asarray(freq, float)[:n]
    phase = np.cumsum(f) / SR % 1.0
    if kind == "square":
        return np.where(phase < duty, 1.0, -1.0)
    if kind == "saw":
        return 2 * phase - 1
    if kind == "tri":
        return 2 * np.abs(2 * phase - 1) - 1
    return np.sin(2 * np.pi * phase)


def env(sec, a=0.004, d=0.08, s=0.6, r=0.1):
    n = int(sec * SR)
    e = np.full(n, s)
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na, endpoint=False) if na else e[:na]
    e[na:na + nd] = np.linspace(1, s, len(e[na:na + nd]))
    if nr:
        e[-nr:] *= np.linspace(1, 0, len(e[-nr:]))
    return e


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def crush(x, bits=6, hold=3):
    q = 2 ** (bits - 1)
    y = np.round(x * q) / q
    return np.repeat(y[::hold], hold)[:len(x)]


def mix(length, *parts):
    """parts: (start_seconds, mono signal)."""
    out = np.zeros(int(length * SR))
    for start, sig in parts:
        i = int(start * SR)
        seg = sig[:max(0, len(out) - i)]
        out[i:i + len(seg)] += seg
    return out


def echo(x, delay=0.12, fb=0.35, taps=4, extra=None):
    d = int(delay * SR)
    out = np.concatenate([x, np.zeros(d * taps + int((extra or 0) * SR))])
    for k in range(1, taps + 1):
        out[d * k:d * k + len(x)] += x * fb ** k
    return out


def stereo(x, spread=0.006):
    d = int(spread * SR)
    left = np.concatenate([x, np.zeros(d)])
    right = np.concatenate([np.zeros(d), x])
    return np.stack([left, right * 0.92 + left * 0.08], axis=1)


def blip(n, sec=0.09, kind="square", duty=0.25, vol=0.5):
    return osc(kind, note(n) if isinstance(n, str) else n, sec, duty) * env(sec, 0.002, 0.03, 0.5, sec * 0.5) * vol


def sweep(f0, f1, sec, kind="square", duty=0.5):
    f = np.geomspace(f0, f1, int(sec * SR))
    return osc(kind, f, sec, duty)


def noise(sec):
    return rng.uniform(-1, 1, int(sec * SR))


def arp(notes, step, sec_each=None, kind="square", duty=0.25, vol=0.45):
    sec_each = sec_each or step * 1.6
    return [(i * step, blip(n, sec_each, kind, duty, vol)) for i, n in enumerate(notes)]


def pad(chord, sec, vol=0.18, cutoff=1800):
    x = sum(osc("saw", note(n) * det, sec) for n in chord for det in (0.997, 1.003))
    return lowpass(x, cutoff) * env(sec, sec * 0.3, 0.2, 0.8, sec * 0.45) * vol / len(chord)


# ---------------------------------------------------------------- the scheme
def startup():
    glitch = crush(noise(0.18) * env(0.18, 0.001, 0.05, 0.3, 0.1), 3, 40) * 0.35
    notes = ["A3", "C4", "E4", "A4", "C5", "E5", "A5", "E5", "C5", "E5", "A5", "C6"]
    sub = osc("sine", 55, 1.4) * env(1.4, 0.005, 0.3, 0.6, 0.9) * 0.55
    x = mix(3.6, (0, glitch), *[(0.2 + s, v) for s, v in arp(notes, 0.085, 0.16, "square", 0.25, 0.32)],
            (0.25, pad(["A3", "E4", "A4", "C5"], 3.2)), (1.25, sub),
            (1.25, blip("A6", 0.9, "tri", vol=0.18)), (1.25, blip("E6", 0.9, "tri", vol=0.12)))
    return stereo(echo(x, 0.19, 0.3, 3))


def shutdown():
    notes = ["E5", "C5", "A4", "E4", "C4", "A3"]
    zip_ = sweep(1800, 60, 0.45, "square", 0.3) * env(0.45, 0.002, 0.1, 0.6, 0.3) * 0.25
    x = mix(2.4, *arp(notes, 0.11, 0.2, "square", 0.25, 0.32), (0.25, pad(["A3", "C4", "E4"], 1.6, 0.16, 1200)), (0.72, zip_))
    return stereo(echo(x, 0.16, 0.28, 3))


def logon():
    x = mix(0.8, *arp(["E5", "G5", "B5", "E6"], 0.07, 0.16, "square", 0.25, 0.35))
    return stereo(echo(x, 0.13, 0.33, 3))


def ding():
    fm = osc("sine", 1760 + 600 * osc("sine", 3520, 0.45) * np.exp(-t_(0.45) * 12), 0.45)
    return stereo(echo(fm * env(0.45, 0.001, 0.1, 0.3, 0.3) * 0.45, 0.11, 0.25, 2))


def notify():
    return stereo(echo(mix(0.35, (0, blip("A5", 0.08)), (0.08, blip("E6", 0.14))), 0.12, 0.3, 3))


def exclamation():
    tone = lambda f, s: crush(osc("saw", f, s) * env(s, 0.002, 0.05, 0.7, 0.06), 5, 2) * 0.35
    return stereo(echo(mix(0.5, (0, tone(note("A5"), 0.12)), (0.14, tone(note("E5"), 0.2))), 0.15, 0.25, 2))


def critical_stop():
    buzz = lambda s: (osc("square", 98, s, 0.4) * 0.5 + crush(noise(s), 4, 6) * 0.2) * env(s, 0.002, 0.03, 0.8, 0.04)
    x = mix(0.8, (0, buzz(0.14) * 0.6), (0.18, buzz(0.14) * 0.6), (0.36, lowpass(buzz(0.34), 2500) * 0.7))
    return stereo(x)


def question():
    x = sweep(note("E5"), note("B5"), 0.18, "square", 0.25) * env(0.18, 0.002, 0.04, 0.6, 0.08) * 0.4
    return stereo(echo(x, 0.12, 0.3, 3))


def menu_click():
    x = lowpass(noise(0.012), 5000) * np.linspace(1, 0, int(0.012 * SR)) * 0.6
    x = mix(0.05, (0, x), (0, blip(3200, 0.02, "sine", vol=0.25)))
    return stereo(x, 0.002)


def menu_popup():
    s = 0.09
    x = mix(0.18, (0, lowpass(noise(s), 3000) * env(s, 0.03, 0.03, 0.4, 0.04) * 0.25),
            (0, sweep(600, 1500, s, "tri") * env(s, 0.01, 0.03, 0.5, 0.04) * 0.3))
    return stereo(x)


def minimize():
    return stereo(echo(sweep(1400, 280, 0.16, "square", 0.3) * env(0.16, 0.002, 0.05, 0.5, 0.06) * 0.3, 0.08, 0.2, 2))


def maximize():
    return stereo(echo(sweep(280, 1400, 0.16, "square", 0.3) * env(0.16, 0.002, 0.05, 0.5, 0.06) * 0.3, 0.08, 0.2, 2))


def recycle():
    s = 0.55
    shred = crush(noise(s), 3, 25) * env(s, 0.005, 0.1, 0.5, 0.25) * 0.35
    fall = sweep(900, 120, s, "saw") * env(s, 0.005, 0.1, 0.5, 0.25) * 0.18
    return stereo(mix(0.7, (0, shred), (0, fall)))


def chat_in():
    bip = lambda f: blip(f, 0.06, "square", 0.5, 0.35)
    return stereo(echo(mix(0.3, (0, bip(1200)), (0.09, bip(1800))), 0.12, 0.3, 2))


def chat_out():
    return stereo(echo(sweep(700, 1200, 0.07, "tri") * env(0.07, 0.002, 0.02, 0.6, 0.03) * 0.4, 0.1, 0.2, 2))


def buddy_in():
    return stereo(echo(mix(0.5, *arp(["C5", "E5", "G5"], 0.06, 0.12, "square", 0.25, 0.35)), 0.12, 0.3, 2))


def buddy_out():
    return stereo(echo(mix(0.5, *arp(["G5", "E5", "C5"], 0.06, 0.12, "square", 0.25, 0.3)), 0.12, 0.3, 2))


def lobby_ready():
    notes = ["A4", "C5", "E5", "A5", "C6", "E6"]
    x = mix(1.3, *arp(notes, 0.05, 0.1, "square", 0.25, 0.3), (0.3, pad(["A4", "C5", "E5"], 0.9, 0.2, 3000)),
            (0.3, blip("A6", 0.6, "tri", vol=0.15)))
    return stereo(echo(x, 0.15, 0.3, 2))


def call_ring():
    ring = lambda: mix(0.42, *[(i * 0.035, blip(f, 0.035, "square", 0.5, 0.3)) for i, f in enumerate([1320, 1760] * 6)])
    x = mix(2.1, (0, ring()), (0.55, ring()), (1.3, ring()))
    return stereo(x)


SOUNDS = {
    "startup": startup, "shutdown": shutdown, "logon": logon, "ding": ding, "notify": notify,
    "exclamation": exclamation, "critical_stop": critical_stop, "question": question,
    "menu_click": menu_click, "menu_popup": menu_popup, "minimize": minimize, "maximize": maximize,
    "recycle": recycle, "chat_in": chat_in, "chat_out": chat_out, "buddy_in": buddy_in,
    "buddy_out": buddy_out, "lobby_ready": lobby_ready, "call_ring": call_ring,
}


# Square-wave sweeps and buzzes sound louder than their peak suggests; trim them.
GAIN = {"minimize": 0.6, "maximize": 0.6, "question": 0.75, "call_ring": 0.8, "critical_stop": 0.85, "menu_click": 0.7, "menu_popup": 0.8}


def finish(name, x):
    peak = np.abs(x).max()
    x = x / peak * PEAK * GAIN.get(name, 1.0)
    fade = min(len(x), int(0.01 * SR))
    x[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return x


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {"scheme": "NightCode", "source": "coleforge/audio/build_nightcode_scheme.py (synthesized)", "sampleRate": SR, "sounds": []}
    for name, fn in SOUNDS.items():
        x = finish(name, fn())
        sf.write(OUT / f"{name}.wav", x, SR, subtype="PCM_16")
        manifest["sounds"].append({"name": name, "file": f"{name}.wav", "seconds": round(len(x) / SR, 2)})
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"wrote {len(SOUNDS)} NightCode sounds to", OUT.relative_to(ROOT.parent.parent))


if __name__ == "__main__":
    main()
