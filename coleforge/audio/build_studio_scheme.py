"""Build the "ColeForge Studio" sound scheme from the ElevenLabs takes.

Reads the downloaded takes in coleforge/audio/elevenlabs-takes/, applies the picks below,
trims leading/trailing silence, adds a short fade-out, peak-normalizes to about -2 dBFS and
writes 44.1 kHz 16-bit stereo WAVs (the format Windows sound schemes require) to
coleforge/shell/assets/sounds/studio/.

    python coleforge/audio/build_studio_scheme.py
"""

import json
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent
TAKES = ROOT / "elevenlabs-takes"
OUT = ROOT.parent / "shell" / "assets" / "sounds" / "studio"
SR = 44100
PEAK = 0.79  # about -2 dBFS, matching the Classic scheme

# Chosen take per sound. Alternates stay in elevenlabs-takes/ so a pick can be swapped here.
PICKS = {
    "startup": "a",       # Cole's pick
    "shutdown": "a",
    "logon": "b",
    "ding": "a",
    "notify": "b",        # take a is near-silent
    "exclamation": "b",
    "critical_stop": "b",
    "question": "b",      # take a is very quiet
    "menu_click": "b",    # regenerated; take a has a long tail
    "menu_popup": "a",
    "minimize": "a",
    "maximize": "b",
    "recycle": "a",
    "chat_in": "a",
    "chat_out": "b",
    "buddy_in": "a",
    "buddy_out": "a",
    "lobby_ready": "a",
    "call_ring": "a",
}
# Longer, musical cues get a gentler fade and keep more of their reverb tail.
FADE = {"startup": 0.6, "shutdown": 0.4, "logon": 0.2, "lobby_ready": 0.2}
TAIL_FLOOR = {"startup": 0.002, "shutdown": 0.003}  # fraction of peak; default 0.02


def process(name: str, take: str) -> dict:
    x, sr = sf.read(TAKES / f"{name}_{take}.mp3", always_2d=True, dtype="float64")
    if sr != SR:
        raise SystemExit(f"{name}_{take}: expected {SR} Hz, got {sr}")
    if x.shape[1] == 1:
        x = np.repeat(x, 2, axis=1)
    x = x[:, :2]
    env = np.abs(x).max(axis=1)
    peak = env.max()
    if peak < 1e-3:
        raise SystemExit(f"{name}_{take} is silent; pick the other take")
    start = max(0, np.where(env > peak * 0.02)[0][0] - int(0.005 * SR))
    tail = np.where(env > peak * TAIL_FLOOR.get(name, 0.02))[0]
    end = min(len(x), tail[-1] + int(0.03 * SR))
    y = x[start:end].copy()
    fade = min(int(FADE.get(name, 0.04) * SR), len(y) // 3)
    y[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
    y[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))[:, None]  # de-click the onset
    y *= PEAK / np.abs(y).max()
    sf.write(OUT / f"{name}.wav", y, SR, subtype="PCM_16")
    return {"name": name, "file": f"{name}.wav", "take": take, "seconds": round(len(y) / SR, 3)}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    takes = {(t["sound"], t["take"]): t for t in json.loads((TAKES / "takes.json").read_text())}
    sounds = []
    for name, take in PICKS.items():
        info = process(name, take)
        info["prompt"] = takes[(name, take)]["prompt"]
        info["generation_id"] = takes[(name, take)]["generation_id"]
        sounds.append(info)
        print(f"{name:14} take {take}  {info['seconds']:.2f}s")
    manifest = {"scheme": "ColeForge Studio", "source": "ElevenLabs eleven_text_to_sound_v2", "sampleRate": SR, "sounds": sounds}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Wrote {len(sounds)} sounds to {OUT.relative_to(ROOT.parent.parent)}")


if __name__ == "__main__":
    main()
