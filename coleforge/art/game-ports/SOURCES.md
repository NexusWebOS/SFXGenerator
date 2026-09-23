# Game-port artwork sources

Art from the open-source ports themselves, used for the Forge Arcade and ForgeChat lobby cards.
No official Doom, Quake or Duke Nukem 3D box art is included.

| File | From | License |
| --- | --- | --- |
| `doom-legacy-logo.png` | Doom Legacy website, `doomlegacy.sourceforge.net/images/menuback.gif` (converted to PNG) | Doom Legacy project, GPL-2.0 |
| `chocolate-doom-icon.svg` / `.png` | [chocolate-doom/icon](https://github.com/chocolate-doom/icon) `doom.svg` (PNG rendered from the SVG) | GPL-2.0 |
| `freedoom-titlepic.png` | [freedoom/freedoom](https://github.com/freedoom/freedoom) `graphics/titlepic/titlepic.png` | BSD 3-Clause, © Contributors to the Freedoom project |
| `quakespasm-logo.png` | [andrei-drexler/ironwail](https://github.com/andrei-drexler/ironwail) `Misc/QuakeSpasm_512.png` | Shipped with QuakeSpasm/Ironwail (GPL-2.0); the Quake logo mark is an id Software trademark |
| `eduke32-icon.png` | [nukeykt/NBlood](https://github.com/nukeykt/NBlood) `source/duke3d/rsrc/game_icon.ico` (largest frame) | EDuke32 icon, GPL-2.0 |

`build_game_covers.py` (next to this file) composes these into
`shell/assets/art/games/<game>.png`. To use your own cover for a game, drop a PNG at that
path. Your Doom Legacy – ColeForge Edition cover goes at `shell/assets/art/games/doom-legacy.png`.
