"use strict";

// Legacy Mode config tests: every generated setting must be one DOSBox Staging / 86Box actually
// accepts. The allowed names and values below were read from their sources (see ../README.md).
//   node coleforge/legacy/test/legacy-profiles.test.js

const assert = require("assert");
const L = require("../../shell/js/legacy-profiles.js");

const parseIni = (text) => {
  const out = {};
  let sec = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const s = /^\[(.+)\]$/.exec(line);
    if (s) { sec = s[1]; out[sec] = out[sec] || (sec === "autoexec" ? [] : {}); continue; }
    if (sec === "autoexec") { out[sec].push(line); continue; }
    const kv = /^([^=]+?)\s*=\s*(.*)$/.exec(line);
    assert.ok(kv && sec, `not an ini line: ${line}`);
    out[sec][kv[1]] = kv[2];
  }
  return out;
};

// DOSBox Staging (src/dosbox.cpp, src/cpu/cpu.cpp, src/hardware/audio/*.cpp, video/voodoo.cpp, network/ipx.cpp)
const DOSBOX = {
  sdl: { fullscreen: ["true", "false"] },
  dosbox: { machine: ["hercules", "cga_mono", "cga", "pcjr", "tandy", "ega", "svga_s3", "svga_et3000", "svga_et4000", "svga_paradise", "vesa_nolfb", "vesa_oldvbe"], memsize: /^\d+$/ },
  cpu: { core: ["auto", "dynamic", "normal", "simple"], cputype: ["auto", "386", "386_fast", "386_prefetch", "486", "pentium", "pentium_mmx"], cpu_cycles: /^(\d+|max)$/, cpu_cycles_protected: /^(\d+|max|auto)$/ },
  sblaster: { sbtype: ["gb", "sb1", "sb2", "sbpro1", "sbpro2", "sb16", "ess", "none"], oplmode: ["auto", "cms", "opl2", "dualopl2", "opl3", "opl3gold", "esfm", "none"] },
  gus: { gus: ["true", "false"] },
  voodoo: { voodoo: ["true", "false"], voodoo_memsize: ["4", "12"], voodoo_threads: /^(auto|\d+)$/, voodoo_bilinear_filtering: ["true", "false"] },
  ipx: { ipx: ["true", "false"] },
};
// 86Box (src/config.c, machine_table.c, cpu_table.c, vid_voodoo*.c, snd_audiopci.c, net_rtl8139.c, fdd.c, mouse_ps2.c, hdc.c)
const P2_SPEEDS = [66666666, 100000000, 133333333, 166666666, 200000000, 233333333, 266666666, 300000000, 333333333, 350000000, 400000000, 450000000];
const BOX86 = {
  Machine: { machine: ["p3bf"], cpu_family: ["pentium2_deschutes"], cpu_speed: (v) => P2_SPEEDS.includes(+v), cpu_multi: /^\d+(\.\d+)?$/, mem_size: (v) => +v >= 8192 && +v <= 1048576 && +v % 8192 === 0, cpu_use_dynarec: ["0", "1"], time_sync: ["disabled", "local", "utc"] },
  Video: { gfxcard: ["voodoo3_3k_agp", "virge_pci"], voodoo: ["0", "1"] },
  "Input devices": { mouse_type: ["ps2"] },
  Sound: { sndcard: ["es1371"], midi_device: ["windows_midi", "system_midi"], fm_driver: ["nuked", "ymfm"] },
  Network: { net_01_card: ["rtl8139c+"], net_01_net_type: ["slirp", "pcap"] },
  "Storage controllers": { hdc_1: ["internal"] },
  "Hard disks": { hdd_01_parameters: /^\d+, \d+, \d+, 0, ide$/, hdd_01_fn: /^[\w.-]+\.img$/, hdd_01_ide_channel: /^[0-3]:[01]$/ },
  "Floppy and CD-ROM drives": { fdd_01_type: ["35_2hd"], cdrom_01_parameters: ["1, atapi"], cdrom_01_ide_channel: /^[0-3]:[01]$/, cdrom_01_image_path: /./ },
  "3dfx Voodoo3 3000": { bilinear: ["0", "1"], dithersub: ["0", "1"], render_threads: ["1", "2", "4"], recompiler: ["0", "1"] },
  "3Dfx Voodoo Graphics": { type: ["voodoo", "diamond_monster_3d", "obsidian_sb50", "voodoo_2", "diamond_monster_3d_2"], framebuffer_memory: ["2", "4"], texture_memory: ["2", "4"], bilinear: ["0", "1"], render_threads: ["1", "2", "4"], sli: ["0", "1"], recompiler: ["0", "1"] },
};

function check(schema, ini, label) {
  for (const [sec, keys] of Object.entries(ini)) {
    if (sec === "autoexec") continue;
    assert.ok(schema[sec], `${label}: unknown section [${sec}]`);
    for (const [k, v] of Object.entries(keys)) {
      const rule = schema[sec][k];
      assert.ok(rule, `${label}: unknown setting ${sec}.${k}`);
      const ok = Array.isArray(rule) ? rule.includes(v) : rule instanceof RegExp ? rule.test(v) : rule(v);
      assert.ok(ok, `${label}: bad value ${sec}.${k} = ${v}`);
    }
  }
}

for (const id of Object.keys(L.DOS_MACHINES)) {
  const ini = parseIni(L.dosboxConf(id, { name: "Test", folder: "C:\\Games\\TEST", exe: "GAME\\RUN.EXE", ipx: "host", exitAfter: true }));
  check(DOSBOX, ini, "dosbox:" + id);
  assert.deepStrictEqual(ini.autoexec.slice(0, 2), ['mount c "C:\\Games\\TEST"', "c:"]);
}
for (const id of Object.keys(L.WIN_MACHINES)) {
  const ini = parseIni(L.box86Cfg(id, { name: "Cole 98", cdImage: "D:\\ISO\\win98se.iso" }));
  check(BOX86, ini, "86box:" + id);
}
console.log(`configs valid: ${Object.keys(L.DOS_MACHINES).length} DOS machines, ${Object.keys(L.WIN_MACHINES).length} Windows 98 PCs`);

// Voodoo3 Mode is what it says on the tin.
const v3 = parseIni(L.box86Cfg("voodoo3"));
assert.strictEqual(v3.Video.gfxcard, "voodoo3_3k_agp");
assert.strictEqual(v3.Machine.machine, "p3bf");
assert.strictEqual(v3.Machine.cpu_speed, "450000000");
const sli = parseIni(L.box86Cfg("voodoo2sli"));
assert.strictEqual(sli.Video.voodoo, "1");
assert.strictEqual(sli["3Dfx Voodoo Graphics"].sli, "1");

// Hostile input can't break out of the config or the autoexec batch.
const evil = L.dosboxConf("486", { name: "x\n[cpu]\ncore=simple", folder: 'C:\\A" & del *.*\n', exe: "RUN.EXE & format c:", ipx: "join", ipxHost: "1.2.3.4 & echo" });
const e = parseIni(evil);
check(DOSBOX, e, "evil");
for (const line of e.autoexec) {
  const unquoted = line.replace(/"[^"]*"/, "");
  assert.ok(!/[&|<>%]/.test(line), `no shell metacharacters: ${line}`);
  assert.ok(!line.startsWith("mount") || /^mount c "[^"]*"$/.test(line), `mount path stays quoted: ${line}`);
  assert.ok(line.startsWith("mount") || !/\s/.test(unquoted.trim()) || /^(ipxnet|cd) /.test(line), `program is a single token: ${line}`);
}
assert.strictEqual(evil.match(/^\[cpu\]$/gm).length, 1, "a game name can't inject a section");
assert.ok(!e.autoexec.some(l => l.startsWith("ipxnet connect")), "invalid IPX host ignored");
const evil86 = parseIni(L.box86Cfg("voodoo3", { name: "../../x\n[Machine]\nmachine=evil", cdImage: "a\nb=c" }));
assert.strictEqual(evil86.Machine.machine, "p3bf");
console.log("hostile input ok");
console.log("all legacy tests passed");
