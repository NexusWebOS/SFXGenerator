"""Draw NightAmp's built-in skins in the classic Winamp 2 skin format.

    python coleforge/art/nightcode/build_nightamp_skins.py

Every sheet of the classic skin format is drawn from scratch (original art, no Nullsoft images):
main, titlebar, cbuttons, shufrep, posbar, volume, balance, monoster, playpaus, numbers, text,
eqmain, pledit, gen, plus viscolor.txt and pledit.txt. Three styles share one drawing routine:

  nightcode   NightCode night blue and neon cyan (NightAmp's default)
  classic     ColeForge Classic: gunmetal, green LEDs, gold title (the late-90s look)
  silver      ColeForge Silver: brushed silver and blue glass with round buttons

Output:
  coleforge/shell/assets/art/nightapps/skins/<id>/*.png, viscolor.txt, pledit.txt, skin.json
  coleforge/shell/assets/art/nightapps/skins/<Name>.wsz   (BMPs; loads in Winamp 2.x/5.x and Webamp too)
A preview of each main window goes next to this script (skins-preview.png).
"""

import io
import json
import random
import sys
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / "shell" / "assets" / "art" / "nightapps" / "skins"

# 4x5 glyphs in 5x6 cells (the same font NightAmp draws with when a skin has no text.bmp).
GLYPHS = {
    "A": ".XX.|X..X|XXXX|X..X|X..X", "B": "XXX.|X..X|XXX.|X..X|XXX.", "C": ".XXX|X...|X...|X...|.XXX", "D": "XXX.|X..X|X..X|X..X|XXX.", "E": "XXXX|X...|XXX.|X...|XXXX",
    "F": "XXXX|X...|XXX.|X...|X...", "G": ".XXX|X...|X.XX|X..X|.XXX", "H": "X..X|X..X|XXXX|X..X|X..X", "I": "XXX.|.X..|.X..|.X..|XXX.", "J": "..XX|...X|...X|X..X|.XX.",
    "K": "X..X|X.X.|XX..|X.X.|X..X", "L": "X...|X...|X...|X...|XXXX", "M": "X..X|XXXX|XXXX|X..X|X..X", "N": "X..X|XX.X|X.XX|X..X|X..X", "O": ".XX.|X..X|X..X|X..X|.XX.",
    "P": "XXX.|X..X|XXX.|X...|X...", "Q": ".XX.|X..X|X..X|X.X.|.X.X", "R": "XXX.|X..X|XXX.|X.X.|X..X", "S": ".XXX|X...|.XX.|...X|XXX.", "T": "XXX.|.X..|.X..|.X..|.X..",
    "U": "X..X|X..X|X..X|X..X|.XX.", "V": "X..X|X..X|X..X|.XX.|.XX.", "W": "X..X|X..X|XXXX|XXXX|X..X", "X": "X..X|X..X|.XX.|X..X|X..X", "Y": "X.X.|X.X.|.X..|.X..|.X..",
    "Z": "XXXX|...X|.XX.|X...|XXXX", "0": ".XX.|X.XX|XX.X|X..X|.XX.", "1": ".X..|XX..|.X..|.X..|XXX.", "2": "XXX.|...X|.XX.|X...|XXXX", "3": "XXX.|...X|.XX.|...X|XXX.",
    "4": "X..X|X..X|XXXX|...X|...X", "5": "XXXX|X...|XXX.|...X|XXX.", "6": ".XX.|X...|XXX.|X..X|.XX.", "7": "XXXX|...X|..X.|.X..|.X..", "8": ".XX.|X..X|.XX.|X..X|.XX.",
    "9": ".XX.|X..X|.XXX|...X|.XX.", " ": "....|....|....|....|....", ".": "....|....|....|....|.X..", ",": "....|....|....|.X..|X...", ":": "....|.X..|....|.X..|....",
    "-": "....|....|XXX.|....|....", "_": "....|....|....|....|XXXX", "(": ".X..|X...|X...|X...|.X..", ")": ".X..|..X.|..X.|..X.|.X..", "[": "XX..|X...|X...|X...|XX..",
    "]": ".XX.|..X.|..X.|..X.|.XX.", "/": "...X|..X.|.X..|.X..|X...", "\\": "X...|.X..|.X..|..X.|...X", "'": ".X..|.X..|....|....|....", '"': "X.X.|X.X.|....|....|....",
    "!": ".X..|.X..|.X..|....|.X..", "?": "XXX.|...X|.XX.|....|.X..", "&": ".X..|X.X.|.X..|X.X.|.X.X", "+": "....|.X..|XXX.|.X..|....", "=": "....|XXX.|....|XXX.|....",
    "#": ".X.X|XXXX|.X.X|XXXX|.X.X", "*": "....|X.X.|.X..|X.X.|....", "%": "X..X|..X.|.X..|X...|X..X", "$": ".XXX|XX..|.XX.|..XX|XXX.", "@": ".XX.|X..X|X.XX|X...|.XXX",
    "^": ".X..|X.X.|....|....|....", "…": "....|....|....|....|X.X.", "Å": ".X..|.XX.|X..X|XXXX|X..X", "Ö": "X..X|.XX.|X..X|X..X|.XX.", "Ä": "X..X|.XX.|X..X|XXXX|X..X",
}
# Where each character lives in text.bmp (row, column), as in the classic skin format.
TEXT_LAYOUT = [
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ\"@   ",
    "0123456789….:()-'!_+\\/[]^&%,=$#",
    "ÅÖÄ?*                          ",
]


def glyph(d, ch, x, y, color, scale=1):
    rows = GLYPHS.get(ch.upper(), GLYPHS["?"]).split("|")
    for r, row in enumerate(rows):
        for c, v in enumerate(row):
            if v == "X":
                d.rectangle((x + c * scale, y + r * scale, x + c * scale + scale - 1, y + r * scale + scale - 1), fill=color)


def text(d, s, x, y, color, scale=1):
    for ch in s:
        glyph(d, ch, x, y, color, scale)
        x += 5 * scale
    return x


def text_w(s, scale=1):
    return (len(s) * 5 - 1) * scale


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vgrad(d, box, top, bot):
    x0, y0, x1, y1 = box
    for y in range(y0, y1 + 1):
        d.line([(x0, y), (x1, y)], fill=lerp(top, bot, (y - y0) / max(1, y1 - y0)))


def hgrad(d, box, left, right):
    x0, y0, x1, y1 = box
    for x in range(x0, x1 + 1):
        d.line([(x, y0), (x, y1)], fill=lerp(left, right, (x - x0) / max(1, x1 - x0)))


def bevel(d, box, hi, lo):
    x0, y0, x1, y1 = box
    d.line([(x0, y0), (x1, y0)], fill=hi); d.line([(x0, y0), (x0, y1)], fill=hi)
    d.line([(x0, y1), (x1, y1)], fill=lo); d.line([(x1, y0), (x1, y1)], fill=lo)


def inset(d, box, fill, s):
    d.rectangle(box, fill=fill)
    bevel(d, box, s["lo"], s["hi"])


# ---------------------------------------------------------------- styles
STYLES = {
    "nightcode": dict(
        name="NightCode", face_top=(20, 40, 86), face_bot=(7, 13, 30), hi=(52, 98, 176), lo=(2, 4, 12), texture="scan",
        lcd=(2, 5, 14), fg=(49, 215, 232), fg_hi=(159, 240, 255), fg_dim=(16, 34, 78), label=(95, 128, 171),
        title=((1, 3, 10), (30, 120, 255)), title_off=((3, 6, 14), (19, 38, 90)), title_text=(234, 246, 255), title_text_off=(95, 128, 171), title_dir="h",
        btn=((219, 230, 242), (90, 106, 136)), btn_glyph=(49, 215, 232), btn_well=(10, 20, 48), round=False,
        groove=(5, 10, 22), fill=[(19, 38, 90), (30, 120, 255), (49, 215, 232)], thumb=((219, 230, 242), (90, 106, 136)),
        led_on=(60, 255, 158), led_off=(19, 38, 90), accent=(49, 215, 232),
        pl=dict(Normal="#9FD3FF", Current="#FFFFFF", NormalBG="#050A16", SelectedBG="#13265A", Font="Share Tech Mono"),
        vis=[(2, 5, 14), (19, 38, 90)] + [lerp((191, 244, 255), (19, 38, 90), i / 15) for i in range(16)] + [(49, 215, 232), (41, 190, 220), (35, 160, 230), (30, 120, 255), (29, 63, 143), (255, 255, 255)],
        logo="skull",
    ),
    "classic": dict(
        name="ColeForge Classic", face_top=(78, 80, 96), face_bot=(40, 41, 52), hi=(150, 152, 172), lo=(12, 12, 18), texture="brushed",
        lcd=(0, 0, 0), fg=(0, 226, 0), fg_hi=(170, 255, 140), fg_dim=(0, 52, 0), label=(170, 172, 190),
        title=((52, 52, 68), (118, 120, 146)), title_off=((44, 44, 52), (78, 78, 90)), title_text=(236, 214, 120), title_text_off=(150, 150, 160), title_dir="ridge",
        btn=((200, 200, 214), (92, 92, 108)), btn_glyph=(24, 24, 32), btn_well=None, round=False,
        groove=(18, 18, 24), fill=[(0, 150, 0), (220, 220, 0), (230, 40, 20)], thumb=((210, 210, 222), (100, 100, 116)),
        led_on=(0, 255, 0), led_off=(0, 70, 0), accent=(0, 226, 0),
        pl=dict(Normal="#00FF00", Current="#FFFFFF", NormalBG="#000000", SelectedBG="#0000C6", Font="Arial"),
        vis=[(0, 0, 0), (40, 40, 40)] + [lerp((240, 40, 16), (240, 210, 16), i / 5) for i in range(6)] + [lerp((220, 220, 16), (24, 140, 8), i / 9) for i in range(10)]
            + [(255, 255, 255), (214, 214, 222), (181, 189, 189), (160, 170, 175), (148, 156, 165), (150, 150, 150)],
        logo="bolt-free",
    ),
    "silver": dict(
        name="ColeForge Silver", face_top=(232, 236, 244), face_bot=(150, 160, 180), hi=(255, 255, 255), lo=(70, 80, 102), texture="smooth",
        lcd=(18, 36, 84), fg=(205, 233, 255), fg_hi=(255, 255, 255), fg_dim=(44, 66, 122), label=(40, 52, 86),
        title=((196, 204, 218), (240, 244, 250)), title_off=((200, 204, 212), (222, 226, 232)), title_text=(30, 54, 118), title_text_off=(120, 128, 146), title_dir="v",
        btn=((250, 252, 255), (150, 162, 186)), btn_glyph=(40, 72, 150), btn_well=None, round=True,
        groove=(98, 110, 134), fill=[(40, 72, 150), (90, 150, 230), (180, 220, 255)], thumb=((255, 255, 255), (150, 162, 186)),
        led_on=(14, 84, 214), led_off=(120, 132, 158), accent=(90, 150, 230),
        pl=dict(Normal="#FFFFFF", Current="#A8E4FF", NormalBG="#2A4C8C", SelectedBG="#6D8FD0", Font="Tahoma"),
        vis=[(18, 36, 84), (44, 66, 122)] + [lerp((255, 255, 255), (60, 110, 210), i / 15) for i in range(16)] + [(255, 255, 255), (220, 236, 255), (180, 210, 250), (140, 180, 240), (100, 150, 230), (255, 255, 255)],
        logo="orb",
    ),
}


def face(img, s, box=None):
    d = ImageDraw.Draw(img)
    w, h = img.size
    x0, y0, x1, y1 = box or (0, 0, w - 1, h - 1)
    vgrad(d, (x0, y0, x1, y1), s["face_top"], s["face_bot"])
    rnd = random.Random(7)
    if s["texture"] == "scan":
        for y in range(y0, y1 + 1, 2):
            for x in range(x0, x1 + 1):
                p = img.getpixel((x, y))
                img.putpixel((x, y), tuple(max(0, v - 5) for v in p[:3]))
    elif s["texture"] == "brushed":
        for y in range(y0, y1 + 1):
            t = rnd.randint(-7, 7)
            for x in range(x0, x1 + 1):
                p = img.getpixel((x, y))
                img.putpixel((x, y), tuple(max(0, min(255, v + t + rnd.randint(-2, 2))) for v in p[:3]))
    return d


def button_face(d, box, s, pressed=False):
    x0, y0, x1, y1 = box
    top, bot = s["btn"]
    if pressed:
        top, bot = lerp(bot, (0, 0, 0), 0.2), lerp(top, (0, 0, 0), 0.25)
    if s["round"]:
        d.rounded_rectangle(box, radius=min(x1 - x0, y1 - y0) // 2, fill=s["lo"])
        for y in range(y0 + 1, y1):
            c = lerp(top, bot, (y - y0) / max(1, y1 - y0))
            d.line([(x0 + 2, y), (x1 - 2, y)], fill=c)
        d.rounded_rectangle((x0, y0, x1, y1), radius=min(x1 - x0, y1 - y0) // 2, outline=s["lo"])
        d.line([(x0 + 3, y0 + 1), (x1 - 3, y0 + 1)], fill=(255, 255, 255) if not pressed else bot)
    else:
        vgrad(d, box, top, bot)
        bevel(d, box, s["hi"] if not pressed else s["lo"], s["lo"] if not pressed else s["hi"])
        if s["btn_well"] and x1 - x0 >= 6 and y1 - y0 >= 6:            # NightCode: a dark glass well so cyan labels read
            d.rectangle((x0 + 2, y0 + 2, x1 - 2, y1 - 2), fill=s["btn_well"] if not pressed else s["lcd"])


# ---------------------------------------------------------------- sheets
def sheet_main(s):
    img = Image.new("RGB", (275, 116))
    d = face(img, s)
    bevel(d, (0, 0, 274, 115), s["hi"], s["lo"])
    inset(d, (19, 20, 106, 62), s["lcd"], s)                   # time + visualizer display
    d.rectangle((72, 30, 73, 31), fill=s["fg"]); d.rectangle((72, 35, 73, 36), fill=s["fg"])  # time colon
    inset(d, (108, 24, 267, 34), s["lcd"], s)                  # scrolling title
    inset(d, (108, 40, 127, 50), s["lcd"], s)                  # kbps
    inset(d, (153, 40, 167, 50), s["lcd"], s)                  # kHz
    text(d, "KBPS", 129, 43, s["label"])
    text(d, "KHZ", 169, 43, s["label"])
    d.rectangle((210, 39, 269, 54), outline=lerp(s["face_bot"], s["lo"], 0.5))
    # grooves behind volume/balance and the transport plate
    d.line([(14, 84), (260, 84)], fill=s["lo"]); d.line([(14, 85), (260, 85)], fill=s["hi"])
    inset(d, (14, 86, 160, 108), lerp(s["face_bot"], s["lo"], 0.35), s)
    # the logo spot (about button at 253,91 13x15)
    if s["logo"] == "skull":
        d.ellipse((254, 91, 265, 101), fill=(219, 230, 242)); d.rectangle((256, 100, 263, 104), fill=(219, 230, 242))
        d.rectangle((256, 95, 258, 97), fill=s["lcd"]); d.rectangle((261, 95, 263, 97), fill=s["lcd"]); d.point((259, 98), fill=s["lcd"])
        d.line([(253, 106), (266, 102)], fill=s["accent"]); d.line([(253, 102), (266, 106)], fill=s["accent"])
    elif s["logo"] == "orb":
        d.ellipse((253, 92, 266, 105), fill=s["fg_dim"], outline=s["lo"]); d.ellipse((256, 94, 262, 99), fill=s["fg"])
    else:
        d.polygon([(260, 91), (254, 99), (259, 99), (256, 106), (265, 96), (260, 96), (263, 91)], fill=s["title_text"], outline=s["lo"])
    return img


def title_bar(img, d, box, s, active, label="NIGHTAMP"):
    x0, y0, x1, y1 = box
    a, b = s["title"] if active else s["title_off"]
    if s["title_dir"] == "h":
        hgrad(d, box, a, b)
    else:
        vgrad(d, box, b, a)
    if s["title_dir"] == "ridge" or s["title_dir"] == "v":
        tw = text_w(label) + 12
        mid = (x0 + x1) // 2
        for y in range(y0 + 3, y1 - 2, 2):                    # grip ridges on both sides of the name
            d.line([(x0 + 22, y), (mid - tw // 2 - 4, y)], fill=s["hi"] if active else lerp(a, b, 0.5))
            d.line([(mid + tw // 2 + 4, y), (x1 - 36, y)], fill=s["hi"] if active else lerp(a, b, 0.5))
            d.line([(x0 + 22, y + 1), (mid - tw // 2 - 4, y + 1)], fill=s["lo"])
            d.line([(mid + tw // 2 + 4, y + 1), (x1 - 36, y + 1)], fill=s["lo"])
    col = s["title_text"] if active else s["title_text_off"]
    tx = (x0 + x1) // 2 - text_w(label) // 2
    text(d, label, tx, y0 + 4, col)
    d.line([(x0, y1), (x1, y1)], fill=s["lo"])


def small_btn(d, x, y, s, kind, pressed=False):
    button_face(d, (x, y, x + 8, y + 8), s, pressed)
    g = s["btn_glyph"]
    o = 1 if pressed else 0
    if kind == "options":
        d.polygon([(x + 2 + o, y + 3 + o), (x + 6 + o, y + 3 + o), (x + 4 + o, y + 6 + o)], fill=g)
    elif kind == "min":
        d.line([(x + 2 + o, y + 6 + o), (x + 6 + o, y + 6 + o)], fill=g)
    elif kind == "close":
        d.line([(x + 2 + o, y + 2 + o), (x + 6 + o, y + 6 + o)], fill=g); d.line([(x + 6 + o, y + 2 + o), (x + 2 + o, y + 6 + o)], fill=g)
    elif kind == "shade":
        d.rectangle((x + 2 + o, y + 2 + o, x + 6 + o, y + 3 + o), fill=g)
    elif kind == "unshade":
        d.rectangle((x + 2 + o, y + 2 + o, x + 6 + o, y + 6 + o), outline=g)


def sheet_titlebar(s):
    img = Image.new("RGB", (344, 87), s["face_bot"])
    d = ImageDraw.Draw(img)
    for kind, x, y in (("options", 0, 0), ("min", 9, 0), ("close", 18, 0), ("shade", 0, 18), ("unshade", 0, 27)):
        small_btn(d, x, y, s, kind)
        small_btn(d, x + (0 if y < 18 else 9), y + (9 if y < 18 else 0), s, kind, pressed=True)
    title_bar(img, d, (27, 0, 301, 13), s, True)
    title_bar(img, d, (27, 15, 301, 28), s, False)
    for y, act in ((29, True), (42, False)):                  # windowshade bar with a little display
        title_bar(img, d, (27, y, 301, y + 13), s, act, label="")
        inset(d, (27 + 98, y + 2, 27 + 197, y + 11), s["lcd"], s)
    title_bar(img, d, (27, 57, 301, 70), s, True, label="NIGHTCODE")
    title_bar(img, d, (27, 72, 301, 85), s, False, label="NIGHTCODE")
    d.rectangle((0, 36, 16, 42), fill=s["groove"])             # shade position bar
    for i, x in enumerate((17, 20, 23)):
        d.rectangle((x, 36, x + 2, 42), fill=s["thumb"][0] if i == 1 else s["thumb"][1])
    for x, dim in ((304, False), (312, True)):                 # clutter bar
        d.rectangle((x, 0, x + 7, 42), fill=lerp(s["face_bot"], s["lo"], 0.4))
        bevel(d, (x, 0, x + 7, 42), s["lo"], s["hi"])
        for ch, yy in (("O", 4), ("A", 12), ("I", 19), ("D", 26), ("V", 34)):
            glyph(d, ch, x + 2, yy, s["fg_dim"] if dim else s["label"])
    for ch, x, y, hh in (("O", 304, 47, 8), ("A", 312, 55, 7), ("I", 320, 62, 7), ("D", 328, 69, 8), ("V", 336, 77, 7)):
        d.rectangle((x, y, x + 7, y + hh - 1), fill=lerp(s["face_bot"], s["lo"], 0.4))
        glyph(d, ch, x + 2, y + (1 if hh == 8 else 1), s["fg_hi"])
    return img


def transport_glyph(d, name, x, y, c):
    if name == "prev":
        d.rectangle((x + 6, y + 5, x + 7, y + 12), fill=c); d.polygon([(x + 15, y + 5), (x + 15, y + 12), (x + 8, y + 8)], fill=c)
    elif name == "play":
        d.polygon([(x + 9, y + 4), (x + 9, y + 13), (x + 15, y + 8)], fill=c)
    elif name == "pause":
        d.rectangle((x + 8, y + 5, x + 9, y + 12), fill=c); d.rectangle((x + 13, y + 5, x + 14, y + 12), fill=c)
    elif name == "stop":
        d.rectangle((x + 8, y + 5, x + 14, y + 12), fill=c)
    elif name == "next":
        d.polygon([(x + 7, y + 5), (x + 7, y + 12), (x + 14, y + 8)], fill=c); d.rectangle((x + 15, y + 5, x + 16, y + 12), fill=c)
    elif name == "eject":
        d.polygon([(x + 11, y + 3), (x + 16, y + 8), (x + 6, y + 8)], fill=c); d.rectangle((x + 6, y + 10, x + 16, y + 11), fill=c)


def sheet_cbuttons(s):
    img = Image.new("RGB", (136, 36), s["face_bot"])
    d = ImageDraw.Draw(img)
    x = 0
    for name in ("prev", "play", "pause", "stop", "next", "eject"):
        w, h = (22, 16) if name == "eject" else (23, 18)
        for row, pressed in ((0, False), (h, True)):
            box = (x, row, x + w - 1, row + h - 1)
            button_face(d, box, s, pressed)
            if s["btn_well"]:
                d.rectangle((x + 3, row + 2, x + w - 4, row + h - 3), fill=s["btn_well"] if not pressed else s["lcd"])
            transport_glyph(d, name, x + (1 if pressed else 0), row + (1 if pressed else 0), s["btn_glyph"] if not pressed or s["btn_well"] else lerp(s["btn_glyph"], (255, 255, 255), 0.3))
        x += w
    return img


def toggle(d, box, s, label, lit, pressed, led=True, icon=None):
    button_face(d, box, s, pressed)
    x0, y0, x1, y1 = box
    o = 1 if pressed else 0
    lx = x0 + 3
    if led:
        d.rectangle((lx + o, y0 + (y1 - y0) // 2 - 1 + o, lx + 2 + o, y0 + (y1 - y0) // 2 + 1 + o), fill=s["led_on"] if lit else s["led_off"])
        lx += 5
    if icon == "repeat":
        c = s["btn_glyph"]
        d.rectangle((lx + 2 + o, y0 + 4 + o, lx + 14 + o, y0 + 10 + o), outline=c)
        d.polygon([(lx + 14 + o, y0 + 2 + o), (lx + 17 + o, y0 + 4 + o), (lx + 14 + o, y0 + 6 + o)], fill=c)
        return
    tx = lx + max(0, (x1 - lx - text_w(label)) // 2)
    text(d, label, tx + o, y0 + (y1 - y0 - 4) // 2 + o, s["btn_glyph"])


def sheet_shufrep(s):
    img = Image.new("RGB", (92, 85), s["face_bot"])
    d = ImageDraw.Draw(img)
    for i, (lit, pressed) in enumerate(((False, False), (False, True), (True, False), (True, True))):
        toggle(d, (0, i * 15, 27, i * 15 + 14), s, "", lit, pressed, icon="repeat")
        toggle(d, (28, i * 15, 74, i * 15 + 14), s, "SHUFFLE", lit, pressed)
    for x, label in ((0, "EQ"), (23, "PL")):
        toggle(d, (x, 61, x + 22, 72), s, label, False, False)
        toggle(d, (x, 73, x + 22, 84), s, label, True, False)
        toggle(d, (x + 46, 61, x + 68, 72), s, label, False, True)
        toggle(d, (x + 46, 73, x + 68, 84), s, label, True, True)
    return img


def thumb(d, box, s, pressed=False):
    x0, y0, x1, y1 = box
    top, bot = s["thumb"]
    if pressed:
        top, bot = lerp(top, s["accent"], 0.45), lerp(bot, s["accent"], 0.45)
    if s["round"]:
        d.rounded_rectangle(box, radius=3, fill=bot, outline=s["lo"])
        d.rounded_rectangle((x0 + 1, y0 + 1, x1 - 1, (y0 + y1) // 2), radius=2, fill=top)
    else:
        vgrad(d, box, top, bot)
        bevel(d, box, (255, 255, 255), s["lo"])
        d.line([((x0 + x1) // 2, y0 + 2), ((x0 + x1) // 2, y1 - 2)], fill=s["lo"])


def fill_color(s, t):
    f = s["fill"]
    return lerp(f[0], f[1], t * 2) if t < 0.5 else lerp(f[1], f[2], (t - 0.5) * 2)


def sheet_posbar(s):
    img = Image.new("RGB", (307, 10), s["face_bot"])
    d = ImageDraw.Draw(img)
    face(img, s, (0, 0, 247, 9))
    inset(d, (0, 3, 247, 6), s["groove"], s)
    thumb(d, (248, 0, 276, 9), s)
    thumb(d, (278, 0, 306, 9), s, pressed=True)
    return img


def sheet_volume(s, balance=False):
    img = Image.new("RGB", (68, 433), s["face_bot"])
    d = ImageDraw.Draw(img)
    x0, w = (9, 38) if balance else (0, 68)
    for i in range(28):
        y = i * 15
        t = i / 27
        face(img, s, (x0, y, x0 + w - 1, y + 12))
        inset(d, (x0 + 1, y + 4, x0 + w - 2, y + 8), s["groove"], s)
        if balance:
            mid = x0 + w // 2
            span = round((w // 2 - 3) * t)
            if span:
                d.rectangle((mid - span, y + 5, mid + span, y + 7), fill=fill_color(s, t))
            d.line([(mid, y + 5), (mid, y + 7)], fill=s["label"])
        else:
            end = x0 + 2 + round((w - 5) * t)
            for x in range(x0 + 2, end + 1):
                d.line([(x, y + 5), (x, y + 7)], fill=fill_color(s, (x - x0) / w * (0.4 + 0.6 * t)))
    thumb(d, (15, 422, 28, 432), s)
    thumb(d, (0, 422, 13, 432), s, pressed=True)
    return img


def sheet_monoster(s):
    img = Image.new("RGB", (56, 24), s["face_bot"])
    d = ImageDraw.Draw(img)
    for x, w, label in ((0, 29, "STEREO"), (29, 27, "MONO")):
        for y, lit in ((0, True), (12, False)):
            face(img, s, (x, y, x + w - 1, y + 11))
            text(d, label, x + (w - text_w(label)) // 2, y + 4, s["led_on"] if lit else lerp(s["face_bot"], s["label"], 0.35))
    return img


def sheet_playpaus(s):
    img = Image.new("RGB", (42, 9), s["lcd"])
    d = ImageDraw.Draw(img)
    d.polygon([(1, 0), (7, 4), (1, 8)], fill=s["led_on"])
    d.rectangle((10, 1, 12, 7), fill=s["fg"]); d.rectangle((14, 1, 16, 7), fill=s["fg"])
    d.rectangle((19, 1, 25, 7), fill=s["fg"])
    d.rectangle((36, 0, 38, 8), fill=(200, 30, 30))
    d.rectangle((39, 0, 41, 8), fill=s["led_on"])
    return img


SEG = {"0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg", " ": "", "-": "g"}
SEG_BOX = {"a": (2, 0, 6, 1), "f": (0, 2, 1, 5), "b": (7, 2, 8, 5), "g": (2, 6, 6, 6), "e": (0, 7, 1, 10), "c": (7, 7, 8, 10), "d": (2, 11, 6, 12)}


def sheet_numbers(s, ex=False):
    chars = "0123456789 " + ("-" if ex else "")
    img = Image.new("RGB", (9 * len(chars), 13), s["lcd"])
    d = ImageDraw.Draw(img)
    for i, ch in enumerate(chars):
        for seg, (x0, y0, x1, y1) in SEG_BOX.items():
            d.rectangle((i * 9 + x0, y0, i * 9 + x1, y1), fill=s["fg"] if seg in SEG[ch] else s["fg_dim"])
    return img


def sheet_text(s):
    img = Image.new("RGB", (155, 18), s["lcd"])
    d = ImageDraw.Draw(img)
    for r, row in enumerate(TEXT_LAYOUT):
        for c, ch in enumerate(row[:31]):
            if ch != " ":
                glyph(d, ch, c * 5, r * 6, s["fg"])
    return img


def sheet_eqmain(s):
    img = Image.new("RGB", (275, 315), s["face_bot"])
    d = face(img, s, (0, 0, 274, 115))
    bevel(d, (0, 0, 274, 115), s["hi"], s["lo"])
    text(d, "PREAMP", 28 - text_w("PREAMP") // 2, 104, s["label"])
    text(d, "+12DB", 43, 37, s["label"]); text(d, "+0DB", 45, 65, s["label"]); text(d, "-12DB", 43, 96, s["label"])
    for i, lab in enumerate(["60", "170", "310", "600", "1K", "3K", "6K", "12K", "14K", "16K"]):
        text(d, lab, 78 + 18 * i + 7 - text_w(lab) // 2, 104, s["label"])
    inset(d, (85, 16, 199, 36), s["lcd"], s)
    title_bar(img, d, (0, 134, 274, 147), s, True, label="EQUALIZER")
    title_bar(img, d, (0, 149, 274, 162), s, False, label="EQUALIZER")
    d.rectangle((0, 116, 8, 133), fill=s["face_bot"])
    small_btn(d, 0, 116, s, "close"); small_btn(d, 0, 125, s, "close", pressed=True)
    for x, lit, pressed in ((10, False, False), (128, False, True), (69, True, False), (187, True, True)):
        toggle(d, (x, 119, x + 25, 130), s, "ON", lit, pressed)
    for x, lit, pressed in ((36, False, False), (154, False, True), (95, True, False), (213, True, True)):
        toggle(d, (x, 119, x + 31, 130), s, "AUTO", lit, pressed)
    for i in range(28):                                      # slider backgrounds: frame 0 = -12 dB … 27 = +12 dB
        x, y = 13 + (i % 14) * 15, 164 + (i // 14) * 65
        t = i / 27
        d.rectangle((x, y, x + 13, y + 62), fill=s["face_bot"])
        inset(d, (x + 5, y, x + 8, y + 62), s["groove"], s)
        mid, top = y + 31, y + 5 + round((1 - t) * 52)
        a, b = sorted((mid, top))
        d.rectangle((x + 6, a, x + 7, b), fill=fill_color(s, t))
    thumb(d, (0, 164, 10, 174), s)
    thumb(d, (0, 176, 10, 186), s, pressed=True)
    button_face(d, (224, 164, 267, 175), s); text(d, "PRESETS", 226, 168, s["btn_glyph"])
    button_face(d, (224, 176, 267, 187), s, pressed=True); text(d, "PRESETS", 227, 181, s["btn_glyph"])
    d.rectangle((0, 294, 112, 312), fill=s["lcd"])
    for x in range(0, 113, 4):
        d.point((x, 303), fill=s["fg_dim"])
    for y in range(19):                                      # graph line colours, top to bottom
        d.point((115, 294 + y), fill=lerp(s["fg_hi"], s["fill"][0], abs(y - 9) / 9) if y != 9 else s["fg"])
    d.line([(0, 314), (112, 314)], fill=s["fill"][1])
    return img


def sheet_pledit(s):
    img = Image.new("RGB", (280, 186), s["face_bot"])
    d = ImageDraw.Draw(img)
    for y, act in ((0, True), (21, False)):
        face(img, s, (0, y, 177, y + 19))
        a, b = s["title"] if act else s["title_off"]
        for x0, w in ((0, 25), (26, 100), (127, 25), (153, 25)):
            (hgrad if s["title_dir"] == "h" else vgrad)(d, (x0, y + 1, x0 + w - 1, y + 13), a, b)
            d.line([(x0, y + 14), (x0 + w - 1, y + 14)], fill=s["lo"])
        text(d, "PLAYLIST", 26 + 50 - text_w("PLAYLIST") // 2, y + 5, s["title_text"] if act else s["title_text_off"])
        small_btn(d, 153 + 25 - 2 - 9, y + 3, s, "close")
        small_btn(d, 153 + 25 - 12 - 9, y + 3, s, "shade")
    # side tiles: left frame 12px, right frame 20px with the scroll groove
    face(img, s, (0, 42, 11, 70)); bevel(d, (0, 42, 11, 70), s["hi"], s["lo"])
    face(img, s, (31, 42, 50, 70))
    inset(d, (31 + 5, 42, 31 + 12, 70), s["groove"], s)
    thumb(d, (52, 53, 59, 70), s); thumb(d, (61, 53, 68, 70), s, pressed=True)
    small_btn(d, 52, 42, s, "close", pressed=True); small_btn(d, 62, 42, s, "shade", pressed=True); small_btn(d, 150, 42, s, "unshade", pressed=True)
    for x, y, w in ((72, 42, 25), (72, 57, 25), (99, 42, 50), (99, 57, 50)):  # playlist windowshade pieces
        (hgrad if s["title_dir"] == "h" else vgrad)(d, (x, y, x + w - 1, y + 13), *(s["title_off"] if (x, y) == (99, 57) else s["title"]))
    for y in (42, 57):                                                     # restore + close on the right piece
        small_btn(d, 99 + 29, y + 3, s, "unshade"); small_btn(d, 99 + 39, y + 3, s, "close")
    # bottom tiles
    face(img, s, (179, 0, 203, 37)); bevel(d, (179, 0, 203, 37), s["hi"], s["lo"])
    face(img, s, (0, 72, 124, 109)); bevel(d, (0, 72, 124, 109), s["hi"], s["lo"])
    for x, label in ((14, "ADD"), (43, "REM"), (72, "SEL"), (101, "MISC")):
        button_face(d, (x, 80, x + 21, 97), s)
        text(d, label, x + 11 - text_w(label) // 2, 87, s["btn_glyph"])
    face(img, s, (126, 72, 275, 109)); bevel(d, (126, 72, 275, 109), s["hi"], s["lo"])
    inset(d, (126 + 5, 72 + 8, 126 + 5 + 62, 72 + 19), s["lcd"], s)       # running time
    inset(d, (126 + 64, 72 + 21, 126 + 64 + 38, 72 + 30), s["lcd"], s)    # mini time
    for i, name in enumerate(("prev", "play", "pause", "stop", "next", "eject")):  # mini transport glyphs
        bx, by = 126 + 3 + i * 10, 72 + 22
        d.rectangle((bx, by, bx + 8, by + 8), fill=lerp(s["face_bot"], s["lo"], 0.3))
        m = Image.new("RGB", (23, 18), (0, 0, 0)); md = ImageDraw.Draw(m); transport_glyph(md, name, 0, 0, (255, 255, 255))
        small = m.resize((10, 8), Image.NEAREST)
        for yy in range(8):
            for xx in range(9):
                if small.getpixel((xx, yy))[0] > 128:
                    d.point((bx + xx, by + yy), fill=s["label"] if s["btn_well"] is None else s["fg"])
    button_face(d, (126 + 150 - 22 - 22, 80, 126 + 150 - 22 - 1, 97), s)
    text(d, "LIST", 126 + 150 - 22 - 11 - text_w("LIST") // 2, 87, s["btn_glyph"])
    for k in range(4):                                                     # resize grip
        d.line([(126 + 149 - 3 - k * 3, 72 + 37), (126 + 149, 72 + 37 - 3 - k * 3)], fill=s["lo"])
    d.rectangle((205, 0, 279, 37), fill=s["lcd"])                         # playlist visualizer area
    # pop-up menu items (22x18): normal, then selected one column right
    items = [((0, 111), "URL"), ((0, 130), "DIR"), ((0, 149), "FILE"), ((54, 111), "ALL"), ((54, 130), "CROP"), ((54, 149), "SEL"), ((54, 168), "MISC"),
             ((104, 111), "INV"), ((104, 130), "NONE"), ((104, 149), "ALL"), ((154, 111), "SORT"), ((154, 130), "INFO"), ((154, 149), "OPTS"),
             ((204, 111), "NEW"), ((204, 130), "SAVE"), ((204, 149), "LOAD")]
    for (x, y), label in items:
        for dx, sel in ((0, False), (23, True)):
            button_face(d, (x + dx, y, x + dx + 21, y + 17), s, pressed=sel)
            text(d, label, x + dx + 11 - text_w(label) // 2, y + 7, s["accent"] if sel else s["btn_glyph"])
    for x, h in ((48, 54), (100, 72), (150, 54), (200, 54), (250, 54)):  # menu side bars
        vgrad(d, (x, 111, x + 2, 111 + h - 1), s["title"][1], s["title"][0])
    return img


def sheet_gen(s):
    img = Image.new("RGB", (194, 109), s["face_bot"])
    d = ImageDraw.Draw(img)
    for y, act in ((0, True), (21, False)):
        a, b = s["title"] if act else s["title_off"]
        for x in (0, 26, 52, 78, 104, 130):
            face(img, s, (x, y, x + 24, y + 19))
            (hgrad if s["title_dir"] == "h" else vgrad)(d, (x, y + 1, x + 24, y + 13), a, b)
            d.line([(x, y + 14), (x + 24, y + 14)], fill=s["lo"])
        small_btn(d, 130 + 25 - 2 - 9, y + 3, s, "close")
    face(img, s, (0, 42, 124, 55)); bevel(d, (0, 42, 124, 55), s["hi"], s["lo"])
    face(img, s, (0, 57, 124, 70)); bevel(d, (0, 57, 124, 70), s["hi"], s["lo"])
    for k in range(3):
        d.line([(124 - 2 - k * 3, 70), (124, 70 - 2 - k * 3)], fill=s["lo"])
    face(img, s, (127, 72, 151, 85))
    for x, w, h, y in ((127, 11, 29, 42), (158, 11, 24, 42), (139, 8, 29, 42), (170, 8, 24, 42)):
        face(img, s, (x, y, x + w - 1, y + h - 1)); bevel(d, (x, y, x + w - 1, y + h - 1), s["hi"], s["lo"])
    small_btn(d, 148, 42, s, "close", pressed=True)
    return img


SHEETS = {"main": sheet_main, "titlebar": sheet_titlebar, "cbuttons": sheet_cbuttons, "shufrep": sheet_shufrep, "posbar": sheet_posbar,
          "volume": sheet_volume, "balance": lambda s: sheet_volume(s, balance=True), "monoster": sheet_monoster, "playpaus": sheet_playpaus,
          "numbers": sheet_numbers, "nums_ex": lambda s: sheet_numbers(s, ex=True), "text": sheet_text, "eqmain": sheet_eqmain, "pledit": sheet_pledit, "gen": sheet_gen}


def viscolor_txt(s):
    return "".join(f"{r},{g},{b}, // {i}\n" for i, (r, g, b) in enumerate(s["vis"]))


def pledit_txt(s):
    return "[Text]\n" + "".join(f"{k}={v}\n" for k, v in s["pl"].items())


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    previews = []
    for sid, s in STYLES.items():
        folder = OUT / sid
        folder.mkdir(exist_ok=True)
        wsz = io.BytesIO()
        with zipfile.ZipFile(wsz, "w", zipfile.ZIP_DEFLATED) as z:
            for name, fn in SHEETS.items():
                im = fn(s)
                im.save(folder / f"{name}.png", optimize=True)
                b = io.BytesIO(); im.save(b, "BMP")
                z.writestr(zipfile.ZipInfo(f"{name.upper()}.BMP", (2026, 1, 1, 0, 0, 0)), b.getvalue())
                if name == "main":
                    comp = im.copy()
                    comp.paste(sheet_titlebar(s).crop((27, 0, 302, 14)), (0, 0))
                    previews.append(comp)
            for fname, body in (("VISCOLOR.TXT", viscolor_txt(s)), ("PLEDIT.TXT", pledit_txt(s)),
                                ("README.TXT", f"{s['name']} for NightAmp (Windows - ColeForge Edition).\nOriginal art drawn by coleforge/art/nightcode/build_nightamp_skins.py.\nWorks in NightAmp, Winamp 2.x/5.x and Webamp.\n")):
                z.writestr(zipfile.ZipInfo(fname, (2026, 1, 1, 0, 0, 0)), body)
        (folder / "viscolor.txt").write_text(viscolor_txt(s))
        (folder / "pledit.txt").write_text(pledit_txt(s))
        (folder / "skin.json").write_text(json.dumps({"id": sid, "name": s["name"], "author": "ColeForge", "builtin": True}) + "\n")
        (OUT / f"{s['name'].replace(' ', '-')}.wsz").write_bytes(wsz.getvalue())
    sheet = Image.new("RGB", (275 * len(previews) + 10 * (len(previews) + 1), 136), (4, 8, 26))
    for i, p in enumerate(previews):
        sheet.paste(p, (10 + i * 285, 10))
    sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST).save(HERE / "skins-preview.png")
    print(f"wrote {len(STYLES)} NightAmp skins to", OUT.relative_to(HERE.parent.parent.parent))


if __name__ == "__main__":
    main()
