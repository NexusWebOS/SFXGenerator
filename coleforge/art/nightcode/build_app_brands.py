"""Draw the video-game style brand art for NightAmp, NightBrowser, Netcon, Disk Dude, SFX Lab and Task Manager.

    python coleforge/art/nightcode/build_app_brands.py

Everything is real low-resolution pixel art, drawn the SNES way: dark keylines, 3-5 tone hue-shifted
ramps (shadows lean purple, highlights lean warm), banded shading with a little dithering, rim light and
specular pixels. Each program gets a fresh "game" subject taken only from what the program is:

  NightAmp      a boombox (the player) with a moon on its handle, notes flying out
  NightBrowser  a rocket blasting off a planet (going places on the web)
  Netcon        a padlock and a keycard (badges, locks, RFID tags)
  Disk Dude     Disk Dude himself as a hero sprite: CD head, shades, hoodie, sneakers, thumbs up
  SFX Lab       a sound potion: a flask of glowing liquid with a square wave inside, notes bubbling out
  Task Manager  a heart container with a pulse line and an HP bar

Icons are drawn natively at 64 and 32 px (16 and 48 are reduced). Logo banners (340x85) and title
screens (320x180) are drawn at that size and doubled with nearest-neighbour, like a console's output:

  shell/assets/art/nightapps/{nightamp,nightbrowser,sfxlab,taskman}{,-16,-64,-logo,-title}.png
  shell/assets/art/programs/{netcon,diskdude}{,-16,-64,-logo,-title}.png
  shell/assets/art/nightapps/{nightamp,nightbrowser}-splash.png   (their title screens, as start-up splashes)
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
ROOT = HERE.parent.parent
ART = ROOT / "shell" / "assets" / "art"
TOOLS = ROOT / "programs" / "retro-tools" / "assets"
FONTS = ROOT / "shell" / "assets" / "fonts"


def c(*v):
    return tuple(v) + (255,)


T = (0, 0, 0, 0)
K = c(6, 4, 18)                      # keyline: a very dark violet rather than flat black
W = c(255, 255, 255)

# Hue-shifted ramps, dark → light.
NAVY = [c(10, 10, 34), c(22, 26, 70), c(38, 50, 120), c(62, 86, 170), c(104, 136, 214)]
CHROME = [c(46, 44, 86), c(96, 104, 152), c(160, 176, 212), c(222, 232, 248), W]
CYAN = [c(12, 34, 92), c(18, 96, 168), c(38, 178, 226), c(128, 238, 255), W]
GOLD = [c(88, 36, 30), c(172, 86, 26), c(238, 164, 38), c(255, 226, 112), c(255, 250, 214)]
RED = [c(62, 10, 44), c(146, 22, 58), c(226, 58, 78), c(255, 138, 132), c(255, 214, 200)]
PURPLE = [c(34, 16, 70), c(78, 42, 148), c(130, 92, 224), c(192, 166, 255), c(236, 226, 255)]
GREEN = [c(8, 44, 52), c(16, 110, 84), c(46, 196, 110), c(160, 252, 150), c(236, 255, 214)]
SKIN = [c(86, 36, 52), c(170, 92, 84), c(236, 160, 128), c(255, 214, 180)]
DENIM = [c(16, 20, 56), c(30, 48, 116), c(52, 88, 180), c(96, 140, 226)]
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


# ------------------------------------------------------------------------------------------ drawing kit
class Pen:
    """Draws in a `unit`-sized space on a canvas of w x h pixels, so icons are drawn natively at 64 and 32."""

    def __init__(self, n=64, w=None, h=None, unit=64):
        self.w, self.h = (w or n), (h or n)
        self.f = self.w / unit
        self.img = Image.new("RGBA", (self.w, self.h), T)
        self.d = ImageDraw.Draw(self.img)

    def p(self, v):
        return int(round(v * self.f))

    def box(self, b):
        x0, y0, x1, y1 = (self.p(v) for v in b)
        return (x0, y0, max(x0, x1 - 1), max(y0, y1 - 1))

    def pts(self, pts):
        return [(self.p(x), self.p(y)) for x, y in pts]

    def mask(self, kind, g):
        m = Image.new("L", self.img.size, 0)
        md = ImageDraw.Draw(m)
        if kind == "rect":
            md.rectangle(self.box(g), fill=255)
        elif kind == "round":
            md.rounded_rectangle(self.box(g[:4]), radius=max(1, self.p(g[4])), fill=255)
        elif kind == "ellipse":
            md.ellipse(self.box(g), fill=255)
        elif kind == "poly":
            md.polygon(self.pts(g), fill=255)
        return m

    def shade(self, kind, g, ramp, mode="top", dither=True, light=(-0.6, -0.7), keep=None):
        """Fill a shape with a banded ramp. mode: top (lit from above), left, sphere, cone (concave), flat.
        keep: an optional mask the fill is limited to."""
        m = self.mask(kind, g)
        if keep is not None:
            m = Image.composite(m, Image.new("L", m.size, 0), keep)
        box = m.getbbox()
        if not box:
            return m
        x0, y0, x1, y1 = box
        cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, max(1, (x1 - x0) / 2), max(1, (y1 - y0) / 2)
        mp, pp, n = m.load(), self.img.load(), len(ramp)
        lx, ly = light
        for y in range(y0, y1):
            for x in range(x0, x1):
                if not mp[x, y]:
                    continue
                u, v = (x + 0.5 - x0) / (x1 - x0), (y + 0.5 - y0) / (y1 - y0)
                if mode == "top":
                    t = 1 - v * 0.9 - u * 0.15
                elif mode == "left":
                    t = 1 - u * 0.9 - v * 0.15
                elif mode == "flat":
                    t = 0.55
                else:
                    dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                    nz = math.sqrt(max(0.0, 1 - dx * dx - dy * dy))
                    t = max(0.0, dx * lx + dy * ly + nz * 0.75) / 1.25
                    if mode == "cone":
                        t = 1 - t
                t = min(1.0, max(0.0, t))
                lv = t * (n - 1)
                i = int(lv)
                if dither and i < n - 1 and lv - i > (BAYER[y % 4][x % 4] + 0.5) / 16 * 0.5 + 0.5:
                    i += 1
                pp[x, y] = ramp[min(n - 1, i)]
        return m

    def clear(self, kind, g):
        self.img.paste(T, (0, 0), self.mask(kind, g))

    def rect(self, b, col):
        self.d.rectangle(self.box(b), fill=col)

    def ell(self, b, col):
        self.d.ellipse(self.box(b), fill=col)

    def poly(self, pts, col):
        self.d.polygon(self.pts(pts), fill=col)

    def line(self, pts, col, w=1):
        self.d.line(self.pts(pts), fill=col, width=max(1, self.p(w)))

    def dot(self, pts, col):
        for x, y in self.pts(pts):
            if 0 <= x < self.w and 0 <= y < self.h:
                self.img.putpixel((x, y), col)

    def arc(self, b, a0, a1, col, w=1):
        self.d.arc(self.box(b), a0, a1, fill=col, width=max(1, self.p(w)))

    def done(self):
        return keyline(self.img)


def keyline(img, col=K):
    """The dark outline around every silhouette."""
    a = img.split()[-1].point(lambda v: 255 if v else 0)
    ring = a.filter(ImageFilter.MaxFilter(3))
    out = Image.new("RGBA", img.size, T)
    out.paste(col, (0, 0), ring)
    out.alpha_composite(img)
    return out


def up(img, s=2):
    return img.resize((img.width * s, img.height * s), Image.NEAREST)


# --------------------------------------------------------------------------------------------- icons
def note(q, x, y, col):
    q.rect((x + 4, y, x + 5, y + 8), col[3]); q.ell((x, y + 6, x + 5, y + 11), col[2]); q.rect((x + 4, y, x + 8, y + 2), col[3])


def nightamp_icon(n):
    """A boombox: chrome handle with a crescent-moon badge, two big speakers, a tape deck, notes flying."""
    q = Pen(n)
    q.shade("round", (12, 8, 52, 26, 6), CHROME, "top")                        # handle
    q.clear("round", (17, 13, 47, 26, 3))
    q.shade("round", (2, 20, 62, 58, 5), NAVY, "top")                           # body
    q.rect((5, 21, 59, 22), NAVY[4])
    for cx in (16, 48):                                                         # speakers
        q.shade("ellipse", (cx - 13, 28, cx + 13, 54), CHROME, "sphere")
        q.shade("ellipse", (cx - 10, 31, cx + 10, 51), CYAN, "cone")
        q.shade("ellipse", (cx - 4, 37, cx + 4, 45), NAVY, "sphere")
        q.dot([(cx - 2, 38)], W)
    q.rect((27, 31, 37, 47), c(4, 8, 20))                                       # tape deck
    q.ell((28, 35, 32, 39), CHROME[2]); q.ell((32, 35, 36, 39), CHROME[2])
    q.rect((28, 42, 36, 44), GOLD[2])
    for i, col in enumerate((RED[2], GOLD[2], GREEN[2])):                       # buttons
        q.rect((25 + i * 5, 23, 29 + i * 5, 27), col)
        q.dot([(25 + i * 5, 23)], W)
    q.shade("ellipse", (27, 2, 37, 12), GOLD, "sphere")                         # moon badge
    q.clear("ellipse", (30, 1, 39, 10))
    note(q, 54, 2, GOLD); note(q, 1, 4, CYAN)
    return q.done()


def nightbrowser_icon(n):
    """A rocket blasting off from behind a ringed planet, trailing fire and stars."""
    q = Pen(n)
    planet = q.shade("ellipse", (0, 28, 38, 64), CYAN, "sphere")
    q.shade("poly", [(6, 40), (14, 33), (24, 37), (20, 46), (27, 53), (18, 60), (8, 52)], GREEN, "sphere", keep=planet)
    q.shade("ellipse", (0, 28, 38, 64), [PURPLE[0], PURPLE[1]], "flat", keep=q.mask("poly", [(26, 20), (64, 20), (64, 64), (14, 64)]))
    for x, y in ((24, 44), (28, 52), (22, 58), (30, 40)):
        q.dot([(x, y)], GOLD[3])                                                # city lights on the night side
    q.arc((-6, 42, 44, 54), 200, 340, GOLD[3], 2)
    q.shade("poly", [(40, 46), (48, 46), (44, 63)], GOLD, "top", dither=False)  # flame
    q.shade("poly", [(42, 46), (46, 46), (44, 55)], [GOLD[4], W], "top", dither=False)
    for x, y, r in ((36, 58, 3), (52, 60, 2), (31, 53, 2)):
        q.ell((x - r, y - r, x + r, y + r), CHROME[2])
    q.shade("round", (36, 14, 52, 48, 7), CHROME, "left")                        # rocket
    q.shade("poly", [(36, 17), (44, 1), (52, 17)], RED, "left")
    q.shade("poly", [(37, 34), (30, 48), (37, 46)], RED, "left", dither=False)
    q.shade("poly", [(51, 34), (58, 48), (51, 46)], RED, "left", dither=False)
    q.shade("ellipse", (40, 21, 48, 29), CYAN, "sphere")
    q.dot([(42, 22)], W)
    q.rect((38, 40, 50, 42), RED[2])
    q.dot([(39, 18), (39, 19), (39, 20)], W)
    for x, y in ((10, 8), (26, 5), (60, 26), (6, 22)):                          # stars
        q.dot([(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)], CYAN[3]); q.dot([(x, y)], W)
    return q.done()


def netcon_icon(n):
    """A gold padlock with a chrome shackle, and a keycard with a chip, pinging RFID waves."""
    q = Pen(n)
    q.arc((8, 4, 38, 36), 180, 360, CHROME[1], 7)                                # shackle
    q.arc((10, 6, 36, 34), 195, 345, CHROME[3], 2)
    q.rect((8, 20, 14, 30), CHROME[1]); q.rect((32, 20, 38, 30), CHROME[1]); q.rect((9, 20, 10, 30), CHROME[3])
    q.shade("round", (2, 26, 44, 62, 5), GOLD, "top")                            # lock body
    q.rect((5, 27, 41, 28), GOLD[4])
    q.rect((4, 38, 42, 39), GOLD[1]); q.rect((4, 50, 42, 51), GOLD[1])
    q.ell((17, 35, 27, 45), K); q.poly([(19, 42), (25, 42), (26, 53), (18, 53)], K)   # keyhole
    q.dot([(7, 30), (8, 30), (7, 31)], W)
    q.shade("round", (30, 30, 62, 52, 3), PURPLE, "top")                         # keycard
    q.rect((31, 34, 61, 37), K)
    q.shade("rect", (34, 40, 42, 48), GOLD, "top", dither=False)
    q.line([(38, 40), (38, 47)], GOLD[1]); q.line([(34, 44), (41, 44)], GOLD[1])
    q.rect((45, 40, 58, 42), PURPLE[4]); q.rect((45, 45, 55, 46), PURPLE[3])
    q.dot([(32, 31), (33, 31), (34, 31)], W)
    for r, col in ((5, CYAN[4]), (10, CYAN[3]), (15, CYAN[2])):                   # RFID waves
        q.arc((54 - r, 20 - r, 54 + r, 20 + r), 225, 315, col, 2)
    return q.done()


def diskdude_icon(n):
    """Disk Dude as a hero sprite: CD head with shades and a grin, hoodie, jeans, sneakers, thumbs up."""
    q = Pen(n)
    q.ell((14, 59, 50, 64), c(10, 10, 34))                                       # ground shadow
    q.shade("ellipse", (12, 3, 50, 37), NAVY, "sphere")                          # hood
    head = q.mask("ellipse", (16, 6, 46, 36))
    hp, ip = head.load(), q.img.load()
    cx, cy = 31 * q.f, 21 * q.f
    bands = [CHROME[3], CYAN[3], PURPLE[3], CHROME[4], GOLD[3], CHROME[2], CYAN[2], CHROME[3]]
    for y in range(q.h):
        for x in range(q.w):
            if hp[x, y]:
                a = (math.atan2(y - cy, x - cx) / (2 * math.pi) + 1) % 1
                ip[x, y] = bands[int(a * len(bands) * 2) % len(bands)]
    q.ell((28, 18, 34, 24), CHROME[1]); q.ell((30, 20, 32, 22), K)               # hub = nose
    q.rect((18, 12, 44, 18), K)                                                  # shades
    q.dot([(20, 13), (21, 13), (33, 13), (34, 13)], CYAN[4])
    q.d.pieslice(q.box((21, 21, 41, 34)), 0, 180, fill=K)                        # grin
    q.rect((23, 27, 39, 28), W)
    q.shade("round", (18, 34, 46, 51, 4), NAVY, "top")                           # hoodie
    q.rect((26, 42, 38, 47), NAVY[1])
    q.line([(28, 35), (28, 41)], CYAN[3]); q.line([(36, 35), (36, 41)], CYAN[3])
    q.shade("round", (12, 36, 19, 50, 3), NAVY, "left")                          # arm down
    q.shade("ellipse", (11, 48, 19, 55), SKIN, "sphere")
    q.shade("round", (45, 26, 52, 40, 3), NAVY, "left")                          # arm up, holding a disc
    q.shade("ellipse", (50, 4, 64, 18), [CHROME[2], CYAN[3], PURPLE[3], CHROME[4]], "sphere")
    q.ell((55, 9, 59, 13), NAVY[1]); q.dot([(53, 7)], W)
    q.shade("ellipse", (44, 18, 54, 28), SKIN, "sphere")
    q.shade("rect", (21, 50, 31, 58), DENIM, "top"); q.shade("rect", (33, 50, 43, 58), DENIM, "top")
    q.shade("round", (17, 56, 32, 62, 2), CHROME, "top"); q.shade("round", (32, 56, 47, 62, 2), CHROME, "top")
    q.rect((18, 60, 31, 61), CYAN[2]); q.rect((33, 60, 46, 61), CYAN[2])
    return q.done()


def sfxlab_icon(n):
    """A sound potion: a round flask of glowing liquid with a square wave in it, notes bubbling out."""
    q = Pen(n)
    flask = q.mask("ellipse", (8, 20, 50, 62))
    glass = Image.composite(Image.new("L", flask.size, 255), flask, q.mask("rect", (22, 6, 36, 26)))
    q.img.paste(c(26, 50, 96), (0, 0), glass)
    liquid = Image.composite(q.mask("rect", (0, 34, 64, 64)), Image.new("L", flask.size, 0), flask)
    q.shade("ellipse", (8, 20, 50, 62), GREEN, "sphere", keep=liquid)
    q.rect((11, 34, 47, 35), GREEN[4])
    q.line([(12, 50), (18, 50), (18, 42), (26, 42), (26, 50), (34, 50), (34, 42), (42, 42), (42, 50), (46, 50)], W, 2)
    for x, y in ((16, 38), (40, 46), (30, 56)):
        q.dot([(x, y), (x + 1, y)], GREEN[4])
    q.shade("rect", (20, 4, 38, 9), CHROME, "top", dither=False)                 # rim
    q.line([(12, 30), (12, 44)], W); q.dot([(13, 28), (14, 27), (24, 11), (24, 12), (24, 13)], W)
    note(q, 43, 1, GOLD); note(q, 53, 13, CYAN)
    for x, y, r in ((40, 18, 2), (45, 25, 1), (14, 12, 2)):
        q.ell((x - r, y - r, x + r, y + r), GREEN[3])
    return q.done()


def taskman_icon(n):
    """A heart container with a pulse line through it, over an HP bar."""
    q = Pen(n)
    q.shade("ellipse", (5, 5, 33, 31), RED, "sphere", light=(-0.7, -0.7))
    q.shade("ellipse", (31, 5, 59, 31), RED, "sphere", light=(-0.3, -0.7))
    q.shade("poly", [(6, 22), (58, 22), (32, 52)], RED, "sphere", light=(-0.5, -0.9))
    q.dot([(11, 11), (12, 10), (13, 10), (10, 12), (10, 13)], W)
    q.dot([(15, 11), (11, 15)], RED[4])
    q.line([(3, 28), (17, 28), (21, 20), (27, 38), (33, 12), (39, 32), (43, 28), (61, 28)], W, 2)
    q.rect((5, 54, 59, 63), K)                                                   # HP bar
    q.shade("rect", (7, 56, 42, 62), GREEN, "top", dither=False)
    q.shade("rect", (42, 56, 50, 62), GOLD, "top", dither=False)
    q.rect((7, 56, 41, 57), GREEN[4])
    return q.done()


ICONS = {"nightamp": nightamp_icon, "nightbrowser": nightbrowser_icon, "netcon": netcon_icon, "diskdude": diskdude_icon,
         "sfxlab": sfxlab_icon, "taskman": taskman_icon}


def reduce(im, size):
    """Shrink an icon (16, 48) with hard alpha."""
    out = im.resize((size, size), Image.LANCZOS)
    out.putalpha(out.split()[-1].point(lambda v: 255 if v > 110 else 0))
    return out


# ------------------------------------------------------------------------------------------ lettering
def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def bitmap(text, size, fnt="Orbitron-Black.ttf", spacing=2):
    f = font(fnt, size)
    w = int(sum(f.getlength(ch) + spacing for ch in text)) + 4
    m = Image.new("1", (w, size * 2), 0)
    d = ImageDraw.Draw(m)
    d.fontmode = "1"
    x = 1
    for ch in text:
        d.text((x, 0), ch, font=f, fill=1)
        x += f.getlength(ch) + spacing
    return m.crop(m.getbbox()).convert("L")


def game_title(text, size, ramp, rim, fnt="Orbitron-Black.ttf", spacing=3):
    """SNES title lettering: a banded fill with a white shine line, a dark keyline, a coloured outer rim
    and a hard drop shadow."""
    m = bitmap(text, size, fnt, spacing)
    w, h = m.size
    pad = 4
    out = Image.new("RGBA", (w + pad * 2 + 2, h + pad * 2 + 2), T)
    base = Image.new("L", out.size, 0)
    base.paste(m, (pad, pad))
    grow = lambda im, r: im.filter(ImageFilter.MaxFilter(r * 2 + 1))
    rim_m, key_m = grow(base, 2), grow(base, 1)
    sh = Image.new("L", out.size, 0)
    sh.paste(rim_m.crop((0, 0, out.width - 2, out.height - 2)), (2, 2))
    out.paste(c(4, 2, 16), (0, 0), sh)
    out.paste(rim, (0, 0), rim_m)
    out.paste(K, (0, 0), key_m)
    bp, mp = out.load(), base.load()
    n = len(ramp)
    for y in range(out.height):
        t = (y - pad) / max(1, h - 1)
        i = min(n - 1, max(0, int((1 - t) * n)))
        for x in range(out.width):
            if mp[x, y]:
                col = ramp[i]
                if y - pad == 1:
                    col = W                                                    # shine line
                elif y - pad == int(h * 0.55):
                    col = ramp[max(0, i - 1)]                                  # horizon band
                bp[x, y] = col
    return out


FONT5 = {
    "A": "01110 10001 10001 11111 10001 10001 10001", "B": "11110 10001 10001 11110 10001 10001 11110",
    "C": "01111 10000 10000 10000 10000 10000 01111", "D": "11110 10001 10001 10001 10001 10001 11110",
    "E": "11111 10000 10000 11110 10000 10000 11111", "F": "11111 10000 10000 11110 10000 10000 10000",
    "G": "01111 10000 10000 10011 10001 10001 01111", "H": "10001 10001 10001 11111 10001 10001 10001",
    "I": "11111 00100 00100 00100 00100 00100 11111", "J": "00111 00010 00010 00010 00010 10010 01100",
    "K": "10001 10010 10100 11000 10100 10010 10001", "L": "10000 10000 10000 10000 10000 10000 11111",
    "M": "10001 11011 10101 10101 10001 10001 10001", "N": "10001 11001 10101 10011 10001 10001 10001",
    "O": "01110 10001 10001 10001 10001 10001 01110", "P": "11110 10001 10001 11110 10000 10000 10000",
    "Q": "01110 10001 10001 10001 10101 10010 01101", "R": "11110 10001 10001 11110 10100 10010 10001",
    "S": "01111 10000 10000 01110 00001 00001 11110", "T": "11111 00100 00100 00100 00100 00100 00100",
    "U": "10001 10001 10001 10001 10001 10001 01110", "V": "10001 10001 10001 10001 10001 01010 00100",
    "W": "10001 10001 10001 10101 10101 11011 10001", "X": "10001 10001 01010 00100 01010 10001 10001",
    "Y": "10001 10001 01010 00100 00100 00100 00100", "Z": "11111 00001 00010 00100 01000 10000 11111",
    "0": "01110 10011 10101 10101 11001 10001 01110", "1": "00100 01100 00100 00100 00100 00100 01110",
    "2": "01110 10001 00001 00110 01000 10000 11111", "3": "11110 00001 00001 01110 00001 00001 11110",
    "4": "00010 00110 01010 10010 11111 00010 00010", "5": "11111 10000 11110 00001 00001 10001 01110",
    "6": "00110 01000 10000 11110 10001 10001 01110", "7": "11111 00001 00010 00100 01000 01000 01000",
    "8": "01110 10001 10001 01110 10001 10001 01110", "9": "01110 10001 10001 01111 00001 00010 01100",
    " ": "00000 00000 00000 00000 00000 00000 00000", "·": "00000 00000 00000 00100 00000 00000 00000",
    ".": "00000 00000 00000 00000 00000 00000 00100", "/": "00001 00010 00010 00100 01000 01000 10000",
    "-": "00000 00000 00000 01110 00000 00000 00000", "!": "00100 00100 00100 00100 00100 00000 00100",
    ":": "00000 00100 00000 00000 00000 00100 00000", "©": "01110 10001 10111 10101 10111 10001 01110",
}


def fitted_title(t, size, room):
    """The biggest title lettering that fits the room (stepping the font size, never stretching pixels)."""
    while size > 10:
        logo = game_title(t["word"], size, t["ramp"], t["rim"])
        if logo.width <= room:
            return logo
        size -= 1
    return logo


def pixel_label(text, col, scale=1, outline=K, spacing=1):
    """Text in the 5x7 pixel font, outlined all round so it reads over any backdrop."""
    text = text.upper()
    w = len(text) * (5 + spacing) - spacing
    m = Image.new("L", (w + 2, 9), 0)
    for i, ch in enumerate(text):
        rows = FONT5.get(ch, FONT5[" "]).split()
        for y, row in enumerate(rows):
            for x, bit in enumerate(row):
                if bit == "1":
                    m.putpixel((1 + i * (5 + spacing) + x, 1 + y), 255)
    out = Image.new("RGBA", m.size, T)
    out.paste(outline, (0, 0), m.filter(ImageFilter.MaxFilter(3)))
    out.paste(col, (0, 0), m)
    return up(out, scale) if scale > 1 else out


# ------------------------------------------------------------------------------------------ scenery
def sky(w, h, top, bottom, bands=10, seed=1):
    """A banded, dithered gradient sky with stars."""
    img = Image.new("RGBA", (w, h), T)
    p = img.load()
    mix = lambda t: tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,)
    for y in range(h):
        f = y / h * (bands - 1)
        b = int(f)
        lo, hi = mix(b / (bands - 1)), mix(min(bands - 1, b + 1) / (bands - 1))
        for x in range(w):
            p[x, y] = hi if (f - b) > (BAYER[y % 4][x % 4] + 0.5) / 16 else lo
    r = random.Random(seed)
    d = ImageDraw.Draw(img)
    for _ in range(w * h // 170):
        d.point((r.randrange(w), r.randrange(int(h * 0.7))), fill=r.choice([c(120, 140, 200), c(200, 210, 255), W]))
    for _ in range(6):
        x, y = r.randrange(w), r.randrange(int(h * 0.55))
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            d.point((x + dx, y + dy), fill=CYAN[3])
        d.point((x, y), fill=W)
    return img


def skyline(img, y0, col, lit, seed=2, hmin=14, hmax=46):
    d = ImageDraw.Draw(img)
    r = random.Random(seed)
    x, (w, h) = -4, img.size
    while x < w:
        bw, bh = r.randrange(10, 24), r.randrange(hmin, hmax)
        d.rectangle((x, y0 - bh, x + bw, h), fill=col)
        if r.random() < 0.3:
            d.line([(x + bw // 2, y0 - bh - 5), (x + bw // 2, y0 - bh)], fill=col)
        for yy in range(y0 - bh + 3, h - 2, 4):
            for xx in range(x + 2, x + bw - 1, 3):
                if r.random() < 0.22:
                    d.point((xx, yy), fill=r.choice(lit))
        x += bw + r.randrange(0, 3)


def grid_floor(img, y0, col, horizon, lines=9):
    d = ImageDraw.Draw(img)
    w, h = img.size
    d.rectangle((0, y0, w, h), fill=c(8, 4, 26))
    for i in range(1, 12):
        y = y0 + int((h - y0) * (i / 11) ** 2)
        d.line([(0, y), (w, y)], fill=col)
    for i in range(-lines, lines + 1):
        d.line([(w / 2 + i * 6, y0), (w / 2 + i * 60, h)], fill=col)
    d.line([(0, y0), (w, y0)], fill=horizon)


def sun(img, cx, cy, r, ramp):
    """A synthwave sun: banded top to bottom, with the lower half sliced by gaps."""
    d = ImageDraw.Draw(img)
    for y in range(cy - r, cy + 1):
        t = (y - (cy - r)) / r
        half = int(math.sqrt(max(0, r * r - (y - cy) ** 2)))
        if t > 0.5 and (y // 3) % 2 == 0:
            continue
        d.line([(cx - half, y), (cx + half, y)], fill=ramp[min(len(ramp) - 1, int(t * len(ramp)))])


def frame(img, col):
    d = ImageDraw.Draw(img)
    w, h = img.size
    d.rectangle((0, 0, w - 1, h - 1), outline=K)
    d.rectangle((1, 1, w - 2, h - 2), outline=col)
    d.rectangle((2, 2, w - 3, h - 3), outline=K)


def glow(img, pts_or_box, col, alpha=40, kind="poly"):
    layer = Image.new("RGBA", img.size, T)
    dl = ImageDraw.Draw(layer)
    (dl.polygon if kind == "poly" else dl.ellipse)(pts_or_box, fill=col[:3] + (alpha,))
    img.alpha_composite(layer)


# ---------------------------------------------------------------------------------------- per program
MAGENTA, SKYBLUE, TEAL, PINK, AMBER, MINT = c(214, 60, 200), c(40, 90, 220), c(40, 200, 230), c(255, 90, 150), c(255, 180, 40), c(60, 230, 140)
THEMES = {
    "nightamp": dict(word="NIGHTAMP", sub="PLAYS EVERYTHING AFTER DARK", ramp=CYAN[1:], rim=MAGENTA, accent=CYAN[3], sky=((6, 4, 26), (70, 20, 90))),
    "nightbrowser": dict(word="NIGHTBROWSER", sub="BROWSE BEYOND THE LIGHT", ramp=GOLD[1:], rim=SKYBLUE, accent=GOLD[3], sky=((2, 2, 16), (22, 20, 74))),
    "netcon": dict(word="NETCON", sub="BADGES · LOCKS · RFID TAGS", ramp=PURPLE[1:], rim=TEAL, accent=PURPLE[3], sky=((4, 2, 20), (40, 16, 80))),
    "diskdude": dict(word="DISK DUDE", sub="RIP · BURN · PLAY · SHARE", ramp=[CHROME[1], CHROME[2], CHROME[3], W], rim=PINK, accent=c(255, 170, 200), sky=((20, 6, 50), (230, 100, 110))),
    "sfxlab": dict(word="SFX LAB", sub="BLIPS · BLASTS · LASERS", ramp=GREEN[1:], rim=AMBER, accent=GREEN[3], sky=((4, 12, 20), (14, 52, 62))),
    "taskman": dict(word="TASK MANAGER", sub="END TASK · WATCH THE STATS", ramp=RED[1:], rim=MINT, accent=RED[3], sky=((4, 4, 18), (20, 30, 50))),
}


def scene(name, w, h):
    """Each program's backdrop."""
    t = THEMES[name]
    img = sky(w, h, t["sky"][0], t["sky"][1], seed=len(name))
    d = ImageDraw.Draw(img)
    if name == "nightamp":                                                    # a night concert
        d.ellipse((w - 70, 14, w - 34, 50), fill=GOLD[3]); d.ellipse((w - 62, 10, w - 26, 46), fill=img.getpixel((w - 44, 12)))
        for i, x in enumerate(range(20, w + 40, 64)):
            glow(img, [(x, h - 30), (x - 34 + i * 10, 0), (x + 6 + i * 10, 0)], CYAN[3] if i % 2 else MAGENTA, 34)
        skyline(img, h - 30, c(14, 8, 40), [GOLD[3], CYAN[3], MAGENTA], seed=3)
        d.rectangle((0, h - 30, w, h), fill=c(24, 12, 60))
        for x in range(0, w + 12, 8):
            d.line([(x, h - 29), (x - 12, h)], fill=c(34, 18, 80))
        d.line([(0, h - 30), (w, h - 30)], fill=MAGENTA)
    elif name == "nightbrowser":                                              # deep space, a big planet
        for i in range(3):
            r = random.Random(i + 7)
            cx, cy, rr = r.randrange(w), r.randrange(h // 2), r.randrange(20, 50)
            glow(img, (cx - rr * 2, cy - rr, cx + rr * 2, cy + rr), PURPLE[2], 45, kind="ellipse")
        pl = Pen(w=150, h=150, unit=150)
        body = pl.shade("ellipse", (0, 0, 150, 150), CYAN, "sphere")
        for b in ((20, 30, 60, 60), (36, 50, 80, 96), (70, 20, 104, 44), (50, 100, 90, 130), (96, 70, 130, 110)):
            pl.shade("ellipse", b, GREEN, "sphere", keep=body)
        night = Image.composite(pl.mask("ellipse", (40, -30, 200, 170)), Image.new("L", body.size, 0), body)
        pl.img.paste(PURPLE[0], (0, 0), night)
        np_ = night.load()
        rr = random.Random(11)
        for _ in range(60):
            x, y = rr.randrange(150), rr.randrange(150)
            if np_[x, y]:
                pl.img.putpixel((x, y), rr.choice([GOLD[3], GOLD[2], CYAN[3]]))
        img.alpha_composite(keyline(pl.img), (w - 120, h - 88))
        d.arc((w - 160, h - 44, w + 50, h + 14), 190, 350, GOLD[3], 2)
    elif name == "netcon":                                                    # cyber grid, server racks
        grid_floor(img, h - 50, c(60, 30, 120), TEAL)
        r = random.Random(5)
        for x in range(6, w, 38):
            th = r.randrange(40, 80)
            d.rectangle((x, h - 50 - th, x + 22, h - 50), fill=c(20, 14, 50), outline=c(60, 40, 120))
            for yy in range(h - 50 - th + 4, h - 52, 5):
                d.line([(x + 3, yy), (x + 19, yy)], fill=c(40, 30, 90))
                d.point((x + 17, yy), fill=r.choice([GREEN[3], CYAN[3], RED[3]]))
    elif name == "diskdude":                                                  # synthwave sunset over the city
        sun(img, w // 2 + 40, h - 30, 56, [GOLD[4], GOLD[3], c(255, 140, 90), PINK, c(200, 60, 170)])
        skyline(img, h - 28, c(26, 8, 50), [c(255, 170, 200), GOLD[3]], seed=9, hmin=10, hmax=34)
        grid_floor(img, h - 28, c(120, 40, 140), PINK, lines=12)
    elif name == "sfxlab":                                                    # the lab: shelves, flasks, scopes
        r = random.Random(4)
        for y in (54, 100):
            d.rectangle((0, y, w, y + 3), fill=c(40, 60, 70)); d.line([(0, y), (w, y)], fill=c(90, 130, 140))
            for x in range(8, w - 10, 26):
                col, hh = r.choice([GREEN, CYAN, PURPLE, GOLD]), r.randrange(10, 20)
                d.rectangle((x, y - hh, x + 8, y - 1), fill=c(30, 50, 70))
                d.rectangle((x + 1, y - hh // 2, x + 7, y - 1), fill=col[2])
                d.point((x + 2, y - hh + 2), fill=W)
        for x in (w - 150, w - 80):
            d.rectangle((x, h - 40, x + 60, h - 23), fill=c(10, 20, 24), outline=c(90, 130, 140))
            d.line([(x + 4 + i, h - 32 + int(5 * math.sin(i / 3.0 + x))) for i in range(52)], fill=GREEN[3])
        d.rectangle((0, h - 20, w, h), fill=c(20, 34, 40)); d.line([(0, h - 20), (w, h - 20)], fill=c(90, 130, 140))
    elif name == "taskman":                                                   # a control-room HUD
        for x in range(0, w, 16):
            d.line([(x, 0), (x, h)], fill=c(14, 30, 36))
        for y in range(0, h, 16):
            d.line([(0, y), (w, y)], fill=c(14, 30, 36))
        cx, cy = w - 60, 60
        for r_ in (12, 24, 36):
            d.ellipse((cx - r_, cy - r_, cx + r_, cy + r_), outline=c(30, 120, 80))
        d.line([(cx, cy), (cx + 30, cy - 20)], fill=GREEN[3]); d.point((cx - 14, cy + 10), fill=RED[3])
        for i, bh in enumerate((20, 34, 26, 44, 30, 50, 38)):
            x = w - 90 + i * 11
            d.rectangle((x, h - 20 - bh, x + 7, h - 20), fill=c(30, 120, 80)); d.line([(x, h - 20 - bh), (x + 7, h - 20 - bh)], fill=GREEN[4])
        d.line([(0, h - 20), (w, h - 20)], fill=c(30, 120, 80))
    return img


def title_screen(name, hero):
    """A 320x180 title screen (saved at 640x360): backdrop, hero sprite at 2x, logo, PRESS START."""
    w, h = 320, 180
    t = THEMES[name]
    img = scene(name, w, h)
    big = up(hero, 2)
    img.alpha_composite(big, (10, h - 128 - 14))
    room = w - 150
    logo = fitted_title(t, 28, room)
    lx = 140 + (room - logo.width) // 2
    img.alpha_composite(logo, (lx, 20))
    sub = pixel_label(t["sub"], t["accent"])
    img.alpha_composite(sub, (140 + (room - sub.width) // 2, 24 + logo.height))
    ps = pixel_label("PRESS START", W, scale=2, spacing=2)
    img.alpha_composite(ps, (140 + (room - ps.width) // 2, h - 60))
    cr = pixel_label("© 2026 NIGHTCODE · COLEFORGE", c(170, 180, 220))
    img.alpha_composite(cr, (140 + (room - cr.width) // 2, h - 20))
    frame(img, t["rim"])
    return up(img, 2)


def banner(name, hero):
    """A 340x85 logo banner (saved at 680x170): hero sprite, game lettering, subtitle plate."""
    w, h = 340, 85
    t = THEMES[name]
    img = scene(name, w, h)
    img.alpha_composite(Image.new("RGBA", (w, h), (4, 2, 16, 110)))
    img.alpha_composite(hero, (10, (h - 64) // 2))
    logo = fitted_title(t, 26, w - 94)
    img.alpha_composite(logo, (84, 12))
    sub = pixel_label(t["sub"], t["accent"])
    ry = 16 + logo.height
    ImageDraw.Draw(img).rectangle((82, ry - 2, 86 + sub.width, ry + sub.height + 1), fill=c(4, 2, 16), outline=t["rim"])
    img.alpha_composite(sub, (85, ry))
    frame(img, t["rim"])
    return up(img, 2)


# ------------------------------------------------------------------------------------------------ main
def folder(name):
    return ART / ("programs" if name in ("netcon", "diskdude") else "nightapps")


def main():
    for sub in ("nightapps", "programs"):
        (ART / sub).mkdir(parents=True, exist_ok=True)
    drawn = {}
    for name, fn in ICONS.items():
        i64, i32 = fn(64), fn(32)
        drawn[name] = (i64, i32)
        i32.save(folder(name) / f"{name}.png")
        i64.save(folder(name) / f"{name}-64.png")
        reduce(i32, 16).save(folder(name) / f"{name}-16.png")
        banner(name, i64).save(folder(name) / f"{name}-logo.png", optimize=True)
        title = title_screen(name, i64)
        title.save(folder(name) / f"{name}-title.png", optimize=True)
        if name in ("nightamp", "nightbrowser"):
            title.convert("RGB").save(folder(name) / f"{name}-splash.png", optimize=True)
    if TOOLS.exists():
        for key, tool in (("netcon", "netcon"), ("diskdude", "disk-dude")):
            Image.open(folder(key) / f"{key}-logo.png").save(TOOLS / f"{tool}-logo.png", optimize=True)
            i64, i32 = drawn[key]
            i64.save(TOOLS / f"{tool}.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)], append_images=[reduce(i32, 16), i32, reduce(i64, 48)])

    # preview: icons (2x, 1x, 32, 16), the six banners, the six title screens
    pv = Image.new("RGBA", (1340, 1790), c(8, 8, 24))
    for i, (name, (i64, i32)) in enumerate(drawn.items()):
        x = 10 + i * 222
        pv.alpha_composite(up(i64, 2), (x, 10)); pv.alpha_composite(i64, (x + 134, 10)); pv.alpha_composite(i32, (x + 134, 82)); pv.alpha_composite(reduce(i32, 16), (x + 172, 82))
    for i, name in enumerate(ICONS):
        pv.alpha_composite(Image.open(folder(name) / f"{name}-logo.png").convert("RGBA"), (10 + (i % 2) * 660, 150 + (i // 2) * 180))
        pv.alpha_composite(Image.open(folder(name) / f"{name}-title.png").convert("RGBA"), (10 + (i % 2) * 660, 700 + (i // 2) * 360))
    pv.convert("RGB").save(HERE / "brands-preview.png", optimize=True)
    print("wrote game-style icons, logos and title screens for", ", ".join(ICONS))


if __name__ == "__main__":
    main()
