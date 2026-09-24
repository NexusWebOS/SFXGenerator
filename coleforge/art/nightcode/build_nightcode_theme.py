"""Build the NightCode desktop theme art: 16-bit icons, the boot screen and the log-on banner.

    python coleforge/art/nightcode/build_nightcode_theme.py

Writes into coleforge/shell/assets/art/nightcode/:
  icons/<id>.png     32x32 16-bit icons (drawn by build_nightcode_icons.py)
  boot.jpg           1920x1080 boot screen (the official logo over circuit night)
  logon-banner.png   4:1 banner for the log-on dialog
  circuits.jpg       1920x1080 circuit night behind the animated "NightCode Live" wallpaper
Run build_nightcode_art.py first; this one reuses its helpers and the logo.
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from build_nightcode_art import ART, circuits, fit, logo, radial, scanlines  # noqa: E402
from build_nightcode_icons import build as build_icons  # noqa: E402

OUT = ART / "nightcode"
FONTS = HERE.parent.parent / "shell" / "assets" / "fonts"

CYAN = (49, 215, 232, 255)


# ---------------------------------------------------------------- screens
def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def glow_text(img, xy, text, fnt, fill, glow_rgb=(30, 120, 255), radius=6, spacing=0):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    if spacing:
        x, y = xy
        for ch in text:
            d.text((x, y), ch, font=fnt, fill=fill)
            x += fnt.getlength(ch) + spacing
    else:
        d.text(xy, text, font=fnt, fill=fill)
    halo = Image.new("RGBA", img.size, glow_rgb + (0,))
    halo.putalpha(layer.split()[-1].filter(ImageFilter.GaussianBlur(radius)))
    img.alpha_composite(halo)
    img.alpha_composite(layer)


def boot_screen(mark):
    w, h = 1920, 1080
    bg = radial(w, h, (12, 30, 84), (2, 5, 14), cx=0.5, cy=0.42, r=0.75)
    circuits(bg, seed=11, count=70)
    m = fit(mark, 600)
    halo = Image.new("RGBA", (m.width + 240, m.height + 240), (0, 0, 0, 0))
    halo.alpha_composite(m, (120, 120))
    alpha = halo.split()[-1].filter(ImageFilter.GaussianBlur(50))
    glow_layer = Image.new("RGBA", halo.size, (30, 110, 255, 0))
    glow_layer.putalpha(alpha.point(lambda a: min(255, int(a * 0.8))))
    x, y = (w - m.width) // 2, 70
    bg.alpha_composite(glow_layer, (x - 120, y - 120))
    bg.alpha_composite(m, (x, y))
    return scanlines(bg, alpha=30)


def circuit_night():
    """The live wallpaper's backdrop: the NightCode wallpaper's circuit night, without the logo."""
    bg = radial(1920, 1080, (14, 34, 92), (2, 5, 14), cx=0.62, cy=0.48, r=0.8)
    circuits(bg)
    return scanlines(bg)


def logon_banner(mark):
    w, h = 880, 220
    bg = radial(w, h, (16, 40, 104), (2, 5, 14), cx=0.2, cy=0.5, r=0.9)
    circuits(bg, seed=5, count=26)
    m = fit(mark, 200)
    bg.alpha_composite(m, (26, (h - m.height) // 2))
    glow_text(bg, (262, 30), "Windows", font("Orbitron-Black.ttf", 70), (235, 247, 255, 255))
    glow_text(bg, (266, 118), "COLEFORGE EDITION", font("Orbitron-Bold.ttf", 30), CYAN, radius=5)
    glow_text(bg, (268, 166), "NIGHTCODE", font("ShareTechMono-Regular.ttf", 24), (127, 196, 255, 255), radius=3, spacing=9)
    return scanlines(bg, alpha=22)


def main():
    icons = build_icons()
    mark = logo()
    boot_screen(mark).convert("RGB").save(OUT / "boot.jpg", quality=88, optimize=True)
    logon_banner(mark).convert("RGB").save(OUT / "logon-banner.png", optimize=True)
    circuit_night().convert("RGB").save(OUT / "circuits.jpg", quality=86, optimize=True)
    print(f"wrote {len(icons)} icons, boot.jpg, logon-banner.png and circuits.jpg to", OUT.relative_to(HERE.parent.parent.parent))


if __name__ == "__main__":
    main()
