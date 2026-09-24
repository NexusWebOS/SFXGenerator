# Windows core: ColeForge on real Windows

This is the "as close to a Windows core as possible" track. Your laptop runs the genuine
Windows 10/11 NT kernel with its normal drivers: Radeon/NVIDIA/Intel graphics, Wi‑Fi, webcam,
USB and NVMe all work. ColeForge replaces `explorer.exe` as the desktop. Classic 98 SE
structure, modern hardware.

```
┌──────────────────────────────────────────────┐
│  Windows – ColeForge Edition shell (Electron) │  desktop, Start menu, apps, ForgeChat
├──────────────────────────────────────────────┤
│  Windows 10/11 user mode + drivers            │  GPU, Wi‑Fi, audio, webcam, USB
├──────────────────────────────────────────────┤
│  Windows NT kernel                            │
└──────────────────────────────────────────────┘
```

You need your own Windows license. This is a private, personal build.

## 1. Build ColeForge.exe

On any Windows PC with [Node.js](https://nodejs.org) 20+:

```powershell
cd coleforge\desktop
npm install
npm start                 # try it in a window first
npm run dist:win          # -> dist\ColeForge.exe (portable) and an installer
```

Use the installer (`ColeForge-1.0.0-x64.exe`) for shell mode. The portable exe unpacks to
a temp folder on every launch, which is fine for trying it out but not for the shell.

## 2. Make ColeForge your shell

```powershell
cd coleforge\core\windows
Set-ExecutionPolicy -Scope Process Bypass
.\install-coleforge.ps1            # shell + sounds + wallpaper
.\install-coleforge.ps1 -ThemeOnly # just the sounds and wallpaper, keep Explorer
```

Sign out and back in: you land in ColeForge instead of Explorer. The script is per-user
(no admin), backs up your previous shell setting, and can be undone:

```powershell
.\uninstall-coleforge.ps1
```

**Escape hatch:** Ctrl+Shift+Esc → File → Run new task → `explorer.exe`.

What the installer sets up:

| Piece | Where |
| --- | --- |
| Shell | `HKCU\Software\Microsoft\Windows NT\CurrentVersion\Winlogon\Shell` → `ColeForge.exe --shell` |
| Sound scheme "ColeForge Classic" | `HKCU\AppEvents\Schemes`, WAVs copied to `%APPDATA%\ColeForge\Media` |
| Wallpaper | `%APPDATA%\ColeForge\wallpaper.*` |

In shell mode, ColeForge's Shut Down / Restart / Log Off really power the machine off, restart it, or sign you out.

### Legacy Mode engines (DOS games, Windows 98 PCs, Voodoo3 Mode)

```powershell
.\get-legacy-engines.ps1                    # DOSBox Staging + 86Box + 86Box ROMs → %LOCALAPPDATA%\ColeForge\legacy\engines
.\get-legacy-engines.ps1 -EnableDirectPlay  # (admin) Windows' DirectPlay for late-90s multiplayer games
```

See [../../legacy/README.md](../../legacy/README.md) for what each engine does and how to set up the Voodoo3 rig.

### Zandronum (online Doom)

```powershell
.\get-zandronum.ps1            # latest official Windows build → %LOCALAPPDATA%\ColeForge\games\zandronum, added to PATH
.\get-zandronum.ps1 -Firewall  # (admin) also allow UDP 10666 (game) and 15101 (LAN browser) on private networks
```

Copy `doom2.wad` or `freedoom2.wad` into that folder, restart ColeForge, and Zandronum shows up in
Forge Arcade, ForgeChat lobbies and the Forge Game Browser.

## 3. Bootable USB for the spare laptop (Windows To Go)

This makes a USB drive that boots a full, portable Windows install. Put ColeForge on it and
you get a ColeForge stick you can boot from the BIOS on any PC.

1. Get a fast USB 3 drive, **64 GB or larger** (a USB SSD is much better than a thumb drive).
2. Download the official Windows 10/11 ISO from Microsoft.
3. Download [Rufus](https://rufus.ie). Select the USB drive and the ISO, and set
   **Image option → Windows To Go**. Start. This takes 20–60 minutes.
4. Plug it into the spare laptop and open the boot menu (usually **F12**, **F9**, **F11** or **Esc**
   at power-on; check the laptop maker's key). If it won't show up, enter BIOS setup and allow USB boot.
   If the stick is listed but refuses to start, temporarily disable Secure Boot in BIOS setup (some
   Rufus/firmware combinations need it off) and turn it back on afterwards if you like.
5. Finish Windows setup on the stick. Windows Update pulls in the laptop's GPU, Wi‑Fi and chipset
   drivers automatically.
6. Copy the ColeForge installer and `coleforge\core\windows\` onto the stick, install, and run
   `install-coleforge.ps1`.

Want it on the laptop's internal drive instead? Install Windows normally, then do steps 1–2 of this guide.

## Sanding off the Explorer edges (optional)

With the shell replaced, a few Windows surfaces still look like Windows 10/11 (Settings, UAC
prompts, File Explorer dialogs). To push the look further:

- **Classic dialogs:** [Open-Shell](https://github.com/Open-Shell/Open-Shell-Menu) (MIT) restyles Explorer windows if you open them.
- **Classic File Manager:** Microsoft's own [winfile](https://github.com/microsoft/winfile) (MIT) builds with Visual Studio and runs great next to ColeForge.
- **Cursors:** ColeForge's cursors are SVG (used inside the shell). For system-wide cursors, export them to `.cur` (e.g. with RealWorld Cursor Editor) and pick them in Mouse settings.
