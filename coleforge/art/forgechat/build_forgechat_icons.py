"""Draw ForgeChat's 16-bit Windows 98 pixel art: logo, wordmark, toolbar icons and buddy status icons.

    python coleforge/art/forgechat/build_forgechat_icons.py

Everything is drawn pixel by pixel in the Windows 16-colour palette (no anti-aliasing) and
written to coleforge/shell/assets/art/forgechat/. A 4x preview sheet goes next to this script.
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / "shell" / "assets" / "art" / "forgechat"

# The Windows 16-colour palette.
K, W, S, G = (0, 0, 0, 255), (255, 255, 255, 255), (192, 192, 192, 255), (128, 128, 128, 255)
NAVY, BLUE, TEAL, CYAN = (0, 0, 128, 255), (0, 0, 255, 255), (0, 128, 128, 255), (0, 255, 255, 255)
YEL, OLIVE, RED, MAROON = (255, 255, 0, 255), (128, 128, 0, 255), (255, 0, 0, 255), (128, 0, 0, 255)
LIME, GREEN, PURPLE, MAG = (0, 255, 0, 255), (0, 128, 0, 255), (128, 0, 128, 255), (255, 0, 255, 255)


def canvas(n=32):
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def px(d, pts, c):
    for p in pts:
        d.point(p, fill=c)


def dither(d, box, c):
    """50% checkerboard shading, the classic 16-colour way to fake a mid-tone."""
    x0, y0, x1, y1 = box
    px(d, [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1) if (x + y) % 2 == 0], c)


def bubble(d, box, fill, line, tail, shade=None):
    x0, y0, x1, y1 = box
    d.rounded_rectangle(box, radius=3, fill=fill, outline=line)
    tx, ty, dx = tail  # tail foot position and direction
    d.polygon([(tx, y1 - 1), (tx + 5 * dx, y1 - 1), (tx - dx, ty)], fill=fill)
    d.line([(tx, y1), (tx - dx, ty)], fill=line)
    d.line([(tx + 5 * dx, y1), (tx - dx, ty)], fill=line)
    if shade:
        d.line([(x0 + 2, y1 - 1), (x1 - 2, y1 - 1)], fill=shade)
        d.line([(x1 - 1, y0 + 2), (x1 - 1, y1 - 2)], fill=shade)


def buddy(d, ox, oy, body=YEL, dark=OLIVE, scale=1):
    """The little running buddy (AIM-style), 10x14 at scale 1."""
    s = scale
    r = lambda x0, y0, x1, y1, c: d.rectangle((ox + x0 * s, oy + y0 * s, ox + (x1 + 1) * s - 1, oy + (y1 + 1) * s - 1), fill=c)
    r(4, 0, 6, 0, K); r(3, 1, 7, 3, K); r(4, 1, 6, 3, body); r(4, 1, 4, 1, W)      # head
    r(3, 4, 7, 8, K); r(4, 5, 6, 7, body); r(6, 5, 6, 7, dark)                       # torso
    r(0, 4, 3, 5, K); r(1, 5, 2, 5, body)                                             # arm back
    r(7, 5, 9, 7, K); r(8, 6, 8, 6, body)                                             # arm forward
    r(2, 9, 4, 12, K); r(3, 9, 3, 11, body); r(1, 12, 2, 13, K)                       # leg back
    r(6, 9, 8, 11, K); r(6, 9, 7, 10, body); r(8, 11, 9, 13, K)                       # leg forward


# ---------------------------------------------------------------- icons (32x32)
def logo():
    img, d = canvas()
    bubble(d, (11, 1, 30, 17), BLUE, NAVY, (25, 22, 1), shade=NAVY)
    dither(d, (13, 3, 28, 6), CYAN)
    bubble(d, (1, 8, 22, 25), W, K, (5, 30, -1), shade=S)
    buddy(d, 7, 10)
    px(d, [(27, 20), (26, 21), (28, 21), (27, 22), (27, 21)], YEL)  # forge spark
    px(d, [(27, 19), (25, 21), (29, 21), (27, 23)], W)
    return img


def send():
    img, d = canvas()
    d.rectangle((2, 8, 24, 25), fill=W, outline=K)
    d.line([(2, 8), (13, 17), (24, 8)], fill=K)
    d.line([(3, 24), (10, 17)], fill=G); d.line([(23, 24), (16, 17)], fill=G)
    d.polygon([(20, 14), (30, 20), (20, 26)], fill=LIME, outline=K)
    d.rectangle((14, 18, 20, 22), fill=LIME, outline=K); d.line([(20, 19), (20, 21)], fill=LIME)
    return img


def smiley():
    img, d = canvas()
    d.ellipse((3, 3, 28, 28), fill=YEL, outline=K)
    d.arc((5, 5, 26, 26), 200, 290, fill=W)
    d.rectangle((10, 10, 12, 14), fill=K); d.rectangle((19, 10, 21, 14), fill=K)
    d.arc((8, 9, 23, 23), 20, 160, fill=K)
    d.arc((8, 10, 23, 24), 30, 150, fill=K)
    dither(d, (20, 20, 25, 25), OLIVE)
    return img


# 3x5 pixel glyphs for tiny labels.
FONT3 = {"G": ["111", "100", "101", "101", "111"], "I": ["111", "010", "010", "010", "111"], "F": ["111", "100", "110", "100", "100"]}


def text3(d, x, y, s, c, scale=1):
    for ch in s:
        for j, row in enumerate(FONT3[ch]):
            for i, bit in enumerate(row):
                if bit == "1":
                    d.rectangle((x + i * scale, y + j * scale, x + (i + 1) * scale - 1, y + (j + 1) * scale - 1), fill=c)
        x += 4 * scale


def gif():
    img, d = canvas()
    d.rectangle((1, 5, 30, 27), fill=S, outline=K)
    d.line([(2, 6), (29, 6)], fill=W); d.line([(2, 6), (2, 26)], fill=W)
    d.rectangle((4, 8, 27, 24), fill=NAVY)
    text3(d, 5, 11, "GIF", YEL, scale=2)
    px(d, [(25, 9), (26, 10), (24, 10), (25, 11)], W)
    return img


def file():
    img, d = canvas()
    d.polygon([(6, 1), (20, 1), (26, 7), (26, 30), (6, 30)], fill=W, outline=K)
    d.polygon([(20, 1), (20, 7), (26, 7)], fill=S, outline=K)
    for y in range(11, 20, 3):
        d.line([(9, y), (22, y)], fill=G)
    d.rectangle((13, 20, 18, 24), fill=BLUE, outline=NAVY)
    d.polygon([(9, 24), (22, 24), (15, 30)], fill=BLUE, outline=NAVY)
    return img


def picture():
    img, d = canvas()
    d.rectangle((1, 4, 30, 27), fill=OLIVE, outline=K)
    d.rectangle((4, 7, 27, 24), fill=CYAN, outline=K)
    d.ellipse((20, 9, 24, 13), fill=YEL)
    d.polygon([(5, 23), (12, 13), (18, 23)], fill=GREEN)
    d.polygon([(13, 23), (20, 16), (26, 23)], fill=(0, 160, 0, 255))
    d.line([(2, 5), (29, 5)], fill=YEL)
    return img


def webcam():
    img, d = canvas()
    d.ellipse((6, 2, 25, 21), fill=S, outline=K)
    d.arc((8, 4, 23, 19), 190, 280, fill=W)
    d.ellipse((11, 7, 20, 16), fill=K)
    d.ellipse((13, 9, 18, 14), fill=BLUE)
    px(d, [(14, 10), (15, 10)], W)
    d.rectangle((13, 21, 18, 24), fill=G, outline=K)
    d.rectangle((6, 25, 25, 29), fill=S, outline=K)
    d.line([(7, 26), (24, 26)], fill=W)
    return img


def mic():
    img, d = canvas()
    d.rounded_rectangle((11, 1, 20, 18), radius=4, fill=G, outline=K)
    for y in range(4, 16, 2):
        d.line([(13, y), (18, y)], fill=S)
    d.arc((7, 8, 24, 24), 0, 180, fill=K)
    d.line([(15, 24), (15, 27)], fill=K); d.line([(16, 24), (16, 27)], fill=K)
    d.rectangle((9, 27, 22, 29), fill=S, outline=K)
    return img


def handset(c, dark, tilt=0):
    """Classic telephone handset: a grip bar with ear and mouth pieces hanging below."""
    img, d = canvas()
    d.rounded_rectangle((3, 9, 28, 15), radius=3, fill=c, outline=K)
    d.polygon([(3, 12), (10, 12), (12, 22), (1, 22)], fill=c, outline=K)
    d.polygon([(21, 12), (28, 12), (30, 22), (19, 22)], fill=c, outline=K)
    d.line([(4, 10), (27, 10)], fill=W)
    d.line([(2, 21), (11, 21)], fill=dark); d.line([(20, 21), (29, 21)], fill=dark)
    dither(d, (6, 13, 25, 14), dark)
    return img.rotate(tilt, resample=Image.NEAREST, center=(16, 16)) if tilt else img


def call():
    return handset(LIME, GREEN, tilt=25)


def hangup():
    return handset(RED, MAROON)


def video():
    img, d = canvas()
    d.rectangle((1, 9, 21, 25), fill=G, outline=K)
    d.line([(2, 10), (20, 10)], fill=S); d.line([(2, 10), (2, 24)], fill=S)
    d.polygon([(22, 14), (30, 9), (30, 25), (22, 20)], fill=S, outline=K)
    d.ellipse((4, 3, 11, 10), fill=S, outline=K); d.ellipse((12, 3, 19, 10), fill=S, outline=K)
    d.ellipse((6, 5, 9, 8), fill=K); d.ellipse((14, 5, 17, 8), fill=K)
    px(d, [(5, 13), (6, 13)], RED)
    return img


def screen():
    img, d = canvas()
    d.rectangle((2, 3, 29, 22), fill=S, outline=K)
    d.rectangle((5, 6, 26, 19), fill=NAVY, outline=G)
    d.rectangle((7, 8, 18, 14), fill=W); d.rectangle((7, 8, 18, 9), fill=BLUE)
    d.polygon([(20, 17), (20, 11), (25, 14)], fill=YEL, outline=K)
    d.rectangle((12, 23, 19, 25), fill=G, outline=K)
    d.rectangle((7, 26, 24, 29), fill=S, outline=K)
    return img


def lobby():
    img, d = canvas()
    d.rounded_rectangle((1, 12, 30, 27), radius=6, fill=G, outline=K)
    d.line([(4, 13), (27, 13)], fill=S)
    d.rectangle((6, 18, 12, 20), fill=K); d.rectangle((8, 16, 10, 22), fill=K)
    d.ellipse((20, 16, 23, 19), fill=RED, outline=K); d.ellipse((24, 19, 27, 22), fill=BLUE, outline=K)
    d.rectangle((14, 21, 17, 22), fill=S)
    buddy(d, 2, 0, body=YEL, scale=1)
    buddy(d, 19, 0, body=CYAN, dark=TEAL, scale=1)
    return img


def invite():
    img, d = canvas()
    buddy(d, 1, 3, scale=2)
    d.rectangle((20, 17, 30, 21), fill=LIME, outline=K); d.rectangle((23, 14, 27, 24), fill=LIME, outline=K)
    d.rectangle((21, 18, 29, 20), fill=LIME); d.rectangle((24, 15, 26, 23), fill=LIME)
    return img


def block():
    img, d = canvas()
    buddy(d, 3, 2, scale=2, body=S, dark=G)
    d.ellipse((13, 13, 30, 30), outline=RED, width=3)
    d.line([(16, 27), (27, 16)], fill=RED, width=3)
    return img


def settings():
    img, d = canvas()
    cx, cy = 16, 16
    for a in range(8):
        import math
        t = a * math.pi / 4
        x, y = cx + 11 * math.cos(t), cy + 11 * math.sin(t)
        d.rectangle((round(x) - 2, round(y) - 2, round(x) + 2, round(y) + 2), fill=G, outline=K)
    d.ellipse((6, 6, 26, 26), fill=G, outline=K)
    d.arc((8, 8, 24, 24), 180, 270, fill=S)
    d.ellipse((12, 12, 20, 20), fill=S, outline=K)
    return img


def download():
    img, d = canvas()
    d.rectangle((12, 2, 19, 15), fill=BLUE, outline=NAVY)
    d.polygon([(5, 15), (26, 15), (15, 27)], fill=BLUE, outline=NAVY)
    d.line([(13, 3), (13, 15)], fill=CYAN)
    d.rectangle((3, 27, 28, 30), fill=S, outline=K)
    return img


def warn():
    img, d = canvas()
    d.polygon([(15, 2), (30, 28), (1, 28)], fill=YEL, outline=K)
    d.line([(15, 3), (2, 27)], fill=W)
    d.rectangle((14, 10, 17, 20), fill=K); d.rectangle((14, 23, 17, 25), fill=K)
    return img


def info():
    img, d = canvas()
    d.rectangle((2, 2, 29, 29), fill=W, outline=K)
    d.rectangle((3, 3, 28, 7), fill=NAVY)
    buddy(d, 5, 12, scale=1)
    for y in (13, 17, 21, 25):
        d.line([(17, y), (26, y)], fill=G)
    return img


def status(kind):
    """16x16 buddy-list status icons."""
    img, d = canvas(16)
    colors = {"online": (YEL, OLIVE), "away": (YEL, OLIVE), "busy": (YEL, OLIVE), "offline": (S, G)}
    buddy(d, 1, 1, *colors[kind])
    if kind == "away":
        d.ellipse((9, 0, 15, 6), fill=CYAN, outline=NAVY); d.ellipse((11, -1, 16, 4), fill=(0, 0, 0, 0))
        d.arc((9, 0, 15, 6), 90, 250, fill=NAVY)
    if kind == "busy":
        d.ellipse((9, 9, 15, 15), fill=RED, outline=MAROON); d.line([(10, 12), (14, 12)], fill=W)
    return img


# ---------------------------------------------------------------- wordmark
# 5x7 pixel font (plus a descender row) for the "ForgeChat" wordmark.
FONT5 = {
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000", "00000"],
    "o": ["00000", "00000", "01110", "10001", "10001", "10001", "01110", "00000"],
    "r": ["00000", "00000", "10110", "11001", "10000", "10000", "10000", "00000"],
    "g": ["00000", "00000", "01111", "10001", "10001", "01111", "00001", "01110"],
    "e": ["00000", "00000", "01110", "10001", "11111", "10000", "01110", "00000"],
    "C": ["01110", "10001", "10000", "10000", "10000", "10001", "01110", "00000"],
    "h": ["10000", "10000", "10110", "11001", "10001", "10001", "10001", "00000"],
    "a": ["00000", "00000", "01110", "00001", "01111", "10001", "01111", "00000"],
    "t": ["01000", "01000", "11100", "01000", "01000", "01001", "00110", "00000"],
}


def wordmark(text="ForgeChat", scale=3):
    w = (len(text) * 6 - 1) * scale + scale * 2
    h = 8 * scale + scale * 2
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x = scale
    for i, ch in enumerate(text):
        fg = NAVY if i < 5 else BLUE  # "Forge" navy, "Chat" blue
        for j, row in enumerate(FONT5[ch]):
            for k, bit in enumerate(row):
                if bit == "1":
                    # Drop shadow first, then the letter pixel.
                    d.rectangle((x + k * scale + scale // 2 + 1, scale + j * scale + scale // 2 + 1, x + (k + 1) * scale + scale // 2, scale + (j + 1) * scale + scale // 2), fill=G)
        for j, row in enumerate(FONT5[ch]):
            for k, bit in enumerate(row):
                if bit == "1":
                    d.rectangle((x + k * scale, scale + j * scale, x + (k + 1) * scale - 1, scale + (j + 1) * scale - 1), fill=fg)
        x += 6 * scale
    return img


def banner():
    """Logo + wordmark lock-up for the sign-on screen, drawn at 2x pixels."""
    mark = wordmark(scale=3)
    emblem = logo().resize((64, 64), Image.NEAREST)
    img = Image.new("RGBA", (64 + 10 + mark.width, 64), (0, 0, 0, 0))
    img.alpha_composite(emblem, (0, 0))
    img.alpha_composite(mark, (74, (64 - mark.height) // 2))
    return img


ICONS = {
    "logo": logo, "send": send, "smiley": smiley, "gif": gif, "file": file, "picture": picture,
    "webcam": webcam, "mic": mic, "call": call, "video": video, "hangup": hangup, "screen": screen,
    "lobby": lobby, "invite": invite, "block": block, "settings": settings, "download": download,
    "warn": warn, "info": info,
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    sheet_items = []
    for name, fn in ICONS.items():
        img = fn()
        img.save(OUT / f"{name}.png")
        sheet_items.append(img)
    for kind in ("online", "away", "busy", "offline"):
        img = status(kind)
        img.save(OUT / f"status-{kind}.png")
        sheet_items.append(img.resize((32, 32), Image.NEAREST))
    logo().resize((64, 64), Image.NEAREST).save(OUT / "logo-64.png")
    wordmark().save(OUT / "wordmark.png")
    banner().save(OUT / "banner.png")
    (OUT / "icons.json").write_text(json.dumps(sorted(list(ICONS) + [f"status-{k}" for k in ("online", "away", "busy", "offline")]), indent=2) + "\n")

    # 4x preview sheet on Windows grey.
    cols = 8
    rows = (len(sheet_items) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * 40 + 8, rows * 40 + 8 + 72), S)
    for i, img in enumerate(sheet_items):
        sheet.alpha_composite(img, (8 + (i % cols) * 40, 8 + (i // cols) * 40))
    b = banner()
    sheet.alpha_composite(b.resize((b.width // 2, b.height // 2), Image.NEAREST), (8, rows * 40 + 16))
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(HERE / "preview.png")
    print(f"wrote {len(ICONS) + 4 + 3} images to {OUT.relative_to(HERE.parent.parent.parent)}")


if __name__ == "__main__":
    main()
