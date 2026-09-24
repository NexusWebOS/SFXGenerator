"""Build the wide log-on banner (flag + wordmark side by side) from the boot splash art.

    python coleforge/art/build_logon_banner.py

Writes coleforge/shell/assets/art/logon-banner.png (1200x300).
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
SHELL = HERE.parent / "shell" / "assets" / "art"
W, H = 1200, 300


def main():
    splash = Image.open(SHELL / "boot-splash.webp").convert("RGB")
    flag = splash.crop((400, 60, 1040, 580))
    mark = splash.crop((200, 560, 1250, 830))

    # Deep blue backdrop with a soft glow behind the flag, like the splash.
    bg = Image.new("RGB", (W, H), (2, 6, 22))
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse((20, -60, 420, 360), fill=150)
    bg.paste((20, 70, 190), mask=glow.filter(ImageFilter.GaussianBlur(70)))

    fh = H - 30
    flag = flag.resize((round(flag.width * fh / flag.height), fh), Image.LANCZOS)
    def lighten(img, pos, feather=28):
        """Lighten-blend `img` onto the backdrop through a feathered mask, so no crop edges show."""
        mask = Image.new("L", img.size, 0)
        ImageDraw.Draw(mask).rectangle((feather, feather, img.width - feather, img.height - feather), fill=255)
        m = np.asarray(mask.filter(ImageFilter.GaussianBlur(feather / 2)), dtype=np.float32)[..., None] / 255
        box = (pos[0], pos[1], pos[0] + img.width, pos[1] + img.height)
        region = np.asarray(bg.crop(box), dtype=np.float32)
        mixed = region * (1 - m) + np.maximum(region, np.asarray(img, dtype=np.float32)) * m
        bg.paste(Image.fromarray(mixed.round().astype(np.uint8)), box[:2])

    lighten(flag, (30, 15))

    mw = W - flag.width - 60
    mark = mark.resize((mw, round(mark.height * mw / mark.width)), Image.LANCZOS)
    lighten(mark, (flag.width + 30, (H - mark.height) // 2))

    out = SHELL / "logon-banner.png"
    bg.save(out, optimize=True)
    print("wrote", out.relative_to(HERE.parent.parent))


if __name__ == "__main__":
    main()
