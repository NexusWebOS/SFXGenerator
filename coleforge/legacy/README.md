# Legacy Mode: 90's games on today's hardware

Windows – ColeForge Edition runs on the real Windows 10/11 NT core, so the laptop's modern
hardware (Radeon, Wi-Fi, NVMe, USB) just works. Legacy Mode is the other half: making the
**games and software of 1985–2000** run on that modern machine, without fighting it.

| What you want to run | Engine | Where it runs |
| --- | --- | --- |
| DOS games (1985–1997) | **DOSBox – ColeForge Edition** (DOSBox Staging + ColeForge presets) | Legacy Mode → DOS game |
| Windows 95/98 games, Glide/3dfx games, DirectX 5–7, SafeDisc discs | **86Box**: a whole 1998–99 PC running Windows 98 SE | Legacy Mode → Windows 98 PC / **Voodoo3 Mode** |
| Late-90s Windows games that nearly work on Windows 10/11 | the host itself, with DirectPlay enabled | `get-legacy-engines.ps1 -EnableDirectPlay` |

## Then vs now: why old games break

| Problem | Then vs now | Legacy Mode's fix |
| --- | --- | --- |
| Timing loops | Games counted CPU cycles to time themselves; on a 4 GHz CPU they run 100× too fast or crash (Turbo Pascal "Runtime error 200"). | DOSBox runs a fixed number of cycles per millisecond, so you dial in a 486 or a Pentium. |
| 16-bit code | DOS and Windows 3.1 programs need NTVDM, which 64-bit Windows removed. | DOSBox emulates the whole DOS PC; 86Box runs real Windows 98. |
| Direct hardware access | Games poked the VGA, Sound Blaster (port 220, IRQ 5, DMA 1) and joystick port directly. | Emulated S3/ET4000/Paradise VGA, Sound Blaster, GUS, AdLib OPL3 and MPU-401 MIDI. |
| Glide & 3dfx | Many 1996–2000 games only accelerate with 3dfx's Glide API, which only 3dfx cards spoke. | DOSBox Staging emulates a Voodoo Graphics; 86Box emulates Voodoo, Voodoo2 SLI, Banshee and Voodoo3. |
| Win98 drivers | Windows 98 has no drivers for modern Radeon/GeForce, Wi-Fi or NVMe (why the 2004 Radeon upgrade broke it). | Inside 86Box, Windows 98 sees 1999 hardware it has drivers for; the real GPU and Wi-Fi stay with the modern Windows core. |
| DirectX 5–7 / DirectPlay | 8-bit palettes, DirectDraw and DirectPlay multiplayer are half-broken on Windows 10/11. | Run them in the Voodoo3 rig, or enable DirectPlay on the host. |
| Copy protection | SafeDisc/SecuROM kernel drivers are blocked on Windows 10/11. | They still work inside the 86Box Windows 98 PC with your original disc image. |
| IPX LAN play | IPX networking is gone from modern Windows. | DOSBox tunnels IPX over UDP (`ipxnet`); host it from a ForgeChat lobby. |

(The same table is in the app: Legacy Mode → Then vs Now.)

## Emulating the processor

**DOSBox** doesn't imitate one specific chip. It runs a set number of x86 instructions per
millisecond ("cycles"). DOSBox Staging's own ballpark table is what the presets use:

| Preset | Real machine | cycles |
| --- | --- | --- |
| IBM PC/XT | 8088 @ 4.77 MHz, CGA | 300 |
| 386DX-33 VGA | 386DX-33 | 6,000 |
| 486DX2-66 SVGA | 486DX/2-66 | 25,000 |
| Pentium 90 + Gravis | Pentium 90 | 50,000 |
| Pentium MMX-166 + Voodoo | Pentium MMX-166 | 100,000 |

Fixed cycles are why a game that ran at 200% speed on a Pentium 4 behaves again. Each preset
also sets `cputype` (so a game that checks for a Pentium finds one) and the `core` (the dynamic
recompiler for the fast machines).

**86Box** emulates the real chips, instruction timings included, from the 8088 to the Pentium II
and the Mendocino-era Celeron (no Pentium III). Windows 98, its drivers and games need that level
of accuracy. It costs host CPU: the Voodoo3 rig wants a strong modern core, so expect a recent
desktop-class CPU for full Pentium II 450 speed.

## Emulating the graphics card

DOS games wrote straight to VGA/SVGA registers, so DOSBox emulates actual cards: S3 Trio64
(default, best VESA), Tseng ET4000, Paradise PVGA1A, plus CGA/EGA/Tandy/Hercules.

3D is the hard part. 1996–2000 games shipped Glide renderers that only ran on 3dfx chips:
- **DOSBox Staging** emulates a 3dfx Voodoo Graphics (4 MB, or 12 MB with two TMUs) for DOS Glide
  games. Some need a matching `GLIDE2X.OVL` in the game folder.
- **86Box** emulates Voodoo Graphics, Voodoo2 (single or **SLI**), Banshee and **Voodoo3**
  1000/2000/3000/3500 in software, with a render recompiler spread over 1, 2 or 4 threads. The
  modern GPU only draws the finished frame, so emulated 3D speed depends on the CPU.

## Voodoo3 Mode

Voodoo3 Mode builds the card people chased in 1999, inside a period-correct PC:

| Part | 86Box device |
| --- | --- |
| Board | ASUS P3B-F, Intel 440BX, AGP (`p3bf`) |
| CPU | Pentium II (Deschutes) 450 MHz, 100 MHz bus × 4.5 (`pentium2_deschutes`) |
| RAM | 128 MB |
| Graphics | **3dfx Voodoo3 3000 AGP**, 16 MB, 166 MHz (`voodoo3_3k_agp`) with bilinear filtering, 4 render threads, recompiler on |
| Sound | Ensoniq AudioPCI ES1371 (Sound Blaster PCI 128), MIDI to Windows |
| Network | Realtek RTL8139C+ on NAT, so Windows 98 gets online and LAN games work |
| Disks | 4 GB IDE disk image, ATAPI CD-ROM for your install disc / game images |

There's also a **Voodoo2 SLI Monster**: Pentium II 350, S3 ViRGE for 2D, and two 12 MB Voodoo2
cards in SLI.

Setting it up the first time:
1. Install the engines: `core\windows\get-legacy-engines.ps1`.
2. Legacy Mode → **Voodoo3 Mode**, set **CD-ROM image** to your Windows 98 SE install ISO, Launch.
   ColeForge writes `86box.cfg` and creates a blank 4 GB disk in
   `%LOCALAPPDATA%\ColeForge\legacy\machines\<name>`.
3. In 86Box: boot the CD, `FDISK` (large disk support: yes), reboot, `FORMAT C:`, run Setup.
4. Inside Windows 98: install the 3dfx Voodoo3 Windows 98 driver, the ES1371 audio driver and the
   RTL8139 network driver.
5. Point the CD-ROM image at a game disc and play.

You bring Windows 98 SE, the drivers and the games; ColeForge doesn't ship any of them.

## DOSBox – ColeForge Edition

Right now this is **DOSBox Staging with ColeForge's layer on top**, not a hard fork of the C++ code:
- machine presets tuned per era (above), each with the right video card, sound hardware and cycles
- a generated `dosbox.conf` per game: mounts the folder as C:, starts the program, optional
  full screen and exit-on-quit
- IPX networking for DOS LAN games (host or join, tunnelled over UDP)
- one-click launching from Legacy Mode, Forge Arcade and the Start menu

Why not fork today: DOSBox Staging already contains what the presets need (CPU cores, S3/ET4000,
Sound Blaster/GUS/OPL, Voodoo, IPX), and it keeps getting fixes. A fork means building and
maintaining a C++ emulator on Windows toolchains. The fork earns its keep once ColeForge needs
something upstream can't do, such as:
- a ColeForge-branded build that reads ColeForge presets natively
- an IPX-to-ForgeChat bridge, so DOS LAN games show up as ForgeChat lobbies
- Glide passthrough to the host GPU

The configs this layer writes would carry straight over to the fork.

## Files

| Path | What it is |
| --- | --- |
| `shell/js/legacy-profiles.js` | Machine presets, `dosbox.conf` / `86box.cfg` generators, the then-vs-now table |
| `shell/js/apps/legacy.js` | The Legacy Mode app |
| `desktop/main.js` (Legacy Mode section) | Writes configs and disk images under `%LOCALAPPDATA%\ColeForge\legacy`, finds the engines |
| `core/windows/get-legacy-engines.ps1` | Installs DOSBox Staging, 86Box and its ROMs from their official releases |
| `legacy/samples/` | Example output: `86box-voodoo3.cfg`, `86box-voodoo2-sli.cfg`, `dosbox-486-doom.conf`, `dosbox-voodoo1.conf` |
| `legacy/test/legacy-profiles.test.js` | Checks every generated setting against the values DOSBox Staging and 86Box accept |
| `art/legacy/build_legacy_icons.py` | The 16-bit Legacy Mode icons and the Voodoo3 Mode badge |

Every setting name and device id comes from the DOSBox Staging and 86Box sources:
- DOSBox Staging: `src/dosbox.cpp`, `src/cpu/cpu.cpp`, `src/hardware/video/voodoo.cpp`,
  `src/hardware/audio/soundblaster.cpp`, `gus.cpp`, `src/hardware/network/ipx.cpp`
- 86Box: `src/config.c`, `src/machine/machine_table.c`, `src/cpu/cpu_table.c`,
  `src/video/vid_voodoo_banshee.c`, `vid_voodoo.c`, `src/sound/snd_audiopci.c`

Both are GPL-2.0 and are downloaded from their official releases; ColeForge doesn't bundle or
modify them.
