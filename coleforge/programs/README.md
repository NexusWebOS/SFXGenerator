# Official ColeForge programs: NightCode

`retro-tools/` is a copy of Cole's **NightCode** tools from
[NexusWebOS/NightCode](https://github.com/NexusWebOS/NightCode) (branch
`add-disk-dude-netcon-2026-09-23`, commit `c15566d`, folder `retro-tools/`). It contains:

| Program | Script | What it does |
| --- | --- | --- |
| **Netcon** | `netcon.py` | Badge maker (always marked SAMPLE), RFID/NFC asset inventory, lock service log, game catalog |
| **Disk Dude** | `disk_dude.py` | CD/DVD detection, verified copy + ZIP, data-disc burning (IMAPI2), Audio CD playback, emulator launch |

Both are Python/Tkinter Windows apps. They keep their data in `%LOCALAPPDATA%\RetroTools`.

## How ColeForge runs them

- The **Netcon** and **Disk Dude** desktop icons (and Start → Programs) open a NightCode launcher
  window (`shell/js/apps/nightcode-programs.js`). Its **Launch** button asks the desktop host to start
  the program (`forge:runProgram` in `desktop/main.js`).
- The host looks for `Netcon.exe` / `DiskDude.exe` in `%LOCALAPPDATA%\ColeForge\programs` first.
  If they aren't there, it runs the script with `py -3` (Python 3.10+ with Pillow is needed).
- To build the standalone .exe files, run `core\windows\build-nightcode-programs.ps1` once. It uses
  the upstream `Build-Retro-Tools.ps1` (PyInstaller) and copies the results to that folder.
- In ColeForge.exe this folder is unpacked from the app archive (`asarUnpack`) so Python can read it.

## Updating

Copy the newer `retro-tools/` folder from the NightCode repo over this one, update the commit
above, and rebuild the icons if the program art changed:
`python coleforge/art/nightcode/build_nightcode_art.py`.
