"use strict";

// Forge Browser: tabbed browser shell. Uses Electron <webview> when running as the desktop
// host (full browsing + native right-click menu); falls back to <iframe> in browser mode.
(function () {
  const { h } = CF;
  const HOME = "forge://home";
  const DEFAULT_FAVS = [["ColeForge Home", HOME], ["Zandronum", "https://zandronum.com/"], ["Freedoom", "https://freedoom.github.io/"], ["Archive.org", "https://archive.org/"], ["Wikipedia", "https://en.wikipedia.org/"]];
  const hasWebview = !!(CF.host && CF.host.webview);
  // Pop-ups from web pages open as tabs in the most recent browser window (routed by core.js).

  function homePage() {
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      body{margin:0;min-height:100vh;display:grid;place-items:center;font:14px Tahoma,Segoe UI,sans-serif;color:#e8f1ff;background:radial-gradient(circle at 50% 30%,#1d3f86,#050b1c 70%)}
      .c{text-align:center;width:min(640px,92vw)}h1{font-size:44px;margin:0;background:linear-gradient(#fff,#a9c6ee);-webkit-background-clip:text;color:transparent}
      h2{margin:0 0 22px;color:#5fb4ff;font-weight:600}form{display:flex;gap:6px}input{flex:1;padding:10px 12px;border-radius:6px;border:1px solid #7fb8ff;background:#06122a;color:#fff;font-size:15px}
      button{padding:10px 18px;border-radius:6px;border:1px solid #9fd4ff;background:linear-gradient(#4f97ff,#1450c8);color:#fff;font-weight:700}
      .t{margin-top:26px;font:12px Lucida Console,monospace;letter-spacing:.2em;color:#9fb2d4}.g{display:flex;gap:10px;justify-content:center;margin-top:22px;flex-wrap:wrap}
      .g a{padding:8px 14px;border:1px solid #3c6bb5;border-radius:6px;color:#bfe3ff;text-decoration:none;background:rgba(255,255,255,.05)}</style></head>
      <body><div class="c"><h1>ColeForge</h1><h2>Forge Browser</h2>
      <script>function nav(v){if(parent!==window)parent.postMessage({forgeNav:v},'*');else console.log('forgeNav:'+v);return false}<\/script>
      <form onsubmit="return nav(this.q.value)"><input name="q" placeholder="Search the web or type a URL" autofocus><button>Go</button></form>
      <div class="g"><a href="#" onclick="return nav('https://freedoom.github.io/')">Freedoom</a><a href="#" onclick="return nav('https://archive.org/')">Archive.org</a><a href="#" onclick="return nav('https://en.wikipedia.org/')">Wikipedia</a></div>
      <div class="t">FASTER. CLEANER. MORE COMPATIBLE. STILL YOURS.</div></div></body></html>`;
  }
  function normalize(input) {
    const v = input.trim();
    if (!v) return HOME;
    if (v === HOME || /^[a-z]+:\/\//i.test(v)) return v;
    if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(v) || /^localhost(:\d+)?/.test(v)) return "https://" + v;
    return (CF.store.get("cf.browser.search", "https://duckduckgo.com/?q=")) + encodeURIComponent(v);
  }

  CF.register({
    id: "browser", name: "Forge Browser", icon: "browser", desc: "Tabbed web browser.",
    window: { w: 960, h: 640 },
    open(win, args) {
      const tabs = [];
      let cur = null;
      const favs = CF.store.get("cf.browser.favs", DEFAULT_FAVS);
      const history = CF.store.get("cf.browser.history", []);
      const tabBar = h("div", { class: "br-tabs" });
      const addr = h("input", { class: "field br-addr", spellcheck: "false" });
      const btn = (g, t, fn) => h("button", { class: "tool", title: t, onclick: fn }, h("b", {}, g));
      const favBar = h("div", { class: "br-favs" });
      const pages = h("div", { class: "br-pages" });
      const hint = h("div", { class: "br-hint" });
      win.body.append(h("div", { class: "br" }, tabBar,
        h("div", { class: "toolbar" }, btn("◀", "Back", () => cur?.back()), btn("▶", "Forward", () => cur?.forward()), btn("⟳", "Reload", () => cur?.reload()), btn("⌂", "Home", () => cur?.go(HOME)),
          addr, btn("☆", "Add to Favorites", addFav), btn("↗", "Open in system browser", () => cur && openExternal(cur.url))),
        favBar, hint, pages));
      addr.addEventListener("keydown", (e) => { if (e.key === "Enter") cur?.go(normalize(addr.value)); });
      addr.addEventListener("focus", () => addr.select());

      function openExternal(url) {
        if (url === HOME) return;
        if (CF.host && CF.host.openExternal) CF.host.openExternal(url); else window.open(url, "_blank", "noopener");
      }
      function renderFavs() {
        favBar.replaceChildren(...favs.map(([name, url], i) => {
          const f = h("span", { class: "br-fav clickable", title: url }, "★ " + name);
          f.addEventListener("click", () => cur?.go(url));
          f.addEventListener("contextmenu", (e) => { e.preventDefault(); CF.contextMenu({ x: e.clientX, y: e.clientY }, [{ label: "Open in new tab", action: () => newTab(url) }, { label: "Remove", action: () => { favs.splice(i, 1); CF.store.set("cf.browser.favs", favs); renderFavs(); } }]); });
          return f;
        }));
      }
      function addFav() {
        if (!cur) return;
        favs.push([cur.title.slice(0, 24) || cur.url, cur.url]);
        CF.store.set("cf.browser.favs", favs); renderFavs();
      }
      function pushHistory(url, title) {
        if (url === HOME) return;
        history.unshift({ url, title, ts: Date.now() });
        history.length = Math.min(history.length, 200);
        CF.store.set("cf.browser.history", history);
      }
      function renderTabs() {
        tabBar.replaceChildren(...tabs.map(t => {
          const el = h("div", { class: "br-tab clickable" + (t === cur ? " on" : "") }, h("img", { src: CF.icon("browser"), alt: "" }), h("span", {}, t.title || "New Tab"), h("span", { class: "br-x clickable", title: "Close tab" }, "✕"));
          el.addEventListener("click", (e) => { if (e.target.classList.contains("br-x")) closeTab(t); else select(t); });
          el.addEventListener("auxclick", (e) => { if (e.button === 1) closeTab(t); });
          el.addEventListener("contextmenu", (e) => { e.preventDefault(); CF.contextMenu({ x: e.clientX, y: e.clientY }, [{ label: "New Tab", key: "Ctrl+T", action: () => newTab(HOME) }, { label: "Duplicate", action: () => newTab(t.url) }, { label: "Reload", action: () => t.reload() }, "-", { label: "Close Tab", key: "Ctrl+W", action: () => closeTab(t) }]); });
          return el;
        }), (() => { const p = h("div", { class: "br-tab br-new clickable", title: "New tab" }, "+"); p.addEventListener("click", () => newTab(HOME)); return p; })());
      }
      function select(t) {
        cur = t;
        tabs.forEach(o => { o.el.style.display = o === t ? "" : "none"; });
        addr.value = t.url === HOME ? "" : t.url;
        win.setTitle(`${t.title || "New Tab"} - Forge Browser`);
        hint.style.display = !hasWebview && t.url !== HOME ? "" : "none";
        renderTabs();
      }
      function closeTab(t) {
        const i = tabs.indexOf(t);
        tabs.splice(i, 1); t.el.remove();
        if (!tabs.length) return win.close();
        if (t === cur) select(tabs[Math.min(i, tabs.length - 1)]); else renderTabs();
      }

      function browserContextMenu(t, x, y, p) {
        const items = [
          { label: "Back", disabled: !t.canBack(), action: () => t.back() }, { label: "Forward", disabled: !t.canForward(), action: () => t.forward() }, { label: "Reload", action: () => t.reload() }, "-",
        ];
        if (p.linkURL) items.push({ label: "Open link in new tab", action: () => newTab(p.linkURL) }, { label: "Copy link address", action: () => navigator.clipboard?.writeText(p.linkURL) }, "-");
        if (p.srcURL && p.mediaType === "image") items.push({ label: "Open image in new tab", action: () => newTab(p.srcURL) }, { label: "Save image as…", action: () => t.view.downloadURL?.(p.srcURL) }, { label: "Edit image in Forgecraft", action: () => CF.open("forgecraft", { dataUrl: p.srcURL, name: "web-image.png" }) }, "-");
        if (p.isEditable) items.push({ label: "Cut", action: () => t.view.cut?.() }, { label: "Paste", action: () => t.view.paste?.() });
        if (p.selectionText) items.push({ label: "Copy", action: () => t.view.copy?.() }, { label: `Search for "${p.selectionText.slice(0, 20)}"`, action: () => newTab(normalize(p.selectionText)) });
        items.push({ label: "Select all", action: () => t.view.selectAll?.() }, "-", { label: "Add page to Favorites", action: addFav }, { label: "Open in system browser", action: () => openExternal(t.url) });
        if (hasWebview) items.push({ label: "View page source", action: () => newTab("view-source:" + t.url) }, { label: "Inspect element", action: () => t.view.inspectElement?.(p.x, p.y) });
        CF.contextMenu({ x, y }, items);
      }

      function newTab(url = HOME) {
        const t = { url, title: "New Tab", stack: [], pos: -1 };
        if (hasWebview) {
          const wv = document.createElement("webview");
          wv.setAttribute("allowpopups", "");
          wv.className = "br-view";
          t.view = wv; t.el = wv;
          t.go = (u) => { t.url = u; if (u === HOME) wv.src = "data:text/html;charset=utf-8," + encodeURIComponent(homePage()); else wv.src = u; };
          t.back = () => wv.canGoBack() && wv.goBack(); t.forward = () => wv.canGoForward() && wv.goForward(); t.reload = () => wv.reload();
          t.canBack = () => { try { return wv.canGoBack(); } catch { return false; } }; t.canForward = () => { try { return wv.canGoForward(); } catch { return false; } };
          wv.addEventListener("did-navigate", (e) => { if (!e.url.startsWith("data:")) { t.url = e.url; pushHistory(e.url, t.title); } if (t === cur) addr.value = t.url === HOME ? "" : t.url; });
          wv.addEventListener("did-navigate-in-page", (e) => { if (e.isMainFrame) { t.url = e.url; if (t === cur) addr.value = e.url; } });
          wv.addEventListener("page-title-updated", (e) => { t.title = e.title; if (t === cur) win.setTitle(`${e.title} - Forge Browser`); renderTabs(); });
          wv.addEventListener("console-message", (e) => { const m = /^forgeNav:(.*)$/.exec(e.message); if (m) t.go(normalize(m[1])); });
          wv.addEventListener("context-menu", (e) => { const r = wv.getBoundingClientRect(); browserContextMenu(t, r.left + e.params.x, r.top + e.params.y, e.params); });
        } else {
          const fr = h("iframe", { class: "br-view", referrerpolicy: "no-referrer", allow: "fullscreen; autoplay; clipboard-write" });
          t.view = fr; t.el = fr;
          const load = () => {
            const u = t.stack[t.pos];
            t.url = u;
            if (u === HOME) { fr.removeAttribute("src"); fr.srcdoc = homePage(); t.title = "ColeForge Home"; }
            else { fr.removeAttribute("srcdoc"); fr.src = u; t.title = u.replace(/^https?:\/\//, "").split("/")[0]; pushHistory(u, t.title); }
            if (t === cur) select(t); else renderTabs();
          };
          t.go = (u) => { t.stack.splice(t.pos + 1); t.stack.push(u); t.pos++; load(); };
          t.back = () => { if (t.pos > 0) { t.pos--; load(); } }; t.forward = () => { if (t.pos < t.stack.length - 1) { t.pos++; load(); } }; t.reload = () => load();
          t.canBack = () => t.pos > 0; t.canForward = () => t.pos < t.stack.length - 1;
          fr.addEventListener("load", () => { try { const d = fr.contentDocument; if (d && d.title) { t.title = d.title; renderTabs(); } } catch { /* cross-origin */ } });
        }
        pages.append(t.el);
        tabs.push(t); select(t);
        t.go(url);
        return t;
      }
      // Messages from the built-in home page search box (iframe mode).
      const onMsg = (e) => { if (e.data && typeof e.data.forgeNav === "string") { const t = tabs.find(x => x.view.contentWindow === e.source); (t || cur)?.go(normalize(e.data.forgeNav)); } };
      addEventListener("message", onMsg);

      win.menubar([
        { label: "File", items: [{ label: "New Tab", key: "Ctrl+T", action: () => newTab(HOME) }, { label: "New Window", action: () => CF.open("browser") }, "-", { label: "Close Tab", key: "Ctrl+W", action: () => cur && closeTab(cur) }, { label: "Close", action: () => win.close() }] },
        { label: "Favorites", items: () => [{ label: "Add to Favorites", action: addFav }, "-", ...favs.map(([n, u]) => ({ label: n, action: () => cur?.go(u) }))] },
        { label: "History", items: () => history.length ? [...history.slice(0, 15).map(it => ({ label: (it.title || it.url).slice(0, 40), action: () => cur?.go(it.url) })), "-", { label: "Clear History", action: () => { history.length = 0; CF.store.set("cf.browser.history", history); } }] : [{ label: "(empty)", disabled: true }] },
        { label: "Tools", items: [{ label: "Search engine…", action: async () => { const r = await CF.dialog({ title: "Search Engine", icon: "browser", message: "Search URL prefix (query is appended):", input: CF.store.get("cf.browser.search", "https://duckduckgo.com/?q="), buttons: ["Save", "Cancel"] }); if (r.button === "Save") CF.store.set("cf.browser.search", r.value.trim()); } }] },
      ]);
      hint.append(h("span", {}, "Browser mode: many sites refuse to load inside frames. Run ColeForge through its desktop host for full browsing, or "), (() => { const a = h("a", { class: "clickable" }, "open this page in your system browser"); a.addEventListener("click", () => cur && openExternal(cur.url)); return a; })(), ".");
      win.el.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.key.toLowerCase() === "t") { e.preventDefault(); newTab(HOME); addr.focus(); }
        else if (e.ctrlKey && e.key.toLowerCase() === "w") { e.preventDefault(); cur && closeTab(cur); }
        else if (e.ctrlKey && e.key.toLowerCase() === "l") { e.preventDefault(); addr.focus(); }
      });
      win.on("args", (a) => a.url && newTab(normalize(a.url)));
      win.on("focus", () => { CF.newTabTarget = newTab; });
      win.on("close", () => { removeEventListener("message", onMsg); if (CF.newTabTarget === newTab) CF.newTabTarget = null; });
      CF.newTabTarget = newTab;
      renderFavs();
      newTab(args.url ? normalize(args.url) : HOME);
    },
  });
})();
