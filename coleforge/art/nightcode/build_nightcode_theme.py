"""Build the NightCode desktop theme art: neon pixel icons, the boot screen and the log-on banner.

    python coleforge/art/nightcode/build_nightcode_theme.py

Writes into coleforge/shell/assets/art/nightcode/:
  icons/<id>.png     32x32 neon pixel icons for the shell (same ids as shell/js/icons.js)
  boot.jpg           1920x1080 boot screen (the official logo over circuit night)
  logon-banner.png   4:1 banner for the log-on dialog
A 4x preview of the icons goes next to this script (theme-preview.png).
Run build_nightcode_art.py first; this one reuses its helpers and the logo.
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from build_nightcode_art import ART, circuits, fit, logo, radial, scanlines  # noqa: E402

OUT = ART / "nightcode"
FONTS = HERE.parent.parent / "shell" / "assets" / "fonts"

# NightCode palette: the logo's night blues, neon cyan and silver, plus signal colours.
T = (0, 0, 0, 0)
K = (0, 0, 0, 255)
INK = (6, 12, 28, 255)
DEEP = (12, 26, 64, 255)
MID = (22, 56, 130, 255)
BLUE = (30, 120, 255, 255)
CYAN = (49, 215, 232, 255)
ICE = (191, 244, 255, 255)
W = (255, 255, 255, 255)
SILV = (200, 214, 229, 255)
STEEL = (110, 130, 160, 255)
PINK = (255, 92, 138, 255)
GREEN = (60, 255, 158, 255)
AMBER = (255, 196, 77, 255)
BLOOD = (70, 6, 26, 255)


def canvas():
    img = Image.new("RGBA", (32, 32), T)
    return img, ImageDraw.Draw(img)


def px(d, pts, c):
    for p in pts:
        d.point(p, fill=c)


def glyph(d, rows, ox, oy, c, s=2):
    """Blit a little bitmap (list of strings, X = on) at scale s."""
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "X":
                d.rectangle((ox + x * s, oy + y * s, ox + x * s + s - 1, oy + y * s + s - 1), fill=c)


def glow(img, colour=(30, 120, 255), alpha=110):
    """Neon halo: a 1px blue ring under the icon's silhouette."""
    a = img.split()[-1].point(lambda v: 255 if v > 0 else 0)
    ring = a.filter(ImageFilter.MaxFilter(3))
    halo = Image.new("RGBA", img.size, colour + (0,))
    halo.putalpha(ring.point(lambda v: alpha if v else 0))
    halo.alpha_composite(img)
    return halo


# ---------------------------------------------------------------- icons
def computer():
    img, d = canvas()
    d.rectangle((3, 3, 28, 22), fill=DEEP, outline=CYAN)
    d.rectangle((6, 6, 25, 19), fill=INK, outline=BLUE)
    d.line([(4, 4), (11, 4)], fill=ICE)
    px(d, [(8, 8), (9, 9), (8, 10)], GREEN)                      # > prompt
    d.line([(11, 9), (17, 9)], fill=CYAN)
    d.line([(8, 12), (20, 12)], fill=BLUE)
    d.line([(8, 14), (15, 14)], fill=BLUE)
    d.line([(8, 16), (12, 16)], fill=CYAN)
    d.rectangle((14, 16, 15, 17), fill=ICE)                      # cursor block
    d.rectangle((13, 23, 18, 25), fill=DEEP, outline=BLUE)
    d.rectangle((8, 26, 23, 28), fill=DEEP, outline=CYAN)
    px(d, [(21, 27)], GREEN)
    return img


def _folder(d, paper=False):
    d.rectangle((3, 6, 12, 9), fill=DEEP, outline=CYAN)
    d.rectangle((3, 9, 28, 27), fill=DEEP, outline=CYAN)
    if paper:
        d.rectangle((7, 4, 24, 15), fill=SILV, outline=K)
        for y in (6, 8, 10):
            d.line([(9, y), (22 - (y % 4) * 2, y)], fill=STEEL)
    d.rectangle((3, 13, 28, 27), fill=MID, outline=CYAN)
    d.line([(4, 14), (27, 14)], fill=BLUE)
    d.line([(7, 21), (14, 21)], fill=ICE)                        # circuit trace + pad
    d.line([(14, 21), (14, 24)], fill=ICE)
    d.rectangle((13, 24, 15, 25), fill=CYAN)
    d.line([(17, 18), (24, 18)], fill=BLUE)
    px(d, [(24, 19), (24, 20)], BLUE)


def folder():
    img, d = canvas()
    _folder(d)
    return img


def documents():
    img, d = canvas()
    _folder(d, paper=True)
    return img


def recycle():
    img, d = canvas()
    d.polygon([(8, 10), (23, 10), (21, 29), (10, 29)], fill=DEEP, outline=CYAN)
    for x in (12, 15, 18):
        d.line([(x, 13), (x + (x - 15) // 3, 26)], fill=BLUE)
    d.rectangle((6, 7, 25, 9), fill=MID, outline=CYAN)
    d.rectangle((13, 4, 18, 6), outline=CYAN)
    d.line([(7, 8), (13, 8)], fill=ICE)
    return img


def forgeamp():
    img, d = canvas()
    d.rounded_rectangle((2, 4, 29, 27), radius=3, fill=INK, outline=CYAN)
    d.ellipse((6, 16, 11, 20), fill=ICE)
    d.line([(11, 7), (11, 18)], fill=ICE)
    d.rectangle((11, 7, 15, 8), fill=ICE)
    for x, top in ((17, 16), (20, 11), (23, 14), (26, 9)):
        d.rectangle((x, top, x + 1, 24), fill=BLUE)
        d.rectangle((x, top, x + 1, top + 1), fill=CYAN)
    d.line([(4, 25), (27, 25)], fill=MID)
    return img


def forgevision():
    img, d = canvas()
    d.rectangle((3, 3, 28, 7), fill=SILV, outline=K)
    for x in range(5, 28, 5):
        d.line([(x, 4), (x + 2, 6)], fill=K)
    d.rectangle((3, 8, 28, 27), fill=INK, outline=CYAN)
    d.polygon([(12, 12), (12, 23), (21, 17)], fill=BLUE, outline=ICE)
    for x in range(5, 28, 4):
        px(d, [(x, 25)], MID)
    return img


def forgecraft():
    img, d = canvas()
    d.ellipse((2, 7, 26, 28), fill=DEEP, outline=CYAN)
    d.ellipse((6, 19, 10, 23), fill=T, outline=CYAN)
    d.rectangle((8, 11, 10, 13), fill=PINK)
    d.rectangle((13, 10, 15, 12), fill=AMBER)
    d.rectangle((19, 12, 21, 14), fill=GREEN)
    d.rectangle((17, 19, 19, 21), fill=BLUE)
    d.line([(15, 30), (26, 13)], fill=STEEL, width=2)
    d.line([(26, 13), (28, 10)], fill=SILV, width=2)
    d.polygon([(27, 10), (30, 4), (31, 9)], fill=CYAN)
    return img


def browser():
    img, d = canvas()
    d.ellipse((4, 4, 27, 27), fill=DEEP, outline=CYAN)
    d.ellipse((10, 4, 21, 27), outline=BLUE)
    d.line([(15, 5), (15, 26)], fill=BLUE)
    for y in (10, 16, 22):
        d.line([(6 if y != 16 else 5, y), (25 if y != 16 else 26, y)], fill=BLUE)
    d.arc((0, 11, 31, 22), 160, 380, fill=ICE)
    px(d, [(8, 8), (9, 7), (10, 7)], ICE)
    return img


def notepad():
    img, d = canvas()
    d.rectangle((5, 4, 25, 29), fill=INK, outline=CYAN)
    for x in (8, 12, 16, 20):
        d.rectangle((x, 2, x + 1, 5), fill=ICE)
    rows = [(8, 16, CYAN), (10, 20, BLUE), (10, 18, BLUE), (8, 14, CYAN), (10, 21, BLUE), (12, 17, GREEN)]
    for i, (x0, x1, c) in enumerate(rows):
        d.line([(x0, 9 + i * 3), (x1, 9 + i * 3)], fill=c)
    d.line([(20, 30), (30, 17)], fill=AMBER, width=2)
    px(d, [(19, 31), (20, 31)], ICE)
    return img


def control():
    img, d = canvas()
    d.rectangle((3, 4, 28, 27), fill=DEEP, outline=CYAN)
    for x, knob in ((9, 10), (16, 18), (23, 13)):
        d.line([(x, 8), (x, 23)], fill=BLUE)
        d.rectangle((x - 2, knob, x + 2, knob + 2), fill=ICE, outline=K)
    px(d, [(5, 25), (7, 25)], GREEN)
    return img


def arcade():
    img, d = canvas()
    d.ellipse((2, 15, 11, 27), fill=DEEP, outline=CYAN)
    d.ellipse((20, 15, 29, 27), fill=DEEP, outline=CYAN)
    d.rounded_rectangle((2, 10, 29, 22), radius=4, fill=DEEP, outline=CYAN)
    d.rectangle((4, 21, 9, 23), fill=DEEP)
    d.rectangle((22, 21, 27, 23), fill=DEEP)
    d.rectangle((5, 15, 11, 16), fill=ICE)
    d.rectangle((7, 13, 8, 18), fill=ICE)
    d.rectangle((21, 12, 22, 13), fill=PINK)
    d.rectangle((24, 15, 25, 16), fill=GREEN)
    d.rectangle((18, 15, 19, 16), fill=BLUE)
    d.rectangle((21, 18, 22, 19), fill=AMBER)
    d.line([(4, 11), (12, 11)], fill=BLUE)
    return img


def network():
    img, d = canvas()
    for x0 in (2, 18):
        d.rectangle((x0, 3, x0 + 11, 12), fill=INK, outline=CYAN)
        d.line([(x0 + 2, 6), (x0 + 7, 6)], fill=BLUE)
        d.line([(x0 + 2, 9), (x0 + 5, 9)], fill=GREEN)
    d.line([(7, 13), (7, 18), (24, 18), (24, 13)], fill=BLUE)
    d.line([(15, 18), (15, 22)], fill=BLUE)
    d.rectangle((10, 22, 21, 28), fill=DEEP, outline=CYAN)
    px(d, [(13, 25), (15, 25), (17, 25), (19, 25)], GREEN)
    return img


def _badge(fill, line, rows, c, oy=6):
    img, d = canvas()
    d.ellipse((2, 2, 29, 29), fill=fill, outline=line)
    d.arc((4, 4, 27, 27), 200, 260, fill=ICE)
    glyph(d, rows, 16 - len(rows[0]), oy, c)
    return img


def info():
    return _badge(DEEP, CYAN, ["XX", "XX", "..", "XX", "XX", "XX", "XX", "XX", "XX"], ICE, oy=7)


def question():
    return _badge(DEEP, CYAN, [".XXXX.", "XX..XX", "....XX", "...XX.", "..XX..", "..XX..", "......", "..XX.."], ICE, oy=8)


def error():
    img, d = canvas()
    d.ellipse((2, 2, 29, 29), fill=BLOOD, outline=PINK)
    d.line([(10, 10), (21, 21)], fill=W, width=3)
    d.line([(21, 10), (10, 21)], fill=W, width=3)
    d.arc((4, 4, 27, 27), 200, 260, fill=PINK)
    return img


def warning():
    img, d = canvas()
    d.polygon([(15, 2), (16, 2), (30, 28), (1, 28)], fill=INK, outline=AMBER)
    d.line([(15, 4), (4, 26)], fill=(120, 90, 30, 255))
    glyph(d, ["XX", "XX", "XX", "XX", "XX", "..", "XX"], 14, 10, AMBER)
    return img


def volume():
    img, d = canvas()
    d.polygon([(3, 12), (8, 12), (15, 5), (15, 26), (8, 19), (3, 19)], fill=DEEP, outline=CYAN)
    d.arc((10, 9, 22, 22), -50, 50, fill=CYAN, width=2)
    d.arc((11, 4, 29, 27), -50, 50, fill=BLUE, width=2)
    return img


def file():
    img, d = canvas()
    d.polygon([(6, 2), (19, 2), (25, 8), (25, 29), (6, 29)], fill=INK, outline=CYAN)
    d.polygon([(19, 2), (19, 8), (25, 8)], fill=MID, outline=CYAN)
    bits = ["1011", "0110", "1101", "0011", "1010", "0111"]
    for r, row in enumerate(bits):
        for i, b in enumerate(row):
            x, y = 9 + i * 3, 11 + r * 3
            d.line([(x, y), (x + (1 if b == "1" else 0), y)], fill=CYAN if b == "1" else BLUE)
    return img


def image():
    img, d = canvas()
    d.rectangle((3, 5, 28, 26), fill=INK, outline=CYAN)
    d.polygon([(5, 24), (12, 14), (17, 20), (21, 16), (26, 24)], fill=MID, outline=BLUE)
    d.ellipse((20, 8, 24, 12), fill=ICE)
    px(d, [(7, 8), (13, 10), (16, 7)], CYAN)
    return img


def run():
    img, d = canvas()
    d.rectangle((2, 4, 29, 27), fill=INK, outline=CYAN)
    d.rectangle((3, 5, 28, 8), fill=BLUE)
    px(d, [(25, 6), (27, 6)], ICE)
    d.line([(6, 12), (9, 15), (6, 18)], fill=GREEN, width=2)
    d.rectangle((12, 17, 16, 18), fill=ICE)
    d.line([(6, 22), (20, 22)], fill=MID)
    return img


def shutdown():
    img, d = canvas()
    d.arc((5, 5, 26, 26), -55, 235, fill=CYAN, width=3)
    d.rectangle((14, 2, 17, 14), fill=CYAN)
    d.line([(15, 3), (15, 12)], fill=ICE)
    return img


ICONS = {
    "computer": computer, "documents": documents, "folder": folder, "recycle": recycle,
    "forgeamp": forgeamp, "forgevision": forgevision, "forgecraft": forgecraft, "browser": browser,
    "notepad": notepad, "control": control, "arcade": arcade, "network": network,
    "info": info, "warning": warning, "question": question, "error": error, "volume": volume,
    "file": file, "image": image, "run": run, "shutdown": shutdown,
}


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
    (OUT / "icons").mkdir(parents=True, exist_ok=True)
    icons = {}
    for name, fn in ICONS.items():
        icons[name] = glow(fn())
        icons[name].save(OUT / "icons" / f"{name}.png")
    mark = logo()
    boot_screen(mark).convert("RGB").save(OUT / "boot.jpg", quality=88, optimize=True)
    logon_banner(mark).convert("RGB").save(OUT / "logon-banner.png", optimize=True)

    cols = 7
    rows = (len(icons) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * 40 + 4, rows * 40 + 4), (4, 8, 26, 255))
    for i, im in enumerate(icons.values()):
        sheet.alpha_composite(im, (4 + (i % cols) * 40, 4 + (i // cols) * 40))
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(HERE / "theme-preview.png")
    print(f"wrote {len(icons)} icons, boot.jpg and logon-banner.png to", OUT.relative_to(HERE.parent.parent.parent))


if __name__ == "__main__":
    main()
