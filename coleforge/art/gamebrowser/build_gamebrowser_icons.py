"""Draw the Forge Game Browser's 16-bit Windows 98 pixel art: app logo, toolbar and list icons.

    python coleforge/art/gamebrowser/build_gamebrowser_icons.py

Uses the Windows 16-colour palette and drawing helpers from ../forgechat/build_forgechat_icons.py.
Writes coleforge/shell/assets/art/gamebrowser/ and a 4x preview sheet next to this script.
"""

import math
import sys

sys.dont_write_bytecode = True
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "forgechat"))
from build_forgechat_icons import (  # noqa: E402
    BLUE, CYAN, G, GREEN, K, LIME, MAROON, NAVY, OLIVE, RED, S, TEAL, W, YEL, buddy, canvas, dither, px,
)

OUT = HERE.parent.parent / "shell" / "assets" / "art" / "gamebrowser"
BROWN = (128, 64, 0, 255)


def globe(d, box, land=GREEN):
    x0, y0, x1, y1 = box
    d.ellipse(box, fill=BLUE, outline=NAVY)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    w = x1 - x0
    d.polygon([(cx - w * 0.3, cy - w * 0.25), (cx - w * 0.05, cy - w * 0.35), (cx + w * 0.05, cy - w * 0.1), (cx - w * 0.15, cy + w * 0.05), (cx - w * 0.3, cy)], fill=land)
    d.polygon([(cx + w * 0.1, cy + w * 0.05), (cx + w * 0.35, cy - w * 0.05), (cx + w * 0.3, cy + w * 0.25), (cx + w * 0.12, cy + w * 0.35)], fill=land)
    d.arc((x0 + 2, y0 + 2, x1 - 2, y1 - 2), 200, 260, fill=CYAN)


# ---------------------------------------------------------------- 32x32
def logo():
    img, d = canvas()
    globe(d, (3, 3, 26, 26))
    d.ellipse((1, 11, 30, 19), outline=YEL)            # orbit ring
    d.ellipse((12, 12, 17, 17), outline=RED)           # crosshair
    d.line([(14, 6), (14, 11)], fill=RED); d.line([(14, 18), (14, 23)], fill=RED)
    d.line([(7, 14), (11, 14)], fill=RED); d.line([(18, 14), (22, 14)], fill=RED)
    px(d, [(27, 5), (26, 6), (28, 6), (27, 7)], W)     # forge spark
    return img


def refresh():
    img, d = canvas()
    d.arc((4, 4, 27, 27), 200, 340, fill=GREEN, width=4)
    d.arc((4, 4, 27, 27), 20, 160, fill=GREEN, width=4)
    d.polygon([(22, 3), (29, 10), (21, 12)], fill=LIME, outline=K)
    d.polygon([(9, 28), (2, 21), (10, 19)], fill=LIME, outline=K)
    d.arc((4, 4, 27, 27), 200, 340, fill=LIME, width=1)
    return img


def stop():
    img, d = canvas()
    r, c = 13, 15.5
    pts = [(c + r * math.cos(math.pi / 8 + i * math.pi / 4), c + r * math.sin(math.pi / 8 + i * math.pi / 4)) for i in range(8)]
    d.polygon(pts, fill=RED, outline=K)
    d.rectangle((8, 13, 23, 18), fill=W, outline=MAROON)
    return img


def join():
    img, d = canvas()
    d.rectangle((14, 2, 29, 29), fill=BROWN, outline=K)
    d.rectangle((16, 4, 27, 27), fill=(0, 0, 0, 255))
    dither(d, (17, 5, 26, 26), MAROON)
    px(d, [(18, 16), (18, 17)], YEL)
    d.polygon([(2, 12), (10, 12), (10, 7), (19, 15), (10, 23), (10, 18), (2, 18)], fill=LIME, outline=K)
    return img


def tower(d, x=6, color=S):
    d.rectangle((x, 2, x + 16, 29), fill=color, outline=K)
    d.line([(x + 1, 3), (x + 15, 3)], fill=W); d.line([(x + 1, 3), (x + 1, 28)], fill=W)
    for y in (6, 10, 14):
        d.rectangle((x + 3, y, x + 13, y + 2), fill=G, outline=K)
    px(d, [(x + 4, 20), (x + 6, 20)], LIME); px(d, [(x + 8, 20)], YEL)
    for y in range(23, 28, 2):
        d.line([(x + 3, y), (x + 13, y)], fill=G)


def host():
    img, d = canvas()
    tower(d, 3)
    d.polygon([(22, 4), (30, 4), (26, 0)], fill=YEL, outline=K)       # broadcast beacon
    d.arc((19, 6, 31, 18), 300, 60, fill=CYAN)
    d.arc((22, 9, 28, 15), 300, 60, fill=CYAN)
    return img


def add():
    img, d = canvas()
    tower(d, 2)
    d.rectangle((18, 17, 30, 23), fill=LIME, outline=K); d.rectangle((21, 14, 27, 26), fill=LIME, outline=K)
    d.rectangle((19, 18, 29, 22), fill=LIME); d.rectangle((22, 15, 26, 25), fill=LIME)
    return img


def star(n=32):
    img, d = canvas(n)
    c, R, r = n / 2, n * 0.46, n * 0.2
    pts = [(c + (R if i % 2 == 0 else r) * math.sin(i * math.pi / 5), c + 1 - (R if i % 2 == 0 else r) * math.cos(i * math.pi / 5)) for i in range(10)]
    d.polygon(pts, fill=YEL, outline=K)
    if n >= 32:
        d.line([(c - 2, 7), (c - 5, 13)], fill=W)
    return img


def share():
    img, d = canvas()
    d.rounded_rectangle((1, 3, 22, 20), radius=3, fill=W, outline=K)
    d.polygon([(5, 19), (10, 19), (4, 26)], fill=W); d.line([(5, 20), (4, 26), (10, 20)], fill=K)
    buddy(d, 6, 5)
    d.polygon([(18, 16), (26, 16), (26, 12), (31, 20), (26, 28), (26, 24), (18, 24)], fill=LIME, outline=K)
    return img


def filt():
    img, d = canvas()
    d.polygon([(2, 4), (29, 4), (18, 16), (18, 27), (13, 30), (13, 16)], fill=S, outline=K)
    d.line([(4, 5), (27, 5)], fill=W)
    dither(d, (14, 17, 17, 27), G)
    return img


def lan32():
    img, d = canvas()
    for x in (1, 17):
        d.rectangle((x, 4, x + 13, 15), fill=S, outline=K); d.rectangle((x + 2, 6, x + 11, 13), fill=TEAL)
        d.rectangle((x + 4, 16, x + 9, 18), fill=G, outline=K)
    d.line([(7, 19), (7, 25), (24, 25), (24, 19)], fill=K, width=2)
    d.rectangle((13, 23, 18, 28), fill=YEL, outline=K)
    return img


def internet32():
    img, d = canvas()
    globe(d, (2, 2, 29, 29))
    return img


# ---------------------------------------------------------------- 16x16 list icons
def small(fn):
    return fn().resize((16, 16), Image.NEAREST)


def lock():
    img, d = canvas(16)
    d.arc((4, 1, 11, 10), 180, 360, fill=K, width=2)
    d.rectangle((4, 5, 5, 7), fill=K); d.rectangle((10, 5, 11, 7), fill=K)
    d.rectangle((3, 7, 12, 14), fill=YEL, outline=K)
    d.line([(4, 8), (11, 8)], fill=W)
    d.rectangle((7, 9, 8, 12), fill=K)
    return img


def ping(level):
    img, d = canvas(16)
    col = {3: LIME, 2: YEL, 1: RED}[level]
    for i in range(4):
        x, hgt = 1 + i * 4, 4 + i * 3
        d.rectangle((x, 15 - hgt, x + 2, 15), fill=col if i < level + (1 if level == 3 else 0) else S, outline=K)
    return img


def marine():
    img, d = canvas(16)
    buddy(d, 3, 1, body=(0, 160, 0, 255), dark=GREEN)
    px(d, [(8, 2), (9, 2)], YEL)   # visor
    return img


def bot():
    img, d = canvas(16)
    d.rectangle((3, 4, 12, 12), fill=S, outline=K)
    d.line([(7, 1), (7, 3)], fill=K); px(d, [(7, 0)], RED)
    d.rectangle((5, 6, 6, 7), fill=RED); d.rectangle((9, 6, 10, 7), fill=RED)
    d.line([(5, 10), (10, 10)], fill=K)
    d.rectangle((1, 7, 2, 9), fill=G); d.rectangle((13, 7, 14, 9), fill=G)
    return img


def spectator():
    img, d = canvas(16)
    d.ellipse((1, 4, 14, 11), fill=W, outline=K)
    d.ellipse((5, 4, 10, 11), fill=BLUE, outline=K)
    d.rectangle((7, 6, 8, 9), fill=K)
    px(d, [(6, 5)], W)
    return img


def wad():
    img, d = canvas(16)
    d.rectangle((1, 1, 14, 14), fill=NAVY, outline=K)
    d.rectangle((4, 1, 11, 6), fill=S, outline=K); d.rectangle((9, 2, 10, 5), fill=NAVY)
    d.rectangle((3, 9, 12, 14), fill=W, outline=K)
    d.line([(4, 11), (11, 11)], fill=RED); d.line([(4, 13), (9, 13)], fill=G)
    return img


ICONS32 = {
    "logo": logo, "refresh": refresh, "stop": stop, "join": join, "host": host, "add": add, "favorite": star,
    "share": share, "filter": filt, "lan": lan32, "internet": internet32,
}
ICONS16 = {
    "lock": lock, "ping-good": lambda: ping(3), "ping-ok": lambda: ping(2), "ping-bad": lambda: ping(1),
    "player": marine, "bot": bot, "spectator": spectator, "wad": wad,
    "lan-16": lambda: small(lan32), "internet-16": lambda: small(internet32), "favorite-16": lambda: star(16),
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    sheet_items = []
    for name, fn in ICONS32.items():
        img = fn(); img.save(OUT / f"{name}.png"); sheet_items.append(img)
    for name, fn in ICONS16.items():
        img = fn(); img.save(OUT / f"{name}.png"); sheet_items.append(img.resize((32, 32), Image.NEAREST))
    logo().resize((64, 64), Image.NEAREST).save(OUT / "logo-64.png")

    cols = 8
    rows = (len(sheet_items) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * 40 + 8, rows * 40 + 8), S)
    for i, img in enumerate(sheet_items):
        sheet.alpha_composite(img, (8 + (i % cols) * 40, 8 + (i // cols) * 40))
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(HERE / "preview.png")
    print(f"wrote {len(ICONS32) + len(ICONS16) + 1} images to {OUT.relative_to(HERE.parent.parent.parent)}")


if __name__ == "__main__":
    main()
