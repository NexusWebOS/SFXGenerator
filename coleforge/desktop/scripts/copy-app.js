"use strict";

// Copies the shell and LAN server into desktop/app/ so electron-builder packages them.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const dest = path.resolve(__dirname, "..", "app");
fs.rmSync(dest, { recursive: true, force: true });
// agent/ is Albert's Claude relay and the MCP server; it needs its one dependency (the Claude SDK).
if (!fs.existsSync(path.join(root, "agent", "node_modules", "@anthropic-ai", "sdk"))) {
  require("child_process").execSync("npm install --omit=dev --no-audit --no-fund", { cwd: path.join(root, "agent"), stdio: "inherit" });
}
for (const dir of ["shell", "server", "programs", "agent"]) fs.cpSync(path.join(root, dir), path.join(dest, dir), { recursive: true });
console.log("Copied shell/, server/, programs/ and agent/ into", path.relative(process.cwd(), dest));
