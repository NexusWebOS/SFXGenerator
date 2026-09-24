"""Build the default "ColeForge 98" wallpaper: classic teal with a faint emblem watermark.

    python coleforge/art/build_classic98_wallpaper.py

Writes coleforge/shell/assets/art/wallpapers/classic98.png (1920x1080).
SpriteCook asset c2f47d44-47e7-4223-865a-d4bba5dbe335 is the generated alternative.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
ART = HERE.parent / "shell" / "assets" / "art"
W, H = 1920, 1080
TEAL = np.array([0, 128, 128], dtype=np.float32)
DARK = np.array([0, 96, 100], dtype=np.float32)


def main():
    splash = Image.open(ART / "boot-splash.webp").convert("L")
    # The flag emblem, used only as a luminance mask so it reads as a darker-teal watermark.
    flag = splash.crop((400, 60, 1040, 580)).resize((520, 422), Image.LANCZOS)
    mask = Image.new("L", (W, H), 0)
    mask.paste(flag, ((W - flag.width) // 2, (H - flag.height) // 2 - 40))
    m = np.asarray(mask.filter(ImageFilter.GaussianBlur(1.2)), dtype=np.float32)[..., None] / 255
    m = np.clip((m - 0.25) * 1.6, 0, 1) * 0.55

    img = TEAL * (1 - m) + DARK * m
    out = ART / "wallpapers" / "classic98.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(img.round().astype(np.uint8)).save(out, optimize=True)
    print("wrote", out.relative_to(HERE.parent.parent))


if __name__ == "__main__":
    main()
