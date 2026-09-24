"""Package "NightCode Code Rain" for Lively Wallpaper (https://www.rocksdanister.com/lively/).

    python coleforge/lively/build_lively.py

Combines the wallpaper page in nightcode-code-rain/ (index.html, LivelyInfo.json,
LivelyProperties.json, thumbnail.jpg, preview.gif) with the shared ColeForge pieces it uses (the
code rain script, the NightCode logo, the circuit backdrop and the Share Tech Mono font) and zips
them with LivelyInfo.json at the root, the layout Lively imports. The zip goes to
coleforge/shell/assets/lively/NightCode-Code-Rain.zip so ColeForge can offer it for download.

thumbnail.jpg and preview.gif are captured from the page by capture_preview.mjs (needs Playwright).
"""

import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "nightcode-code-rain"
SHELL = HERE.parent / "shell"
OUT = SHELL / "assets" / "lively" / "NightCode-Code-Rain.zip"

SHARED = {
    "nightcode-rain.js": SHELL / "js" / "nightcode-rain.js",
    "logo.png": SHELL / "assets" / "art" / "nightcode" / "logo.png",
    "circuits.jpg": SHELL / "assets" / "art" / "nightcode" / "circuits.jpg",
    "ShareTechMono-Regular.ttf": SHELL / "assets" / "fonts" / "ShareTechMono-Regular.ttf",
    "OFL-ShareTechMono.txt": SHELL / "assets" / "fonts" / "OFL-ShareTechMono.txt",
}
OWN = ["index.html", "LivelyInfo.json", "LivelyProperties.json", "thumbnail.jpg", "preview.gif"]


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    files = {name: SRC / name for name in OWN} | SHARED
    missing = [name for name, path in files.items() if not path.exists()]
    if missing:
        raise SystemExit(f"missing: {', '.join(missing)} (run capture_preview.mjs for the thumbnail/preview)")
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for name, path in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))  # stable zip bytes between builds
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, path.read_bytes())
    print(f"wrote {OUT.relative_to(HERE.parent.parent)} ({OUT.stat().st_size // 1024} KB, {len(files)} files)")


if __name__ == "__main__":
    main()
