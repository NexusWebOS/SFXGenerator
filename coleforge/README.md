# Windows – ColeForge Edition

*Classic Roots. Modern Horizons.*

**NightCode edition:** the ultimate hacker build. The NightCode skull-chip logo is the official
logo, the NightCode wallpaper, avatar and colour scheme are the defaults, and NightCode's **Netcon**
and **Disk Dude** ship as official ColeForge programs.

A private, experimental "what if Windows 98 SE never stopped evolving" build: a 98 SE-style
desktop with a modern glass finish, running on a modern kernel so today's hardware (Radeon,
Wi‑Fi, webcams, NVMe) just works. Includes its own browser, messenger, media players, paint
program, LAN game lobbies and a full sound scheme.

## Try it in 30 seconds

```bash
node coleforge/server/forgechat-server.js
# open http://localhost:8098  (friends on your network: http://<your-ip>:8098)
```

Or open `coleforge/shell/index.html` directly in a browser. Everything works except
cross-PC ForgeChat, which needs the server.

## What's in the box

| App | What it does |
| --- | --- |
| **Shell** | BIOS POST → your boot splash with the segmented loading bar → welcome/log-on → desktop. Draggable/resizable windows, taskbar, Start menu with All Programs, quick launch, tray (network, volume, clock), Run dialog, right-click menus everywhere (desktop, icons, title bars, taskbar with Cascade/Tile/Minimize All, Start button, tray, text boxes with Cut/Copy/Paste, and inside every app), toasts, 98-style dialogs, Shut Down / Restart / Log Off. Keys: Ctrl+Esc (Start), Alt+F4, F5, Ctrl+Shift+R (Run). |
| **Control Panel** | Theme (**Windows 98 Classic**, the default, or ColeForge Glass); Appearance colour schemes with a Win98-style preview: **NightCode** (the default), Windows Standard, **ColeForge Dark**, Automatic (follows Windows light/dark), and the classic **High Contrast Black / White / #1 / #2**; an **Accessibility** tab with Use High Contrast, the Left Alt+Left Shift+Print Screen shortcut, following Windows' own High Contrast when ColeForge is your shell, and Normal/Large/Extra large sizes; wallpapers (incl. your own picture), accent colour, UI size, cursor scheme, the ColeForge sound scheme with previews, account name + picture (15 Cole avatars or your own). |
| **My Computer** | Live hardware report: CPU cores, GPU name, RAM, network, display, battery, storage (real drives when running as the desktop host). |
| **My Documents / Recycle Bin / Notepad** | Save, import, delete to the bin, restore, empty (with the crumple sound). Notepad has find, time/date, word wrap and export. |
| **Forge Browser** | Tabs, favorites, history, search, home page. As the desktop host it uses real Chromium tabs with a full right-click menu (open link in new tab, copy, save/edit image in Forgecraft, view source, inspect). |
| **ForgeAmp** | Music player for **MP3, WAV, OGG, Opus, FLAC, M4A/AAC, MP4 audio, WebM, AIFF** plus **MIDI (.mid/.midi/.rmi/.kar) and Doom .MUS**, both played by the built-in ForgeMIDI synth (General MIDI instruments, distortion guitar, drums, no soundfont needed). Playlist, folders, shuffle/repeat, spectrum + scope visualizer. |
| **ForgeVision** | Video player: MP4/WebM/OGV/MKV/MOV (codec permitting), playlist, speed, loop, subtitles (.srt/.vtt), picture-in-picture, fullscreen, frame capture → Forgecraft. |
| **Forgecraft** | Paint meets Photoshop: layers (opacity, 16 blend modes, reorder, merge, flatten), soft/hard brushes, pencil, eraser, line/rect/ellipse, flood fill, eyedropper, text, move; filters (grayscale, invert, sepia, brightness/contrast, hue/saturation, blur, sharpen, emboss, edge, posterize, Forge Glow); resize/canvas/flip/rotate; 25-step undo; zoom; export PNG/JPEG/WebP; set as wallpaper or avatar. |
| **ForgeChat** | AIM × Discord × Messenger: buddy list with online/away/busy and **away messages with auto-responses**, channels, DMs, typing indicators, unread badges, emoji & smileys, **GIFs**, pictures, **file sharing** (8 MB), **voice clips**, **webcam snapshots**, **1:1 voice/video calls with screen share** (WebRTC), avatars, `/away` `/back` `/me` `/host`. |
| **Forge Arcade + LAN lobbies** | DOOM Legacy – ColeForge Edition (your own source port), **Zandronum**, Doom/Doom II, Freedoom, Quake, Duke Nukem 3D. Host a lobby in ForgeChat, friends join and ready up, the host hits Start and everyone's game launches pointed at the host. Zandronum lobbies start a real server on the host and show its live map/players. |
| **Legacy Mode** | 90's games on modern hardware: **DOSBox – ColeForge Edition** (DOSBox Staging with era presets from an IBM XT to a Pentium MMX + Voodoo, IPX LAN play) for DOS games, and complete Windows 98 SE PCs in **86Box**, including **Voodoo3 Mode** (Pentium II 450, 440BX, 3dfx Voodoo3 3000 AGP) and a Voodoo2 SLI rig. Generates the configs, creates the disk, launches the emulator. See [legacy/README.md](legacy/README.md). |
| **Forge Game Browser** | A 16-bit, GameSpy-style Zandronum server browser: internet servers from the Zandronum master, LAN servers found automatically from their broadcasts, favourites and ForgeChat lobbies. Sort by ping/players, filter, see every player's score/ping/team, WADs, limits and skill; double-click to join (password prompt included), host your own server, or **Share** a server into ForgeChat as a one-click Join card. |
| **Netcon** *(NightCode)* | Official ColeForge program: SAMPLE ID badge maker with PNG export, RFID/NFC asset inventory (IDs you type in, no radio reading), lock service/damage log, game ownership and compatibility catalog. |
| **Disk Dude** *(NightCode)* | Official ColeForge program: detects PS1/PS2/Dreamcast/Xbox/DVD/VCD/music/data discs, verified copy with SHA-256 manifest + ZIP, data-disc burning, Audio CD playback, one-click emulator launch. See [programs/README.md](programs/README.md). |
| **Sounds** | Two 19-sound schemes, switchable in Control Panel → Sounds: **ColeForge Studio** (default, generated with ElevenLabs) and **ColeForge Classic** (synthesized by `generate_coleforge_system_sounds.js`). Compare them at `shell/assets/sounds/audition.html`. |

## Layout

```
coleforge/
  shell/        the desktop: index.html, css/, js/ (core, apps, MIDI synth), assets/
  server/       LAN server: serves the shell + ForgeChat hub + Game Browser API (no dependencies)
  server/zandronum/  Zandronum master/launcher protocol + Huffman codec (ported from Zandronum's source)
  programs/     official NightCode programs (Netcon, Disk Dude), vendored from NexusWebOS/NightCode
  legacy/       Legacy Mode docs (then vs now, CPU/GPU emulation, Voodoo3 Mode), sample configs, tests
  desktop/      Electron host → ColeForge.exe, shell replacement, real browser tabs, game launching
  core/windows/ run ColeForge as your Windows shell + Windows To Go USB guide
  core/reactos/ experimental open-source NT core track
  art/          SpriteCook asset manifest + the local art builders
```

## Running it for real (laptop / USB)

See **[core/windows/README.md](core/windows/README.md)**: build `ColeForge.exe`, make it your
shell on Windows 10/11 (keeps every modern driver), and put the whole thing on a bootable
Windows To Go USB for the spare laptop. ReactOS notes are in [core/reactos/README.md](core/reactos/README.md).

## LAN parties

1. One PC runs the server (or just ColeForge.exe, which starts it automatically).
2. Everyone opens `http://<host-ip>:8098` or signs into ForgeChat with server
   `ws://<host-ip>:8098/forgechat`.
3. **Game Lobbies → Host a Game**, pick game/map/mode, enter your LAN IP. Friends Join and hit Ready.
   Start launches everyone.
4. Configure engine paths per game in **Forge Arcade → Configure**. Command templates are editable
   because ports differ by version. Double-check the Duke3D netplay flags for your EDuke32 build.

Other engines are open-source ports (Zandronum, Chocolate Doom, QuakeSpasm/Ironwail, EDuke32);
DOOM Legacy – ColeForge Edition is your own port, so point Forge Arcade → Configure at its .exe.
Game data comes from your own copies, or use **Freedoom** so everyone at the party has it.

### Zandronum online

- Install it: `core\windows\get-zandronum.ps1` downloads the official Windows build from
  zandronum.com into `%LOCALAPPDATA%\ColeForge\games\zandronum` and adds it to your PATH. Drop
  `doom2.wad` (or `freedoom2.wad`) in that folder.
- **Forge Game Browser** lists servers. The ColeForge LAN server does the UDP work for it:
  `GET /api/zandronum/browse` (master list + queries + LAN) and `GET /api/zandronum/query?addr=host:port`.
  It listens on UDP 15101 for LAN servers' broadcasts (`ZANDRONUM_LAN=0` turns that off) and asks
  `master.zandronum.com:15300` for the internet list (`ZANDRONUM_MASTER=host:port` to change it).
- Hosting: Game Browser → Host, or a ForgeChat lobby with game "Zandronum". The host's PC runs
  `zandronum -host` and joins it; everyone else connects to the lobby's address (default port 10666).
- Offline demo/test: `node coleforge/server/zandronum/test/mock-zandronum.js` starts fake servers,
  a fake master and a LAN beacon; run the LAN server with `ZANDRONUM_MASTER=127.0.0.1:15300`.
  Tests: `node coleforge/server/zandronum/test/zandronum.test.js`.
- Licenses and the Zandronum source files this follows: `server/zandronum/NOTICE.md`.

Webcam/mic/calls need a secure context: they work on `localhost` and inside ColeForge.exe.
Browsers visiting `http://<lan-ip>` may block the camera; use ColeForge.exe on each PC.

## Art

- **NightCode** (`art/nightcode/`): Cole's four NightCode pictures are in `source/`; the skull-chip logo
  is the official logo (About box, avatar, desktop wallpaper). `art/nightcode/build_nightcode_art.py`
  builds the logo sizes, the NightCode avatar, 4 wallpapers (NightCode, Enter the NightCode, Shadow
  Grid, Beyond the Light) and the 16-colour pixel icons, mascots and logos for Netcon and Disk Dude.
  SpriteCook alternatives are listed under `nightcode_batch` in `spritecook-assets.json`.
- `shell/assets/art/boot-splash.webp`: your boot splash concept (used as-is).
- **SpriteCook** (project "ColeForge OS"): logo (2 variants), boot background, 2 wallpapers,
  22 icons (desktop, apps, dialogs, tray, Start menu) and a 4-piece cursor set: 31 assets in all.
  `art/spritecook-assets.json` maps each asset ID to its path under `shell/`. Drop the PNGs there
  and the shell uses them automatically; until then it falls back to its built-in vector icons.
- **Windows 98 theme** (`shell/css/theme98.css`): navy desktop, grey 3D bevels, navy title bars,
  classic Start menu with the vertical banner and Programs/Documents/Settings flyouts, and a 98
  log-on dialog. Switch in Control Panel → Display → Theme. Its art is built locally:
  `art/build_logon_banner.py` (log-on banner from the boot splash) and
  `art/build_classic98_wallpaper.py` (the "ColeForge 98 Navy" wallpaper).
- **ForgeChat 16-bit art** (`shell/assets/art/forgechat/`): logo, wordmark, sign-on banner, 18
  toolbar/call icons and 4 buddy status icons, hand-drawn pixel by pixel in the Windows 16-colour
  palette by `art/forgechat/build_forgechat_icons.py` (preview: `art/forgechat/preview.png`).
  In the 98 theme ForgeChat opens maximized on a grey window and uses this art throughout.
- **Cole avatars** (`shell/assets/art/avatars/`): 15 pictures cut from your portraits by
  `art/cole/build_avatars.py`, listed in `avatars.json` for the picker (log-on, Start → Settings →
  Account Picture, Control Panel → Account, ForgeChat sign-on). More likeness avatars from SpriteCook
  are in `spritecook-assets.json` under `windows98_batch`.
- **Game covers** (`shell/assets/art/games/`): `doom-legacy.webp` is your DOOM Legacy – ColeForge
  Edition cover. The others are built by `art/game-ports/build_game_covers.py` from the ports' own
  freely licensed art (sources and licenses in `art/game-ports/SOURCES.md`); the Zandronum card
  uses ColeForge's own pixel globe.
- **Forge Game Browser 16-bit art** (`shell/assets/art/gamebrowser/`): logo, toolbar icons, ping
  bars, player/bot/spectator, lock, WAD, LAN/internet/favourite icons, drawn in the Windows
  16-colour palette by `art/gamebrowser/build_gamebrowser_icons.py` (preview: `art/gamebrowser/preview.png`).

## Sounds

- **ColeForge Studio** (`shell/assets/sounds/studio/`): generated with ElevenLabs Sound Effects v2
  in the "ColeForge Sound Scheme" flow. Two takes of each sound are in `audio/elevenlabs-takes/`
  (with `takes.json`). `audio/build_studio_scheme.py` picks one per event, trims, fades and
  normalizes it to 44.1 kHz 16-bit WAV. To swap a take, change `PICKS` in that script and run
  `python coleforge/audio/build_studio_scheme.py`.
- **ColeForge Classic** (`shell/assets/sounds/`): procedural, from `generate_coleforge_system_sounds.js`.
- The Windows installer uses Studio by default: `install-coleforge.ps1 -Scheme Classic` for the other.

## Private build

This build uses the Windows name for personal, non-distributed use. Before sharing it
publicly, rename it and drop Microsoft marks.
