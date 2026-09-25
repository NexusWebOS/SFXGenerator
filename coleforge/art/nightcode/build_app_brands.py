"""Draw the 16-bit brand art for NightAmp, NightBrowser, Netcon and Disk Dude.

    python coleforge/art/nightcode/build_app_brands.py

Each program gets icons drawn natively at 64x64 and 32x32 (16x16 and 48x48 are reduced from those),
a chrome pixel wordmark logo (680x170), and NightAmp/NightBrowser their start-up splashes (560x315).
Everything is in the NightCode 16-colour palette with black keylines, dithered shading lit from the
top-left and white specular pixels. Writes:

  shell/assets/art/nightapps/{nightamp,nightbrowser}{,-16,-64}.png, -logo.png, -splash.png
  shell/assets/art/programs/{netcon,diskdude}{,-16,-64}.png, -logo.png
  programs/retro-tools/assets/{netcon,disk-dude}-logo.png, .ico
  art/nightcode/brands-preview.png
"""

import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from build_nightcode_icons import (A, B1, B2, BAYER, C1, C2, G, K, M, N1, N2, N3, P, PALETTE, S1, S2, S3, T, W,  # noqa: E402
                                   ellipse, outline, paint, poly, px, rect)

ROOT = HERE.parent.parent
ART = ROOT / "shell" / "assets" / "art"
TOOLS = ROOT / "programs" / "retro-tools" / "assets"
FONTS = ROOT / "shell" / "assets" / "fonts"
V = (134, 101, 220, 255)          # Netcon / Disk Dude violet (their mascots' accent)
V2 = (190, 170, 255, 255)
STEEL = [S1, S2, S3, W]
NIGHT = [N1, N2, N3]


def new(n):
    img = Image.new("RGBA", (n, n), T)
    return img, ImageDraw.Draw(img)


class Pen:
    """Draws in a 64-unit space on a canvas of any size (64 or 32), so each icon is drawn natively."""

    def __init__(self, n):
        self.n, self.f = n, n / 64
        self.img, self.d = new(n)

    def p(self, v):
        return int(round(v * self.f))

    def box(self, b):
        x0, y0, x1, y1 = b
        return (self.p(x0), self.p(y0), max(self.p(x0), self.p(x1) - (1 if self.f < 1 else 0)), max(self.p(y0), self.p(y1) - (1 if self.f < 1 else 0)))

    def pts(self, pts):
        return [(self.p(x), self.p(y)) for x, y in pts]

    def fill(self, shape, b, ramp, mode="diag", gamma=1.0):
        m = {"rect": rect, "ellipse": ellipse}[shape](self.box(b)) if shape != "poly" else poly(self.pts(b))
        paint(self.img, m, ramp, mode=mode, gamma=gamma)

    def rect(self, b, c):
        self.d.rectangle(self.box(b), fill=c)

    def ell(self, b, c):
        self.d.ellipse(self.box(b), fill=c)

    def line(self, pts, c, w=1):
        self.d.line(self.pts(pts), fill=c, width=max(1, self.p(w)))

    def dot(self, pts, c):
        px(self.d, self.pts(pts), c)

    def arc(self, b, a0, a1, c, w=1):
        self.d.arc(self.box(b), a0, a1, fill=c, width=max(1, self.p(w)))

    def done(self):
        return outline(self.img)


# ------------------------------------------------------------------------------------ NightAmp
def nightamp_icon(n):
    """A chrome crescent moon cradling a glowing equalizer, with a note riding the top bar."""
    q = Pen(n)
    # the moon: a steel disc with a bite taken out, dithered from the top-left
    moon = Image.new("L", (n, n), 0)
    md = ImageDraw.Draw(moon)
    md.ellipse(q.box((3, 3, 61, 61)), fill=255)
    md.ellipse(q.box((17, -3, 73, 53)), fill=0)
    layer, _ = new(n)
    paint(layer, lambda m: m.bitmap((0, 0), moon, fill=255), [N3, B1, B2, C1, C2], mode="diag", gamma=0.85)
    q.img.alpha_composite(layer)
    q.dot([(9, 22), (9, 23), (10, 19), (11, 16), (12, 14)], W)            # rim light on the moon's edge
    # equalizer bars inside the crescent's hollow, tall in the middle
    bars = [(23, 40), (31, 28), (39, 20), (47, 30), (55, 38)]
    for i, (x, top) in enumerate(bars):
        q.fill("rect", (x, top, x + 5, 56), [N3, B1, C1, G] if i % 2 == 0 else [N3, B1, B2, C1], mode="up")
        q.rect((x, top - 5, x + 5, top - 3), W if i == 2 else C2)         # peak caps
    q.rect((22, 56, 60, 59), N1)                                          # the stage the bars stand on
    q.line([(22, 56), (60, 56)], N3)
    # a note on the tallest bar
    q.rect((49, 3, 51, 13), A); q.ell((44, 10, 51, 16), A)            # an eighth note, flag curling down
    q.line([(51, 3), (55, 6), (56, 9), (55, 11)], A, 2)
    q.dot([(45, 11)], W)
    return q.done()


# ---------------------------------------------------------------------------------- NightBrowser
def nightbrowser_icon(n):
    """The Earth half in night (city lights), a cyan orbit ring and a comet-cursor streaking past."""
    q = Pen(n)
    q.fill("ellipse", (6, 6, 58, 58), [N2, N3, B1, B2, C1], mode="sphere")
    g = q.img.load()
    # night side, with a dithered terminator
    for y in range(n):
        for x in range(n):
            if not g[x, y][3]:
                continue
            u = x / q.f - (40 + (y / q.f - 32) * 0.35)
            if u > 3 or (u > 0 and BAYER[y % 4][x % 4] < u * 5):
                g[x, y] = N1 if (x * 3 + y) % 7 else N2
    # continents on the lit side
    for pts in ([(11, 22), (18, 15), (27, 16), (29, 23), (24, 27), (30, 34), (27, 42), (20, 40), (16, 31), (11, 29)],
                [(22, 44), (31, 43), (35, 49), (29, 53), (23, 51)], [(29, 12), (37, 10), (40, 16), (33, 19)]):
        q.fill("poly", pts, [(20, 100, 60, 255), G, C2], mode="diag")
    for pt in ((44, 20), (48, 24), (46, 31), (51, 33), (44, 38), (49, 42), (42, 46), (53, 27)):
        q.dot([pt], A)                                                   # city lights
    q.dot([(48, 24), (46, 31)], W)
    q.dot([(16, 12), (15, 13), (17, 12), (18, 11)], W)                   # specular
    # the orbit ring: behind the globe on top, in front at the bottom
    q.arc((0, 26, 64, 46), 0, 180, C1, 2)
    q.arc((1, 27, 63, 45), 10, 170, B1, 1)
    # the comet-cursor: a pixel arrow with a tail of stars
    arrow = [(44, 42), (44, 62), (49, 57), (53, 64), (57, 62), (53, 55), (60, 55)]
    q.fill("poly", arrow, [S2, S3, W], mode="diag")
    q.dot([(40, 60), (36, 62), (33, 58), (38, 56)], C2)                # sparkle trail
    q.dot([(36, 62)], W)
    return q.done()


# -------------------------------------------------------------------------------------- Netcon
def netcon_icon(n):
    """An ID badge on a lanyard clip, over a circuit board, with RFID waves."""
    q = Pen(n)
    # circuit board behind, tilted feel via offset
    q.fill("rect", (30, 22, 62, 56), [(10, 60, 40, 255), (20, 100, 60, 255), G], mode="diag", gamma=1.6)
    for y in (28, 36, 44, 50):
        q.line([(34, y), (58, y)], A)
    q.fill("rect", (42, 30, 54, 44), [K, N1, N2], mode="diag")            # the chip
    for x in (43, 46, 49, 52):
        q.dot([(x, 29), (x, 45)], S3)
    q.dot([(44, 32)], C1)
    # the badge
    q.fill("rect", (6, 14, 36, 60), [S2, S3, W], mode="diag", gamma=0.7)
    q.fill("rect", (6, 14, 36, 22), [V, V2], mode="h")                      # header stripe
    q.rect((9, 17, 20, 19), W)
    q.fill("rect", (10, 26, 22, 40), [N2, N3, B1], mode="v")                # photo
    q.ell((13, 27, 19, 33), C1); q.fill("rect", (11, 34, 21, 40), [B1, C1], mode="v")
    q.rect((24, 27, 33, 28), N2); q.rect((24, 31, 31, 32), S1); q.rect((24, 35, 32, 36), S1)
    for i, x in enumerate(range(10, 33, 2)):                               # barcode
        q.rect((x, 46, x + (1 if i % 3 else 0), 55), K)
    q.rect((8, 57, 34, 58), S1)
    # the clip and lanyard
    q.fill("rect", (17, 4, 25, 15), [S1, S2, S3], mode="h")
    q.rect((19, 7, 23, 10), K)
    q.line([(19, 0), (21, 4)], V); q.line([(25, 0), (23, 4)], V)
    # RFID waves
    for r, c in ((6, C2), (11, C1), (16, B2)):
        q.arc((50 - r, 8 - r, 50 + r, 8 + r), 200, 340, c, 2)
    q.dot([(50, 8)], W)
    return q.done()


# ------------------------------------------------------------------------------------ Disk Dude
def diskdude_icon(n):
    """Disk Dude himself: a shiny CD wearing shades and a grin, hood up, peeking over a jewel case."""
    q = Pen(n)
    # jewel case behind
    q.fill("rect", (34, 30, 63, 63), [N2, N3, B1], mode="diag")
    q.rect((36, 32, 61, 61), (30, 50, 110, 255))
    q.line([(36, 32), (61, 32)], C2); q.line([(38, 36), (38, 59)], B2)
    # the hood (navy, like his hoodie) behind the disc
    q.fill("ellipse", (2, 0, 56, 56), [N1, N2, N3], mode="diag")
    # the disc with an iridescent sheen
    disc = Image.new("L", (n, n), 0)
    ImageDraw.Draw(disc).ellipse(q.box((7, 7, 51, 51)), fill=255)
    dp, g = disc.load(), q.img.load()
    cx, cy, R = 29 * q.f, 29 * q.f, 22 * q.f
    sheen = [S1, S2, S3, C2, V2, S3, A, S2, C1, S3]
    for y in range(n):
        for x in range(n):
            if not dp[x, y]:
                continue
            ang = (math.atan2(y - cy, x - cx) + math.pi) / (2 * math.pi)
            r = math.hypot(x - cx, y - cy) / R
            k = (ang * len(sheen) * 2 + r * 1.5 + (BAYER[y % 4][x % 4] / 16)) % len(sheen)
            g[x, y] = sheen[int(k)]
    q.ell((25, 25, 33, 33), S1); q.ell((27, 27, 31, 31), N1)          # the hub hole is his nose
    q.dot([(12, 20), (13, 17), (15, 14), (17, 12)], W)
    # shades and grin
    q.rect((11, 15, 47, 17), K)
    q.fill("rect", (11, 16, 27, 24), [K, N1, N2], mode="diag"); q.fill("rect", (31, 16, 47, 24), [K, N1, N2], mode="diag")
    q.dot([(13, 17), (14, 17), (15, 17), (33, 17), (34, 17), (35, 17)], C2)
    q.d.pieslice(q.box((15, 26, 43, 46)), 0, 180, fill=K)              # a big grin
    q.rect((19, 36, 39, 38), W)                                          # teeth
    q.rect((29, 36, 29, 38), S2)
    q.fill("ellipse", (24, 40, 34, 45), [M, P], mode="v")                # tongue
    return q.done()


# ------------------------------------------------------------------------------------- SFX Lab
def sfxlab_icon(n):
    """A little speaker blasting a square wave, with a coin and a spark flying out."""
    q = Pen(n)
    q.fill("rect", (4, 22, 16, 42), STEEL[:3], mode="h")                   # speaker body
    q.fill("poly", [(16, 22), (30, 8), (30, 56), (16, 42)], [S1, S2, S3], mode="h")
    q.fill("ellipse", (24, 26, 34, 38), [N1, N2, N3], mode="diag")         # cone
    q.dot([(6, 24), (7, 24), (18, 21)], W)
    # the square wave
    wave = [(34, 40), (38, 40), (38, 22), (46, 22), (46, 40), (54, 40), (54, 22), (60, 22)]
    q.line(wave, C1, 3)
    q.line([(x, y - 1) for x, y in wave], C2, 1)
    # a coin and a spark
    q.fill("ellipse", (44, 44, 58, 58), [M, A, (255, 228, 150, 255), W], mode="sphere")
    q.rect((50, 47, 51, 55), M)
    for (x, y) in ((40, 8), (56, 6)):
        q.line([(x - 3, y), (x + 3, y)], A); q.line([(x, y - 3), (x, y + 3)], A); q.dot([(x, y)], W)
    return q.done()


# -------------------------------------------------------------------------------- Task Manager
def taskman_icon(n):
    """A monitor showing a green performance graph, with a red End Task button."""
    q = Pen(n)
    q.fill("rect", (4, 6, 60, 46), [S1, S2, S3], mode="diag")
    q.fill("rect", (9, 11, 55, 41), [K, N1], mode="v")
    for x in range(13, 55, 8):
        q.line([(x, 12), (x, 40)], (10, 60, 40, 255))
    for y in (18, 26, 34):
        q.line([(10, y), (54, y)], (10, 60, 40, 255))
    q.line([(10, 34), (18, 30), (24, 36), (32, 20), (38, 26), (46, 16), (54, 22)], G, 2)
    q.fill("rect", (26, 46, 38, 52), [S1, S2], mode="h")                    # stand
    q.fill("rect", (16, 52, 48, 58), [S1, S2, S3], mode="v")
    q.fill("ellipse", (44, 40, 62, 58), [M, P, (255, 160, 190, 255)], mode="sphere")   # End Task button
    q.line([(49, 45), (57, 53)], W, 2); q.line([(57, 45), (49, 53)], W, 2)
    q.dot([(12, 13)], W)
    return q.done()


ICONS = {"nightamp": nightamp_icon, "nightbrowser": nightbrowser_icon, "netcon": netcon_icon, "diskdude": diskdude_icon, "sfxlab": sfxlab_icon, "taskman": taskman_icon}


def snap(im):
    """Reduce an icon (48, 16) and snap it back onto the palette, keeping hard alpha."""
    pal = list(PALETTE) + [V, V2, (10, 60, 40, 255), (20, 100, 60, 255), (30, 50, 110, 255)]
    out = im.copy()
    p = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = p[x, y]
            if a < 110:
                p[x, y] = T
                continue
            p[x, y] = min(pal, key=lambda c: (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2)
    return out


def reduce(im, size):
    return snap(im.resize((size, size), Image.LANCZOS))


# ------------------------------------------------------------------------------------ wordmarks
def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def pixel_text(text, size, scale, fnt="Orbitron-Black.ttf", spacing=1):
    """Text rendered without anti-aliasing, then blown up: a crisp pixel wordmark."""
    f = font(fnt, size)
    w = int(sum(f.getlength(c) + spacing for c in text)) + 4
    h = size + size // 2
    m = Image.new("1", (w, h), 0)
    d = ImageDraw.Draw(m)
    d.fontmode = "1"
    x = 1
    for c in text:
        d.text((x, 0), c, font=f, fill=1)
        x += f.getlength(c) + spacing
    m = m.crop(m.getbbox())
    return m.resize((m.width * scale, m.height * scale), Image.NEAREST), scale


def chrome_word(text, size=30, scale=3, ramp=None, rim=C1):
    """A chrome wordmark: dithered steel bands, a dark horizon line, black keyline, colored rim, glow."""
    ramp = ramp or [S1, S2, S3, W, S3, S2, S1, N3, B1, B2, C1]
    mask, s = pixel_text(text, size, scale, fnt="Orbitron-Bold.ttf", spacing=max(3, size // 7))
    w, h = mask.size
    pad = 3 * s
    out = Image.new("RGBA", (w + pad * 2, h + pad * 2), T)
    mp = mask.load()
    body = Image.new("RGBA", mask.size, T)
    bp = body.load()
    rows = h // s
    for y in range(h):
        row = y // s
        t = row / max(1, rows - 1)
        level = t * (len(ramp) - 1)
        for x in range(w):
            if mp[x, y]:
                i = int(level)
                if i < len(ramp) - 1 and level - i > (BAYER[row % 4][(x // s) % 4] + 0.5) / 16:
                    i += 1
                bp[x, y] = ramp[i]
    # keyline (one "pixel" = s) and a coloured rim under it
    a = body.split()[-1]
    key = a.filter(ImageFilter.MaxFilter(2 * s + 1))
    rim_a = a.filter(ImageFilter.MaxFilter(3 * s + (s % 2 == 0)))
    glow = rim_a.filter(ImageFilter.GaussianBlur(3 * s)).point(lambda v: int(v * 0.7))
    g = Image.new("RGBA", out.size, T); g.paste(Image.new("RGBA", mask.size, B1[:3] + (255,)), (pad, pad), glow); out.alpha_composite(g)
    r = Image.new("RGBA", out.size, T); r.paste(Image.new("RGBA", mask.size, rim), (pad, pad), rim_a); out.alpha_composite(r)
    k = Image.new("RGBA", out.size, T); k.paste(Image.new("RGBA", mask.size, K), (pad, pad), key); out.alpha_composite(k)
    out.alpha_composite(body, (pad, pad))
    # specular glints along the top edge
    op = out.load()
    rnd = random.Random(text)
    for _ in range(max(3, len(text))):
        x = pad + rnd.randrange(0, w // s) * s
        for yy in range(h):
            if mp[min(w - 1, x - pad + s // 2), yy] if 0 <= x - pad < w else False:
                for dy in range(s):
                    for dx in range(s):
                        op[x + dx, pad + yy + dy] = W
                break
    return out


def small_caps(text, color, size=13, scale=2, spacing=1, fit=None):
    """Small pixel text; with fit=width it steps down (smaller scale, then smaller size) until it fits."""
    if fit:
        for sc, sz in ((scale, size), (1, size + 6), (1, size + 3), (1, size), (1, size - 2)):
            out = small_caps(text, color, sz, sc, spacing)
            if out.width <= fit:
                return out
        return out
    mask, s = pixel_text(text, size, scale, fnt="ShareTechMono-Regular.ttf", spacing=spacing)
    out = Image.new("RGBA", (mask.width + s, mask.height + s), T)
    out.paste(Image.new("RGBA", mask.size, K), (s, s), mask)
    out.paste(Image.new("RGBA", mask.size, color), (0, 0), mask)
    return out


def logo(name, word, tagline, icon, accent=C1, ramp=None, w=680, h=170):
    """680x170 banner: the 64px icon at 2x, the chrome wordmark and a tagline, on a dark plate."""
    img = Image.new("RGBA", (w, h), T)
    d = ImageDraw.Draw(img)
    # plate with a bevel, circuit traces and scanlines
    d.rectangle((0, 0, w - 1, h - 1), fill=(5, 10, 26, 255))
    for y in range(0, h, 3):
        d.line([(0, y), (w, y)], fill=(8, 16, 38, 255))
    rnd = random.Random(name)
    for _ in range(14):
        x, y = rnd.randrange(150, w - 20), rnd.randrange(10, h - 10)
        L = rnd.randrange(20, 90)
        d.line([(x, y), (x + L, y)], fill=(16, 34, 78, 255), width=2)
        d.line([(x + L, y), (x + L + 12, y + (12 if y < h / 2 else -12))], fill=(16, 34, 78, 255), width=2)
        d.rectangle((x + L + 10, y + (10 if y < h / 2 else -14), x + L + 14, y + (14 if y < h / 2 else -10)), outline=(30, 60, 130, 255))
    d.rectangle((0, 0, w - 1, h - 1), outline=accent)
    d.rectangle((2, 2, w - 3, h - 3), outline=(19, 38, 90, 255))
    d.rectangle((4, 4, 9, h - 5), fill=accent)
    # the icon, big, with a glow
    big = icon.resize((128, 128), Image.NEAREST)
    halo = Image.new("RGBA", (168, 168), T)
    halo.paste(Image.new("RGBA", (128, 128), accent), (20, 20), big.split()[-1])
    img.alpha_composite(halo.filter(ImageFilter.GaussianBlur(10)), (8, 1))
    img.alpha_composite(big, (28, 21))
    word_img = chrome_word(word, ramp=ramp, rim=accent)
    if word_img.width > w - 190:
        word_img = word_img.resize((w - 190, int(word_img.height * (w - 190) / word_img.width)), Image.NEAREST)
    tag = small_caps(tagline, accent, fit=w - 196)
    top = (h - (word_img.height + 12 + tag.height)) // 2
    img.alpha_composite(word_img, (170, top))
    ImageDraw.Draw(img).line([(178, top + word_img.height + 4), (w - 24, top + word_img.height + 4)], fill=(19, 38, 90, 255), width=2)
    img.alpha_composite(tag, (178, top + word_img.height + 12))
    return img


def splash(icon, word, tagline, lines, accent, mark, ramp=None):
    """560x315 start-up splash: a night skyline, the icon big, the chrome wordmark and details."""
    w, h = 560, 315
    img = Image.new("RGBA", (w, h), T)
    d = ImageDraw.Draw(img)
    for y in range(h):                                                     # banded night sky
        t = y / h
        band = int(t * 7)
        c = [(2, 5, 14), (4, 10, 28), (7, 16, 42), (10, 22, 58), (14, 30, 76), (19, 38, 90), (22, 44, 104)][band]
        d.line([(0, y), (w, y)], fill=c + (255,))
        if (y % 2) and band < 6 and random.Random(y).random() < 0.5:
            d.line([(0, y), (w, y)], fill=[(2, 5, 14), (4, 10, 28), (7, 16, 42), (10, 22, 58), (14, 30, 76), (19, 38, 90), (22, 44, 104)][band + 1] + (255,))
    rnd = random.Random(word)
    for _ in range(90):                                                   # stars
        x, y = rnd.randrange(w), rnd.randrange(int(h * 0.6))
        d.point((x, y), fill=rnd.choice([S2, S3, W, C2]))
    for _ in range(6):
        x, y = rnd.randrange(w), rnd.randrange(int(h * 0.5))
        d.line([(x - 2, y), (x + 2, y)], fill=C2); d.line([(x, y - 2), (x, y + 2)], fill=C2); d.point((x, y), fill=W)
    x = 0                                                                  # skyline
    while x < w:
        bw, bh = rnd.randrange(18, 46), rnd.randrange(30, 110)
        d.rectangle((x, h - bh, x + bw, h), fill=(5, 10, 26, 255))
        d.line([(x, h - bh), (x + bw, h - bh)], fill=(19, 38, 90, 255))
        for wy in range(h - bh + 6, h - 6, 7):
            for wx in range(x + 4, x + bw - 3, 6):
                if rnd.random() < 0.28:
                    d.rectangle((wx, wy, wx + 1, wy + 2), fill=rnd.choice([A, C1, (255, 220, 140, 255)]))
        x += bw + rnd.randrange(0, 6)
    # the icon, 3x, with its glow
    big = icon.resize((192, 192), Image.NEAREST)
    halo = Image.new("RGBA", (240, 240), T)
    halo.paste(Image.new("RGBA", (192, 192), accent), (24, 24), big.split()[-1])
    img.alpha_composite(halo.filter(ImageFilter.GaussianBlur(14)), (0, 30))
    img.alpha_composite(big, (24, 54))
    word_img = chrome_word(word, size=28, scale=2, ramp=ramp, rim=accent)
    if word_img.width > w - 236:
        word_img = word_img.resize((w - 236, int(word_img.height * (w - 236) / word_img.width)), Image.NEAREST)
    img.alpha_composite(word_img, (224, 64))
    y = 64 + word_img.height + 6
    tg = small_caps(tagline, accent, size=12, fit=w - 244)
    img.alpha_composite(tg, (232, y))
    y += tg.height + 10
    for line in lines:
        img.alpha_composite(small_caps(line, (150, 190, 230, 255), size=11, scale=1, spacing=0), (234, y))
        y += 16
    if mark is not None:
        m = mark.copy(); m.thumbnail((52, 52), Image.LANCZOS)
        img.alpha_composite(m, (w - m.width - 12, h - m.height - 10))
    img.alpha_composite(small_caps("OFFICIAL COLEFORGE PROGRAM · NIGHTCODE", (95, 128, 171, 255), size=11, scale=1, spacing=0), (14, h - 22))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, w - 1, h - 1), outline=accent)
    d.rectangle((1, 1, w - 2, h - 2), outline=K)
    return img


def main():
    (ART / "nightapps").mkdir(parents=True, exist_ok=True)
    (ART / "programs").mkdir(parents=True, exist_ok=True)
    mark_path = ART / "nightcode" / "logo-128.png"
    mark = Image.open(mark_path).convert("RGBA") if mark_path.exists() else None
    drawn = {}
    for name, fn in ICONS.items():
        i64, i32 = fn(64), fn(32)
        drawn[name] = (i64, i32)
        folder = ART / ("programs" if name in ("netcon", "diskdude") else "nightapps")
        i32.save(folder / f"{name}.png")
        i64.save(folder / f"{name}-64.png")
        reduce(i32, 16).save(folder / f"{name}-16.png")

    teal = [N3, B1, B2, C1, C2, W, C2, C1, B2, B1, N3]
    violet = [S1, S2, S3, W, S3, V2, V, N3, B1, B2, C1]
    brands = {
        "nightamp": ("NIGHTAMP", "PLAYS EVERYTHING AFTER DARK", C1, None,
                     ["MP3 FLAC OPUS AAC OGG WAV MIDI  ·  MP4 WEBM MKV HLS", "WINAMP SKINS  ·  MEDIA LIBRARY  ·  RADIO", "V2.1"]),
        "nightbrowser": ("NIGHTBROWSER", "BROWSE BEYOND THE LIGHT", B2, teal,
                         ["NIGHTSHIELD TRACKER BLOCKING", "PRIVATE TABS  ·  HTTPS UPGRADE  ·  SPEED DIAL", "V1.1"]),
        "netcon": ("NETCON", "BADGES // ASSETS // REPAIR LOG // GAMES", V2, violet, None),
        "diskdude": ("DISK DUDE", "OPTICAL MEDIA // ARCHIVE // PLAY // SHARE", C1, None, None),
    }
    for name, (word, tag, accent, ramp, lines) in brands.items():
        folder = ART / ("programs" if name in ("netcon", "diskdude") else "nightapps")
        lg = logo(name, word, tag, drawn[name][0], accent=accent, ramp=ramp)
        lg.save(folder / f"{name}-logo.png", optimize=True)
        if lines:
            splash(drawn[name][0], word, tag, lines, accent, mark, ramp=ramp).convert("RGB").save(folder / f"{name}-splash.png", optimize=True)
    # the Windows programs use the same art
    if TOOLS.exists():
        for key, tool in (("netcon", "netcon"), ("diskdude", "disk-dude")):
            Image.open(ART / "programs" / f"{key}-logo.png").save(TOOLS / f"{tool}-logo.png", optimize=True)
            i64, i32 = drawn[key]
            i64.save(TOOLS / f"{tool}.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
                     append_images=[reduce(i32, 16), i32, reduce(i64, 48)])

    # preview: icons at 1x/2x on the desktop blue, and the logos
    pv = Image.new("RGBA", (1400, 1040), (6, 12, 30, 255))
    x = 16
    for name, (i64, i32) in drawn.items():
        pv.alpha_composite(i64.resize((128, 128), Image.NEAREST), (x, 16))
        pv.alpha_composite(i64, (x + 136, 16)); pv.alpha_composite(i32, (x + 136, 88)); pv.alpha_composite(reduce(i32, 16), (x + 176, 88))
        x += 230
    y = 170
    for i, name in enumerate(brands):
        folder = ART / ("programs" if name in ("netcon", "diskdude") else "nightapps")
        pv.alpha_composite(Image.open(folder / f"{name}-logo.png").convert("RGBA"), (16 + (i % 2) * 690, y + (i // 2) * 180))
    for i, name in enumerate(("nightamp", "nightbrowser")):
        pv.alpha_composite(Image.open(ART / "nightapps" / f"{name}-splash.png").convert("RGBA"), (16 + i * 690, 540))
    pv.convert("RGB").save(HERE / "brands-preview.png", optimize=True)
    print("wrote icons, logos and splashes for", ", ".join(ICONS))


if __name__ == "__main__":
    main()
