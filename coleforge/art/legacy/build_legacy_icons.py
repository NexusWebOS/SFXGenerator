"""Draw Legacy Mode's 16-bit Windows 98 pixel art: logo, hardware icons and the Voodoo3 Mode badge.

    python coleforge/art/legacy/build_legacy_icons.py

Uses the Windows 16-colour palette and helpers from ../forgechat/build_forgechat_icons.py.
Writes coleforge/shell/assets/art/legacy/ and a 4x preview sheet next to this script.
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "forgechat"))
from build_forgechat_icons import (  # noqa: E402
    BLUE, CYAN, G, GREEN, K, LIME, MAROON, NAVY, OLIVE, RED, S, TEAL, W, YEL, canvas, dither, px,
)

OUT = HERE.parent.parent / "shell" / "assets" / "art" / "legacy"
BEIGE, BEIGE_D, ORANGE, PURPLE = (214, 206, 180, 255), (160, 150, 120, 255), (255, 140, 0, 255), (128, 0, 128, 255)

# 5x7 capitals + digits for badges.
FONT = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"], "C": ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"], "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "G": ["01110", "10001", "10000", "10111", "10001", "10001", "01111"], "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"], "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"], "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"], "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"], " ": ["00000"] * 7,
}


def text(d, x, y, s, color, scale=1, shadow=None):
    for ch in s:
        for j, row in enumerate(FONT[ch]):
            for i, bit in enumerate(row):
                if bit == "1":
                    if shadow:
                        d.rectangle((x + i * scale + scale, y + j * scale + scale, x + (i + 1) * scale + scale - 1, y + (j + 1) * scale + scale - 1), fill=shadow)
                    d.rectangle((x + i * scale, y + j * scale, x + (i + 1) * scale - 1, y + (j + 1) * scale - 1), fill=color)
        x += 6 * scale
    return x


def crt(d, box, screen=K):
    x0, y0, x1, y1 = box
    d.rectangle(box, fill=BEIGE, outline=K)
    d.line([(x0 + 1, y0 + 1), (x1 - 1, y0 + 1)], fill=W); d.line([(x0 + 1, y0 + 1), (x0 + 1, y1 - 1)], fill=W)
    d.rectangle((x0 + 3, y0 + 3, x1 - 3, y1 - 5), fill=screen, outline=BEIGE_D)
    px(d, [(x1 - 4, y1 - 3)], LIME)


# ---------------------------------------------------------------- 32x32
def logo():
    img, d = canvas()
    crt(d, (1, 1, 30, 24))
    px(d, [(5, 6), (6, 6), (5, 7), (5, 8), (6, 8)], LIME)                        # C
    px(d, [(8, 7), (8, 9)], LIME)                                                 # :
    px(d, [(10, 6), (11, 7), (12, 8), (13, 9)], LIME)                             # \
    px(d, [(15, 6), (16, 7), (17, 8), (16, 9), (15, 10)], LIME)                   # >
    d.rectangle((19, 9, 22, 10), fill=LIME)                                       # cursor
    d.rectangle((10, 25, 21, 27), fill=BEIGE_D, outline=K)
    d.rectangle((6, 27, 25, 30), fill=BEIGE, outline=K)
    d.rectangle((20, 14, 30, 30), fill=NAVY, outline=K)                           # floppy
    d.rectangle((22, 14, 28, 18), fill=S, outline=K); px(d, [(26, 15), (26, 16)], NAVY)
    d.rectangle((22, 23, 28, 30), fill=W, outline=K)
    return img


def dos():
    img, d = canvas()
    d.rectangle((1, 3, 30, 28), fill=K, outline=S)
    d.rectangle((2, 4, 29, 8), fill=NAVY)
    px(d, [(4, 12), (5, 12), (4, 13), (4, 14), (5, 14), (7, 13), (9, 12), (10, 13), (11, 14), (13, 12), (14, 13), (13, 14)], W)
    d.rectangle((16, 14, 19, 14), fill=W)
    for y in (18, 21, 24):
        d.line([(4, y), (4 + (y * 7) % 18 + 6, y)], fill=G)
    return img


def win98():
    img, d = canvas()
    crt(d, (1, 2, 22, 20), screen=TEAL)
    d.rectangle((6, 21, 17, 23), fill=BEIGE_D, outline=K)
    d.rectangle((23, 6, 31, 30), fill=BEIGE, outline=K)                           # tower
    d.line([(24, 7), (30, 7)], fill=W)
    d.rectangle((25, 9, 29, 10), fill=G); d.rectangle((25, 12, 29, 13), fill=G)
    px(d, [(25, 27), (27, 27)], LIME)
    d.rectangle((6, 7, 9, 10), fill=RED); d.rectangle((10, 7, 13, 10), fill=LIME)
    d.rectangle((6, 11, 9, 14), fill=BLUE); d.rectangle((10, 11, 13, 14), fill=YEL)
    return img


def cpu():
    img, d = canvas()
    for i in range(6, 27, 3):
        d.line([(i, 2), (i, 5)], fill=S); d.line([(i, 26), (i, 29)], fill=S)
        d.line([(2, i), (5, i)], fill=S); d.line([(26, i), (29, i)], fill=S)
    d.rectangle((5, 5, 26, 26), fill=G, outline=K)
    d.rectangle((10, 10, 21, 21), fill=S, outline=K)
    d.line([(6, 6), (25, 6)], fill=S)
    dither(d, (11, 11, 20, 20), W)
    return img


def card3d():
    """A 1999 AGP 3D card: board, heatsink, gold fingers, V3 marking."""
    img, d = canvas()
    d.rectangle((1, 6, 30, 23), fill=GREEN, outline=K)
    d.rectangle((6, 9, 17, 19), fill=S, outline=K)                                # heatsink
    for x in range(8, 17, 2):
        d.line([(x, 10), (x, 18)], fill=G)
    d.rectangle((20, 9, 23, 12), fill=K); d.rectangle((25, 9, 28, 12), fill=K)    # SGRAM
    d.rectangle((20, 15, 23, 18), fill=K); d.rectangle((25, 15, 28, 18), fill=K)
    for x in range(4, 28, 2):
        d.line([(x, 24), (x, 27)], fill=YEL)                                      # gold fingers
    d.rectangle((0, 3, 2, 26), fill=S, outline=K)                                 # bracket
    px(d, [(9, 21), (10, 21), (13, 21), (14, 21), (12, 22), (11, 22)], W)        # tiny "V"
    return img


def sound():
    img, d = canvas()
    d.rectangle((1, 7, 30, 22), fill=GREEN, outline=K)
    d.rectangle((0, 4, 2, 25), fill=S, outline=K)
    for y, c in ((8, LIME), (13, CYAN), (18, (255, 105, 180, 255))):
        d.ellipse((3, y, 6, y + 3), fill=c, outline=K)
    d.rectangle((9, 10, 17, 18), fill=K); dither(d, (10, 11, 16, 17), G)
    d.rectangle((20, 10, 27, 13), fill=K); d.rectangle((20, 15, 27, 18), fill=K)
    for x in range(4, 28, 2):
        d.line([(x, 23), (x, 26)], fill=YEL)
    return img


def ram():
    img, d = canvas()
    d.rectangle((1, 10, 30, 21), fill=GREEN, outline=K)
    for x in (3, 10, 17, 24):
        d.rectangle((x, 12, x + 5, 18), fill=K)
    for x in range(2, 30, 2):
        d.line([(x, 22), (x, 24)], fill=YEL)
    d.rectangle((15, 21, 16, 24), fill=(0, 0, 0, 0))
    return img


def floppy():
    img, d = canvas()
    d.rectangle((3, 3, 28, 28), fill=NAVY, outline=K)
    d.rectangle((9, 3, 23, 12), fill=S, outline=K); d.rectangle((19, 5, 21, 10), fill=NAVY)
    d.rectangle((7, 16, 24, 28), fill=W, outline=K)
    d.line([(9, 19), (22, 19)], fill=RED); d.line([(9, 22), (20, 22)], fill=G); d.line([(9, 25), (18, 25)], fill=G)
    return img


def launch():
    img, d = canvas()
    d.ellipse((2, 2, 29, 29), fill=GREEN, outline=K)
    d.arc((4, 4, 27, 27), 200, 290, fill=LIME)
    d.polygon([(12, 9), (23, 16), (12, 23)], fill=W, outline=K)
    return img


def config():
    img, d = canvas()
    d.rectangle((4, 2, 24, 29), fill=W, outline=K)
    for y in range(6, 27, 4):
        d.line([(7, y), (13, y)], fill=NAVY); d.line([(15, y), (21, y)], fill=G)
    d.rectangle((18, 18, 30, 30), fill=S, outline=K)
    d.ellipse((20, 20, 28, 28), fill=G, outline=K); d.ellipse((23, 23, 25, 25), fill=W)
    return img


def voodoo_badge():
    """A 16-bit "VOODOO3 MODE" badge (ColeForge's own art, not 3dfx's logo)."""
    img = Image.new("RGBA", (96, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, 95, 23), fill=K, outline=S)
    d.rectangle((1, 1, 94, 22), outline=G)
    for i in range(2, 22):
        t = (i - 2) / 19
        d.line([(2, i), (93, i)], fill=(int(40 + 60 * t), 0, int(70 + 40 * t), 255))
    x = text(d, 5, 3, "VOODOO3", ORANGE, shadow=K)
    text(d, 6, 13, "MODE", YEL, shadow=K)
    # a tiny card silhouette on the right
    d.rectangle((70, 5, 90, 17), fill=GREEN, outline=K); d.rectangle((73, 7, 80, 14), fill=S, outline=K)
    for xx in range(72, 90, 2):
        d.line([(xx, 18), (xx, 20)], fill=YEL)
    return img


def legacy_banner():
    img = Image.new("RGBA", (120, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    text(d, 1, 4, "LEGACY MODE", NAVY, shadow=G)
    return img


ICONS32 = {"logo": logo, "dos": dos, "win98": win98, "cpu": cpu, "card3d": card3d, "sound": sound, "ram": ram,
           "floppy": floppy, "launch": launch, "config": config}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    items = []
    for name, fn in ICONS32.items():
        im = fn(); im.save(OUT / f"{name}.png"); items.append(im)
        im.resize((16, 16), Image.NEAREST).save(OUT / f"{name}-16.png")
    logo().resize((64, 64), Image.NEAREST).save(OUT / "logo-64.png")
    badge = voodoo_badge(); badge.save(OUT / "voodoo3-mode.png")
    banner = legacy_banner(); banner.save(OUT / "legacy-mode.png")

    cols = 5
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * 40 + 8, rows * 40 + 8 + 60), S)
    for i, im in enumerate(items):
        sheet.alpha_composite(im, (8 + (i % cols) * 40, 8 + (i // cols) * 40))
    sheet.alpha_composite(badge, (8, rows * 40 + 12))
    sheet.alpha_composite(banner, (8, rows * 40 + 40))
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(HERE / "preview.png")
    print(f"wrote {len(ICONS32) * 2 + 3} images to {OUT.relative_to(HERE.parent.parent.parent)}")


if __name__ == "__main__":
    main()
