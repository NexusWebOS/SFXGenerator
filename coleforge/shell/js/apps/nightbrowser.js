"use strict";

// NightBrowser: the NightCode web browser, cloned from Forge Browser and upgraded.
// - NightShield: tracker/ad blocking + HTTPS upgrade (ColeForge.exe; desktop/nightshield.js)
// - private tabs (their own in-memory session, no history), speed dial, bookmarks bar
// - find in page, zoom, mute tab, page screenshot → Forgecraft, "Play in NightAmp" for media links
// The engine (CF.NightWeb.mount) is shared with NightAmp's built-in browser.
(function () {
  const { h } = CF;
  const ART = "assets/art/nightapps/";
  const KEY = "cf.nightbrowser";
  const HOME = "night://home";
  const hasWebview = !!(CF.host && CF.host.webview);
  const ENGINES = [["DuckDuckGo", "https://duckduckgo.com/?q="], ["Startpage", "https://www.startpage.com/do/search?q="], ["Brave Search", "https://search.brave.com/search?q="],
    ["Mojeek", "https://www.mojeek.com/search?q="], ["Google", "https://www.google.com/search?q="], ["Bing", "https://www.bing.com/search?q="]];
  const DEFAULT_DIAL = [["NightCode", "https://github.com/NexusWebOS/NightCode"], ["Zandronum", "https://zandronum.com/"], ["Freedoom", "https://freedoom.github.io/"],
    ["Archive.org", "https://archive.org/"], ["SomaFM", "https://somafm.com/"], ["Wikipedia", "https://en.wikipedia.org/"], ["Doomworld", "https://www.doomworld.com/"], ["Hacker News", "https://news.ycombinator.com/"]];
  const MEDIA_RX = /\.(wsz|mp3|m4a|aac|flac|ogg|oga|opus|wav|weba|mp4|m4v|webm|mkv|mov|ogv|m3u8|mid|midi|pls|m3u)(\?|#|$)/i;
  const prefs = () => Object.assign({ engine: ENGINES[0][1], shield: true, https: true, dial: DEFAULT_DIAL, bookmarks: DEFAULT_DIAL.slice(0, 5), showBar: true, splash: true }, CF.store.get(KEY, {}));
  const setPrefs = (p) => CF.store.set(KEY, p);
  let shieldApplied = false;
  function applyShield() {
    const p = prefs();
    if (CF.host?.shield) CF.host.shield({ enabled: p.shield, httpsUpgrade: p.https }).catch(() => {});
    shieldApplied = true;
  }
  const esc = CF.esc;
  const abs = (p) => new URL(p, location.href).href;

  function normalize(input, p = prefs()) {
    const v = String(input || "").trim();
    if (!v) return HOME;
    if (/^night:\/\//i.test(v) || /^[a-z][\w+.-]*:\/\//i.test(v) || /^(about|view-source|data):/i.test(v)) return v;
    if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(v) || /^localhost(:\d+)?(\/.*)?$/.test(v)) {
      const host = v.split(/[/:]/)[0];
      const local = /^localhost$|\.local$|\.lan$|^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host);   // this PC and the LAN stay on http
      return (p.https && !local ? "https://" : "http://") + v;
    }
    return p.engine + encodeURIComponent(v);
  }

  // The NightCode start page. Links and the search box talk to the browser through
  // postMessage (iframe) or console messages (webview), the same protocol Forge Browser uses.
  function homePage({ title = "NightBrowser", subtitle = "BROWSE BEYOND THE LIGHT", tiles, stats = "", extra = "" }) {
    const tileHtml = tiles.map(([n, u]) => `<a href="#" data-u="${esc(u)}"><b>${esc(n.slice(0, 2).toUpperCase())}</b><span>${esc(n)}</span></a>`).join("");
    return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:STM;src:url(${abs("assets/fonts/ShareTechMono-Regular.ttf")})}@font-face{font-family:Orb;font-weight:900;src:url(${abs("assets/fonts/Orbitron-Black.ttf")})}
html,body{margin:0;min-height:100%;background:#02050e;color:#cfe6ff;font:14px STM,Consolas,monospace}canvas{position:fixed;inset:0;width:100%;height:100%;opacity:.55}
main{position:relative;max-width:760px;margin:0 auto;padding:5vh 18px 30px;text-align:center}img{width:120px;filter:drop-shadow(0 0 18px #1e78ff)}
h1{margin:6px 0 0;font:900 40px Orb,sans-serif;color:#eaf6ff;text-shadow:0 0 14px rgba(49,215,232,.8)}h2{margin:4px 0 22px;font-size:12px;letter-spacing:.35em;color:#31d7e8;font-weight:normal}
form{display:flex;gap:6px}input{flex:1;padding:12px 14px;background:rgba(5,10,22,.92);color:#fff;border:1px solid #31d7e8;font:inherit;font-size:16px;outline:none;box-shadow:0 0 16px rgba(30,120,255,.35)}
button{padding:0 18px;background:linear-gradient(#15306a,#0a1a40);color:#fff;border:1px solid #31d7e8;font:inherit;cursor:pointer}
.d{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:26px}.d a{display:flex;align-items:center;gap:10px;padding:10px;background:rgba(10,18,36,.85);border:1px solid #1f3a6e;color:#cfe6ff;text-decoration:none;text-align:left}
.d a:hover{border-color:#31d7e8;box-shadow:0 0 10px rgba(49,215,232,.4)}.d b{flex:none;display:grid;place-items:center;width:30px;height:30px;background:#10224a;color:#31d7e8;font:900 12px Orb,sans-serif;border:1px solid #2d5aa8}
.s{margin-top:22px;color:#5f80ab;font-size:12px;letter-spacing:.08em}</style></head><body><canvas id="c"></canvas><main>
<img src="${abs("assets/art/nightcode/logo-128.png")}" alt=""><h1>${esc(title)}</h1><h2>${esc(subtitle)}</h2>
<form id="f"><input name="q" placeholder="Search or type a web address" autofocus autocomplete="off"><button>GO</button></form>
<div class="d">${tileHtml}</div>${extra}<div class="s">${stats}</div></main>
<script>
function nav(v){if(parent!==window)parent.postMessage({forgeNav:v},"*");else console.log("forgeNav:"+v);return false}
document.getElementById("f").onsubmit=function(e){e.preventDefault();nav(this.q.value)};
document.querySelectorAll("[data-u]").forEach(function(a){a.onclick=function(e){e.preventDefault();nav(a.dataset.u)}});
(function(){var c=document.getElementById("c"),x=c.getContext("2d"),g="01ABCDEF<>{}[]/=+*#$%NIGHTCODE".split(""),cols=[],s=16;
function r(){c.width=innerWidth;c.height=innerHeight;cols=Array.from({length:Math.ceil(c.width/s)},function(){return -Math.random()*c.height/s})}r();addEventListener("resize",r);
setInterval(function(){x.fillStyle="rgba(2,5,14,.14)";x.fillRect(0,0,c.width,c.height);x.font=s+"px STM,monospace";
cols.forEach(function(y,i){x.fillStyle=i%3?"#1e78ff":"#31d7e8";x.fillText(g[(Math.random()*g.length)|0],i*s,y*s);cols[i]=y*s>c.height&&Math.random()>.975?0:y+.5})},50)})();
<\/script></body></html>`;
  }

  /* ================= the engine ================= */
  // nightamp://play?u=<stream>&n=<name> links (NightAmp's radio page) and direct media files go to onMedia.
  function mediaHandler(o) {
    return (u) => {
      if (!o.onMedia) return false;
      if (/^nightamp:\/\//i.test(u)) { const q = new URL(u); o.onMedia(q.searchParams.get("u"), q.searchParams.get("n")); return true; }
      if (MEDIA_RX.test(u)) { o.onMedia(u, decodeURIComponent(u.split(/[?#]/)[0].split("/").pop())); return true; }
      return false;
    };
  }
  // mount(container, { tabs, home, homeHtml(), storeless, onTitle(t), onMedia(url, name), compact, privateOnly })
  function mount(container, o = {}) {
    const p = prefs();
    const mediaLink = mediaHandler(o);
    if (!shieldApplied) applyShield();
    const tabs = [];
    let cur = null;
    const history = o.storeless ? [] : CF.store.get(KEY + ".history", []);
    const btn = (icon, title, fn, cls = "") => { const b = h("button", { class: "nb-btn " + cls, title }, h("img", { src: `${ART}nightbrowser/${icon}.png`, alt: title })); b.addEventListener("click", fn); return b; };
    const tabBar = h("div", { class: "nb-tabs" });
    const addr = h("input", { class: "nb-addr", spellcheck: "false", placeholder: "Search or type a web address" });
    const secure = h("span", { class: "nb-secure", title: "" });
    const reloadBtn = btn("reload", "Reload (F5)", () => cur?.loading ? cur.stop() : cur?.reload());
    const shieldBtn = btn("shield", "NightShield", shieldMenu, "nb-shield");
    const shieldCount = h("i", { class: "nb-badge" });
    shieldBtn.append(shieldCount);
    const findBar = h("div", { class: "nb-find", hidden: true });
    const bar = h("div", { class: "nb-bar" });
    const pages = h("div", { class: "nb-pages" });
    const hint = h("div", { class: "nb-hint", hidden: true });
    const root = h("div", { class: "nb" + (o.compact ? " compact" : "") },
      o.tabs === false ? null : tabBar,
      h("div", { class: "nb-toolbar" }, btn("back", "Back (Alt+Left)", () => cur?.back()), btn("forward", "Forward (Alt+Right)", () => cur?.forward()), reloadBtn, btn("home", "Home", () => cur?.go(o.home || HOME)),
        h("div", { class: "nb-addrwrap" }, secure, addr), btn("star", "Bookmark this page", bookmark), shieldBtn,
        o.tabs === false ? null : btn("private", "New private tab (Ctrl+Shift+N)", () => newTab(o.home || HOME, true)),
        o.compact ? null : btn("camera", "Screenshot the page to Forgecraft", screenshot), btn("menu", "Menu", (e) => mainMenu(e))),
      o.compact ? null : bar, findBar, hint, pages);
    container.append(root);

    addr.addEventListener("keydown", (e) => { if (e.key === "Enter") { cur?.go(normalize(addr.value)); addr.blur(); } });
    addr.addEventListener("focus", () => addr.select());

    /* ---- bookmarks bar ---- */
    function renderBar() {
      if (o.compact) return;
      const q = prefs();
      bar.hidden = !q.showBar;
      bar.replaceChildren(...q.bookmarks.map(([name, url], i) => {
        const f = h("span", { class: "nb-mark clickable", title: url }, h("img", { src: `${ART}nightbrowser/star.png`, alt: "" }), name);
        f.addEventListener("click", () => cur?.go(url));
        f.addEventListener("auxclick", (e) => { if (e.button === 1) newTab(url); });
        f.addEventListener("contextmenu", (e) => { e.preventDefault(); CF.contextMenu({ x: e.clientX, y: e.clientY }, [
          { label: "Open in new tab", action: () => newTab(url) }, { label: "Open in private tab", action: () => newTab(url, true) }, "-",
          { label: "Add to speed dial", action: () => { const q2 = prefs(); q2.dial.push([name, url]); setPrefs(q2); } },
          { label: "Remove", action: () => { const q2 = prefs(); q2.bookmarks.splice(i, 1); setPrefs(q2); renderBar(); } }]); });
        return f;
      }));
    }
    function bookmark() {
      if (!cur || cur.url === HOME || cur.url === o.home) return;
      const q = prefs();
      if (q.bookmarks.some(([, u]) => u === cur.url)) return CF.toast({ title: "NightBrowser", body: "This page is already bookmarked.", icon: "nightbrowser" });
      q.bookmarks.push([(cur.title || cur.url).slice(0, 28), cur.url]); setPrefs(q); renderBar();
      CF.toast({ title: "NightBrowser", body: `Bookmarked ${cur.title || cur.url}`, icon: "nightbrowser" });
    }
    function pushHistory(url, title, t) {
      if (t.priv || o.storeless || /^night:|^data:/.test(url)) return;
      history.unshift({ url, title, ts: Date.now() });
      history.length = Math.min(history.length, 300);
      CF.store.set(KEY + ".history", history);
    }

    /* ---- tabs ---- */
    function renderTabs() {
      if (o.tabs === false) return;
      tabBar.replaceChildren(...tabs.map(t => {
        const el = h("div", { class: "nb-tab clickable" + (t === cur ? " on" : "") + (t.priv ? " priv" : "") + (t.muted ? " muted" : ""), title: t.url },
          h("img", { src: t.favicon || (t.priv ? `${ART}nightbrowser/private.png` : `${ART}nightbrowser.png`), alt: "" }),
          h("span", {}, (t.loading ? "⋯ " : "") + (t.title || "New Tab")), t.muted ? h("small", {}, "🔇") : null, h("span", { class: "nb-x clickable", title: "Close tab (Ctrl+W)" }, "✕"));
        el.addEventListener("click", (e) => e.target.classList.contains("nb-x") ? closeTab(t) : select(t));
        el.addEventListener("auxclick", (e) => { if (e.button === 1) closeTab(t); });
        el.addEventListener("contextmenu", (e) => { e.preventDefault(); CF.contextMenu({ x: e.clientX, y: e.clientY }, [
          { label: "New tab", key: "Ctrl+T", action: () => newTab(o.home || HOME) }, { label: "Duplicate", action: () => newTab(t.url, t.priv) }, { label: "Reload", action: () => t.reload() },
          { label: t.muted ? "Unmute tab" : "Mute tab", disabled: !hasWebview, action: () => mute(t) }, "-",
          { label: "Close tab", action: () => closeTab(t) }, { label: "Close other tabs", disabled: tabs.length < 2, action: () => tabs.filter(x => x !== t).forEach(closeTab) }]); });
        return el;
      }), (() => { const pl = h("div", { class: "nb-tab nb-new clickable", title: "New tab (Ctrl+T)" }, h("img", { src: `${ART}nightbrowser/plus.png`, alt: "+" })); pl.addEventListener("click", () => newTab(o.home || HOME)); return pl; })());
    }
    function select(t) {
      cur = t;
      tabs.forEach(x => { x.el.style.display = x === t ? "" : "none"; });
      syncChrome();
      renderTabs();
    }
    function syncChrome() {
      const t = cur;
      if (!t) return;
      addr.value = t.url === HOME || t.url === o.home ? "" : t.url;
      const https = /^https:/.test(t.url);
      secure.className = "nb-secure " + (https ? "ok" : /^http:/.test(t.url) ? "warn" : "");
      secure.textContent = https ? "🔒" : /^http:/.test(t.url) ? "!" : t.priv ? "🕶" : "◆";
      secure.title = https ? "Secure connection (HTTPS)" : /^http:/.test(t.url) ? "Not secure (HTTP)" : "NightBrowser page";
      reloadBtn.querySelector("img").src = `${ART}nightbrowser/${t.loading ? "stop" : "reload"}.png`;
      reloadBtn.title = t.loading ? "Stop (Esc)" : "Reload (F5)";
      hint.hidden = hasWebview || t.url === HOME || t.url === o.home;
      o.onTitle?.(t.title || "New Tab", t);
      updateShield();
    }
    function closeTab(t) {
      const i = tabs.indexOf(t);
      if (i < 0) return;
      tabs.splice(i, 1); t.el.remove();
      if (hasWebview && t.wcId) CF.host?.shieldReset?.(t.wcId);
      if (!tabs.length) { if (o.onEmpty) return o.onEmpty(); return newTab(o.home || HOME); }
      if (t === cur) select(tabs[Math.min(i, tabs.length - 1)]); else renderTabs();
    }
    function mute(t) { if (!t.view.setAudioMuted) return; t.muted = !t.muted; t.view.setAudioMuted(t.muted); renderTabs(); }

    function homeFor(t) {
      if (o.homeHtml && (t.url === o.home)) return o.homeHtml();
      const q = prefs();
      return homePage({ tiles: q.dial, stats: t.priv ? "PRIVATE TAB · NO HISTORY · NO COOKIES KEPT" : hasWebview ? `NIGHTSHIELD ${q.shield ? "ON" : "OFF"} · HTTPS UPGRADE ${q.https ? "ON" : "OFF"}` : "BROWSER MODE · RUN COLEFORGE.EXE FOR NIGHTSHIELD" });
    }
    const isHome = (u) => u === HOME || (o.home && u === o.home);

    function newTab(url = o.home || HOME, priv = !!o.privateOnly) {
      const t = { url, title: "New Tab", priv, stack: [], pos: -1, loading: false };
      if (hasWebview) {
        const wv = document.createElement("webview");
        wv.setAttribute("allowpopups", "");
        wv.setAttribute("partition", priv ? "nightbrowser-private" : "persist:nightbrowser");
        wv.className = "nb-view";
        t.view = wv; t.el = wv;
        t.go = (u) => {
          if (mediaLink(u)) return;
          t.url = u;
          wv.src = isHome(u) ? "data:text/html;charset=utf-8," + encodeURIComponent(homeFor(t)) : u;
        };
        t.back = () => wv.canGoBack() && wv.goBack(); t.forward = () => wv.canGoForward() && wv.goForward(); t.reload = () => wv.reload(); t.stop = () => wv.stop();
        t.canBack = () => { try { return wv.canGoBack(); } catch { return false; } }; t.canForward = () => { try { return wv.canGoForward(); } catch { return false; } };
        wv.addEventListener("dom-ready", () => { try { t.wcId = wv.getWebContentsId(); } catch { /* not ready */ } });
        wv.addEventListener("did-start-loading", () => { t.loading = true; if (t === cur) syncChrome(); renderTabs(); });
        wv.addEventListener("did-stop-loading", () => { t.loading = false; if (t === cur) syncChrome(); renderTabs(); });
        wv.addEventListener("did-navigate", (e) => { if (!e.url.startsWith("data:")) { t.url = e.url; t.favicon = null; pushHistory(e.url, t.title, t); } if (t === cur) syncChrome(); });
        wv.addEventListener("did-navigate-in-page", (e) => { if (e.isMainFrame && !e.url.startsWith("data:")) { t.url = e.url; if (t === cur) syncChrome(); } });
        wv.addEventListener("page-title-updated", (e) => { t.title = e.title; if (t === cur) syncChrome(); renderTabs(); });
        wv.addEventListener("page-favicon-updated", (e) => { t.favicon = e.favicons?.[0] || null; renderTabs(); });
        wv.addEventListener("found-in-page", (e) => { findCount.textContent = e.result.matches ? `${e.result.activeMatchOrdinal}/${e.result.matches}` : "0/0"; });
        wv.addEventListener("console-message", (e) => { const m = /^forgeNav:(.*)$/.exec(e.message); if (m) t.go(normalize(m[1])); });
        wv.addEventListener("will-navigate", (e) => { if (MEDIA_RX.test(e.url) && o.onMedia) { wv.stop(); o.onMedia(e.url, decodeURIComponent(e.url.split(/[?#]/)[0].split("/").pop())); } });
        wv.addEventListener("context-menu", (e) => { const r = wv.getBoundingClientRect(); pageMenu(t, r.left + e.params.x, r.top + e.params.y, e.params); });
      } else {
        const fr = h("iframe", { class: "nb-view", referrerpolicy: "no-referrer", allow: "fullscreen; autoplay; clipboard-write", sandbox: "allow-scripts allow-forms allow-popups allow-same-origin allow-presentation allow-downloads" });
        t.view = fr; t.el = fr;
        const load = () => {
          const u = t.stack[t.pos];
          t.url = u;
          if (isHome(u)) { fr.removeAttribute("src"); fr.srcdoc = homeFor(t); t.title = o.homeTitle || "Start Page"; }
          else { fr.removeAttribute("srcdoc"); fr.src = u; t.title = u.replace(/^https?:\/\//, "").split("/")[0]; pushHistory(u, t.title, t); }
          if (t === cur) syncChrome(); renderTabs();
        };
        t.go = (u) => {
          if (mediaLink(u)) return;
          t.stack.splice(t.pos + 1); t.stack.push(u); t.pos++; load();
        };
        t.back = () => { if (t.pos > 0) { t.pos--; load(); } }; t.forward = () => { if (t.pos < t.stack.length - 1) { t.pos++; load(); } }; t.reload = () => load(); t.stop = () => {};
        t.canBack = () => t.pos > 0; t.canForward = () => t.pos < t.stack.length - 1;
        fr.addEventListener("load", () => { try { const d = fr.contentDocument; if (d && d.title) { t.title = d.title; renderTabs(); if (t === cur) syncChrome(); } } catch { /* cross-origin */ } });
      }
      pages.append(t.el);
      tabs.push(t); select(t);
      t.go(url);
      return t;
    }

    /* ---- menus ---- */
    function pageMenu(t, x, y, prm) {
      const items = [{ label: "Back", disabled: !t.canBack(), action: () => t.back() }, { label: "Forward", disabled: !t.canForward(), action: () => t.forward() }, { label: "Reload", action: () => t.reload() }, "-"];
      if (prm.linkURL) {
        items.push({ label: "Open link in new tab", action: () => newTab(prm.linkURL) }, { label: "Open link in private tab", action: () => newTab(prm.linkURL, true) });
        if (MEDIA_RX.test(prm.linkURL)) items.push({ label: "Play in NightAmp", icon: "nightamp", action: () => playInAmp(prm.linkURL) });
        items.push({ label: "Copy link address", action: () => navigator.clipboard?.writeText(prm.linkURL) }, "-");
      }
      if (prm.srcURL && (prm.mediaType === "video" || prm.mediaType === "audio")) items.push({ label: "Play in NightAmp", icon: "nightamp", action: () => playInAmp(prm.srcURL) }, "-");
      if (prm.srcURL && prm.mediaType === "image") items.push({ label: "Open image in new tab", action: () => newTab(prm.srcURL) }, { label: "Save image as…", action: () => t.view.downloadURL?.(prm.srcURL) }, "-");
      if (prm.isEditable) items.push({ label: "Cut", action: () => t.view.cut?.() }, { label: "Paste", action: () => t.view.paste?.() });
      if (prm.selectionText) items.push({ label: "Copy", action: () => t.view.copy?.() }, { label: `Search for "${prm.selectionText.slice(0, 20)}"`, action: () => newTab(normalize(prm.selectionText)) });
      items.push({ label: "Select all", action: () => t.view.selectAll?.() }, "-", { label: "Bookmark this page", action: bookmark }, { label: "Find in page…", key: "Ctrl+F", action: openFind },
        { label: "View page source", action: () => newTab("view-source:" + t.url) }, { label: "Inspect element", action: () => t.view.inspectElement?.(prm.x, prm.y) });
      CF.contextMenu({ x, y }, items);
    }
    function playInAmp(url) { const name = decodeURIComponent(url.split(/[?#]/)[0].split("/").pop()); (o.onMedia || ((u, n) => CF.open("nightamp", { add: [{ name: n, url: u }], play: true })))(url, name); }
    function mainMenu(e) {
      const r = e.currentTarget.getBoundingClientRect(), q = prefs();
      CF.contextMenu({ x: r.right - 220, y: r.bottom }, [
        o.tabs === false ? null : { label: "New tab", key: "Ctrl+T", action: () => newTab(o.home || HOME) },
        o.tabs === false ? null : { label: "New private tab", key: "Ctrl+Shift+N", action: () => newTab(o.home || HOME, true) },
        { label: "New NightBrowser window", action: () => CF.open("nightbrowser") }, "-",
        { label: "Zoom in", key: "Ctrl++", disabled: !hasWebview, action: () => zoom(0.1) }, { label: "Zoom out", key: "Ctrl+-", disabled: !hasWebview, action: () => zoom(-0.1) }, { label: "Actual size", key: "Ctrl+0", disabled: !hasWebview, action: () => zoom(0) },
        { label: "Find in page…", key: "Ctrl+F", action: openFind }, { label: cur?.muted ? "Unmute tab" : "Mute tab", disabled: !hasWebview, action: () => cur && mute(cur) }, "-",
        { label: "History", items: history.length ? [...history.slice(0, 15).map(it => ({ label: (it.title || it.url).slice(0, 44), action: () => cur?.go(it.url) })), "-", { label: "Clear history", action: () => { history.length = 0; CF.store.set(KEY + ".history", []); } }] : [{ label: "(empty)", disabled: true }] },
        { label: "Bookmarks", items: q.bookmarks.length ? q.bookmarks.map(([n, u]) => ({ label: n, action: () => cur?.go(u) })) : [{ label: "(none)", disabled: true }] },
        { label: "Show bookmarks bar", checked: q.showBar, disabled: !!o.compact, action: () => { q.showBar = !q.showBar; setPrefs(q); renderBar(); } }, "-",
        { label: "Search engine", items: ENGINES.map(([n, u]) => ({ label: n, checked: q.engine === u, action: () => { q.engine = u; setPrefs(q); } })) },
        { label: "Speed dial…", action: editDial },
        { label: "Show splash screen at start", checked: q.splash, action: () => { q.splash = !q.splash; setPrefs(q); } }, "-",
        { label: "About NightBrowser", action: about },
      ]);
    }
    function zoom(d) { const v = cur?.view; if (!v?.getZoomFactor) return; v.setZoomFactor(d === 0 ? 1 : Math.max(0.3, Math.min(3, v.getZoomFactor() + d))); }
    async function editDial() {
      const q = prefs();
      const ta = h("textarea", { class: "field", rows: 10, style: "width:100%;min-width:380px;font-family:inherit" }, q.dial.map(([n, u]) => `${n} | ${u}`).join("\n"));
      const r = await CF.dialog({ title: "Speed dial", icon: "nightbrowser", message: "One site per line: Name | https://address", content: ta, buttons: ["Save", "Cancel"] });
      if (r.button !== "Save") return;
      q.dial = ta.value.split("\n").map(l => l.split("|").map(s => s.trim())).filter(([n, u]) => n && u).map(([n, u]) => [n, normalize(u, q)]);
      setPrefs(q);
      tabs.filter(t => isHome(t.url)).forEach(t => t.reload());
    }

    /* ---- NightShield ---- */
    async function updateShield() {
      const q = prefs();
      shieldBtn.classList.toggle("off", !q.shield);
      if (!hasWebview || !CF.host?.shieldStats) { shieldCount.textContent = ""; shieldBtn.title = "NightShield blocks trackers in ColeForge.exe (desktop app)."; return; }
      const s = await CF.host.shieldStats(cur?.wcId).catch(() => null);
      if (!s) return;
      shieldCount.textContent = q.shield && s.page ? String(Math.min(s.page, 999)) : "";
      shieldBtn.title = `NightShield ${q.shield ? "on" : "off"}: ${s.page || 0} tracker(s) blocked on this page, ${s.total} this session`;
    }
    function shieldMenu(e) {
      const r = e.currentTarget.getBoundingClientRect(), q = prefs();
      CF.contextMenu({ x: r.left - 120, y: r.bottom }, [
        { label: hasWebview ? "NightShield: block trackers and ads" : "NightShield needs ColeForge.exe", checked: q.shield, disabled: !hasWebview, action: () => { q.shield = !q.shield; setPrefs(q); applyShield(); updateShield(); cur?.reload(); } },
        { label: "Upgrade to HTTPS", checked: q.https, action: () => { q.https = !q.https; setPrefs(q); applyShield(); } },
      ]);
    }
    const shieldTimer = setInterval(() => { if (root.isConnected) updateShield(); else clearInterval(shieldTimer); }, 3000);

    /* ---- find in page ---- */
    const findIn = h("input", { class: "field", placeholder: "Find in page" });
    const findCount = h("span", { class: "muted" });
    findBar.append(h("img", { src: `${ART}nightbrowser/find.png`, alt: "" }), findIn, findCount,
      h("button", { class: "btn", onclick: () => doFind(false) }, "Next"), h("button", { class: "btn flat", onclick: () => doFind(true) }, "Previous"), h("button", { class: "btn flat", onclick: closeFind }, "✕"));
    findIn.addEventListener("keydown", (e) => { if (e.key === "Enter") doFind(e.shiftKey); if (e.key === "Escape") closeFind(); });
    function openFind() { findBar.hidden = false; findIn.focus(); findIn.select(); if (!hasWebview) findCount.textContent = "Find works on pages in ColeForge.exe"; }
    function doFind(back) { if (!findIn.value) return; if (cur?.view.findInPage) cur.view.findInPage(findIn.value, { forward: !back, findNext: true }); }
    function closeFind() { findBar.hidden = true; cur?.view.stopFindInPage?.("clearSelection"); }

    /* ---- screenshot ---- */
    async function screenshot() {
      if (!cur?.view.capturePage) return CF.dialog({ title: "NightBrowser", icon: "info", message: "Page screenshots work in ColeForge.exe, the desktop app." });
      const img = await cur.view.capturePage();
      const name = `Screenshot ${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.png`;
      if (CF.vfs.write(name, img.toDataURL(), "image")) CF.open("forgecraft", { file: name });
    }
    function about() {
      const w = CF.createWindow({ title: "About NightBrowser", icon: "nightbrowser", w: 580, h: 430, resizable: false });
      w.body.append(h("div", { class: "wn-about" }, h("img", { src: `${ART}nightbrowser-splash.png`, alt: "NightBrowser" }),
        h("p", {}, "NightBrowser 1.0, the NightCode web browser. An official ColeForge program, grown from Forge Browser."),
        h("p", { class: "muted" }, hasWebview ? "Chromium engine with NightShield tracker blocking and HTTPS upgrade." : "Browser mode: pages load in frames and many sites refuse. Run ColeForge.exe for the full browser.")));
    }

    /* ---- keys, messages ---- */
    root.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (e.ctrlKey && e.shiftKey && k === "n") { e.preventDefault(); if (o.tabs !== false) newTab(o.home || HOME, true); }
      else if (e.ctrlKey && k === "t" && o.tabs !== false) { e.preventDefault(); newTab(o.home || HOME); addr.focus(); }
      else if (e.ctrlKey && k === "w" && o.tabs !== false) { e.preventDefault(); cur && closeTab(cur); }
      else if (e.ctrlKey && k === "l") { e.preventDefault(); addr.focus(); }
      else if (e.ctrlKey && k === "f") { e.preventDefault(); openFind(); }
      else if (e.ctrlKey && (k === "=" || k === "+")) { e.preventDefault(); zoom(0.1); }
      else if (e.ctrlKey && k === "-") { e.preventDefault(); zoom(-0.1); }
      else if (e.ctrlKey && k === "0") { e.preventDefault(); zoom(0); }
      else if (k === "f5") { e.preventDefault(); cur?.reload(); }
      else if (e.altKey && k === "arrowleft") cur?.back();
      else if (e.altKey && k === "arrowright") cur?.forward();
    });
    const onMsg = (e) => { if (e.data && typeof e.data.forgeNav === "string") { const t = tabs.find(x => x.view.contentWindow === e.source); if (t) t.go(normalize(e.data.forgeNav)); } };
    addEventListener("message", onMsg);
    hint.append(h("span", {}, "Browser mode: many sites refuse to load inside frames, and NightShield is off. Run ColeForge.exe for the full NightBrowser, or "),
      (() => { const a = h("a", { class: "clickable" }, "open this page in your system browser"); a.addEventListener("click", () => cur && (CF.host?.openExternal ? CF.host.openExternal(cur.url) : window.open(cur.url, "_blank", "noopener"))); return a; })(), ".");

    renderBar();
    return {
      root, newTab, get current() { return cur; }, go: (u) => cur ? cur.go(normalize(u)) : newTab(normalize(u)), normalize,
      destroy() { removeEventListener("message", onMsg); clearInterval(shieldTimer); tabs.slice().forEach(t => { t.el.remove(); }); root.remove(); },
    };
  }

  CF.NightWeb = { mount, normalize, homePage, HOME };
  CF.associate(["html", "htm", "url"], "nightbrowser");

  CF.register({
    id: "nightbrowser", name: "NightBrowser", icon: "nightbrowser", desc: "NightBrowser: private, tracker-blocking web browser (NightShield, private tabs, speed dial).",
    window: { w: 1000, h: 660 },
    open(win, args) {
      if (prefs().splash) CF.appSplash({ id: "nightbrowser", image: `${ART}nightbrowser-splash.png` });
      const web = mount(win.body, { onTitle: (t, tab) => win.setTitle(`${t}${tab?.priv ? " (Private)" : ""} - NightBrowser`), onEmpty: () => win.close() });
      const open = (a) => {
        if (a.file) { const d = CF.vfs.read(a.file); if (d) return web.newTab("data:text/html;charset=utf-8," + encodeURIComponent(d.data)); }
        return web.newTab(a.url ? normalize(a.url) : HOME, !!a.private);
      };
      open(args);
      win.on("args", open);
      const target = (u) => web.newTab(u);
      win.on("focus", () => { CF.newTabTarget = target; });
      win.on("close", () => { if (CF.newTabTarget === target) CF.newTabTarget = null; web.destroy(); });
      CF.newTabTarget = target;
    },
  });
})();
