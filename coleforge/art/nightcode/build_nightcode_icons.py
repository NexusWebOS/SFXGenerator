"""Draw the NightCode theme's 16-bit icons.

    python coleforge/art/nightcode/build_nightcode_icons.py

32x32 pixel art in a strict 16-colour NightCode palette, drawn the 16-bit way: black outlines,
3-5 tone shading lit from the top-left with ordered (Bayer) dithering between tones, shaded spheres,
and a white specular pixel or two. Writes coleforge/shell/assets/art/nightcode/icons/<id>.png (same
ids as shell/js/icons.js) and a 4x preview sheet next to this script (theme-preview.png).
"""

import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / "shell" / "assets" / "art" / "nightcode" / "icons"

# The NightCode 16: outline black, three navies, two blues, two cyans, white, three steels (the
# logo's chrome) and four signal colours.
T = (0, 0, 0, 0)
K = (2, 4, 12, 255)
N1, N2, N3 = (10, 20, 48, 255), (19, 38, 90, 255), (29, 63, 143, 255)
B1, B2 = (30, 120, 255, 255), (79, 163, 255, 255)
C1, C2 = (49, 215, 232, 255), (159, 240, 255, 255)
W = (255, 255, 255, 255)
S1, S2, S3 = (90, 106, 136, 255), (159, 176, 200, 255), (219, 230, 242, 255)
G, P, A, M = (60, 255, 158, 255), (255, 92, 138, 255), (255, 196, 77, 255), (106, 10, 38, 255)
PALETTE = {K, N1, N2, N3, B1, B2, C1, C2, W, S1, S2, S3, G, P, A, M}

STEEL = [S1, S2, S3]
NAVY = [N1, N2, N3]
BLUE = [N2, N3, B1, B2]
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
LIGHT = (-0.55, -0.6, 0.58)


def canvas():
    img = Image.new("RGBA", (32, 32), T)
    return img, ImageDraw.Draw(img)


def px(d, pts, c):
    for p in pts:
        d.point(p, fill=c)


def paint(img, shape, ramp, mode="diag", gamma=1.0):
    """Fill a shape (drawn by `shape` on a mask) with a dithered tone ramp (dark → light).

    mode: diag (lit from top-left), h (from the left), v (from the top), up (from the bottom),
    cyl (a cylinder lit left of centre) or sphere (a ball lit from the top-left).
    """
    mask = Image.new("L", img.size, 0)
    shape(ImageDraw.Draw(mask))
    box = mask.getbbox()
    if not box:
        return
    x0, y0, x1, y1 = box
    w, h = max(1, x1 - x0 - 1), max(1, y1 - y0 - 1)
    cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
    lx, ly, lz = LIGHT
    ln = math.sqrt(lx * lx + ly * ly + lz * lz)
    mp, p, n = mask.load(), img.load(), len(ramp)
    for y in range(y0, y1):
        for x in range(x0, x1):
            if not mp[x, y]:
                continue
            u, v = (x - x0) / w, (y - y0) / h
            if mode == "diag":
                t = 1 - (u + v) / 2
            elif mode == "h":
                t = 1 - u
            elif mode == "v":
                t = 1 - v
            elif mode == "up":
                t = v
            elif mode == "cyl":
                t = max(0.0, 1 - abs(u - 0.3) / 0.75)
            else:  # sphere
                dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                nz = math.sqrt(max(0.0, 1 - dx * dx - dy * dy))
                t = max(0.0, (dx * lx + dy * ly + nz * lz) / ln)
            t = min(1.0, max(0.0, t)) ** gamma
            level = t * (n - 1)
            i = int(level)
            if i < n - 1 and level - i > (BAYER[y % 4][x % 4] + 0.5) / 16:
                i += 1
            p[x, y] = ramp[i]


def rect(box):
    return lambda m: m.rectangle(box, fill=255)


def ellipse(box):
    return lambda m: m.ellipse(box, fill=255)


def poly(pts):
    return lambda m: m.polygon(pts, fill=255)


def outline(img):
    """The 16-bit black keyline around every silhouette."""
    src, out = img.load(), img.copy()
    op = out.load()
    for y in range(32):
        for x in range(32):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < 32 and 0 <= ny < 32 and src[nx, ny][3]:
                    op[x, y] = K
                    break
    return out


def glyph(d, rows, ox, oy, c, shadow=None):
    """2x bitmap glyph with an optional 1px drop shadow."""
    for pass_, (col, off) in enumerate(((shadow, 1), (c, 0))):
        if col is None:
            continue
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch == "X":
                    d.rectangle((ox + x * 2 + off, oy + y * 2 + off, ox + x * 2 + 1 + off, oy + y * 2 + 1 + off), fill=col)


def button(d, x, y, col):
    d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=K)
    d.ellipse((x - 1, y - 1, x + 1, y + 1), fill=col)
    px(d, [(x - 1, y - 1)], W)


# ---------------------------------------------------------------- icons
def computer():
    img, d = canvas()
    paint(img, rect((3, 2, 28, 21)), STEEL)
    d.line([(4, 2), (27, 2)], fill=W)
    d.rectangle((5, 4, 26, 18), fill=K)
    paint(img, rect((6, 5, 25, 17)), [N1, N2, N3], gamma=1.6)
    for y in range(6, 17, 2):
        d.line([(6, y), (25, y)], fill=N1)                 # CRT scanlines
    px(d, [(8, 7), (9, 8), (8, 9)], G)
    d.line([(11, 8), (18, 8)], fill=C1)
    d.line([(8, 11), (21, 11)], fill=B2)
    d.line([(8, 13), (16, 13)], fill=B2)
    d.line([(8, 15), (12, 15)], fill=C1)
    d.rectangle((14, 15, 15, 16), fill=C2)
    px(d, [(7, 6), (8, 6), (7, 7)], W)
    px(d, [(6, 20), (8, 20), (10, 20)], S1)
    px(d, [(24, 20), (25, 20)], G)
    paint(img, rect((13, 22, 18, 23)), [S1, S2])
    paint(img, rect((7, 24, 24, 28)), STEEL)
    d.line([(8, 24), (23, 24)], fill=W)
    return outline(img)


def _folder(img, d, paper=False):
    paint(img, rect((3, 5, 12, 8)), BLUE)
    paint(img, rect((3, 7, 28, 26)), [N1, N2, N3])
    if paper:
        paint(img, rect((7, 3, 24, 14)), [S2, S3, W])
        for y, x1 in ((6, 21), (8, 19), (10, 22)):
            d.line([(9, y), (x1, y)], fill=S1)
    paint(img, rect((2, 12, 29, 27)), [N3, B1, B2, C1])
    d.line([(3, 12), (28, 12)], fill=C2)
    d.line([(7, 20), (13, 20)], fill=C2)
    d.line([(13, 20), (13, 23)], fill=C2)
    d.rectangle((12, 23, 14, 25), fill=K)
    px(d, [(13, 24)], C2)
    d.line([(17, 17), (24, 17)], fill=N2)
    d.line([(24, 17), (24, 21)], fill=N2)
    d.rectangle((23, 21, 25, 23), fill=N2)


def folder():
    img, d = canvas()
    _folder(img, d)
    return outline(img)


def documents():
    img, d = canvas()
    _folder(img, d, paper=True)
    return outline(img)


def recycle():
    img, d = canvas()
    paint(img, poly([(8, 10), (23, 10), (21, 29), (10, 29)]), STEEL + [W], mode="cyl")
    for x0, x1 in ((12, 12), (15, 15), (18, 18)):
        d.line([(x0, 13), (x1, 26)], fill=S1)
    paint(img, rect((9, 12, 22, 13)), [N3, B1, C1], mode="h")
    paint(img, rect((6, 7, 25, 9)), STEEL)
    d.line([(7, 7), (24, 7)], fill=W)
    d.rectangle((13, 4, 18, 6), fill=S2)
    d.rectangle((14, 5, 17, 6), fill=T)
    return outline(img)


def forgeamp():
    img, d = canvas()
    paint(img, rect((2, 4, 29, 28)), NAVY)
    d.line([(3, 4), (28, 4)], fill=N3)
    d.rectangle((4, 6, 27, 17), fill=K)
    d.rectangle((5, 7, 26, 16), fill=N1)
    for x, top in ((15, 12), (18, 9), (21, 11), (24, 8)):
        for y in range(top, 16):
            c = C2 if y <= top else C1 if y <= top + 2 else B1
            d.line([(x, y), (x + 1, y)], fill=c)
    d.ellipse((6, 12, 10, 15), fill=C2)
    d.line([(10, 8), (10, 13)], fill=C2)
    px(d, [(11, 8), (12, 9), (12, 10)], C2)
    px(d, [(7, 12)], W)
    for x in (8, 15):
        d.ellipse((x - 3, 20, x + 3, 26), fill=K)
        paint(img, ellipse((x - 2, 21, x + 2, 25)), STEEL + [W], mode="sphere")
    paint(img, rect((20, 21, 27, 25)), BLUE)
    px(d, [(26, 19)], P)
    px(d, [(24, 19)], G)
    return outline(img)


def forgevision():
    img, d = canvas()
    paint(img, rect((2, 2, 29, 7)), STEEL)
    for x in range(3, 28, 6):
        d.polygon([(x, 3), (x + 2, 3), (x + 4, 6), (x + 2, 6)], fill=N1)
    paint(img, rect((2, 9, 29, 28)), NAVY)
    d.rectangle((4, 11, 27, 26), fill=K)
    d.rectangle((5, 12, 26, 25), fill=N1)
    paint(img, poly([(11, 13), (11, 24), (21, 18)]), [N3, B1, B2, C1])
    d.line([(12, 15), (12, 22)], fill=C2)
    px(d, [(12, 14)], W)
    for x in range(6, 26, 4):
        px(d, [(x, 27)], N3)
    return outline(img)


def forgecraft():
    img, d = canvas()
    paint(img, ellipse((2, 7, 27, 29)), STEEL + [W])
    d.ellipse((6, 19, 10, 23), fill=T)
    for (x, y), col in (((9, 12), P), ((15, 10), A), ((21, 12), G), ((19, 19), B1), ((13, 24), C1)):
        d.ellipse((x - 2, y - 2, x + 1, y + 1), fill=col)
        px(d, [(x - 1, y - 1)], W)
        px(d, [(x, y), (x + 1, y - 1)], K)
    d.line([(13, 30), (23, 16)], fill=N3, width=2)
    d.line([(13, 29), (22, 16)], fill=B1)
    d.line([(23, 16), (25, 13)], fill=S3, width=2)
    d.polygon([(25, 13), (27, 8), (29, 6), (28, 10)], fill=C1)
    px(d, [(28, 7), (27, 9)], C2)
    return outline(img)


def browser():
    img, d = canvas()
    paint(img, ellipse((3, 3, 28, 28)), [N2, N3, B1, B2, C1], mode="sphere")
    for x in range(4, 28, 2):
        px(d, [(x, 16)], C2)                                # dotted equator and latitudes
    for x in range(7, 25, 2):
        px(d, [(x, 10), (x, 22)], C2)
    for y in range(4, 28, 2):
        px(d, [(15, y)], C2)
    d.arc((9, 3, 22, 28), 90, 270, fill=N2)
    d.arc((9, 3, 22, 28), -90, 90, fill=N2)
    px(d, [(9, 7), (10, 6), (8, 8)], W)
    d.arc((1, 11, 30, 22), 5, 175, fill=S3)                 # orbit ring passing in front
    d.arc((1, 12, 30, 23), 20, 160, fill=S1)
    return outline(img)


def notepad():
    img, d = canvas()
    paint(img, rect((5, 4, 25, 29)), [S2, S3, W])
    d.line([(25, 5), (25, 29)], fill=S1)
    d.line([(6, 29), (25, 29)], fill=S1)
    for x in (8, 12, 16, 20):
        d.rectangle((x, 2, x + 1, 5), fill=S1)
        px(d, [(x, 2)], S3)
    for y, x0, x1, c in ((9, 8, 14, N3), (12, 10, 19, B1), (15, 10, 17, B1), (18, 8, 12, N3), (21, 10, 20, B1), (24, 8, 15, N3)):
        d.line([(x0, y), (x1, y)], fill=c)
    d.line([(19, 29), (28, 17)], fill=A, width=3)
    d.line([(19, 28), (27, 17)], fill=W)
    d.polygon([(28, 15), (30, 16), (29, 18), (27, 17)], fill=P)
    px(d, [(18, 30), (19, 30)], S3)
    px(d, [(17, 31)], K)
    return outline(img)


def control():
    img, d = canvas()
    paint(img, rect((2, 3, 29, 28)), STEEL)
    d.line([(3, 3), (28, 3)], fill=W)
    for x, knob in ((8, 10), (15, 18), (22, 13)):
        d.rectangle((x, 7, x + 1, 24), fill=N1)
        px(d, [(x, 7)], K)
        d.rectangle((x - 3, knob - 1, x + 4, knob + 3), fill=K)
        paint(img, rect((x - 2, knob, x + 3, knob + 2)), BLUE + [C1])
    px(d, [(5, 26), (6, 26)], G)
    px(d, [(9, 26)], P)
    return outline(img)


def arcade():
    img, d = canvas()

    def pad(m):
        m.ellipse((2, 11, 14, 26), fill=255)
        m.ellipse((17, 11, 29, 26), fill=255)
        m.rectangle((8, 11, 23, 24), fill=255)

    paint(img, pad, STEEL + [W])
    d.rectangle((5, 17, 11, 19), fill=N1)
    d.rectangle((7, 15, 9, 21), fill=N1)
    px(d, [(8, 18)], N3)
    px(d, [(7, 15), (5, 17)], S1)
    for (x, y), col in (((23, 14), B1), ((26, 17), G), ((20, 17), A), ((23, 20), P)):
        button(d, x, y, col)
    d.line([(12, 21), (14, 20)], fill=N2)
    d.line([(16, 21), (18, 20)], fill=N2)
    d.line([(6, 11), (12, 11)], fill=W)
    return outline(img)


def network():
    img, d = canvas()
    for x0 in (1, 18):
        paint(img, rect((x0, 2, x0 + 12, 12)), STEEL)
        d.rectangle((x0 + 2, 4, x0 + 10, 10), fill=K)
        d.rectangle((x0 + 3, 5, x0 + 9, 9), fill=N2)
        d.line([(x0 + 4, 6), (x0 + 7, 6)], fill=C1)
        d.line([(x0 + 4, 8), (x0 + 6, 8)], fill=G)
    for pts in (((7, 13), (7, 17)), ((24, 13), (24, 17)), ((7, 17), (24, 17)), ((15, 17), (15, 21))):
        d.line([(pts[0][0] + 1, pts[0][1] + 1), (pts[1][0] + 1, pts[1][1] + 1)], fill=N2)
        d.line(list(pts), fill=B2)
    paint(img, rect((8, 21, 23, 28)), BLUE)
    d.line([(9, 21), (22, 21)], fill=C1)
    for x, col in ((11, G), (14, G), (17, A), (20, G)):
        px(d, [(x, 25)], col)
        px(d, [(x, 26)], K)
    return outline(img)


def _badge(ramp, rows, oy, fg=W, shadow=N1):
    img, d = canvas()
    paint(img, ellipse((2, 2, 29, 29)), ramp, mode="sphere")
    glyph(d, rows, 16 - len(rows[0]), oy, fg, shadow)
    px(d, [(9, 6), (8, 7), (10, 6)], W)
    return outline(img)


def info():
    return _badge([N2, N3, B1, B2, C1], ["XX", "XX", "..", "XX", "XX", "XX", "XX", "XX", "XX"], 7)


def question():
    return _badge([N2, N3, B1, B2, C1], [".XXXX.", "XX..XX", "....XX", "...XX.", "..XX..", "..XX..", "......", "..XX.."], 8)


def error():
    return _badge([M, M, P, P], ["XX...XX", ".XX.XX.", "..XXX..", ".XX.XX.", "XX...XX"], 11, fg=W, shadow=M)


def warning():
    img, d = canvas()
    paint(img, poly([(15, 2), (16, 2), (30, 28), (1, 28)]), [M, A, A, A, W], mode="diag", gamma=0.8)
    glyph(d, ["XX", "XX", "XX", "XX", "XX", "..", "XX"], 14, 10, K)
    return outline(img)


def volume():
    img, d = canvas()
    paint(img, poly([(9, 11), (16, 4), (16, 27), (9, 20)]), STEEL)
    paint(img, rect((3, 11, 9, 20)), BLUE)
    d.line([(4, 11), (8, 11)], fill=C1)
    d.line([(16, 5), (16, 26)], fill=S1)
    d.arc((11, 9, 22, 22), -50, 50, fill=C1, width=2)
    d.arc((11, 4, 29, 27), -50, 50, fill=B2, width=2)
    px(d, [(21, 9), (26, 6)], C2)
    return outline(img)


def file():
    img, d = canvas()
    paint(img, poly([(6, 2), (19, 2), (25, 8), (25, 29), (6, 29)]), [S2, S3, W])
    paint(img, poly([(19, 2), (19, 8), (25, 8)]), [S1, S2])
    d.line([(19, 2), (19, 8), (25, 8)], fill=S1)
    d.line([(25, 9), (25, 29)], fill=S1)
    for r, row in enumerate(["1011", "0110", "1101", "0011", "1010", "0111"]):
        for i, b in enumerate(row):
            x, y = 9 + i * 3, 12 + r * 3
            d.rectangle((x, y, x + 1, y), fill=B1 if b == "1" else N3)
    return outline(img)


def image():
    img, d = canvas()
    paint(img, rect((2, 5, 29, 26)), STEEL)
    d.rectangle((4, 7, 27, 24), fill=K)
    paint(img, rect((5, 8, 26, 23)), [N1, N2, N3, B1], mode="up")
    px(d, [(8, 10), (13, 12), (11, 9), (16, 10)], W)
    paint(img, ellipse((19, 9, 24, 14)), [S2, S3, W], mode="sphere")
    paint(img, poly([(5, 23), (11, 14), (15, 19), (19, 15), (26, 23)]), NAVY)
    px(d, [(11, 14), (10, 15), (12, 15), (19, 15), (18, 16), (20, 16)], W)
    return outline(img)


def run():
    img, d = canvas()
    paint(img, rect((2, 4, 29, 27)), STEEL)
    paint(img, rect((3, 5, 28, 8)), [N3, B1, B2], mode="h")
    px(d, [(25, 6), (27, 6)], W)
    d.rectangle((4, 10, 27, 25), fill=K)
    d.rectangle((5, 11, 26, 24), fill=N1)
    for x0 in (7, 8):
        px(d, [(x0, 13), (x0 + 1, 14), (x0 + 2, 15), (x0 + 1, 16), (x0, 17)], G)
    d.rectangle((12, 16, 15, 17), fill=C2)
    d.line([(7, 21), (19, 21)], fill=N3)
    return outline(img)


def shutdown():
    img, d = canvas()
    paint(img, ellipse((2, 2, 29, 29)), STEEL + [W], mode="sphere")
    d.arc((4, 4, 27, 27), 0, 360, fill=S1)
    d.arc((8, 8, 23, 23), -60, 240, fill=N3, width=4)
    d.arc((9, 9, 22, 22), -58, 238, fill=B1, width=2)
    d.rectangle((14, 5, 17, 15), fill=N3)
    d.rectangle((15, 6, 16, 14), fill=C1)
    px(d, [(15, 6)], C2)
    return outline(img)


ICONS = {
    "computer": computer, "documents": documents, "folder": folder, "recycle": recycle,
    "forgeamp": forgeamp, "forgevision": forgevision, "forgecraft": forgecraft, "browser": browser,
    "notepad": notepad, "control": control, "arcade": arcade, "network": network,
    "info": info, "warning": warning, "question": question, "error": error, "volume": volume,
    "file": file, "image": image, "run": run, "shutdown": shutdown,
}


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    icons = {}
    for name, fn in ICONS.items():
        im = fn()
        pixels = getattr(im, "get_flattened_data", im.getdata)()
        stray = {c for c in pixels if c[3] and c not in PALETTE}
        if stray:
            raise SystemExit(f"{name}: colours outside the NightCode 16: {sorted(stray)[:4]}")
        im.save(OUT / f"{name}.png")
        icons[name] = im
    cols = 7
    rows = (len(icons) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * 40 + 4, rows * 40 + 4), (4, 8, 26, 255))
    for i, im in enumerate(icons.values()):
        sheet.alpha_composite(im, (4 + (i % cols) * 40, 4 + (i // cols) * 40))
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(HERE / "theme-preview.png")
    return icons


if __name__ == "__main__":
    print(f"wrote {len(build())} 16-bit NightCode icons to", OUT.relative_to(HERE.parent.parent.parent))
