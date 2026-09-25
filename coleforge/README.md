# Windows – ColeForge Edition

*Classic Roots. Modern Horizons.*

**NightCode edition:** the ultimate hacker build. The NightCode skull-chip logo is the official
logo, and the whole desktop wears the **NightCode theme**:
- **NightCode Live**, the animated code-rain wallpaper, is the default background. It's also packaged for
  [Lively Wallpaper](lively/README.md) so it can run on your regular Windows desktop.
- Neon circuit window chrome with Orbitron/Share Tech Mono type and a 16-bit pixel icon set.
- A terminal-style BIOS, the "Enter the NightCode" boot screen and a Shadow Grid log-on.
- NightCode cursors, the NightCode chiptune sound scheme and a code-rain screen saver.

Official ColeForge programs: **WinNight** (archiver), **NightAmp** (media player), **NightBrowser** (web browser),
and NightCode's **Netcon** and **Disk Dude**.

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
| **Control Panel** | Theme: **NightCode** (the default; like a Windows 98 Desktop Theme it brings its wallpaper, cursors and sounds), **Windows 98 Classic** or ColeForge Glass. A **screen saver** (NightCode Code Rain, with wait time and Preview) and optional CRT scanlines. Appearance colour schemes for Windows 98 Classic, with a Win98-style preview: **NightCode**, Windows Standard, **ColeForge Dark**, Automatic (follows Windows light/dark), and the classic **High Contrast Black / White / #1 / #2**; an **Accessibility** tab with Use High Contrast, the Left Alt+Left Shift+Print Screen shortcut, following Windows' own High Contrast when ColeForge is your shell, and Normal/Large/Extra large sizes; wallpapers (incl. your own picture), accent colour, UI size, cursor scheme, the ColeForge sound scheme with previews, account name + picture (15 Cole avatars or your own). |
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
| **WinNight** *(NightCode)* | The archiver: a big-button archive manager with its own 16-bit toolbar and splash. Opens ZIP, **RAR (v4/v5)**, **7-Zip**, TAR, GZ/TGZ, XZ, BZIP2, ZSTD, ISO, CAB and more; creates ZIP, TAR, TAR.GZ/XZ/BZ2/ZST. **Lock** archives with **AES-256** (WinZip AE-2, opens in WinRAR/7-Zip/Windows), Add, Extract To (My Documents or this PC), Test (CRC-32 + AES authentication), View (text, pictures, hex; music/video go to NightAmp), Delete, Rename, New folder, Find (names and text inside files), Info, comments, **Repair** (rebuilds a ZIP from its local headers), Convert between formats, and **self-extracting archives** as a single .html file. Engine: `shell/js/zipkit.js`. |
| **NightAmp** *(NightCode)* | The media player: a clean-room Winamp 2 that draws itself from **Winamp classic skins (.wsz)**. Drop any of the thousands of community skins on it (or Winamp's own look, from the [Winamp Skin Museum](https://skins.webamp.org/)) and it wears it; three original skins are built in: **NightCode** (default), **ColeForge Classic** (the grey/green look) and **ColeForge Silver** (the silver/blue look). Main window, 10-band equalizer with presets, playlist editor with Winamp's pop-up ADD/REM/SEL/MISC/LIST menus, windowshade, double size, clutter bar (O A I D V), Z/X/C/V/B keys. A **Media Library** (Alt+L) reads ID3/FLAC/Ogg/MP4 tags, sorts by artist and album, keeps its files between sessions and holds saved playlists, internet radio and skins. Plays MP3, AAC/M4A, FLAC, Opus, Vorbis, WAV, WebM audio, **AIFF** (built-in converter), **MIDI and Doom .MUS** (ForgeMIDI); **video** MP4/H.264, WebM/VP9/AV1, MKV, MOV and **HLS .m3u8** with subtitles, speed, picture-in-picture and full screen; **internet radio** and M3U/PLS playlists; a **built-in web & radio browser**; and **NightDrop**, audio-reactive code rain when there's no picture. |
| **NightBrowser** *(NightCode)* | Forge Browser, cloned and upgraded: NightCode start page with code rain and an editable speed dial, **NightShield** tracker/ad blocking and **HTTPS upgrade** (ColeForge.exe), **private tabs** in their own in-memory session, bookmarks bar, find in page, zoom, mute tab, page screenshot → Forgecraft, "Play in NightAmp" for media links, search engine choice (DuckDuckGo default). |
| **NightCode Net** *(NightCode)* | The terminal of [nightcode.coletechsystems.com](https://nightcode.coletechsystems.com): boots NightCode-DOS (BIOS POST, CONFIG.SYS, AUTOEXEC.BAT) and logs in to NightCode Net, a Supabase-backed bulletin board with accounts (sign up, activation email, username, email or GitHub sign-in, password reset), message boards, WHO, FINGER, profiles, colour schemes and code rain. On the website, `WIN` boots this whole desktop in the browser, logged on as you and saved to Supabase so it follows you between browsers; `WEB` opens NightBrowser and `OPS` NightOps. The same account works here; the program reads the site's `config.json`. Run `nightcode`. Setup: [web/nightcode/SETUP.md](web/nightcode/SETUP.md). |
| **Albert** *(ColeForge's agent)* | Your companion, powered by Claude (Claude Opus 5 by default), or free on Groq's open models (GPT-OSS, Llama 4, ...): a chat window with Albert himself, a little CRT-faced android with a lantern. He opens programs, reads, searches and writes your documents, drives NightAmp, opens pages, changes settings, checks NightCode Net, searches and reads the web, looks at pictures you drop in, and works things out in a sandboxed JavaScript scratchpad, asking before anything that changes your stuff. Answers stream in live with his thoughts; you pick how hard he thinks. He keeps a memory you can read and edit. Your own programs can ask him things through the **Albert API** (`/api/albert/v1/ask`). The Claude SDK and your API key stay in ColeForge's server (`agent/`), never in the browser. Run `albert`. See [AGENTS.md](AGENTS.md). |
| **SFX Lab** *(NightCode)* | Retro game sound effects for your games: one click makes a new **pickup/coin, laser, explosion, power-up, hit, jump or blip** (or a random one), then 23 sliders (envelope, pitch slide, vibrato, arpeggio, duty, retrigger, flanger, low/high-pass filters) and five waveforms shape it. Hear it on every change, **Mutate** it, keep a history, and **export 16- or 8-bit .wav** at 44.1/22/11 kHz, save it to My Documents or play it in NightAmp. Albert can make sounds with it too (`make_sound`). Run `sfx`. |
| **Task Manager** *(Ctrl+Shift+Esc)* | The open programs with **End Task** (it closes a program even when the program's own close code fails), Switch To and New Task; live **performance** graphs (how busy the desktop is, frame rate, memory) and what's using **storage** (settings, My Documents, chats, the Media Library). Also on the taskbar's right-click menu. Run `taskmgr`. |
| **NightOps** *(NightCode)* | Your NightCode Net, Supabase project, GitHub repositories (browse files, read code, latest commits) and Netlify sites (deploy history, trigger a deploy) in one window, for the NightCode Net sysop. GitHub and Netlify tokens stay in the site's Netlify function (`web/nightcode/netlify/functions/ops.mjs`). Run `ops`. |
| **Netcon** *(NightCode)* | Official ColeForge program: SAMPLE ID badge maker with PNG export, RFID/NFC asset inventory (IDs you type in, no radio reading), lock service/damage log, game ownership and compatibility catalog. |
| **Disk Dude** *(NightCode)* | Official ColeForge program: detects PS1/PS2/Dreamcast/Xbox/DVD/VCD/music/data discs, verified copy with SHA-256 manifest + ZIP, data-disc burning, Audio CD playback, one-click emulator launch. See [programs/README.md](programs/README.md). |
| **Sounds** | Three 19-sound schemes, switchable in Control Panel → Sounds: **NightCode** (default, chiptune synth by `audio/build_nightcode_scheme.py`), **ColeForge Studio** (generated with ElevenLabs) and **ColeForge Classic** (synthesized by `generate_coleforge_system_sounds.js`). Compare them at `shell/assets/sounds/audition.html`. |

## Layout

```
coleforge/
  shell/        the desktop: index.html, css/, js/ (core, apps, MIDI synth), assets/
  server/       LAN server: serves the shell + ForgeChat hub + Game Browser API (no dependencies)
  server/zandronum/  Zandronum master/launcher protocol + Huffman codec (ported from Zandronum's source)
  programs/     official NightCode programs (Netcon, Disk Dude), vendored from NexusWebOS/NightCode
  shell/vendor/ libarchive.js (RAR/7z/… for WinNight) and hls.js (HLS for NightAmp), see vendor/README.md
  agent/        Albert's relay (Claude via the official SDK, Groq's free models) and the MCP server for AI agent software (AGENTS.md)
  web/nightcode/ nightcode.coletechsystems.com (Netlify): NightCode-DOS, the desktop build, NightOps' function,
                the Supabase migrations and login function
  tests/        ZipKit (WinNight's engine), NightShield, NightAmp (skins, tags) and NightCode Net tests
  lively/       NightCode Code Rain packaged for Lively Wallpaper (build script + page)
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

- **NightCode theme** (`css/nightcode.css`, built on the 98 theme): `art/nightcode/build_nightcode_theme.py`
  builds the boot screen, the log-on banner and the circuit backdrop, and calls `build_nightcode_icons.py`
  for the 21 icons (`shell/assets/art/nightcode/icons/`, preview `art/nightcode/theme-preview.png`). The
  icons are true 16-bit pixel art: a strict 16-colour NightCode palette, black keylines and dithered
  3-5 tone shading. Cursors are in `shell/assets/cursors/nightcode/`. The fonts are Share Tech Mono and
  Orbitron (SIL Open Font License 1.1, licences next to them in `shell/assets/fonts/`).
- **WinNight, NightAmp, NightBrowser** (`shell/assets/art/nightapps/`): program icons, WinNight's 10 toolbar
  buttons and file-type icons and NightBrowser's toolbar, all 16-bit in the NightCode palette, plus the three
  start-up splash screens, drawn by `art/nightcode/build_nightcode_apps.py` (preview `art/nightcode/apps-preview.png`).
- **NightAmp skins** (`shell/assets/art/nightapps/skins/`): NightCode, ColeForge Classic and ColeForge Silver,
  every Winamp 2 skin sheet (main, title bar, buttons, sliders, LED digits, text font, equalizer, playlist, frames,
  viscolor.txt, pledit.txt) drawn by `art/nightcode/build_nightamp_skins.py`. Each is also exported as a real
  `.wsz` (`NightCode.wsz`, `ColeForge-Classic.wsz`, `ColeForge-Silver.wsz`) that works in Winamp and Webamp.
  Preview: `art/nightcode/nightamp-skins.png`.
- **Program brands** (`art/nightcode/build_app_brands.py`): 16-bit icons drawn natively at 64 and 32 px (16/48 reduced)
  for NightAmp, NightBrowser, Netcon, Disk Dude, SFX Lab and Task Manager; chrome pixel wordmark logos for the first four,
  NightAmp's and NightBrowser's start-up splashes, and Netcon's and Disk Dude's Windows .ico files. Preview: `art/nightcode/brands-preview.png`.
- **Albert** (`shell/assets/art/albert/`): 16-bit sprite sheet (idle, talking, thinking, happy; 4 frames each)
  and icons, drawn by `art/albert/build_albert.py` in the NightCode palette (preview `art/albert/albert-preview.png`).
- **NightCode Live** (`shell/js/nightcode-rain.js`): the code rain behind the desktop (30 fps, paused under
  a maximized window) and in the screen saver. `lively/` packages it for Lively Wallpaper.
- **NightCode art** (`art/nightcode/`): Cole's four NightCode pictures are in `source/`; the skull-chip logo
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

- **NightCode** (`shell/assets/sounds/nightcode/`, the default): chiptune/cyber system sounds
  (square arpeggios in A minor, bit-crushed glitches, modem chirps), synthesized entirely in code by
  `audio/build_nightcode_scheme.py`. Run `python coleforge/audio/build_nightcode_scheme.py` to rebuild.
- **ColeForge Studio** (`shell/assets/sounds/studio/`): generated with ElevenLabs Sound Effects v2
  in the "ColeForge Sound Scheme" flow. Two takes of each sound are in `audio/elevenlabs-takes/`
  (with `takes.json`). `audio/build_studio_scheme.py` picks one per event, trims, fades and
  normalizes it to 44.1 kHz 16-bit WAV. To swap a take, change `PICKS` in that script and run
  `python coleforge/audio/build_studio_scheme.py`.
- **ColeForge Classic** (`shell/assets/sounds/`): procedural, from `generate_coleforge_system_sounds.js`.
- The Windows installer uses NightCode by default: `install-coleforge.ps1 -Scheme Studio` or `-Scheme Classic` for the others.

## Private build

This build uses the Windows name for personal, non-distributed use. Before sharing it
publicly, rename it and drop Microsoft marks.

## AI agents

ColeForge works with AI agent software: Albert is built in, and while it runs, ColeForge is an MCP server
(`http://localhost:8098/mcp`) for Claude Code, Claude Desktop, Codex and others, and your own programs can
ask Albert things over the Albert API (`POST http://localhost:8098/api/albert/v1/ask`). How to connect, the
tool list and the safety rules: [AGENTS.md](AGENTS.md).

## Tests

```
node coleforge/tests/zipkit.test.js       # WinNight's ZIP/TAR/AES engine against Python, Info-ZIP and pyzipper
node coleforge/tests/nightshield.test.js  # NightBrowser's tracker blocker and HTTPS upgrade rules
node coleforge/tests/nightamp.test.js     # NightAmp's skins (.wsz, sheet sizes) and tag reader (mutagen when installed)
node coleforge/tests/sfx.test.js          # SFX Lab's synth: presets, clamped settings, .wav output
node coleforge/tests/albert.test.js       # Albert's relay (streaming mock Claude API and Groq), agent endpoints' guards, Albert API, MCP over HTTP and stdio
node coleforge/tests/nightcode.test.js    # NightCode Net + NightOps against a mock Supabase / GitHub / Netlify, migrations, netlify.toml
node coleforge/server/zandronum/test/zandronum.test.js
node coleforge/legacy/test/legacy-profiles.test.js
```

## About NightAmp and Winamp's source code

NightAmp doesn't use Winamp's code. The source Llama Group published in 2024 came under the Winamp
Collaborative License, which doesn't allow modified versions to be shared (and the repository was taken
down weeks later). So NightAmp is written from scratch for the ColeForge shell. It follows the classic
Winamp 2 layout and behaviour, with original skins and presets and no Nullsoft code or art.

### Getting the Winamp look back

NightAmp reads the Winamp 2 skin format, so the real Winamp designs come back the same way they always did:
by loading a skin. Right-click NightAmp → **Skins → Get more skins** opens the Winamp Skin Museum in the
built-in browser; downloading a `.wsz` there puts it on straight away. You can also drop a `.wsz` on NightAmp,
open one from My Documents, or use **Skins → Load skin**. Skins you load are kept (IndexedDB) and listed in the
Skins menu and in the Media Library's Skins page. Winamp's default "base skin" isn't included because it's
Nullsoft's art; ColeForge Classic and ColeForge Silver are original skins in the same spirit.

The skin engine (`shell/js/nightamp-skin.js`) uses the sprite coordinates from Webamp's skin map
(Copyright (c) 2015 Jordan Eldredge, MIT licence, notice in the file). A sheet a skin leaves out is taken
from ColeForge Classic, like Winamp falls back to its base skin.

