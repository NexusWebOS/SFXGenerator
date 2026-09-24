# NightCode Code Rain for Lively Wallpaper

The animated **NightCode Live** background from Windows – ColeForge Edition, packaged for
[Lively Wallpaper](https://www.rocksdanister.com/lively/) so it can run on your regular Windows desktop too.

## Install

1. Get `NightCode-Code-Rain.zip`: it's at `coleforge/shell/assets/lively/`, or in ColeForge use
   Control Panel → Display → Wallpaper → *Download it for Lively Wallpaper*.
2. Drag the .zip into Lively's window (or use **+ Add Wallpaper** and pick the file).
3. Click it to set it. Right-click it and choose **Customise** to change the settings below.

| Setting | What it does |
| --- | --- |
| Rain speed, Columns, Trail length | How fast, how dense and how long the code rain is |
| NightCode logo | Hover (right, like ColeForge), Hover (centre), Drift (like the screen saver) or Off |
| Logo size | Size of the logo |
| Rain / accent / leading character colours | Recolour the rain |
| Circuit board background | Circuit traces behind the rain, or plain black |
| Frame rate | 30 fps (lighter) or 60 fps (smoother) |

Lively pauses wallpapers on its own while a full-screen app or game is running.

## Files and rebuilding

- `nightcode-code-rain/`: the wallpaper page (`index.html`), `LivelyInfo.json`, `LivelyProperties.json`,
  `thumbnail.jpg` and `preview.gif`.
- The rain itself is ColeForge's `shell/js/nightcode-rain.js`. The same file drives the ColeForge
  desktop and screen saver, so they always match.
- `python coleforge/lively/build_lively.py` adds the shared files (rain script, logo, circuit backdrop,
  Share Tech Mono font with its OFL licence) and writes the zip.
- `node coleforge/lively/capture_preview.mjs` captures a new thumbnail and preview GIF from the page
  (needs Playwright, and Python with Pillow for the GIF).
