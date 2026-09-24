"""Compose Forge Arcade cover cards from the game ports' own artwork (see SOURCES.md).

    python coleforge/art/game-ports/build_game_covers.py

Writes 640x360 PNGs to coleforge/shell/assets/art/games/<game>.png.
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / "shell" / "assets" / "art" / "games"
W, H = 640, 360


def radial(inner, outer, center=(0.5, 0.45), radius=0.75):
    """Radial gradient background from `inner` at the center to `outer` at the edges."""
    small = Image.new("RGB", (W // 4, H // 4))
    px = small.load()
    cx, cy = center[0] * small.width, center[1] * small.height
    rmax = radius * max(small.width, small.height)
    for y in range(small.height):
        for x in range(small.width):
            t = min(1.0, ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / rmax)
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(inner, outer))
    return small.resize((W, H), Image.BICUBIC).convert("RGBA")


def glow(img, color, blur=18, strength=2):
    """Colored halo from an image's alpha channel."""
    alpha = img.split()[-1].filter(ImageFilter.GaussianBlur(blur))
    halo = Image.new("RGBA", img.size, color + (0,))
    halo.putalpha(alpha.point(lambda a: min(255, a * strength)))
    return halo


def place(bg, art, height, glow_color=None, nearest=False, y=0.5):
    scale = height / art.height
    art = art.resize((round(art.width * scale), round(height)), Image.NEAREST if nearest else Image.LANCZOS)
    pos = ((W - art.width) // 2, round(H * y - art.height / 2))
    if glow_color:
        pad = 60
        canvas = Image.new("RGBA", (art.width + pad * 2, art.height + pad * 2))
        canvas.paste(art, (pad, pad), art)
        bg.alpha_composite(glow(canvas, glow_color), (pos[0] - pad, pos[1] - pad))
    bg.alpha_composite(art, pos)
    return bg


def vignette(img):
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rectangle([0, 0, W, H], outline=255, width=40)
    shade = Image.new("RGBA", (W, H), (0, 0, 0, 150))
    shade.putalpha(mask.filter(ImageFilter.GaussianBlur(40)))
    img.alpha_composite(shade)
    return img


def load(name):
    return Image.open(HERE / name).convert("RGBA")


def key_out_black(img, floor=24):
    """Make the near-black backdrop of a non-transparent logo transparent."""
    r, g, b, a = img.split()
    bright = ImageChops.lighter(ImageChops.lighter(r, g), b).point(lambda v: 255 if v >= floor else 0)
    img = img.copy()
    img.putalpha(ImageChops.multiply(a, bright))
    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    covers = {}

    # Freedoom: the title screen itself, pixel-doubled and cropped to 16:9.
    fd = load("freedoom-titlepic.png").resize((640, 400), Image.NEAREST)
    covers["freedoom"] = fd.crop((0, 20, 640, 380))

    # Doom Legacy uses Cole's own cover (games/doom-legacy.webp); this port-logo card is kept as an alternate.
    covers["doom-legacy-port"] = place(radial((18, 60, 24), (2, 8, 4)), key_out_black(load("doom-legacy-logo.png"), floor=6), 240, (40, 160, 50), nearest=True)

    # Doom via Chocolate Doom: the chocolate-bar icon on hellish red.
    covers["doom"] = place(radial((150, 30, 12), (22, 2, 2)), load("chocolate-doom-icon.png"), 300, (255, 120, 40))

    # Quake via QuakeSpasm/Ironwail: dark rune on a dusty bronze field.
    covers["quake"] = place(radial((201, 165, 103), (40, 28, 12), radius=0.7), load("quakespasm-logo.png"), 300)

    # Duke Nukem 3D via EDuke32: the radiation badge on a hazard-yellow burst.
    covers["duke3d"] = place(radial((255, 200, 40), (30, 20, 0), radius=0.65), load("eduke32-icon.png"), 250, (255, 230, 120))

    for game, img in covers.items():
        vignette(img.convert("RGBA")).convert("RGB").save(OUT / f"{game}.png", optimize=True)
        print("wrote", (OUT / f"{game}.png").relative_to(HERE.parent.parent.parent))


if __name__ == "__main__":
    main()
