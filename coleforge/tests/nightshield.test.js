"use strict";
// NightShield's matching rules (coleforge/desktop/nightshield.js).  node coleforge/tests/nightshield.test.js
const assert = require("assert");
const { isTracker, upgradeUrl, createShield } = require("../desktop/nightshield.js");

for (const u of ["https://www.google-analytics.com/g/collect", "https://securepubads.g.doubleclick.net/tag/js/gpt.js", "https://connect.facebook.net/en_US/fbevents.js",
  "https://www.facebook.com/tr?id=1", "https://static.hotjar.com/c/hotjar-1.js", "https://c.amazon-adsystem.com/aax2/apstag.js", "wss://ws.hotjar.com/api"]) assert.ok(isTracker(u), u);
for (const u of ["https://www.google.com/", "https://www.facebook.com/", "https://en.wikipedia.org/wiki/Doom", "https://zandronum.com/", "https://notdoubleclick.net.example.org/",
  "https://github.com/NexusWebOS/NightCode", "http://localhost:8098/", "data:text/html,x", "https://media.netflix.com/"]) assert.ok(!isTracker(u), u);
console.log("ok - tracker hosts blocked, ordinary sites allowed");

assert.strictEqual(upgradeUrl("http://example.com/a?b=1"), "https://example.com/a?b=1");
for (const u of ["http://localhost:8098/", "http://192.168.1.20:8098/", "http://10.0.0.5/", "http://myserver/", "http://nas.local/", "https://example.com/"]) assert.strictEqual(upgradeUrl(u), null, u);
console.log("ok - HTTPS upgrade skips this PC and the LAN");

const s = createShield();
let handler;
s.install({ webRequest: { onBeforeRequest: (_f, fn) => { handler = fn; } } });
const run = (url, type = "script", id = 7) => new Promise(r => handler({ url, resourceType: type, webContentsId: id }, r));
(async () => {
  assert.deepStrictEqual(await run("https://www.googletagmanager.com/gtm.js"), { cancel: true });
  assert.deepStrictEqual(await run("http://example.org/", "mainFrame"), { redirectURL: "https://example.org/" });
  assert.deepStrictEqual(await run("https://example.org/app.js"), {});
  assert.strictEqual(s.stats(7).page, 1);
  s.set({ enabled: false, httpsUpgrade: false });
  assert.deepStrictEqual(await run("https://www.googletagmanager.com/gtm.js"), {});
  assert.deepStrictEqual(await run("http://example.org/", "mainFrame"), {});
  console.log("ok - request filter counts blocks per tab and can be switched off");
  console.log("all nightshield tests passed");
})();
