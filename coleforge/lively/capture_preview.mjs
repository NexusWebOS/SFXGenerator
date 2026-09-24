// Capture thumbnail.jpg and preview.gif for the Lively package from the real wallpaper page.
//
//   node coleforge/lively/capture_preview.mjs      (needs Playwright; Python + Pillow for the GIF)
//
// Renders nightcode-code-rain/index.html as a 1920x1080 desktop (at half scale), serving the shared
// files straight from the ColeForge shell, then writes the stills into nightcode-code-rain/.
import { createRequire } from "module";
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch {
  ({ chromium } = require(execFileSync("npm", ["root", "-g"]).toString().trim() + "/playwright"));
}
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "nightcode-code-rain");
const SHELL = path.join(HERE, "..", "shell");
const FILES = {
  "index.html": path.join(SRC, "index.html"),
  "nightcode-rain.js": path.join(SHELL, "js", "nightcode-rain.js"),
  "logo.png": path.join(SHELL, "assets", "art", "nightcode", "logo.png"),
  "circuits.jpg": path.join(SHELL, "assets", "art", "nightcode", "circuits.jpg"),
  "ShareTechMono-Regular.ttf": path.join(SHELL, "assets", "fonts", "ShareTechMono-Regular.ttf"),
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 0.5 });
await page.route("http://lively.local/**", (route) => {
  const file = FILES[new URL(route.request().url()).pathname.slice(1)];
  return file ? route.fulfill({ path: file }) : route.fulfill({ status: 404 });
});
await page.goto("http://lively.local/index.html");
await page.evaluate(() => livelyPropertyListener("fps", 1)); // smooth frames for the capture
await page.waitForTimeout(4000);
await page.screenshot({ path: path.join(SRC, "thumbnail.jpg"), type: "jpeg", quality: 85 });

const frames = mkdtempSync(path.join(tmpdir(), "ncr-"));
for (let i = 0; i < 40; i++) {
  writeFileSync(path.join(frames, `${String(i).padStart(3, "0")}.png`), await page.screenshot());
  await page.waitForTimeout(60);
}
await browser.close();

execFileSync("python3", ["-c", `
import glob, sys
from PIL import Image
frames = [Image.open(f).convert("RGB").resize((480, 270), Image.LANCZOS) for f in sorted(glob.glob(sys.argv[1] + "/*.png"))]
pal = frames[0].quantize(colors=64, method=Image.Quantize.MEDIANCUT)
frames = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
frames[0].save(sys.argv[2], save_all=True, append_images=frames[1:], duration=90, loop=0, optimize=True)
`, frames, path.join(SRC, "preview.gif")]);
rmSync(frames, { recursive: true });
console.log("wrote thumbnail.jpg and preview.gif", readFileSync(path.join(SRC, "preview.gif")).length >> 10, "KB");
