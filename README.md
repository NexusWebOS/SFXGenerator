# SFXGenerator

Procedural and reference-matched sound-effect generators for **Bullets of Fury**, plus the
**Windows – ColeForge Edition** project (see [`coleforge/`](coleforge/README.md)).

The generated banks are audition assets only. They do not replace files in the Bullets of Fury repository.

## Recommended banks

- `generated/bullets-of-fury-style-matched-v3/` — 42 core weapon and maneuver sounds matched to the shipping game's audio profile.
- `generated/bullets-of-fury-style-expansion-v4/` — 66 additional missile, impact, explosion, thruster, projectile, shield, warning, ricochet, and debris sounds.

Each bank includes:

- individual 44.1 kHz, 16-bit mono PCM WAV files;
- an `index.html` audition page;
- a preview reel;
- `manifest.json` with duration and spectral/loudness measurements;
- WAV `smpl` metadata on seamless loops.

V1 and V2 are preserved as earlier design explorations.

## Regenerating V3 and V4

Install the Python dependencies:

```powershell
python -m pip install -r requirements.txt
```

The style-matched generators read the current Bullets of Fury sound bank as reference material. By default they expect `BulletsOfFury` and `SFXGenerator` to be sibling folders. Set the `BOF_SOUND_BANK` environment variable to use another location.

```powershell
python .\generate_bullets_of_fury_style_matched_v3.py
python .\generate_bullets_of_fury_style_expansion_v4.py
```

The V1/V2 JavaScript generators require only Node.js:

```powershell
node .\generate_bullets_of_fury_sfx.js
node .\generate_bullets_of_fury_arcade_v2.js
```

## Approved sound profile

V3 and V4 follow the measured shipping-bank profile: 44.1 kHz centered mono, dry and compact arcade envelopes, approximately -3 dBFS peaks, sub-heavy missiles and explosions, presence-focused flame/projectile cues, and dense low-mid sustained beams and thrusters.

## ColeForge system sounds

`generate_coleforge_system_sounds.js` (Node.js only) renders the 19-sound "ColeForge Classic"
desktop scheme into `coleforge/shell/assets/sounds/` as 44.1 kHz stereo WAVs with a manifest:

```powershell
node .\generate_coleforge_system_sounds.js
```
