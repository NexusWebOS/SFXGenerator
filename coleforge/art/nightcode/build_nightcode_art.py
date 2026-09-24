"""Build the NightCode edition art from Cole's NightCode artwork (source/).

    python coleforge/art/nightcode/build_nightcode_art.py

Writes into coleforge/shell/assets/art/:
  nightcode/logo*.png          the official NightCode logo at several sizes
  avatars/nightcode.png        the NightCode avatar (and registers it in avatars/avatars.json)
  wallpapers/nightcode*.png    1920x1080 desktop wallpapers
  programs/*.png               desktop icons and art for Netcon and Disk Dude
A 4x preview of the program icons goes next to this script.
"""

import json
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
SRC = HERE / "source"
ART = HERE.parent.parent / "shell" / "assets" / "art"
TOOLS = HERE.parent.parent / "programs" / "retro-tools" / "assets"
sys.path.insert(0, str(HERE.parent / "forgechat"))
from build_forgechat_icons import K, W, S, G, NAVY, CYAN, canvas, dither, px  # noqa: E402

W16, H16 = 1920, 1080
INK = (4, 8, 22)
BLUE = (30, 120, 255)
CYAN_T = (49, 215, 232, 255)
VIOLET = (134, 101, 220, 255)
SILVER = (220, 238, 244, 255)
DARKNAVY = (10, 16, 32, 255)


def logo():
    im = Image.open(SRC / "nightcode-logo.webp").convert("RGBA")
    return im.crop(im.split()[-1].getbbox())


def fit(im, size):
    im = im.copy()
    im.thumbnail((size, size), Image.LANCZOS)
    return im


def square(im, size, bg=None):
    out = Image.new("RGBA", (size, size), bg or (0, 0, 0, 0))
    t = fit(im, size)
    out.alpha_composite(t, ((size - t.width) // 2, (size - t.height) // 2))
    return out


def radial(w, h, inner, outer, cx=0.5, cy=0.5, r=0.75):
    small = Image.new("RGB", (w // 8, h // 8))
    p = small.load()
    for y in range(small.height):
        for x in range(small.width):
            d = min(1.0, (((x / small.width - cx) * w / h) ** 2 + (y / small.height - cy) ** 2) ** 0.5 / r)
            p[x, y] = tuple(round(a + (b - a) * d) for a, b in zip(inner, outer))
    return small.resize((w, h), Image.BICUBIC).convert("RGBA")


def circuits(img, seed=7, count=90):
    """Glowing pixel circuit traces with square pads, like the logo's chip frame."""
    rnd = random.Random(seed)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    step = 12
    for _ in range(count):
        x = rnd.randrange(0, img.width // step) * step
        y = rnd.randrange(0, img.height // step) * step
        col = (40, 110, 255, rnd.randrange(60, 150))
        pts = [(x, y)]
        for _ in range(rnd.randrange(2, 6)):
            if rnd.random() < 0.5:
                x += rnd.choice((-1, 1)) * rnd.randrange(3, 14) * step
            else:
                y += rnd.choice((-1, 1)) * rnd.randrange(2, 8) * step
            pts.append((x, y))
        d.line(pts, fill=col, width=2)
        ex, ey = pts[-1]
        d.rectangle((ex - 5, ey - 5, ex + 5, ey + 5), outline=(90, 170, 255, col[3] + 60), width=2)
    glow = layer.filter(ImageFilter.GaussianBlur(4))
    img.alpha_composite(glow)
    img.alpha_composite(layer)
    return img


def scanlines(img, alpha=26):
    lines = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lines)
    for y in range(0, img.height, 3):
        d.line([(0, y), (img.width, y)], fill=(0, 0, 0, alpha))
    img.alpha_composite(lines)
    return img


def wallpaper_logo(mark):
    """The main NightCode wallpaper: circuit night with the official logo, space left for icons."""
    bg = radial(W16, H16, (14, 34, 92), INK, cx=0.62, cy=0.48, r=0.8)
    circuits(bg)
    m = fit(mark, 820)
    halo = Image.new("RGBA", (m.width + 200, m.height + 200), (0, 0, 0, 0))
    halo.alpha_composite(m, (100, 100))
    alpha = halo.split()[-1].filter(ImageFilter.GaussianBlur(40))
    glow = Image.new("RGBA", halo.size, (30, 110, 255, 0))
    glow.putalpha(alpha.point(lambda a: min(255, int(a * 0.7))))
    pos = (int(W16 * 0.62 - m.width / 2), (H16 - m.height) // 2 - 20)
    bg.alpha_composite(glow, (pos[0] - 100, pos[1] - 100))
    bg.alpha_composite(m, pos)
    return scanlines(bg)


def wallpaper_from_square(path):
    """Put a square NightCode poster on a 16:9 canvas, filling the sides with a darkened blur of itself."""
    art = Image.open(path).convert("RGBA")
    side = art.resize((W16, W16), Image.LANCZOS).crop((0, (W16 - H16) // 2, W16, (W16 + H16) // 2))
    side = side.filter(ImageFilter.GaussianBlur(28))
    dark = Image.new("RGBA", side.size, (0, 0, 10, 170))
    side.alpha_composite(dark)
    main = art.resize((H16, H16), Image.LANCZOS)
    fade = Image.new("L", main.size, 255)
    fd = ImageDraw.Draw(fade)
    for i in range(60):
        fd.rectangle((i, 0, i, H16), fill=int(255 * i / 60))
        fd.rectangle((H16 - 1 - i, 0, H16 - 1 - i, H16), fill=int(255 * i / 60))
    main.putalpha(fade)
    side.alpha_composite(main, ((W16 - H16) // 2, 0))
    return side


def avatar(mark):
    bg = radial(192, 192, (22, 50, 120), INK, r=0.7)
    mk = fit(mark, 176)
    bg.alpha_composite(mk, ((192 - mk.width) // 2, (192 - mk.height) // 2))
    return bg.convert("RGB")


# ---------------------------------------------------------------- program icons (32x32 pixel art)
def icon_netcon():
    img, d = canvas()
    # circuit board behind
    d.rectangle((14, 12, 30, 28), fill=(0, 96, 48, 255), outline=K)
    for x in (17, 21, 25):
        d.line([(x, 13), (x, 27)], fill=(0, 160, 80, 255))
    d.rectangle((20, 17, 26, 23), fill=K); d.rectangle((21, 18, 25, 22), fill=CYAN_T)
    # lanyard + badge
    d.line([(8, 0), (10, 5)], fill=VIOLET, width=2); d.line([(16, 0), (13, 5)], fill=VIOLET, width=2)
    d.rectangle((9, 4, 14, 8), fill=S, outline=K)
    d.rectangle((3, 7, 19, 30), fill=SILVER, outline=K)
    d.rectangle((4, 8, 18, 12), fill=DARKNAVY)
    d.rectangle((6, 14, 12, 21), fill=DARKNAVY, outline=CYAN_T)
    px(d, [(8, 16), (10, 16)], CYAN_T)                     # skull eyes on the photo
    d.rectangle((8, 18, 10, 19), fill=S)
    d.line([(6, 24), (16, 24)], fill=NAVY); d.line([(6, 27), (13, 27)], fill=G)
    px(d, [(5, 9), (7, 9), (9, 9)], CYAN_T)
    return img


def icon_diskdude():
    img, d = canvas()
    d.ellipse((1, 3, 30, 31), fill=SILVER, outline=K)
    d.pieslice((3, 5, 28, 29), 20, 80, fill=VIOLET)
    d.pieslice((3, 5, 28, 29), 200, 250, fill=CYAN_T)
    d.ellipse((12, 14, 19, 21), fill=DARKNAVY, outline=S)
    # hoodie rim around the top and the shades
    d.arc((0, 1, 31, 32), 190, 350, fill=NAVY, width=3)
    d.rectangle((5, 9, 14, 12), fill=K); d.rectangle((17, 9, 26, 12), fill=K); d.line([(14, 10), (17, 10)], fill=K)
    px(d, [(6, 10), (18, 10)], W)
    d.arc((10, 20, 21, 26), 20, 160, fill=K)
    return img


def main():
    for sub in ("nightcode", "avatars", "wallpapers", "programs"):
        (ART / sub).mkdir(parents=True, exist_ok=True)
    mark = logo()
    fit(mark, 512).save(ART / "nightcode" / "logo.png", optimize=True)
    for s in (128, 64, 32, 16):
        square(mark, s).save(ART / "nightcode" / f"logo-{s}.png")

    avatar(mark).save(ART / "avatars" / "nightcode.png", optimize=True)
    listing = ART / "avatars" / "avatars.json"
    items = json.loads(listing.read_text()) if listing.exists() else []
    items = [a for a in items if a.get("id") != "nightcode"]
    items.insert(0, {"id": "nightcode", "label": "NightCode", "file": "assets/art/avatars/nightcode.png"})
    listing.write_text(json.dumps(items, indent=2) + "\n")

    wallpaper_logo(mark).convert("RGB").save(ART / "wallpapers" / "nightcode.png", optimize=True)
    for name, src in (("nightcode-enter", "nightcode-enter.webp"), ("nightcode-grid", "nightcode-shadow-grid.webp"), ("nightcode-beyond", "nightcode-beyond-light.webp")):
        wallpaper_from_square(SRC / src).convert("RGB").save(ART / "wallpapers" / f"{name}.jpg", quality=88, optimize=True)

    icons = {"netcon": icon_netcon(), "diskdude": icon_diskdude()}
    for name, im in icons.items():
        im.save(ART / "programs" / f"{name}.png")
        im.resize((64, 64), Image.NEAREST).save(ART / "programs" / f"{name}-64.png")
    for app, key in (("netcon", "netcon"), ("disk-dude", "diskdude")):
        m = Image.open(TOOLS / f"{app}-mascot.png").convert("RGBA")
        m = m.crop(m.split()[-1].getbbox())
        m.thumbnail((360, 360), Image.NEAREST)
        m.save(ART / "programs" / f"{key}-mascot.png", optimize=True)
        Image.open(TOOLS / f"{app}-logo.png").save(ART / "programs" / f"{key}-logo.png", optimize=True)

    sheet = Image.new("RGBA", (124, 40), (192, 192, 192, 255))
    sheet.alpha_composite(icons["netcon"], (4, 4)); sheet.alpha_composite(icons["diskdude"], (44, 4))
    sheet.alpha_composite(square(mark, 32), (84, 4))
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(HERE / "preview.png")
    print("wrote NightCode logo, avatar, 4 wallpapers and program art to", ART.relative_to(HERE.parent.parent.parent))


if __name__ == "__main__":
    main()
