"""Art for the NightCode programs WinNight, NightAmp and NightBrowser.

    python coleforge/art/nightcode/build_nightcode_apps.py

Everything is 16-bit pixel art in the NightCode 16-colour palette (build_nightcode_icons.py), plus
start-up splash screens. Writes into coleforge/shell/assets/art/nightapps/:
  <app>.png, <app>-64.png         program icons (winnight, nightamp, nightbrowser)
  winnight/<button>.png           32x32 WinNight toolbar buttons
  winnight/types/<type>.png       16x16 file-type icons for the archive list
  nightbrowser/<button>.png       16x16 NightBrowser toolbar buttons
  nightamp/cbuttons.png           NightAmp transport buttons (normal row, pressed row)
  nightamp/numbers.png            NightAmp LED digits (0-9, blank, minus; 9x13 each)
  <app>-splash.png                560x315 start-up splash screens
A 4x preview sheet goes next to this script (apps-preview.png).
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from build_nightcode_art import circuits, fit, logo, radial, scanlines  # noqa: E402
from build_nightcode_icons import (  # noqa: E402
    A, B1, B2, BLUE, C1, C2, G, K, M, N1, N2, N3, NAVY, P, PALETTE, S1, S2, S3, STEEL, T, W,
    button, canvas, ellipse, glyph, outline, paint, poly, px, rect,
)

OUT = HERE.parent.parent / "shell" / "assets" / "art" / "nightapps"
FONTS = HERE.parent.parent / "shell" / "assets" / "fonts"
GOLD = [M, A, A, W]


# ---------------------------------------------------------------- program icons (32x32)
def winnight():
    """A night-blue archive crate with a zipper down the middle and a crescent-moon badge."""
    img, d = canvas()
    paint(img, rect((3, 8, 28, 29)), BLUE)
    paint(img, rect((2, 4, 29, 9)), STEEL)
    d.line([(3, 4), (28, 4)], fill=W)
    d.line([(3, 10), (28, 10)], fill=N1)
    for y in range(11, 29):
        px(d, [(15, y)], S3 if y % 2 else S1)                 # zipper teeth
        px(d, [(16, y)], S1 if y % 2 else S3)
    d.rectangle((13, 5, 18, 8), fill=K)
    paint(img, rect((14, 6, 17, 13)), GOLD)                   # zipper pull
    d.ellipse((5, 14, 12, 21), fill=C2)
    d.ellipse((7, 13, 13, 20), fill=N3)                        # crescent moon
    px(d, [(6, 15)], W)
    px(d, [(22, 15), (25, 18), (21, 22)], C2)                  # stars
    px(d, [(24, 24)], C1)
    return outline(img)


def nightamp():
    """A night orb: crescent moon on the left, equalizer bars glowing on the right."""
    img, d = canvas()
    paint(img, ellipse((2, 2, 29, 29)), [N1, N2, N3, B1], mode="sphere")
    d.ellipse((5, 7, 18, 24), fill=C2)
    d.ellipse((9, 5, 21, 22), fill=N2)                         # crescent
    px(d, [(6, 12), (6, 13)], W)
    for x, top, col in ((17, 15, B2), (20, 11, C1), (23, 14, G), (26, 17, C1)):
        d.rectangle((x, top, x + 1, 24), fill=col)
        px(d, [(x, top)], W)
    d.line([(16, 25), (27, 25)], fill=N1)
    px(d, [(9, 5), (10, 4)], W)
    return outline(img)


def nightbrowser():
    """The Earth by night: a lit blue side, a night side with city lights, and an orbit ring."""
    img, d = canvas()
    paint(img, ellipse((3, 3, 28, 28)), [N2, N3, B1, B2, C1], mode="sphere")
    night = Image.new("L", (32, 32), 0)
    ImageDraw.Draw(night).ellipse((15, -2, 44, 33), fill=255)  # terminator
    globe = Image.new("L", (32, 32), 0)
    ImageDraw.Draw(globe).ellipse((3, 3, 28, 28), fill=255)
    pp, nm, gm = img.load(), night.load(), globe.load()
    for y in range(32):
        for x in range(32):
            if nm[x, y] and gm[x, y]:
                pp[x, y] = N1 if (x + y) % 5 else N2
    for pt in ((20, 10), (23, 13), (19, 17), (24, 19), (21, 22), (26, 15), (22, 16)):
        px(d, [pt], A)                                         # city lights
    px(d, [(22, 10), (25, 17)], W)
    d.arc((1, 11, 30, 22), 5, 175, fill=C1)
    d.arc((1, 12, 30, 23), 20, 160, fill=B1)
    px(d, [(8, 7), (7, 8), (9, 7)], W)
    return outline(img)


# ---------------------------------------------------------------- WinNight toolbar (32x32)
def _crate(img, d, box=(4, 12, 21, 28)):
    x0, y0, x1, y1 = box
    paint(img, rect(box), BLUE)
    paint(img, rect((x0 - 1, y0 - 3, x1 + 1, y0)), STEEL)
    mid = (x0 + x1) // 2
    for y in range(y0 + 1, y1):
        px(d, [(mid, y)], S3 if y % 2 else S1)
    d.rectangle((mid - 1, y0 - 2, mid + 1, y0 + 2), fill=A)


def tb_add():
    img, d = canvas()
    _crate(img, d)
    paint(img, rect((20, 4, 25, 21)), [N3, G, G, W])
    paint(img, rect((14, 10, 31, 15)), [N3, G, G, W])
    return outline(img)


def tb_extract():
    img, d = canvas()
    paint(img, rect((2, 12, 11, 15)), BLUE)
    paint(img, rect((2, 14, 29, 29)), [N3, B1, B2, C1])
    d.line([(3, 14), (28, 14)], fill=C2)
    paint(img, rect((13, 2, 18, 13)), GOLD)
    paint(img, poly([(8, 12), (23, 12), (15, 22)]), GOLD)
    return outline(img)


def tb_test():
    img, d = canvas()
    _crate(img, d, (3, 10, 22, 28))
    d.line([(14, 19), (19, 25), (29, 9)], fill=K, width=5)
    d.line([(14, 19), (19, 25), (29, 9)], fill=G, width=3)
    px(d, [(28, 10), (15, 19)], W)
    return outline(img)


def tb_view():
    img, d = canvas()
    paint(img, ellipse((1, 8, 30, 24)), [S2, S3, W])
    paint(img, ellipse((9, 8, 22, 23)), [N3, B1, B2, C1], mode="sphere")
    d.ellipse((13, 12, 18, 18), fill=K)
    px(d, [(12, 11), (13, 11)], W)
    return outline(img)


def tb_delete():
    img, d = canvas()
    paint(img, poly([(7, 9), (24, 9), (22, 29), (9, 29)]), STEEL + [W], mode="cyl")
    paint(img, rect((5, 6, 26, 8)), STEEL)
    d.rectangle((13, 3, 18, 5), fill=S2)
    d.line([(10, 13), (21, 25)], fill=K, width=4)
    d.line([(21, 13), (10, 25)], fill=K, width=4)
    d.line([(10, 13), (21, 25)], fill=P, width=2)
    d.line([(21, 13), (10, 25)], fill=P, width=2)
    return outline(img)


def tb_find():
    img, d = canvas()
    d.line([(18, 18), (28, 28)], fill=N3, width=5)
    d.line([(18, 18), (28, 28)], fill=B1, width=3)
    paint(img, ellipse((2, 2, 21, 21)), STEEL + [W], mode="sphere")
    paint(img, ellipse((5, 5, 18, 18)), [N3, B1, C1, C2], mode="sphere")
    px(d, [(8, 8), (9, 7), (7, 9)], W)
    return outline(img)


def tb_wizard():
    img, d = canvas()
    d.line([(4, 28), (19, 13)], fill=N1, width=3)
    d.line([(4, 28), (19, 13)], fill=S2, width=1)
    paint(img, poly([(22, 3), (24, 9), (30, 10), (25, 14), (27, 20), (22, 16), (17, 20), (19, 14), (14, 10), (20, 9)]), GOLD)
    for pt in ((8, 6), (12, 3), (5, 13), (28, 25), (24, 27)):
        px(d, [pt], C2)
    px(d, [(9, 6), (8, 5), (7, 6), (8, 7)], C1)
    return outline(img)


def tb_info():
    img, d = canvas()
    paint(img, ellipse((2, 2, 29, 29)), [N2, N3, B1, B2, C1], mode="sphere")
    glyph(d, ["XX", "XX", "..", "XX", "XX", "XX", "XX", "XX", "XX"], 14, 7, W, N1)
    px(d, [(9, 6), (8, 7)], W)
    return outline(img)


def tb_repair():
    img, d = canvas()
    _crate(img, d, (3, 13, 20, 29))
    d.line([(10, 25), (26, 9)], fill=K, width=5)
    d.line([(10, 25), (26, 9)], fill=S2, width=3)
    d.line([(10, 24), (25, 9)], fill=S3)
    paint(img, ellipse((21, 1, 31, 11)), STEEL, mode="sphere")
    d.rectangle((25, 1, 28, 5), fill=T)
    return outline(img)


def tb_lock():
    img, d = canvas()
    d.arc((8, 2, 23, 19), 180, 360, fill=K, width=5)
    d.arc((9, 3, 22, 18), 180, 360, fill=S2, width=3)
    d.line([(9, 10), (9, 14)], fill=S2, width=3)
    d.line([(22, 10), (22, 14)], fill=S2, width=3)
    paint(img, rect((5, 13, 26, 29)), GOLD)
    d.line([(6, 13), (25, 13)], fill=W)
    d.ellipse((13, 17, 18, 22), fill=K)
    d.rectangle((15, 21, 16, 26), fill=K)
    return outline(img)


TOOLBAR = {"add": tb_add, "extract": tb_extract, "test": tb_test, "view": tb_view, "delete": tb_delete,
           "find": tb_find, "wizard": tb_wizard, "info": tb_info, "repair": tb_repair, "lock": tb_lock}


# ---------------------------------------------------------------- file types (16x16)
def ft_folder():
    img, d = canvas(16)
    paint(img, rect((1, 3, 6, 5)), BLUE)
    paint(img, rect((1, 5, 14, 13)), [N3, B1, B2, C1])
    d.line([(2, 5), (13, 5)], fill=C2)
    return outline(img)


def _page(img, d):
    paint(img, poly([(3, 1), (10, 1), (13, 4), (13, 14), (3, 14)]), [S2, S3, W])
    d.line([(10, 1), (10, 4), (13, 4)], fill=S1)


def ft_file():
    img, d = canvas(16)
    _page(img, d)
    return outline(img)


def ft_text():
    img, d = canvas(16)
    _page(img, d)
    for y, x1 in ((6, 11), (8, 10), (10, 11), (12, 8)):
        d.line([(5, y), (x1, y)], fill=N3)
    return outline(img)


def ft_code():
    img, d = canvas(16)
    _page(img, d)
    px(d, [(7, 6), (6, 7), (5, 8), (6, 9), (7, 10)], B1)
    px(d, [(9, 6), (10, 7), (11, 8), (10, 9), (9, 10)], B1)
    return outline(img)


def ft_image():
    img, d = canvas(16)
    paint(img, rect((1, 3, 14, 13)), STEEL)
    paint(img, rect((2, 4, 13, 12)), [N1, N2, B1], mode="up")
    paint(img, poly([(2, 12), (6, 7), (9, 10), (11, 8), (13, 12)]), NAVY)
    px(d, [(11, 5)], W)
    return outline(img)


def ft_audio():
    img, d = canvas(16)
    d.ellipse((2, 10, 6, 13), fill=C1)
    d.ellipse((9, 9, 13, 12), fill=C1)
    d.line([(6, 3), (6, 11)], fill=C1)
    d.line([(13, 2), (13, 10)], fill=C1)
    d.line([(6, 3), (13, 2)], fill=C1, width=2)
    px(d, [(3, 10), (10, 9)], W)
    return outline(img)


def ft_video():
    img, d = canvas(16)
    paint(img, rect((1, 3, 14, 13)), NAVY)
    for x in range(2, 14, 3):
        px(d, [(x, 4), (x, 12)], S3)
    paint(img, poly([(6, 6), (6, 11), (10, 8)]), [B1, C1, C2])
    return outline(img)


def ft_archive():
    img, d = canvas(16)
    paint(img, rect((2, 5, 13, 14)), BLUE)
    paint(img, rect((1, 2, 14, 5)), STEEL)
    for y in range(6, 14):
        px(d, [(7, y)], S3 if y % 2 else S1)
    d.rectangle((6, 3, 8, 6), fill=A)
    return outline(img)


def ft_exe():
    img, d = canvas(16)
    paint(img, rect((1, 2, 14, 13)), STEEL)
    paint(img, rect((2, 3, 13, 5)), [N3, B1, B2], mode="h")
    d.rectangle((2, 6, 13, 12), fill=N1)
    px(d, [(4, 8), (5, 9), (4, 10)], G)
    return outline(img)


TYPES = {"folder": ft_folder, "file": ft_file, "text": ft_text, "code": ft_code, "image": ft_image,
         "audio": ft_audio, "video": ft_video, "archive": ft_archive, "exe": ft_exe}


# ---------------------------------------------------------------- NightBrowser toolbar (16x16)
def _arrow(left):
    img, d = canvas(16)
    pts = [(2, 8), (8, 2), (8, 5), (14, 5), (14, 11), (8, 11), (8, 14)]
    if not left:
        pts = [(15 - x, y) for x, y in pts]
    paint(img, poly(pts), [N3, B1, C1, C2])
    return outline(img)


def nb_back():
    return _arrow(True)


def nb_forward():
    return _arrow(False)


def nb_reload():
    img, d = canvas(16)
    d.arc((2, 2, 13, 13), 40, 330, fill=C1, width=3)
    paint(img, poly([(9, 1), (14, 4), (9, 7)]), [B1, C1, C2])
    return outline(img)


def nb_home():
    img, d = canvas(16)
    paint(img, poly([(8, 1), (15, 8), (1, 8)]), [N3, B1, B2])
    paint(img, rect((3, 8, 12, 14)), STEEL)
    d.rectangle((7, 10, 9, 14), fill=N2)
    px(d, [(5, 10)], A)
    return outline(img)


def nb_star():
    img, d = canvas(16)
    paint(img, poly([(8, 1), (10, 6), (15, 6), (11, 9), (13, 14), (8, 11), (3, 14), (5, 9), (1, 6), (6, 6)]), GOLD)
    return outline(img)


def nb_shield():
    img, d = canvas(16)
    paint(img, poly([(8, 1), (14, 3), (13, 10), (8, 14), (3, 10), (2, 3)]), [N3, B1, B2, C1])
    d.line([(5, 7), (7, 10), (11, 4)], fill=W, width=2)
    return outline(img)


def nb_private():
    img, d = canvas(16)
    paint(img, poly([(3, 6), (5, 1), (11, 1), (13, 6)]), [N1, N2, N3])
    d.line([(1, 6), (14, 6)], fill=N3, width=2)
    d.ellipse((1, 9, 6, 13), fill=K)
    d.ellipse((9, 9, 14, 13), fill=K)
    d.line([(6, 10), (9, 10)], fill=K)
    px(d, [(2, 10), (10, 10)], C2)
    return outline(img)


def nb_find():
    img, d = canvas(16)
    d.line([(9, 9), (14, 14)], fill=B1, width=3)
    paint(img, ellipse((1, 1, 11, 11)), STEEL, mode="sphere")
    paint(img, ellipse((3, 3, 9, 9)), [N3, B1, C1, C2], mode="sphere")
    return outline(img)


def nb_camera():
    img, d = canvas(16)
    paint(img, rect((1, 4, 14, 13)), STEEL)
    d.rectangle((5, 2, 9, 4), fill=S2)
    paint(img, ellipse((4, 5, 11, 12)), [N1, N3, B1, C2], mode="sphere")
    px(d, [(12, 6)], A)
    return outline(img)


def nb_menu():
    img, d = canvas(16)
    for y in (3, 7, 11):
        paint(img, rect((2, y, 13, y + 1)), [B1, C1, C2], mode="h")
    return outline(img)


def nb_plus():
    img, d = canvas(16)
    paint(img, rect((6, 2, 9, 13)), [N3, B1, C1])
    paint(img, rect((2, 6, 13, 9)), [N3, B1, C1])
    return outline(img)


def nb_stop():
    img, d = canvas(16)
    d.line([(3, 3), (12, 12)], fill=P, width=3)
    d.line([(12, 3), (3, 12)], fill=P, width=3)
    return outline(img)


NB = {"back": nb_back, "forward": nb_forward, "reload": nb_reload, "home": nb_home, "star": nb_star, "shield": nb_shield,
      "private": nb_private, "find": nb_find, "camera": nb_camera, "menu": nb_menu, "plus": nb_plus, "stop": nb_stop}


# ---------------------------------------------------------------- NightAmp sprites
def cbuttons():
    """Transport buttons: prev, play, pause, stop, next (23x18) and eject (22x16); normal row then pressed."""
    sheet = Image.new("RGBA", (136, 36), T)
    glyphs = {
        "prev": lambda d, o: (d.rectangle((7 + o, 5 + o, 8 + o, 12 + o), fill=C1), d.polygon([(15 + o, 5 + o), (15 + o, 12 + o), (9 + o, 8 + o)], fill=C1)),
        "play": lambda d, o: d.polygon([(9 + o, 4 + o), (9 + o, 13 + o), (15 + o, 8 + o)], fill=C1),
        "pause": lambda d, o: (d.rectangle((8 + o, 5 + o, 9 + o, 12 + o), fill=C1), d.rectangle((13 + o, 5 + o, 14 + o, 12 + o), fill=C1)),
        "stop": lambda d, o: d.rectangle((8 + o, 5 + o, 14 + o, 12 + o), fill=C1),
        "next": lambda d, o: (d.polygon([(7 + o, 5 + o), (7 + o, 12 + o), (13 + o, 8 + o)], fill=C1), d.rectangle((14 + o, 5 + o, 15 + o, 12 + o), fill=C1)),
        "eject": lambda d, o: (d.polygon([(11 + o, 3 + o), (16 + o, 8 + o), (6 + o, 8 + o)], fill=C1), d.rectangle((6 + o, 10 + o, 16 + o, 11 + o), fill=C1)),
    }
    x = 0
    for name, draw in glyphs.items():
        w, h = (22, 16) if name == "eject" else (23, 18)
        for row, pressed in ((0, False), (18, True)):
            b = Image.new("RGBA", (w, h), T)
            bd = ImageDraw.Draw(b)
            paint(b, rect((0, 0, w - 1, h - 1)), [N1, N2, N3] if pressed else [S1, S2, S3], mode="v" if not pressed else "up")
            bd.rectangle((0, 0, w - 1, h - 1), outline=K)
            if not pressed:
                bd.line([(1, 1), (w - 2, 1)], fill=W)
            else:
                bd.line([(1, 1), (w - 2, 1)], fill=N1)
            bd.rectangle((3, 2, w - 4, h - 3), fill=N1 if not pressed else K)
            draw(bd, 1 if pressed else 0)
            sheet.alpha_composite(b, (x, row))
        x += w
    return sheet


SEG = {  # seven-segment map: a top, b top-right, c bottom-right, d bottom, e bottom-left, f top-left, g middle
    "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc",
    "7": "abc", "8": "abcdefg", "9": "abcdfg", " ": "", "-": "g",
}


def numbers():
    sheet = Image.new("RGBA", (9 * 12, 13), (4, 8, 22, 255))
    d = ImageDraw.Draw(sheet)
    segs = {"a": (2, 0, 6, 1), "f": (0, 2, 1, 5), "b": (7, 2, 8, 5), "g": (2, 6, 6, 6),
            "e": (0, 7, 1, 10), "c": (7, 7, 8, 10), "d": (2, 11, 6, 12)}
    for i, ch in enumerate("0123456789 -"):
        ox = i * 9
        for s, (x0, y0, x1, y1) in segs.items():
            d.rectangle((ox + x0, y0, ox + x1, y1), fill=C1 if s in SEG[ch] else N2)
    return sheet


# ---------------------------------------------------------------- splash screens
def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def glow_text(img, xy, text, fnt, fill, glow=(30, 120, 255), radius=6, spacing=0):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = xy
    if spacing:
        for ch in text:
            d.text((x, y), ch, font=fnt, fill=fill)
            x += fnt.getlength(ch) + spacing
    else:
        d.text(xy, text, font=fnt, fill=fill)
    halo = Image.new("RGBA", img.size, glow + (0,))
    halo.putalpha(layer.split()[-1].filter(ImageFilter.GaussianBlur(radius)))
    img.alpha_composite(halo)
    img.alpha_composite(layer)


def splash(icon, title, tagline, blurb, accent, mark):
    w, h = 560, 315
    bg = radial(w, h, (18, 44, 110), (2, 5, 14), cx=0.25, cy=0.45, r=0.95)
    circuits(bg, seed=hash(title) % 1000, count=30)
    big = icon.resize((160, 160), Image.NEAREST)
    halo = Image.new("RGBA", (220, 220), (0, 0, 0, 0))
    halo.alpha_composite(big, (30, 30))
    glow_a = halo.split()[-1].filter(ImageFilter.GaussianBlur(18))
    glow = Image.new("RGBA", halo.size, accent + (0,))
    glow.putalpha(glow_a.point(lambda a: int(a * 0.8)))
    bg.alpha_composite(glow, (6, 50))
    bg.alpha_composite(big, (36, 80))
    panel = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    ImageDraw.Draw(panel).rectangle((216, 64, w - 8, 244), fill=(2, 5, 14, 175))
    bg.alpha_composite(panel.filter(ImageFilter.GaussianBlur(6)))
    tsize = 46
    while font("Orbitron-Black.ttf", tsize).getlength(title) > w - 228 - 14:
        tsize -= 1
    glow_text(bg, (228, 78 + (46 - tsize) // 2), title, font("Orbitron-Black.ttf", tsize), (236, 247, 255, 255), glow=accent)
    glow_text(bg, (232, 140), tagline, font("Orbitron-Bold.ttf", 15), C1, radius=4)
    d = ImageDraw.Draw(bg)
    size = 14
    while size > 9 and max(font("ShareTechMono-Regular.ttf", size).getlength(line) for line in blurb) > w - 232 - 16:
        size -= 1
    mono = font("ShareTechMono-Regular.ttf", size)
    for i, line in enumerate(blurb):
        d.text((232, 172 + i * (size + 5)), line, font=mono, fill=(150, 190, 230, 255))
    small = fit(mark, 56)
    bg.alpha_composite(small, (w - small.width - 14, h - small.height - 12))
    d.text((18, h - 26), "OFFICIAL COLEFORGE PROGRAM  ·  NIGHTCODE", font=font("ShareTechMono-Regular.ttf", 12), fill=(95, 128, 171, 255))
    d.rectangle((0, 0, w - 1, h - 1), outline=(49, 215, 232, 255))
    return scanlines(bg, alpha=20)


def check(im, name):
    pixels = getattr(im, "get_flattened_data", im.getdata)()
    stray = {c for c in pixels if c[3] and c not in PALETTE and c != (4, 8, 22, 255)}
    if stray:
        raise SystemExit(f"{name}: colours outside the NightCode 16: {sorted(stray)[:4]}")


def main():
    for sub in ("", "winnight", "winnight/types", "nightbrowser", "nightamp"):
        (OUT / sub).mkdir(parents=True, exist_ok=True)
    apps = {"winnight": winnight(), "nightamp": nightamp(), "nightbrowser": nightbrowser()}
    for name, im in apps.items():
        check(im, name)
        im.save(OUT / f"{name}.png")
        im.resize((64, 64), Image.NEAREST).save(OUT / f"{name}-64.png")
    groups = [("winnight", TOOLBAR), ("winnight/types", TYPES), ("nightbrowser", NB)]
    drawn = {}
    for folder, table in groups:
        for name, fn in table.items():
            im = fn()
            check(im, f"{folder}/{name}")
            im.save(OUT / folder / f"{name}.png")
            drawn[f"{folder}/{name}"] = im
    cb, nums = cbuttons(), numbers()
    check(cb, "cbuttons"); check(nums, "numbers")
    cb.save(OUT / "nightamp" / "cbuttons.png")
    nums.save(OUT / "nightamp" / "numbers.png")

    mark = logo()
    splash(apps["winnight"], "WinNight", "ARCHIVER  //  NIGHTCODE", ["ZIP · RAR · 7Z · TAR · GZ · XZ · ISO", "AES-256 locked archives, test & repair", "v1.0"], (30, 120, 255), mark).convert("RGB").save(OUT / "winnight-splash.png", optimize=True)
    splash(apps["nightamp"], "NightAmp", "PLAYS EVERYTHING AFTER DARK", ["MP3 FLAC OPUS AAC OGG WAV MIDI", "MP4 WEBM MKV HLS video · radio · browser", "v1.0"], (49, 215, 232), mark).convert("RGB").save(OUT / "nightamp-splash.png", optimize=True)
    splash(apps["nightbrowser"], "NightBrowser", "BROWSE BEYOND THE LIGHT", ["NightShield tracker blocking", "Private tabs · HTTPS upgrade · speed dial", "v1.0"], (30, 120, 255), mark).convert("RGB").save(OUT / "nightbrowser-splash.png", optimize=True)

    # 4x preview: program icons, toolbar, file types, browser buttons, NightAmp sprites.
    sheet = Image.new("RGBA", (380, 150), (4, 8, 26, 255))
    x = 4
    for im in apps.values():
        sheet.alpha_composite(im, (x, 4)); x += 36
    x = 4
    for name in TOOLBAR:
        sheet.alpha_composite(drawn[f"winnight/{name}"], (x, 42)); x += 36
    x = 4
    for name in TYPES:
        sheet.alpha_composite(drawn[f"winnight/types/{name}"], (x, 80)); x += 20
    for name in NB:
        sheet.alpha_composite(drawn[f"nightbrowser/{name}"], (x, 80)); x += 20
    sheet.alpha_composite(cb, (4, 102))
    sheet.alpha_composite(nums, (150, 104))
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(HERE / "apps-preview.png")
    print("wrote NightCode program art to", OUT.relative_to(HERE.parent.parent.parent))


if __name__ == "__main__":
    main()
