"""Draw Albert, the ColeForge / NightCode agent, as 16-bit pixel art.

    python coleforge/art/albert/build_albert.py

Albert is a small android: a round CRT-glass head with a kind face on the screen (eyes behind round
spectacles), a cyan antenna light, a knitted NightCode scarf, and a lantern, because his job is to be a
light you carry into the dark corners of a problem. Drawn in the NightCode 16-colour palette with the
same helpers as the theme's icons (black keylines, dithered shading).

Writes coleforge/shell/assets/art/albert/:
  albert-sheet.png   64x64 frames: row 0 idle (4), row 1 talking (4), row 2 thinking (4), row 3 happy (4)
  albert-64.png      the first idle frame
  albert-128.png     2x, for splash and About
  albert-icon.png    32x32 head icon (program icon), albert-16.png for small places
and a 4x preview next to this script (albert-preview.png).
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "nightcode"))
from build_nightcode_icons import (T, K, N1, N2, N3, B1, B2, C1, C2, W, S1, S2, S3, A,  # noqa: E402
                                   STEEL, NAVY, paint, rect, ellipse, poly, outline, px)

OUT = HERE.parent.parent / "shell" / "assets" / "art" / "albert"
F = 64


def body(img, d, bob):
    y = bob
    # legs and feet
    paint(img, rect((24, 52 + y, 29, 58 + y)), NAVY, "cyl")
    paint(img, rect((35, 52 + y, 40, 58 + y)), NAVY, "cyl")
    paint(img, ellipse((21, 56 + y, 30, 61 + y)), STEEL, "sphere")
    paint(img, ellipse((34, 56 + y, 43, 61 + y)), STEEL, "sphere")
    # torso: a rounded navy coat with silver trim
    paint(img, ellipse((18, 34 + y, 46, 58 + y)), [N1, N2, N3, B1], "sphere")
    d.line([(32, 38 + y), (32, 54 + y)], fill=S1)
    px(d, [(29, 44 + y), (29, 49 + y)], S2)                     # buttons
    # chest light
    px(d, [(36, 44 + y), (35, 45 + y), (37, 45 + y), (36, 46 + y)], C1)
    px(d, [(36, 45 + y)], C2)
    # arms: left (his right) hangs, right holds the lantern
    paint(img, poly([(18, 40 + y), (14, 50 + y), (17, 52 + y), (21, 43 + y)]), NAVY, "diag")
    paint(img, ellipse((12, 49 + y, 18, 55 + y)), STEEL, "sphere")
    paint(img, poly([(45, 40 + y), (50, 46 + y), (48, 49 + y), (43, 44 + y)]), NAVY, "diag")
    paint(img, ellipse((46, 44 + y, 52, 50 + y)), STEEL, "sphere")


def lantern(img, d, bob, glow):
    y = bob
    d.line([(49, 44 + y), (49, 47 + y)], fill=S2)               # handle
    paint(img, rect((46, 47 + y, 53, 49 + y)), STEEL, "v")      # cap
    paint(img, rect((46, 50 + y, 53, 57 + y)), [C1, C2, W] if glow else [B1, C1, C2], "sphere")
    d.line([(46, 50 + y), (46, 57 + y)], fill=S1)
    d.line([(53, 50 + y), (53, 57 + y)], fill=S1)
    paint(img, rect((46, 58 + y, 53, 59 + y)), STEEL, "v")      # base
    px(d, [(49, 53 + y), (50, 53 + y), (49, 54 + y), (50, 54 + y)], W if glow else C2)  # flame


def halo(img, bob, glow):
    """Soft light around the lantern (added after the outline so it isn't keylined)."""
    p = img.load()
    cx, cy = 49.5, 53.5 + bob
    r = 10 if glow else 8
    for yy in range(int(cy - r), int(cy + r) + 1):
        for xx in range(int(cx - r), int(cx + r) + 1):
            if not (0 <= xx < F and 0 <= yy < F) or p[xx, yy][3]:
                continue
            dd = ((xx - cx) ** 2 + (yy - cy) ** 2) ** 0.5
            if dd < r and (xx + yy) % 2 == 0 and dd > 5:
                a = int(90 * (1 - dd / r))
                if a > 12:
                    p[xx, yy] = (49, 215, 232, a)


def scarf(img, d, bob, wind):
    y = bob
    # the knitted band: cyan with a navy stripe, ribbed with a dither
    paint(img, lambda m: m.rounded_rectangle((19, 32 + y, 45, 37 + y), radius=2, fill=255), [N3, C1, C2], "v")
    d.line([(20, 35 + y), (44, 35 + y)], fill=N3)
    for x in range(20, 45, 2):
        px(d, [(x, 33 + y)], C2)
    # the tail hangs on his right side (viewer's left), swinging a little
    tail = [(20, 36 + y), (25, 36 + y), (23 - wind, 48 + y), (18 - wind, 47 + y)]
    paint(img, poly(tail), [N3, C1, C2], "h")
    for yy in (39, 42, 45):
        d.line([(19 - wind // 2, yy + y), (24 - wind // 2, yy + y)], fill=N3)
    px(d, [(18 - wind, 49 + y), (20 - wind, 50 + y), (22 - wind, 49 + y)], C1)  # fringe


def head(img, d, bob, eyes="open", mouth="smile", antenna=True, look=0):
    y = bob
    # antenna
    d.line([(32, 3 + y), (32, 7 + y)], fill=S2)
    paint(img, ellipse((30, 0 + y, 34, 4 + y)), [C1, C2, W] if antenna else [N3, B1, C1], "sphere")
    # ear knobs
    paint(img, ellipse((11, 16 + y, 17, 24 + y)), STEEL, "sphere")
    paint(img, ellipse((47, 16 + y, 53, 24 + y)), STEEL, "sphere")
    # the steel CRT bezel and glass screen
    paint(img, lambda m: m.rounded_rectangle((14, 6 + y, 50, 33 + y), radius=9, fill=255), STEEL, "sphere")
    paint(img, lambda m: m.rounded_rectangle((18, 10 + y, 46, 29 + y), radius=6, fill=255), [N1, N1, N2, N3], "sphere", gamma=1.6)
    # glass shine
    px(d, [(21, 12 + y), (22, 12 + y), (20, 13 + y), (20, 14 + y)], S3)
    # scanlines on the glass
    for yy in range(12, 29, 2):
        for xx in range(19, 46):
            c = img.getpixel((xx, yy + y))
            if c[3] and c[:3] in (N1[:3], N2[:3]):
                img.putpixel((xx, yy + y), (6, 14, 36, 255))
    # spectacles: two rings and a bridge
    lx, rx, ey = 26 + look, 38 + look, 18 + y
    for cx in (lx, rx):
        d.ellipse((cx - 5, ey - 4, cx + 4, ey + 4), outline=B2)
    d.line([(lx + 4, ey - 1), (rx - 5, ey - 1)], fill=B2)
    # eyes
    for cx in (lx, rx):
        if eyes == "open":
            d.rectangle((cx - 2, ey - 2, cx + 1, ey + 2), fill=C1)
            d.rectangle((cx - 2, ey - 2, cx - 1, ey - 1), fill=C2)
            px(d, [(cx - 2, ey - 2)], W)
        elif eyes == "blink":
            d.line([(cx - 2, ey + 1), (cx + 1, ey + 1)], fill=C1)
        elif eyes == "up":
            d.rectangle((cx - 2, ey - 3, cx + 1, ey), fill=C1)
            px(d, [(cx - 2, ey - 3)], W)
        elif eyes == "happy":                                      # ^ ^
            px(d, [(cx - 2, ey + 1), (cx - 1, ey), (cx, ey - 1), (cx + 1, ey), (cx + 2, ey + 1)], C1)
    # mouth / screen line
    my = 25 + y
    if mouth == "smile":
        px(d, [(29, my), (30, my + 1), (31, my + 1), (32, my + 1), (33, my + 1), (34, my + 1), (35, my)], C1)
    elif mouth.startswith("wave"):                                 # talking: a little waveform
        k = int(mouth[-1])
        amp = [[0, 1, 0, -1, 0, 1, 0], [1, -1, 1, -1, 1, -1, 1], [0, 2, -1, 1, -2, 1, 0], [1, 0, -1, 0, 1, 0, -1]][k]
        for i, a in enumerate(amp):
            px(d, [(29 + i, my + a)], C2 if abs(a) > 1 else C1)
    elif mouth.startswith("dots"):                                  # thinking: . . .
        k = int(mouth[-1])
        for i in range(3):
            px(d, [(28 + i * 4, my + 1)], C2 if i == k else N3)
    elif mouth == "grin":
        d.line([(28, my), (36, my)], fill=C1)
        px(d, [(29, my + 1), (30, my + 2), (31, my + 2), (32, my + 2), (33, my + 2), (34, my + 1)], C1)


def frame(state, i):
    img, d = Image.new("RGBA", (F, F), T), None
    d = ImageDraw.Draw(img)
    bob = 1 if (state == "idle" and i in (1, 2)) or (state == "happy" and i % 2) else 0
    glow = state != "idle" or i != 3
    wind = [0, 1, 1, 0][i]
    body(img, d, bob)
    scarf(img, d, bob, wind if state != "think" else 0)
    lantern(img, d, bob, glow)
    if state == "idle":
        head(img, d, bob, eyes="blink" if i == 2 else "open", antenna=i in (0, 1))
    elif state == "talk":
        head(img, d, bob, eyes="open", mouth=f"wave{i}", antenna=i % 2 == 0)
    elif state == "think":
        head(img, d, bob, eyes="up", mouth=f"dots{i % 3}", antenna=True, look=[-1, 0, 1, 0][i])
    else:
        head(img, d, bob, eyes="happy", mouth="grin", antenna=True)
    img = outline(img)
    halo(img, bob, glow)
    return img


def icon(n=32):
    """The program icon: Albert's head and scarf, big."""
    big = frame("idle", 0).crop((8, 0, 56, 48))
    return big.resize((n, n), Image.NEAREST) if n != 48 else big


def to_palette(img):
    """Snap a smooth downscale back onto the NightCode palette with hard alpha (keeps it pixel art)."""
    pal = [K, N1, N2, N3, B1, B2, C1, C2, W, S1, S2, S3, A]
    p = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = p[x, y]
            if a < 110:
                p[x, y] = T
                continue
            p[x, y] = min(pal, key=lambda c: (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2)
    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    states = ["idle", "talk", "think", "happy"]
    sheet = Image.new("RGBA", (F * 4, F * len(states)), T)
    for r, s in enumerate(states):
        for i in range(4):
            sheet.alpha_composite(frame(s, i), (i * F, r * F))
    sheet.save(OUT / "albert-sheet.png")
    first = frame("idle", 0)
    first.save(OUT / "albert-64.png")
    first.resize((128, 128), Image.NEAREST).save(OUT / "albert-128.png")
    # head icon: crop the head square and scale with nearest-neighbour steps
    head_crop = to_palette(first.crop((10, 0, 54, 44)).resize((32, 32), Image.LANCZOS))
    head_crop.save(OUT / "albert-icon.png")
    first.crop((10, 0, 54, 44)).resize((16, 16), Image.LANCZOS).save(OUT / "albert-16.png")
    prev = Image.new("RGBA", (sheet.width * 4 + 16, sheet.height * 4 + 16), (4, 8, 26, 255))
    prev.alpha_composite(sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST), (8, 8))
    prev.save(HERE / "albert-preview.png")
    print("wrote Albert to", OUT.relative_to(HERE.parent.parent.parent))


if __name__ == "__main__":
    main()
