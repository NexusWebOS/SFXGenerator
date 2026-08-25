#!/usr/bin/env python3
"""Additional Bullets of Fury SFX, matched to the approved V3/current bank."""

from __future__ import annotations

import html
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

import generate_bullets_of_fury_style_matched_v3 as b


HERE = Path(__file__).resolve().parent
OUT = HERE / "generated" / "bullets-of-fury-style-expansion-v4"
DEFS = []


def define(name, category, description, loop, builder, target_rms=None):
    DEFS.append(dict(name=name, category=category, description=description, loop=loop, builder=builder, target_rms=target_rms))


def launch(speed_factor=1.0, weight=1.0, alien=False, boss=False):
    base = b.speed(b.load("nsp_rocket_launch.mp3"), speed_factor)
    booster = b.speed(b.load("nsp_booster_ignite.mp3"), max(0.65, speed_factor * 0.92))
    dur = min(1.85, max(0.62, b.seconds(base)))
    layers = [(base, 0.82 * weight), (booster, 0.34 * weight, 0.015)]
    if boss:
        layers += [(b.speed(b.load("expSmall.mp3"), 0.72), 0.28, 0.0), (b.lowpass(b.load("nsp_space_rumble.mp3"), 900), 0.18)]
    else:
        layers += [(b.speed(b.load("grenade.mp3"), max(0.7, speed_factor)), 0.22, 0.0)]
    if alien:
        layers += [(b.speed(b.load("nsp_scanner_sweep.mp3"), 2.1), 0.24, 0.08), (b.lowpass(b.load("nsp_beam_sustain.mp3"), 2400), 0.12)]
    return b.mix(dur, *layers)


def hit(size="medium", surface="armor"):
    dur = {"small": 0.62, "medium": 1.05, "large": 1.65}[size]
    exp = b.load("expSmall.mp3") if size == "small" else b.fit(b.load("expBig.mp3"), dur)
    gain = {"small": 0.72, "medium": 0.76, "large": 0.86}[size]
    layers = [(exp, gain), (b.speed(b.load("nsp_comet_impact.mp3"), 1.18 if size == "small" else 0.9), 0.34)]
    if surface == "armor":
        layers += [(b.speed(b.load("hit.mp3"), 0.82), 0.5), (b.lowpass(b.load("crackle.wav"), 1300), 0.22)]
    elif surface == "ground":
        layers += [(b.lowpass(b.load("nsp_asteroid_break.mp3"), 2100), 0.5), (b.lowpass(b.noise(dur, 35, 1100, 8101, 0.001, dur * 0.72), 1300), 0.22)]
    elif surface == "ice":
        layers += [(b.load("shatter.wav"), 0.75), (b.highpass(b.load("nsp_asteroid_break.mp3"), 850), 0.32)]
    elif surface == "shield":
        layers += [(b.load("nsp_shield_down.mp3"), 0.58), (b.speed(b.load("nsp_heavy_laser.mp3"), 0.9), 0.3)]
    elif surface == "alien":
        layers += [(b.speed(b.load("nsp_solar_flare.mp3"), 1.3), 0.42), (b.speed(b.load("nsp_charge_release.mp3"), 1.8), 0.32)]
    elif surface == "water":
        layers += [(b.bandpass(b.noise(dur, 40, 2400, 8107, 0.001, dur * 0.8), 80, 2200), 0.4), (b.lowpass(b.load("nsp_comet_impact.mp3"), 1400), 0.28)]
    return b.mix(dur, *layers)


def explosion(kind="medium"):
    if kind == "small":
        return b.mix(0.72, (b.load("expSmall.mp3"), 0.86), (b.speed(b.load("nsp_asteroid_break.mp3"), 1.45), 0.27))
    if kind == "medium":
        return b.mix(1.35, (b.fit(b.load("expBig.mp3"), 1.35), 0.78), (b.load("nsp_comet_impact.mp3"), 0.34))
    if kind == "large":
        return b.mix(2.25, (b.fit(b.load("expBig.mp3"), 2.25), 0.88), (b.speed(b.load("bomb.mp3"), 0.82), 0.42), (b.lowpass(b.load("nsp_space_rumble.mp3"), 850), 0.23))
    if kind == "fuel":
        return b.mix(2.05, (b.fit(b.load("expBig.mp3"), 2.05), 0.78), (b.load("nsp_solar_flare.mp3"), 0.54), (b.fit(b.load("arc_flame_loop.wav"), 1.4), 0.28, 0.2))
    if kind == "electric":
        return b.mix(1.15, (b.load("expSmall.mp3"), 0.58), (b.load("chain_lightning_hit_1.mp3"), 0.7), (b.load("chain_lightning_hit_2.mp3"), 0.65, 0.13), (b.load("crackle.wav"), 0.24))
    if kind == "plasma":
        return b.mix(1.4, (b.fit(b.load("expBig.mp3"), 1.3), 0.5), (b.speed(b.load("nsp_solar_flare.mp3"), 1.12), 0.66), (b.load("nsp_charge_release.mp3"), 0.36))
    if kind == "ice":
        return b.mix(1.25, (b.fit(b.load("expBig.mp3"), 1.2), 0.48), (b.load("shatter.wav"), 0.86), (b.speed(b.load("nsp_asteroid_break.mp3"), 1.2), 0.32))
    raise ValueError(kind)


def engine_loop(speed_factor=1.0, weight=1.0, alien=False):
    eng = b.make_loop(b.speed(b.load("nsp_engine_loop.mp3"), speed_factor), 1.4, 0.13)
    rocket = b.make_loop(b.lowpass(b.speed(b.load("nsp_rocket_launch.mp3"), speed_factor), 2600), 1.4, 0.14)
    layers = [(eng, 0.82 * weight), (rocket, 0.24 * weight)]
    if alien:
        layers += [(b.make_loop(b.lowpass(b.load("nsp_beam_sustain.mp3"), 2200), 1.4, 0.12), 0.3)]
    return b.make_loop(b.mix(1.4, *layers), 1.4, 0.12)


def projectile(source, speed_factor=1.0, duration=None, accent=None, accent_gain=0.25):
    main = b.speed(b.load(source), speed_factor)
    duration = duration or b.seconds(main)
    layers = [(main, 0.86)]
    if accent:
        layers.append((b.speed(b.load(accent), max(0.7, speed_factor)), accent_gain))
    return b.mix(duration, *layers)


# Missile launches: distinct weight, cadence, and technology families.
define("missile_launch_tank_heavy_01", "Missile Launches", "Heavy tracked-tank launcher with deep ignition.", False, lambda: launch(0.88, 1.08, boss=True), -10.0)
define("missile_launch_tank_heavy_02", "Missile Launches", "Alternate heavy tank launch with sharper tube crack.", False, lambda: b.mix(1.5, (launch(0.94, 1.0, boss=True), 0.86), (b.load("crackle.wav"), 0.25)), -10.5)
define("missile_launch_tank_light", "Missile Launches", "Fast light-tank missile launch.", False, lambda: launch(1.48, 0.92), -11.2)
define("missile_launch_homing", "Missile Launches", "Homing missile with scanner-acquire edge.", False, lambda: b.mix(1.25, (launch(1.12, 0.88), 0.82), (b.speed(b.load("nsp_nav_lock.mp3"), 1.5), 0.34, 0.07)), -11.0)
define("missile_launch_air_to_ground", "Missile Launches", "Jet-fired air-to-ground missile.", False, lambda: b.mix(1.12, (launch(1.28, 0.9), 0.85), (b.load("nsp_rcs_thruster.mp3"), 0.24)), -10.8)
define("missile_launch_micro", "Missile Launches", "Compact micro-missile pop.", False, lambda: launch(1.9, 0.78), -13.0)
define("missile_launch_twin", "Missile Launches", "Twin launch with a short tube stagger.", False, lambda: b.mix(1.5, (launch(1.38, 0.76), 0.8), (launch(1.45, 0.72), 0.78, 0.23)), -9.8)
define("missile_launch_salvo_four", "Missile Launches", "Four-missile rapid tank salvo.", False, lambda: b.mix(1.9, (launch(1.72, 0.64), 0.72, 0), (launch(1.78, 0.62), 0.7, 0.22), (launch(1.68, 0.64), 0.7, 0.44), (launch(1.6, 0.68), 0.72, 0.68)), -9.0)
define("missile_launch_boss_siege", "Missile Launches", "Oversized boss siege missile.", False, lambda: launch(0.7, 1.18, boss=True), -9.2)
define("missile_launch_alien", "Missile Launches", "Alien guided missile with energized exhaust.", False, lambda: launch(1.05, 0.94, alien=True), -10.5)

# Missile impacts: material-specific read for combat feedback.
define("missile_hit_armor_light", "Missile Hits", "Small missile impact on armor.", False, lambda: hit("small", "armor"), -14.0)
define("missile_hit_armor_heavy", "Missile Hits", "Heavy direct missile hit on armor.", False, lambda: hit("large", "armor"), -13.0)
define("missile_hit_ground", "Missile Hits", "Missile impact into dirt or runway.", False, lambda: hit("medium", "ground"), -14.0)
define("missile_hit_airburst", "Missile Hits", "Open-air missile detonation.", False, lambda: explosion("medium"), -13.5)
define("missile_hit_shield", "Missile Hits", "Missile collision against an energy shield.", False, lambda: hit("medium", "shield"), -12.5)
define("missile_hit_ice", "Missile Hits", "Missile hit on ice with bright fracture.", False, lambda: hit("medium", "ice"), -15.0)
define("missile_hit_water", "Missile Hits", "Low, splashing missile impact.", False, lambda: hit("medium", "water"), -14.5)
define("missile_hit_alien_hull", "Missile Hits", "Missile strike against an alien hull.", False, lambda: hit("medium", "alien"), -13.5)
define("missile_hit_cluster", "Missile Hits", "Primary hit followed by three cluster pops.", False, lambda: b.mix(1.65, (hit("medium", "armor"), 0.8), (explosion("small"), 0.54, 0.36), (explosion("small"), 0.5, 0.58), (explosion("small"), 0.46, 0.82)), -10.5)
define("missile_dud_clank", "Missile Hits", "Failed missile strike and metal clank.", False, lambda: b.mix(0.48, (b.speed(b.load("hit.mp3"), 0.72), 0.78), (b.speed(b.load("nsp_docking_clamp.mp3"), 1.55), 0.42)), -16.0)

# Explosion library.
define("explosion_air_small_01", "Explosions", "Compact aerial explosion A.", False, lambda: explosion("small"), -14.0)
define("explosion_air_small_02", "Explosions", "Compact aerial explosion B.", False, lambda: b.mix(0.75, (b.speed(b.load("expSmall.mp3"), 1.12), 0.86), (b.speed(b.load("nsp_comet_impact.mp3"), 1.55), 0.25)), -14.5)
define("explosion_air_medium", "Explosions", "Medium aerial detonation.", False, lambda: explosion("medium"), -13.0)
define("explosion_air_large", "Explosions", "Large screen-filling aerial explosion.", False, lambda: explosion("large"), -12.5)
define("explosion_tank_cookoff", "Explosions", "Tank destruction with secondary ammunition pop.", False, lambda: b.mix(2.35, (explosion("large"), 0.84), (explosion("small"), 0.52, 0.54), (b.load("crackle.wav"), 0.28, 0.92)), -11.0)
define("explosion_jet_breakup", "Explosions", "Jet destruction with tearing debris.", False, lambda: b.mix(1.8, (explosion("medium"), 0.82), (b.speed(b.load("nsp_asteroid_break.mp3"), 1.15), 0.44, 0.25), (b.load("shatter.wav"), 0.3, 0.32)), -12.5)
define("explosion_fuel_air", "Explosions", "Fuel-air blast with hot flame tail.", False, lambda: explosion("fuel"), -12.0)
define("explosion_boss_core", "Explosions", "Massive boss-core detonation.", False, lambda: b.mix(2.8, (explosion("large"), 0.9), (b.load("nsp_bof2_ultra_blast.mp3"), 0.52), (explosion("electric"), 0.32, 0.58)), -10.5)
define("explosion_plasma", "Explosions", "Alien plasma bloom.", False, lambda: explosion("plasma"), -12.5)
define("explosion_electrical", "Explosions", "Electrical machinery explosion.", False, lambda: explosion("electric"), -14.0)
define("explosion_ice_burst", "Explosions", "Frozen target rupture.", False, lambda: explosion("ice"), -14.5)
define("explosion_chain_sequence", "Explosions", "Three escalating explosions for collapsing targets.", False, lambda: b.mix(3.0, (explosion("small"), 0.58, 0), (explosion("medium"), 0.68, 0.58), (explosion("large"), 0.82, 1.2)), -11.5)

# Continuous and one-shot propulsion cues.
define("thruster_player_loop", "Thrusters", "Player fighter engine bed.", True, lambda: engine_loop(1.08, 0.9), -10.0)
define("thruster_enemy_jet_loop", "Thrusters", "Enemy jet engine bed.", True, lambda: engine_loop(1.24, 0.78), -10.8)
define("thruster_heavy_boss_loop", "Thrusters", "Heavy boss-engine rumble.", True, lambda: engine_loop(0.72, 1.08), -8.8)
define("thruster_afterburner_loop", "Thrusters", "Dense afterburner sustain.", True, lambda: engine_loop(0.94, 1.05), -9.0)
define("thruster_missile_motor_loop", "Thrusters", "Missile motor sustain for long-travel rockets.", True, lambda: b.make_loop(b.mix(1.2, (b.lowpass(b.load("nsp_rocket_launch.mp3"), 3200), 0.82), (b.load("nsp_engine_loop.mp3"), 0.28)), 1.2, 0.12), -9.2)
define("thruster_alien_hover_loop", "Thrusters", "Alien hover/engine bed.", True, lambda: engine_loop(0.9, 0.72, alien=True), -9.8)
define("thruster_rcs_light", "Thrusters", "Short light RCS correction burst.", False, lambda: b.speed(b.load("nsp_rcs_thruster.mp3"), 1.25), -14.0)
define("thruster_rcs_heavy", "Thrusters", "Heavy steering-thruster burst.", False, lambda: b.mix(0.62, (b.speed(b.load("nsp_rcs_thruster.mp3"), 0.82), 0.82), (b.speed(b.load("nsp_booster_ignite.mp3"), 1.35), 0.32)), -12.5)
define("thruster_booster_start", "Thrusters", "Booster ignition and engine catch.", False, lambda: b.mix(0.85, (b.load("nsp_booster_ignite.mp3"), 0.84), (b.fit(b.load("nsp_engine_loop.mp3"), 0.78), 0.34, 0.08)), -11.5)
define("thruster_booster_stop", "Thrusters", "Booster cutoff and brake wash.", False, lambda: b.mix(0.72, (b.load("brake.wav"), 0.72), (b.reverse(b.speed(b.load("nsp_rcs_thruster.mp3"), 0.92)), 0.42)), -13.0)

# Enemy projectiles and weapon families.
define("enemy_machine_shot_light", "Enemy Projectiles", "Light enemy machine-gun shot.", False, lambda: b.shot(9001, 1.18, False), -15.5)
define("enemy_machine_shot_heavy", "Enemy Projectiles", "Heavy enemy autocannon shot.", False, lambda: b.shot(9002, 0.78, True), -13.5)
define("enemy_machine_burst", "Enemy Projectiles", "Short enemy autocannon burst.", False, lambda: b.burst(0.72, 9003, 13.5, True), -10.5)
define("enemy_pulse_laser_blue", "Enemy Projectiles", "Fast blue pulse laser.", False, lambda: projectile("nsp_pulse_laser.mp3", 1.08, 0.1), -15.5)
define("enemy_pulse_laser_red", "Enemy Projectiles", "Lower red pulse laser.", False, lambda: projectile("nsp_pulse_laser.mp3", 0.82, 0.14, "enemyShoot.mp3", 0.22), -15.0)
define("enemy_pulse_laser_alien", "Enemy Projectiles", "Modulated alien pulse laser.", False, lambda: projectile("nsp_pulse_laser.mp3", 0.68, 0.18, "nsp_scanner_sweep.mp3", 0.2), -14.5)
define("enemy_heavy_laser", "Enemy Projectiles", "Heavy enemy laser cannon.", False, lambda: projectile("nsp_heavy_laser.mp3", 0.92, 0.34, "nsp_railgun.mp3", 0.18), -11.8)
define("enemy_scatter_laser", "Enemy Projectiles", "Three-tone scatter laser.", False, lambda: b.mix(0.42, (b.load("nsp_scatter_laser.mp3"), 0.86), (b.speed(b.load("nsp_pulse_laser.mp3"), 1.2), 0.25, 0.05)), -14.0)
define("enemy_plasma_orb_green", "Enemy Projectiles", "Green alien plasma orb.", False, lambda: projectile("nsp_solar_flare.mp3", 1.42, 0.74, "nsp_charge_release.mp3", 0.24), -12.5)
define("enemy_plasma_orb_red", "Enemy Projectiles", "Heavy red plasma orb.", False, lambda: projectile("nsp_solar_flare.mp3", 1.05, 0.95, "nsp_heavy_laser.mp3", 0.28), -11.8)
define("enemy_prism_bolt", "Enemy Projectiles", "Bright prism projectile.", False, lambda: projectile("nsp_scatter_laser.mp3", 0.92, 0.4, "nsp_scanner_sweep.mp3", 0.25), -14.0)
define("enemy_flame_bolt", "Enemy Projectiles", "Compact enemy flame projectile.", False, lambda: b.mix(0.46, (b.speed(b.load("arc_flame_loop.wav"), 1.55), 0.72), (b.speed(b.load("nsp_solar_flare.mp3"), 2.0), 0.34)), -13.5)
define("enemy_ice_bolt", "Enemy Projectiles", "Sharp enemy ice projectile.", False, lambda: b.mix(0.28, (b.speed(b.load("nsp_pulse_laser.mp3"), 0.76), 0.7), (b.speed(b.load("shatter.wav"), 2.0), 0.45)), -15.0)
define("enemy_electric_bolt", "Enemy Projectiles", "Electrical enemy projectile.", False, lambda: b.mix(0.38, (b.load("chain_lightning_hit_1.mp3"), 0.82), (b.speed(b.load("nsp_pulse_laser.mp3"), 0.88), 0.32)), -14.0)
define("enemy_rail_cannon", "Enemy Projectiles", "Low, forceful enemy rail cannon.", False, lambda: b.mix(0.7, (b.load("nsp_railgun.mp3"), 0.9), (b.load("nsp_heavy_laser.mp3"), 0.25)), -10.5)
define("enemy_boss_cannon", "Enemy Projectiles", "Large boss projectile launch.", False, lambda: b.mix(0.92, (b.speed(b.load("nsp_railgun.mp3"), 0.82), 0.72), (b.load("enemyBig.wav"), 0.48), (b.load("nsp_charge_release.mp3"), 0.28)), -10.0)

# Extra combat feedback.
define("missile_lock_warning", "Combat Extras", "Incoming missile lock alert.", False, lambda: b.mix(0.74, (b.load("lockAlert.wav"), 0.82), (b.load("nsp_nav_lock.mp3"), 0.42, 0.18)), -13.0)
define("incoming_projectile_alert", "Combat Extras", "Urgent incoming-projectile warning.", False, lambda: b.mix(0.78, (b.load("nsp_alert_critical.mp3"), 0.78), (b.speed(b.load("nsp_console_beep.mp3"), 0.82), 0.42, 0.26)), -12.5)
define("shield_hit_light", "Combat Extras", "Small projectile deflected by shield.", False, lambda: b.mix(0.34, (b.speed(b.load("nsp_shield_up.mp3"), 1.8), 0.62), (b.load("hit.mp3"), 0.32)), -15.0)
define("shield_hit_heavy", "Combat Extras", "Heavy projectile collision with shield.", False, lambda: b.mix(0.65, (b.load("nsp_shield_down.mp3"), 0.68), (b.load("nsp_heavy_laser.mp3"), 0.4)), -12.5)
define("shield_break_combat", "Combat Extras", "Shield collapse under missile fire.", False, lambda: b.mix(0.92, (b.load("nsp_shield_down.mp3"), 0.72), (b.load("shatter.wav"), 0.58), (b.load("expSmall.mp3"), 0.35)), -13.0)
define("debris_scatter_metal", "Combat Extras", "Metal debris scattering after an explosion.", False, lambda: b.mix(0.78, (b.load("nsp_asteroid_break.mp3"), 0.62), (b.load("shatter.wav"), 0.34), (b.speed(b.load("hit.mp3"), 0.75), 0.28, 0.16)), -16.0)
define("projectile_ricochet", "Combat Extras", "Projectile ricochet from armored plating.", False, lambda: b.mix(0.32, (b.speed(b.load("nsp_docking_clamp.mp3"), 2.15), 0.55), (b.speed(b.load("nsp_pulse_laser.mp3"), 1.4), 0.38)), -16.0)
define("boss_weapon_charge", "Combat Extras", "Boss weapon charging before a major attack.", False, lambda: b.mix(1.5, (b.load("bossPhase.wav"), 0.48), (b.load("nsp_bof2_charge_shot.mp3"), 0.68), (b.lowpass(b.load("nsp_space_rumble.mp3"), 1100), 0.22)), -10.5)


def main():
    if not b.REFERENCE.is_dir():
        raise SystemExit(f"Reference bank not found: {b.REFERENCE}")
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {
        "title": "Bullets of Fury — Style-Matched Expansion V4",
        "version": 4,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sampleRate": b.SR,
        "channels": 1,
        "format": "16-bit mono PCM WAV",
        "masterPeakDb": -3.0,
        "referenceBank": "../BulletsOfFury/assets/game/sounds (override with BOF_SOUND_BANK)",
        "styleProfile": "Approved V3/current-bank profile: centered mono, dry compact arcade envelopes, category-specific bandwidth, and -3 dBFS peak target.",
        "note": "Expansion-only audition bank. No Bullets of Fury assets or earlier preview banks were changed.",
        "files": [],
    }
    rendered = {}
    for d in DEFS:
        x = b.master(d["builder"](), d["loop"], d["target_rms"])
        filename = d["name"] + ".wav"
        (OUT / filename).write_bytes(b.wav_bytes(x, d["loop"]))
        rendered[d["name"]] = x
        manifest["files"].append({
            "name": d["name"], "file": filename, "category": d["category"],
            "description": d["description"], "loop": d["loop"],
            "duration": round(b.seconds(x), 3), **b.features(x),
        })

    reel_order = [
        "missile_launch_tank_heavy_01", "missile_launch_tank_light", "missile_launch_homing",
        "missile_launch_twin", "missile_launch_salvo_four", "missile_launch_boss_siege",
        "missile_launch_alien", "missile_hit_armor_heavy", "missile_hit_ground",
        "missile_hit_shield", "missile_hit_cluster", "explosion_air_small_01",
        "explosion_air_medium", "explosion_air_large", "explosion_tank_cookoff",
        "explosion_jet_breakup", "explosion_fuel_air", "explosion_boss_core",
        "thruster_player_loop", "thruster_heavy_boss_loop", "thruster_afterburner_loop",
        "thruster_missile_motor_loop", "enemy_machine_burst", "enemy_pulse_laser_blue",
        "enemy_heavy_laser", "enemy_plasma_orb_green", "enemy_prism_bolt",
        "enemy_boss_cannon", "shield_hit_heavy", "shield_break_combat", "boss_weapon_charge",
    ]
    reel_duration = sum(min(2.15, b.seconds(rendered[n])) + 0.24 for n in reel_order)
    layers, cursor = [], 0.0
    for name in reel_order:
        clip = b.fit(rendered[name], min(2.15, b.seconds(rendered[name])))
        layers.append((clip, 0.86, cursor))
        cursor += b.seconds(clip) + 0.24
    reel = b.master(b.mix(reel_duration, *layers), False)
    reel_name = "bullets_of_fury_style_expansion_v4_preview_reel.wav"
    (OUT / reel_name).write_bytes(b.wav_bytes(reel, False))
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    groups = list(dict.fromkeys(x["category"] for x in manifest["files"]))
    cards = []
    for group in groups:
        cards.append(f"<section><h2>{html.escape(group)}</h2>")
        for x in [v for v in manifest["files"] if v["category"] == group]:
            badge = '<span class="loop">LOOP</span>' if x["loop"] else ""
            cards.append(f'<article><div><strong>{html.escape(x["name"])}</strong>{badge}<p>{html.escape(x["description"])}</p><small>{x["duration"]:.2f}s · {x["rmsDb"]:.1f} dB RMS · centroid {x["centroidHz"]} Hz</small></div><audio controls {"loop" if x["loop"] else ""} preload="none" src="{x["file"]}"></audio></article>')
        cards.append("</section>")
    page = f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bullets of Fury Expansion V4</title><style>:root{{color-scheme:dark;--hot:#ff6138;--ice:#77eaff}}*{{box-sizing:border-box}}body{{margin:0;background:radial-gradient(circle at 50% 0,#263451,#080a10 58%);color:#f4f7ff;font:15px system-ui,sans-serif}}.wrap{{max-width:1100px;margin:auto;padding:32px 18px 80px}}h1{{font-size:clamp(28px,5vw,50px);margin:0;text-shadow:0 0 25px #f53}}header p{{color:#c1cada;max-width:850px;line-height:1.5}}.notice{{border:1px solid #40627b;background:#101b29;padding:13px;border-radius:10px;color:#a5f1ce}}h2{{margin-top:38px;color:var(--ice);text-transform:uppercase;letter-spacing:.08em}}article{{display:grid;grid-template-columns:1fr minmax(260px,420px);gap:20px;align-items:center;background:linear-gradient(135deg,#171c29,#10131c);border:1px solid #2c364a;border-radius:12px;padding:15px 18px;margin:9px 0}}strong{{font:700 16px ui-monospace,monospace}}.loop{{font:700 10px ui-monospace,monospace;background:var(--ice);color:#07151a;padding:4px 7px;border-radius:12px;margin-left:9px}}p{{margin:5px 0;color:#c4ccda}}small{{color:#7f90aa}}audio{{width:100%;height:38px}}.reel{{margin:24px 0;padding:18px;border:1px solid var(--hot);border-radius:14px;background:#1c1110}}@media(max-width:700px){{article{{grid-template-columns:1fr}}}}</style></head><body><div class="wrap"><header><h1>BULLETS OF FURY — EXPANSION V4</h1><p>Additional missile launches and hits, explosions, thrusters, enemy projectiles, shields, warnings, ricochets and debris—all matched to the approved V3/current-game audio profile.</p><div class="notice">Expansion audition bank only. No game asset or earlier preview was replaced.</div><div class="reel"><strong>Expansion quick reel</strong><p>Selected sounds in sequence.</p><audio controls preload="metadata" src="{reel_name}"></audio></div></header>{''.join(cards)}</div></body></html>'''
    (OUT / "index.html").write_text(page, encoding="utf-8")
    category_counts = {group: sum(1 for d in DEFS if d["category"] == group) for group in groups}
    (OUT / "README.md").write_text("# Bullets of Fury — Style-Matched Expansion V4\n\n" + "\n".join(f"- {k}: {v}" for k, v in category_counts.items()) + f"\n\nTotal: {len(DEFS)} sounds, including {sum(1 for d in DEFS if d['loop'])} seamless loops. No game files replaced.\n", encoding="utf-8")
    print(f"Generated {len(DEFS)} expansion sounds ({sum(1 for d in DEFS if d['loop'])} loops) in {OUT}")


if __name__ == "__main__":
    main()
