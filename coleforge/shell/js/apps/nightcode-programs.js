"use strict";

// Official NightCode programs for Windows – ColeForge Edition: Netcon and Disk Dude, from
// github.com/NexusWebOS/NightCode (vendored in coleforge/programs/retro-tools). They're native Windows
// apps (Python/Tk), so ColeForge shows each one's launcher here and the desktop host starts it.
(function () {
  const { h } = CF;
  const art = (n) => `assets/art/programs/${n}`;
  const REPO = "https://github.com/NexusWebOS/NightCode";

  const PROGRAMS = {
    netcon: {
      name: "Netcon", tagline: "BADGES // ASSET INVENTORY // REPAIR LOG // GAME CATALOG",
      desc: "Design and export printable, clearly marked SAMPLE ID badges; keep an inventory of the RFID/NFC tags you manage; log lock hardware damage and repairs; and keep a personal game ownership and compatibility catalog.",
      features: ["Badge maker with PNG export (always marked SAMPLE)", "RFID / NFC asset inventory: IDs you type in yourself, no radio reading or cloning",
        "Lock service and damage log with a cylinder diagram, no bypass instructions", "Game library with key hints (last 4 characters only) and compatibility notes"],
    },
    diskdude: {
      name: "Disk Dude", tagline: "OPTICAL MEDIA // ARCHIVE // PLAY // SHARE",
      desc: "Scans CDs and DVDs and recognises PS1, PS2, Dreamcast, Xbox, DVD Video, VCD, music and data discs; copies them with a SHA-256 manifest and ZIP; burns data CDs through Windows IMAPI2; plays Audio CDs; and opens a disc in your emulator.",
      features: ["Disc detection with cover art and file list", "Verified copy + ZIP, and data-disc burning (asks before anything irreversible)",
        "Audio CD play/pause/stop and one-click emulator launch", "Optional explicit uploads to your GitHub release or Supabase bucket"],
    },
  };

  for (const [id, p] of Object.entries(PROGRAMS)) {
    CF.register({
      id, name: p.name, icon: id, single: true, desc: `${p.name}: official NightCode program. ${p.tagline.toLowerCase()}.`,
      window: { w: 780, h: 600 },
      open(win) {
        const status = h("div", { class: "ncp-status muted" }, CF.host?.programStatus ? "Checking…" : "Runs on Windows through ColeForge.exe (the desktop app).");
        const launchBtn = h("button", { class: "btn ncp-launch", disabled: !CF.host?.runProgram }, h("img", { src: art(`${id}.png`), alt: "" }), ` Launch ${p.name}`);
        launchBtn.addEventListener("click", async () => {
          launchBtn.disabled = true;
          try {
            const r = await CF.host.runProgram(id);
            CF.toast({ title: p.name, body: r.via === "exe" ? "Starting…" : "Starting from Python source…", icon: id });
          } catch (e) {
            CF.dialog({ title: p.name, icon: "error", message: e.message });
          }
          launchBtn.disabled = false;
        });
        win.body.append(h("div", { class: "ncp" },
          h("div", { class: "ncp-hero" },
            h("div", { class: "ncp-hero-text" }, h("img", { class: "ncp-logo", src: art(`${id}-logo.png`), alt: p.name })),
            h("img", { class: "ncp-mascot", src: art(`${id}-mascot.png`), alt: "" })),
          h("div", { class: "ncp-body" },
            h("p", {}, p.desc),
            h("ul", { class: "ncp-list" }, p.features.map(f => h("li", {}, f))),
            h("p", { class: "muted" }, "Local by design: no cloud account needed, settings stay in %LOCALAPPDATA%\\RetroTools. Use only media and systems you own or manage."),
            h("div", { class: "row ncp-actions" }, launchBtn,
              h("button", { class: "btn flat", onclick: () => CF.open("browser", { url: REPO }) }, "NightCode on GitHub"),
              h("button", { class: "btn flat", onclick: howToBuild }, "Build .exe…")),
            status),
          h("div", { class: "ncp-foot" }, h("img", { src: "assets/art/nightcode/logo-32.png", alt: "" }), "Official ColeForge program · NightCode")));
        win.statusbar([`${p.name} · NightCode`, CF.host?.runProgram ? "Desktop host" : "Browser mode"]);
        if (CF.host?.programStatus) CF.host.programStatus(id).then(st => {
          status.textContent = st.exe ? `Ready: ${st.exe}` : st.source ? `Ready: runs ${st.source.split(/[\\/]/).pop()} with Python 3 (py -3). Build the .exe to run without Python.` : "Program files are missing from this build.";
        }).catch(e => { status.textContent = e.message; });
        function howToBuild() {
          CF.dialog({ title: `Build ${p.name}.exe`, icon: "info", message: "On Windows, run this once in PowerShell from the ColeForge folder:\n\n  core\\windows\\build-nightcode-programs.ps1\n\nIt installs Pillow and PyInstaller for your user, builds Netcon.exe and DiskDude.exe, and puts them in %LOCALAPPDATA%\\ColeForge\\programs, where ColeForge launches them from." });
        }
      },
    });
  }
})();
