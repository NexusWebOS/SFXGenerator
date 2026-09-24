"""Cut Cole's portrait art into square avatars for the shell and ForgeChat.

    python coleforge/art/cole/build_avatars.py

Writes 192x192 PNGs to coleforge/shell/assets/art/avatars/ plus avatars.json (the picker list).
"""

import json
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / "shell" / "assets" / "art" / "avatars"
SIZE = 192

# The 4x3 expression sheet, left to right, top to bottom.
SHEET_NAMES = [
    ("cole-sly", "Sly"), ("cole-focused", "Focused"), ("cole-skeptic", "Skeptic"), ("cole-chill", "Chill"),
    ("cole-stern", "Stern"), ("cole-shout", "Shout"), ("cole-determined", "Determined"), ("cole-wink", "Wink"),
    ("cole-salute", "Salute"), ("cole-pilot", "Pilot"), ("cole-shades", "Shades"), ("cole-smirk", "Smirk"),
]


def square(img, box):
    """Crop `box` (l, t, r, b), then center-crop to a square biased toward the top (faces)."""
    c = img.crop(box)
    s = min(c.size)
    left = (c.width - s) // 2
    top = min(int((c.height - s) * 0.25), c.height - s)
    return c.crop((left, top, left + s, top + s)).resize((SIZE, SIZE), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    avatars = []

    def save(name, label, img):
        img.convert("RGB").save(OUT / f"{name}.png", optimize=True)
        avatars.append({"id": name, "label": label, "file": f"assets/art/avatars/{name}.png"})

    save("cole-blue", "Command Deck", square(Image.open(HERE / "portrait-blue.webp"), (0, 0, 1254, 1254)))
    save("cole-green", "Field Ops", square(Image.open(HERE / "portrait-green.webp"), (0, 0, 1254, 1254)))

    sheet = Image.open(HERE / "portrait-sheet.webp")
    cols, rows = 4, 3
    cw, ch = sheet.width / cols, sheet.height / rows
    for i, (name, label) in enumerate(SHEET_NAMES):
        x, y = i % cols, i // cols
        # Trim a few pixels so the neighbouring frame edges don't bleed in.
        box = (round(x * cw) + 4, round(y * ch) + 4, round((x + 1) * cw) - 4, round((y + 1) * ch) - 4)
        save(name, label, square(sheet, box))

    body = Image.open(HERE / "full-body.webp").convert("RGBA")
    bg = Image.new("RGBA", body.size, (10, 26, 63, 255))
    bg.alpha_composite(body)
    save("cole-full", "Full Kit", square(bg, (190, 0, 700, 510)))

    (OUT / "avatars.json").write_text(json.dumps(avatars, indent=2) + "\n")
    print(f"wrote {len(avatars)} avatars to {OUT.relative_to(HERE.parent.parent.parent)}")


if __name__ == "__main__":
    main()
