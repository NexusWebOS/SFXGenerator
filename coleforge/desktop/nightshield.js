"use strict";
// NightShield: NightBrowser's tracker and ad blocker plus HTTPS upgrade, running in ColeForge.exe.
// It filters requests in NightBrowser's own sessions (persist:nightbrowser and the in-memory
// nightbrowser-private), so Forge Browser and the rest of ColeForge are untouched.

// Well-known ad, analytics and tracking hosts. A request is blocked when its host is one of these
// or a subdomain of one. Keep the list short and uncontroversial: sites should still work.
const TRACKERS = [
  "doubleclick.net", "googlesyndication.com", "googleadservices.com", "google-analytics.com", "googletagmanager.com",
  "googletagservices.com", "adservice.google.com", "pagead2.googlesyndication.com", "2mdn.net",
  "connect.facebook.net", "facebook.com/tr", "analytics.twitter.com", "ads-twitter.com", "ads-api.twitter.com",
  "scorecardresearch.com", "quantserve.com", "quantcount.com", "adnxs.com", "criteo.com", "criteo.net", "taboola.com",
  "outbrain.com", "amazon-adsystem.com", "adsrvr.org", "rubiconproject.com", "pubmatic.com", "openx.net",
  "casalemedia.com", "moatads.com", "hotjar.com", "hotjar.io", "mixpanel.com", "cdn.segment.com", "api.segment.io",
  "nr-data.net", "bat.bing.com", "clarity.ms", "mc.yandex.ru", "analytics.tiktok.com", "ct.pinterest.com",
  "px.ads.linkedin.com", "snap.licdn.com", "chartbeat.com", "chartbeat.net", "mathtag.com", "bluekai.com", "demdex.net",
  "everesttech.net", "krxd.net", "adform.net", "smartadserver.com", "serving-sys.com", "teads.tv", "sharethrough.com",
  "advertising.com", "adsafeprotected.com", "doubleverify.com", "zedo.com", "media.net", "yieldmo.com", "bidswitch.net",
  "3lift.com", "indexww.com", "contextweb.com", "sonobi.com", "lijit.com", "exelator.com", "agkn.com", "tapad.com",
];
const HOSTS = new Set(TRACKERS.filter(t => !t.includes("/")));
const PATHS = TRACKERS.filter(t => t.includes("/"));

function isTracker(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  if (!/^(https?|wss?):$/.test(u.protocol)) return false;
  const parts = u.hostname.toLowerCase().split(".");
  for (let i = 0; i < parts.length - 1; i++) if (HOSTS.has(parts.slice(i).join("."))) return true;
  const hp = u.hostname.replace(/^www\./, "") + u.pathname;
  return PATHS.some(p => hp.startsWith(p));
}

// http:// → https://, except for this PC and the local network (LAN servers, ColeForge itself).
function upgradeUrl(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== "http:") return null;
  const h = u.hostname;
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".lan") || /^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\.|^\[?::1\]?$/.test(h) || !h.includes(".")) return null;
  u.protocol = "https:";
  return u.toString();
}

function createShield() {
  const state = { enabled: true, httpsUpgrade: true, total: 0, perContents: new Map() };
  function install(ses) {
    ses.webRequest.onBeforeRequest({ urls: ["<all_urls>"] }, (details, cb) => {
      if (state.enabled && isTracker(details.url)) {
        state.total++;
        state.perContents.set(details.webContentsId, (state.perContents.get(details.webContentsId) || 0) + 1);
        return cb({ cancel: true });
      }
      if (state.httpsUpgrade && details.resourceType === "mainFrame") {
        const to = upgradeUrl(details.url);
        if (to) return cb({ redirectURL: to });
      }
      cb({});
    });
  }
  return {
    install,
    set(opts = {}) { if ("enabled" in opts) state.enabled = !!opts.enabled; if ("httpsUpgrade" in opts) state.httpsUpgrade = !!opts.httpsUpgrade; return this.stats(); },
    stats(id) { return { enabled: state.enabled, httpsUpgrade: state.httpsUpgrade, total: state.total, page: id != null ? state.perContents.get(id) || 0 : undefined }; },
    reset(id) { state.perContents.delete(id); },
  };
}

module.exports = { TRACKERS, isTracker, upgradeUrl, createShield };
