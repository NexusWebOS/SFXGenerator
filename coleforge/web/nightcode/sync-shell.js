"use strict";
// Copies NightCode-DOS (nc-api.js, nc-terminal.js, the CRT stylesheet) into the ColeForge shell, so
// ColeForge.exe's NightCode Net program runs exactly what nightcode.coletechsystems.com runs.
//   node coleforge/web/nightcode/sync-shell.js
// tests/nightcode.test.js fails if the copies drift.
const fs = require("fs");
const path = require("path");
const dest = path.join(__dirname, "../../shell/js/nightcode-net");
fs.mkdirSync(dest, { recursive: true });
for (const f of ["nc-api.js", "nc-terminal.js"]) fs.copyFileSync(path.join(__dirname, "js", f), path.join(dest, f));
// The stylesheet's font path is relative to css/; in the shell the font lives in assets/fonts.
const css = fs.readFileSync(path.join(__dirname, "css/nightcode-dos.css"), "utf8")
  .replace(/\n\/\* the web page \*\/[\s\S]*$/, "\n")
  .replace('url("../assets/fonts/ShareTechMono-Regular.ttf")', 'url("../../assets/fonts/ShareTechMono-Regular.ttf")');
fs.writeFileSync(path.join(dest, "nightcode-dos.css"), css);
console.log("synced NightCode-DOS into", path.relative(process.cwd(), dest));
