"use strict";

// Free Games shelf: classic PC games their owners released for free (and open-source Freedoom), each
// downloaded from its official home, checked against a pinned SHA-256, unpacked into the NightCode folder
// on your desktop (Desktop\NightCode\Games) and started with one click. Adventures and God of Thunder
// run in ScummVM (fetched from scummvm.org the first time); Freedoom plays in Forge Arcade.
// Nothing comes from abandonware sites: every entry below is freeware by its rights holders' say-so,
// public domain, or open source. Adding a game = one catalog entry (verify the sha256 first).

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { unzip } = require("./unzip.js");

const SVM = "https://downloads.scummvm.org/frs/extras/";
const svm = (p) => SVM + p.split("/").map(encodeURIComponent).join("/");

const ENGINES = {
  scummvm: {
    name: "ScummVM 2026.3.0", site: "https://www.scummvm.org",
    files: [{ url: "https://downloads.scummvm.org/frs/scummvm/2026.3.0/scummvm-2026.3.0-win32-x86_64.zip", size: 120217090, sha256: "ba0af3fd6cf0d281c623d48b23c77a4b4775860d496195155e6ceb281e0fff95" }],
    exe: ["scummvm.exe", "scummvm"],
  },
};

const CATALOG = [
  { id: "beneath-a-steel-sky", name: "Beneath a Steel Sky", year: 1994, by: "Revolution Software", genre: "Sci-fi adventure", engine: "scummvm",
    about: "Cyberpunk point-and-click classic with art by Dave Gibbons (Watchmen). Robert Foster and his robot pal Joey versus the city computer LINC. CD version with full speech.",
    license: "Freeware, released by Revolution Software", files: [{ url: svm("Beneath a Steel Sky/bass-cd-1.2.zip"), size: 69377781, sha256: "53209b9400eab6fd7fa71518b2f357c8de75cfeaa5ba57024575ab79cc974593" }] },
  { id: "flight-of-the-amazon-queen", name: "Flight of the Amazon Queen", year: 1995, by: "Interactive Binary Illusions", genre: "Comedy adventure",
    engine: "scummvm", about: "Pilot Joe King crash-lands in the Amazon: dinosaurs, Amazon women and a mad scientist. Talkie version with full speech.",
    license: "Freeware, released by its authors", files: [{ url: svm("Flight of the Amazon Queen/FOTAQ_Talkie-1.1.zip"), size: 33744817, sha256: "a25cdd5e003a0a5e402af99b218cc7ea81ad032cb36b8c05df3bd1167038d8a8" }] },
  { id: "lure-of-the-temptress", name: "Lure of the Temptress", year: 1992, by: "Revolution Software", genre: "Fantasy adventure", engine: "scummvm",
    about: "Revolution's first game: Diermot must free the village of Turnvale from the sorceress Selena. Characters wander the town living their own lives.",
    license: "Freeware, released by Revolution Software", files: [{ url: svm("Lure of the Temptress/lure-1.1.zip"), size: 5678861, sha256: "f3178245a1483da1168c3a11e70b65d33c389f1f5df63d4f3a356886c1890108" }] },
  { id: "drascula", name: "Drascula: The Vampire Strikes Back", year: 1996, by: "Alcachofa Soft", genre: "Comedy horror adventure", engine: "scummvm",
    about: "Spanish cult comedy: estate agent John Hacker versus Count Drascula, with plenty of B-movie gags. Includes the soundtrack.",
    license: "Freeware, released by Alcachofa Soft",
    files: [{ url: svm("Drascula_ The Vampire Strikes Back/drascula-1.0.zip"), size: 32842993, sha256: "b731f6cb5a22ba8b4c3b3362f570b9a10a67b6cb0b395394b19a94b36e4e42de" },
      { url: svm("Drascula_ The Vampire Strikes Back/drascula-audio-2.0.zip"), size: 36531704, sha256: "7e6afba36eed13dd02e0360119e9a6a8d0e7b334ddc11d7c46ab7faceb8fe401" }] },
  { id: "dreamweb", name: "DreamWeb", year: 1994, by: "Creative Reality", genre: "Cyberpunk thriller", engine: "scummvm",
    about: "Dark top-down cyberpunk adventure: Ryan is told in his dreams that he must kill seven people to save the DreamWeb. Mature themes. CD version with speech.",
    license: "Freeware, released by its authors", files: [{ url: svm("Dreamweb/dreamweb-cd-us-1.1.zip"), size: 226360597, sha256: "f403d95e847b0fe2cde9b86cd2cf835826c6b759c3691f0ee456cacb0948dc94" }] },
  { id: "god-of-thunder", name: "God of Thunder", year: 1993, by: "Software Creations / Adept Software", genre: "Action puzzle",
    engine: "scummvm", about: "Play Thor, hurling Mjölnir through a top-down world of puzzles, monsters and secrets. All three parts of the shareware classic, now free.",
    license: "Freeware, released by Adept Software", files: [{ url: svm("God of Thunder/gotfree.zip"), size: 1059686, sha256: "94962e6fcbc6d547debda11224d00fdec7a0d03bacdf7d82d08ed8ea289c0c5e" }] },
  { id: "griffon-legend", name: "The Griffon Legend", year: 2005, by: "Syn9", genre: "Action RPG",
    engine: "scummvm", about: "Zelda-style action RPG in lush 16-bit pixel art: sword, magic and a griffon-knight out for revenge.",
    license: "Freeware, released by its author", files: [{ url: svm("Griffon Legend/griffon-1.0.zip"), size: 9552316, sha256: "0aad5fb10f51afb5c121cf04cc86539a6f0d89db85809f9e1767dfdc8d3191a4" }] },
  { id: "nippon-safes", name: "Nippon Safes, Inc.", year: 1992, by: "Dynabyte", genre: "Comedy adventure", engine: "scummvm",
    about: "Three crooks, one heist: switch between Doug, Donna and Dino in this Italian cartoon caper.",
    license: "Freeware, released by its authors", files: [{ url: svm("Nippon Safes/nippon-1.0.zip"), size: 1977894, sha256: "53e7e2c60065e4aed193169bbcdcfd1113fa68d3efe1c8240ba073c0e20d613f" }] },
  { id: "out-of-order", name: "Out of Order", year: 2003, by: "Tim Furnish", genre: "Surreal adventure", engine: "scummvm",
    about: "Award-winning freeware adventure: Ben wakes up in a very strange hospital. Hand-drawn and very funny.",
    license: "Freeware, released by its author", files: [{ url: svm("SLUDGE/outoforder.zip"), size: 10606154, sha256: "e57a2fda60ff41e3d22ee6ac763de89762eaeb719104d8851662f1d6146f38ec" }] },
  { id: "mystery-house", name: "Mystery House", year: 1980, by: "On-Line Systems (Sierra)", genre: "Graphic adventure",
    engine: "scummvm", about: "The very first graphical adventure game: a murder mystery in an abandoned Victorian mansion, drawn in Apple II lines.",
    license: "Public domain (released by Sierra in 1987)", files: [{ url: svm("Mystery House/MYSTHOUS.zip"), size: 59353, sha256: "ada412228a149394489b28c6c7f9ebab0722b52e04732fd0aa22949673cfa3a0" }] },
  { id: "freedoom", name: "Freedoom", year: 2024, by: "The Freedoom project", genre: "First-person shooter", engine: "arcade",
    about: "Complete free Doom-compatible games: Phase 1 (episodic, like Ultimate Doom) and Phase 2 (32 maps, like Doom II). Plays in Forge Arcade, great for LAN parties.",
    license: "Open source (BSD licence)", files: [{ url: "https://github.com/freedoom/freedoom/releases/download/v0.13.0/freedoom-0.13.0.zip", size: 24143781, sha256: "3f9b264f3e3ce503b4fb7f6bdcb1f419d93c7b546f4df3e874dd878db9688f59" }] },
];

const ALLOWED_HOSTS = new Set(["downloads.scummvm.org", "github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com"]);
const fmtMB = (n) => (n / 1048576).toFixed(n > 10485760 ? 0 : 1) + " MB";

function findFile(dir, names, depth = 3) {
  try {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of list) if (e.isFile() && names.some((n) => n.toLowerCase() === e.name.toLowerCase())) return path.join(dir, e.name);
    if (depth > 0) for (const e of list) if (e.isDirectory()) { const hit = findFile(path.join(dir, e.name), names, depth - 1); if (hit) return hit; }
  } catch { /* not there */ }
  return null;
}

// home: the NightCode folder (Desktop\NightCode). fetchImpl lets tests serve their own files.
function createFreeGames({ home, catalog = CATALOG, engines = ENGINES, fetchImpl = globalThis.fetch, allowedHosts = ALLOWED_HOSTS } = {}) {
  const gamesDir = path.join(home, "Games");
  const engineDir = (id) => path.join(gamesDir, "_Engines", id);
  const gameDir = (g) => path.join(gamesDir, g.name.replace(/[<>:"/\\|?*]/g, "").trim());
  const byId = new Map(catalog.map((g) => [g.id, g]));
  const busy = new Map();
  const marker = (dir) => path.join(dir, ".nightcode-installed.json");
  const installed = (dir) => fs.existsSync(marker(dir));

  function engineStatus(id) {
    const e = engines[id];
    const dir = engineDir(id);
    return { id, name: e.name, installed: installed(dir), exe: installed(dir) ? findFile(dir, e.exe) : null, size: e.files.reduce((n, f) => n + f.size, 0) };
  }

  function list() {
    return {
      home, games: gamesDir,
      engines: Object.fromEntries(Object.keys(engines).map((id) => [id, engineStatus(id)])),
      items: catalog.map((g) => ({
        id: g.id, name: g.name, year: g.year, by: g.by, genre: g.genre, about: g.about, license: g.license, engine: g.engine,
        size: g.files.reduce((n, f) => n + f.size, 0), sizeText: fmtMB(g.files.reduce((n, f) => n + f.size, 0)),
        installed: installed(gameDir(g)), dir: gameDir(g), busy: busy.get(g.id) || null,
      })),
    };
  }

  async function download(file, tmp, onBytes) {
    const u = new URL(file.url);
    if (u.protocol !== "https:" && !(u.protocol === "http:" && ["127.0.0.1", "localhost"].includes(u.hostname))) throw new Error("Downloads must use HTTPS.");
    if (!allowedHosts.has(u.hostname)) throw new Error(`${u.hostname} isn't an approved source.`);
    const res = await fetchImpl(file.url, { redirect: "follow", headers: { "User-Agent": "NightCode-FreeGames" } });
    if (!res.ok || !res.body) throw new Error(`${u.hostname} answered ${res.status}.`);
    const hash = crypto.createHash("sha256");
    const out = fs.createWriteStream(tmp);
    let got = 0;
    try {
      for await (const chunk of res.body) {
        const b = Buffer.from(chunk);
        got += b.length;
        if (got > file.size) throw new Error("The download is bigger than it should be.");
        hash.update(b);
        if (!out.write(b)) await new Promise((r) => out.once("drain", r));
        onBytes(b.length);
      }
    } finally {
      await new Promise((r) => out.end(r));
    }
    if (got !== file.size) throw new Error(`The download stopped early (${fmtMB(got)} of ${fmtMB(file.size)}).`);
    if (hash.digest("hex") !== file.sha256) throw new Error("The download doesn't match its checksum, so it wasn't installed.");
  }

  // Downloads every file of an entry, verifies it, unpacks it into dir and marks it installed.
  async function fetchInto(key, files, dir, onProgress) {
    const total = files.reduce((n, f) => n + f.size, 0);
    let done = 0;
    const tmpDir = path.join(gamesDir, "_Downloads");
    fs.mkdirSync(tmpDir, { recursive: true });
    const staging = dir + ".partial";
    fs.rmSync(staging, { recursive: true, force: true });
    try {
      for (const [i, f] of files.entries()) {
        const tmp = path.join(tmpDir, `${key}-${i}.zip`);
        onProgress({ id: key, phase: "download", done, total });
        await download(f, tmp, (n) => { done += n; onProgress({ id: key, phase: "download", done, total }); });
        onProgress({ id: key, phase: "unpack", done, total });
        // The main zip's wrapper folder (bass-cd-1.2/...) goes; add-ons (drascula's audio/) keep their layout.
        unzip(tmp, staging, { stripSingleRoot: i === 0 || f.strip === true });
        fs.rmSync(tmp, { force: true });
      }
      fs.writeFileSync(marker(staging), JSON.stringify({ installed: new Date().toISOString(), files: files.map((f) => f.url) }, null, 1));
      fs.rmSync(dir, { recursive: true, force: true });
      fs.renameSync(staging, dir);
    } catch (e) {
      fs.rmSync(staging, { recursive: true, force: true });
      throw e;
    }
  }

  async function install(id, onProgress = () => {}) {
    const g = byId.get(id);
    if (!g) throw new Error("Unknown game.");
    if (busy.get(id)) throw new Error(`${g.name} is already being installed.`);
    busy.set(id, "installing");
    try {
      if (engines[g.engine] && !engineStatus(g.engine).installed) {
        const e = engines[g.engine];
        await fetchInto(g.engine, e.files, engineDir(g.engine), (p) => onProgress(Object.assign(p, { id, engine: e.name })));
      }
      if (!installed(gameDir(g))) await fetchInto(id, g.files, gameDir(g), (p) => onProgress(Object.assign(p, { id })));
      onProgress({ id, phase: "done" });
      return list().items.find((x) => x.id === id);
    } finally {
      busy.delete(id);
    }
  }

  function uninstall(id) {
    const g = byId.get(id);
    if (!g) throw new Error("Unknown game.");
    const dir = gameDir(g);
    if (!installed(dir)) throw new Error(`${g.name} isn't installed.`);
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  }

  // What to run for an installed game: { exe, args, cwd } for ScummVM, or { arcade, iwad, dir } for Freedoom.
  function launchSpec(id) {
    const g = byId.get(id);
    if (!g) throw new Error("Unknown game.");
    const dir = gameDir(g);
    if (!installed(dir)) throw new Error(`${g.name} isn't installed yet.`);
    if (g.engine === "arcade") {
      return { arcade: "freedoom", dir, iwad: findFile(dir, ["freedoom2.wad"]), iwad1: findFile(dir, ["freedoom1.wad"]) };
    }
    const exe = engineStatus(g.engine).exe;
    if (!exe) throw new Error(`${engines[g.engine].name} is missing; install the game again to fetch it.`);
    const saves = path.join(gamesDir, "_Saves", g.id);
    fs.mkdirSync(saves, { recursive: true });
    return { exe, cwd: path.dirname(exe), args: [`--path=${dir}`, `--savepath=${saves}`, "--auto-detect"] };
  }

  return { list, install, uninstall, launchSpec, gamesDir };
}

module.exports = { createFreeGames, CATALOG, ENGINES, ALLOWED_HOSTS };
