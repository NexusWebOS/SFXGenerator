"use strict";

// Copies the shell and LAN server into desktop/app/ so electron-builder packages them.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const dest = path.resolve(__dirname, "..", "app");
fs.rmSync(dest, { recursive: true, force: true });
for (const dir of ["shell", "server"]) fs.cpSync(path.join(root, dir), path.join(dest, dir), { recursive: true });
console.log("Copied shell/ and server/ into", path.relative(process.cwd(), dest));
