"use strict";

// Legacy Mode: hardware presets for 1990s PC games and the config files that make them real.
//   - DOS games      → DOSBox – ColeForge Edition (DOSBox Staging with ColeForge presets): dosbox.conf
//   - Win9x games    → a whole 1999 PC in 86Box (Pentium II, 440BX, Voodoo3…):          86box.cfg
// Setting names and device ids are taken from the DOSBox Staging and 86Box sources, so the
// generated files load as-is. Shared by the shell (Legacy Mode app) and Node (tests, tools).
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LegacyProfiles = api;
})(typeof self !== "undefined" ? self : this, function () {
  /* ---------------- DOS machines (DOSBox Staging) ---------------- */
  // Cycles are DOSBox Staging's own ballpark table (cpu_cycles help text): starting points to tune.
  const DOS_MACHINES = {
    "xt": {
      name: "IBM PC/XT", era: "1983", cpu: "8088 @ 4.77 MHz", cycles: 300, cputype: "auto", core: "normal", machine: "cga", memsize: 1,
      video: "CGA", sound: "PC speaker + AdLib", sbtype: "none", oplmode: "opl2", gus: false, voodoo: false,
      blurb: "Early CGA games: Alley Cat, King's Quest (PC version), Digger.",
    },
    "386": {
      name: "386DX-33 VGA", era: "1991", cpu: "Intel 386DX @ 33 MHz", cycles: 6000, cputype: "386", core: "normal", machine: "svga_paradise", memsize: 4,
      video: "Paradise PVGA1A (VGA)", sound: "Sound Blaster Pro 2", sbtype: "sbpro2", oplmode: "opl3", gus: false, voodoo: false,
      blurb: "Wolfenstein 3D, Commander Keen, Monkey Island 2, Wing Commander.",
    },
    "486": {
      name: "486DX2-66 SVGA", era: "1993", cpu: "Intel 486DX2 @ 66 MHz", cycles: 25000, cputype: "486", core: "auto", machine: "svga_s3", memsize: 16,
      video: "S3 Trio64 (SVGA/VESA)", sound: "Sound Blaster 16 + General MIDI", sbtype: "sb16", oplmode: "opl3", gus: false, voodoo: false,
      blurb: "DOOM, DOOM II, Heretic, Duke Nukem 3D, Descent, X-COM, Warcraft II.",
    },
    "pentium": {
      name: "Pentium 90 + Gravis", era: "1995", cpu: "Intel Pentium @ 90 MHz", cycles: 50000, cputype: "pentium", core: "dynamic", machine: "svga_s3", memsize: 32,
      video: "S3 Trio64 (SVGA/VESA)", sound: "Sound Blaster 16 + Gravis UltraSound", sbtype: "sb16", oplmode: "opl3", gus: true, voodoo: false,
      blurb: "Quake (DOS), Duke Nukem 3D at high res, Screamer, demoscene productions (GUS).",
    },
    "voodoo1": {
      name: "Pentium MMX-166 + Voodoo", era: "1997", cpu: "Intel Pentium MMX @ 166 MHz", cycles: 100000, cputype: "pentium_mmx", core: "dynamic", machine: "svga_s3", memsize: 64,
      video: "S3 Trio64 + 3dfx Voodoo Graphics (12 MB, 2 TMUs)", sound: "Sound Blaster 16", sbtype: "sb16", oplmode: "opl3", gus: false, voodoo: true, voodoo_memsize: "12",
      blurb: "DOS Glide games: Tomb Raider (3dfx patch), Carmageddon (3dfx), POD, Extreme Assault.",
    },
  };

  /* ---------------- Windows 98 PCs (86Box) ---------------- */
  const WIN_MACHINES = {
    "voodoo3": {
      name: "Voodoo3 Rig (1999)", era: "1999", featured: true,
      board: "ASUS P3B-F (Intel 440BX, AGP 2x)", machine: "p3bf",
      cpu: "Intel Pentium II (Deschutes) 450 MHz", cpu_family: "pentium2_deschutes", cpu_speed: 450000000, cpu_multi: 4.5,
      mem_kb: 131072, gfxcard: "voodoo3_3k_agp", gfxName: "3dfx Voodoo3 3000 AGP (16 MB, 166 MHz)",
      sndcard: "es1371", sound: "Ensoniq AudioPCI ES1371 (Sound Blaster PCI 128)", net: "rtl8139c+", netName: "Realtek RTL8139C+ (NAT)",
      addon: null, os: "Windows 98 SE",
      blurb: "The card everyone wanted: Glide 3, 16-bit colour at 1024×768. Unreal Tournament, Quake III Arena, Half-Life, Need for Speed: High Stakes, Diablo II.",
    },
    "voodoo2sli": {
      name: "Voodoo2 SLI Monster (1998)", era: "1998",
      board: "ASUS P3B-F (Intel 440BX)", machine: "p3bf",
      cpu: "Intel Pentium II (Deschutes) 350 MHz", cpu_family: "pentium2_deschutes", cpu_speed: 350000000, cpu_multi: 3.5,
      mem_kb: 131072, gfxcard: "virge_pci", gfxName: "S3 ViRGE (2D) + 2× Voodoo2 12 MB in SLI",
      sndcard: "es1371", sound: "Ensoniq AudioPCI ES1371", net: "rtl8139c+", netName: "Realtek RTL8139C+ (NAT)",
      addon: { type: "voodoo_2", sli: 1, framebuffer_memory: 4, texture_memory: 4 }, os: "Windows 98 SE",
      blurb: "Two Voodoo2s bridged in SLI for 1024×768 in Glide. Quake II, Unreal, Half-Life, Tomb Raider III.",
    },
  };

  const MACHINES = Object.assign({}, ...Object.entries(DOS_MACHINES).map(([id, m]) => ({ [id]: Object.assign({ id, kind: "dos" }, m) })),
    ...Object.entries(WIN_MACHINES).map(([id, m]) => ({ [id]: Object.assign({ id, kind: "win9x" }, m) })));

  /* ---------------- DOSBox – ColeForge Edition: dosbox.conf ---------------- */
  // A DOS path segment we can safely write into [autoexec]: 8.3-ish names, no batch metacharacters.
  const dosName = (s) => String(s || "").replace(/[^A-Za-z0-9_~!#$%'()\-.\\]/g, "").replace(/^\\+/, "").slice(0, 64);
  // Host folder for "mount c": characters Windows allows in paths, minus anything the DOS shell or
  // our quotes could trip on.
  const hostPath = (s) => String(s || "").replace(/["\r\n%|<>&*?]/g, "").trim().slice(0, 260);

  function dosboxConf(machineId, game = {}) {
    const m = DOS_MACHINES[machineId];
    if (!m) throw new Error("Unknown DOS machine: " + machineId);
    const cycles = +game.cycles || m.cycles;
    const lines = [
      "# DOSBox – ColeForge Edition",
      `# Machine: ${m.name} (${m.era}) · ${m.cpu} · ${m.video} · ${m.sound}`,
      `# Game: ${String(game.name || "DOS prompt").replace(/[\r\n]/g, " ").slice(0, 60)}`,
      "# Generated by Windows – ColeForge Edition Legacy Mode. Load with: dosbox --conf <this file>",
      "",
      "[sdl]",
      "fullscreen = " + (game.fullscreen ? "true" : "false"),
      "",
      "[dosbox]",
      `machine = ${m.machine}`,
      `memsize = ${m.memsize}`,
      "",
      "[cpu]",
      `core = ${m.core}`,
      `cputype = ${m.cputype}`,
      `cpu_cycles = ${cycles}`,
      "cpu_cycles_protected = auto",
      "",
      "[sblaster]",
      `sbtype = ${m.sbtype}`,
      `oplmode = ${m.oplmode}`, // with sbtype = none, opl2 is a plain AdLib card
      "",
      "[gus]",
      `gus = ${m.gus ? "true" : "false"}`,
      "",
      "[voodoo]",
      `voodoo = ${m.voodoo ? "true" : "false"}`,
    ];
    if (m.voodoo) lines.push(`voodoo_memsize = ${m.voodoo_memsize || "4"}`, "voodoo_threads = auto", "voodoo_bilinear_filtering = true");
    lines.push("", "[ipx]", `ipx = ${game.ipx ? "true" : "false"}`, "", "[autoexec]");
    const folder = hostPath(game.folder);
    if (folder) lines.push(`mount c "${folder}"`, "c:");
    if (game.ipx === "host") lines.push("ipxnet startserver");
    else if (game.ipx && /^[A-Za-z0-9.-]{1,253}$/.test(game.ipxHost || "")) lines.push(`ipxnet connect ${game.ipxHost}`);
    const exe = dosName(game.exe);
    if (folder && exe) {
      const dir = exe.includes("\\") ? exe.slice(0, exe.lastIndexOf("\\")) : "";
      if (dir) lines.push(`cd \\${dir}`);
      lines.push(exe.slice(exe.lastIndexOf("\\") + 1));
      if (game.exitAfter) lines.push("exit");
    }
    return lines.join("\n") + "\n";
  }

  /* ---------------- 86Box: 86box.cfg for a Windows 98 PC ---------------- */
  const vmName = (s) => String(s || "ColeForge 98").replace(/[^\w .-]/g, "").replace(/^[\s.]+|[\s.]+$/g, "").slice(0, 40) || "ColeForge 98";

  function box86Cfg(machineId, vm = {}) {
    const m = WIN_MACHINES[machineId];
    if (!m) throw new Error("Unknown 86Box machine: " + machineId);
    const memKb = Math.max(8192, Math.min(1048576, Math.round((+vm.memMb || m.mem_kb / 1024)) * 1024));
    const threads = [1, 2, 4].includes(+vm.renderThreads) ? +vm.renderThreads : 4;
    const out = [
      "# Windows – ColeForge Edition · Legacy Mode · " + m.name,
      `# ${m.board} · ${m.cpu} · ${memKb / 1024} MB · ${m.gfxName} · ${m.sound}`,
      "# Open this folder with: 86Box.exe --vmpath <folder>",
      "",
      "[Machine]",
      `machine = ${m.machine}`,
      `cpu_family = ${m.cpu_family}`,
      `cpu_speed = ${m.cpu_speed}`,
      `cpu_multi = ${m.cpu_multi}`,
      `mem_size = ${memKb}`,
      "cpu_use_dynarec = 1",
      "time_sync = local",
      "",
      "[Video]",
      `gfxcard = ${m.gfxcard}`,
      `voodoo = ${m.addon ? 1 : 0}`,
      "",
      "[Input devices]",
      "mouse_type = ps2",
      "",
      "[Sound]",
      `sndcard = ${m.sndcard}`,
      "midi_device = windows_midi", // General MIDI through Windows' synth (or your own MIDI device)
      "fm_driver = nuked",
      "",
      "[Network]",
      `net_01_card = ${m.net}`,
      "net_01_net_type = slirp",
      "",
      "[Storage controllers]",
      "hdc_1 = internal",
      "",
      "[Hard disks]",
      // 63 sectors × 16 heads × 8322 cylinders ≈ 4 GB, plenty for Windows 98 SE and games.
      "hdd_01_parameters = 63, 16, 8322, 0, ide",
      `hdd_01_fn = ${vmName(vm.name).replace(/ /g, "_")}.img`,
      "hdd_01_ide_channel = 0:0",
      "",
      "[Floppy and CD-ROM drives]",
      "fdd_01_type = 35_2hd",
      "cdrom_01_parameters = 1, atapi",
      "cdrom_01_ide_channel = 1:0",
    ];
    if (vm.cdImage) out.push(`cdrom_01_image_path = ${String(vm.cdImage).replace(/[\r\n]/g, "").slice(0, 260)}`);
    // Per-device settings live in sections named after the device.
    if (m.gfxcard.startsWith("voodoo3")) out.push("", "[3dfx Voodoo3 3000]", "bilinear = 1", "dithersub = 1", `render_threads = ${threads}`, "recompiler = 1");
    if (m.addon) out.push("", "[3Dfx Voodoo Graphics]", `type = ${m.addon.type}`, `framebuffer_memory = ${m.addon.framebuffer_memory}`,
      `texture_memory = ${m.addon.texture_memory}`, "bilinear = 1", `render_threads = ${threads}`, `sli = ${m.addon.sli}`, "recompiler = 1");
    return out.join("\n") + "\n";
  }

  /* ---------------- then vs now ---------------- */
  const THEN_VS_NOW = [
    ["Timing loops", "Games counted CPU cycles to time themselves; on a 4 GHz CPU they run 100× too fast or crash (Turbo Pascal \"Runtime error 200\").", "DOSBox runs a fixed number of cycles per millisecond — dial in a 486 or a Pentium."],
    ["16-bit code", "DOS and Windows 3.1 programs need NTVDM, which 64-bit Windows removed.", "DOSBox emulates the whole DOS PC; 86Box runs real Windows 98."],
    ["Direct hardware access", "Games poked the VGA, Sound Blaster (port 220, IRQ 5, DMA 1) and joystick port directly.", "Emulated S3/ET4000/Paradise VGA, Sound Blaster, GUS, AdLib OPL3 and MPU-401 MIDI."],
    ["Glide & 3dfx", "Many 1996–2000 games only accelerate with 3dfx's Glide API, which only 3dfx cards spoke.", "DOSBox Staging emulates a Voodoo Graphics; 86Box emulates Voodoo, Voodoo2 SLI, Banshee and Voodoo3."],
    ["Win98 drivers", "Windows 98 has no drivers for modern Radeon/GeForce, Wi-Fi or NVMe (why your 2004 Radeon upgrade broke it).", "Inside 86Box, Windows 98 sees 1999 hardware it has drivers for; your real GPU and Wi-Fi stay with the modern Windows core."],
    ["DirectX 5–7 / DirectPlay", "8-bit palettes, DirectDraw and DirectPlay multiplayer are half-broken on Windows 10/11.", "Run them in the Voodoo3 rig, or enable DirectPlay on the host (get-legacy-engines.ps1 -EnableDirectPlay)."],
    ["Copy protection", "SafeDisc/SecuROM kernel drivers are blocked on Windows 10/11.", "They still work inside the 86Box Windows 98 PC with your original disc image."],
    ["IPX LAN play", "IPX networking is gone from modern Windows.", "DOSBox tunnels IPX over UDP (ipxnet); host it from a ForgeChat lobby."],
  ];

  return { DOS_MACHINES, WIN_MACHINES, MACHINES, THEN_VS_NOW, dosboxConf, box86Cfg, vmName };
});
