"use strict";

// Vector fallback icons. Each id may be overridden by a SpriteCook PNG at
// assets/art/icons/<id>.png; CF.icons.resolve() probes for those at boot.
(function () {
  const defs = `
    <defs>
      <linearGradient id="gGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd4ff"/><stop offset=".5" stop-color="#2d7fff"/><stop offset="1" stop-color="#0b2f86"/></linearGradient>
      <linearGradient id="gShine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <linearGradient id="gFolder" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a3"/><stop offset="1" stop-color="#e0a83a"/></linearGradient>
      <linearGradient id="gSteel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2f5fa"/><stop offset="1" stop-color="#8d98ab"/></linearGradient>
      <radialGradient id="gGlow"><stop offset="0" stop-color="#bfe3ff"/><stop offset="1" stop-color="#1f6fff" stop-opacity="0"/></radialGradient>
    </defs>`;
  const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${defs}${body}</svg>`;
  const shine = (x, y, w, h, r = 4) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#gShine)"/>`;

  const art = {
    logo: svg(`<circle cx="24" cy="24" r="22" fill="url(#gGlow)" opacity=".7"/>
      <path d="M24 4 41 14v20L24 44 7 34V14Z" fill="url(#gGlass)" stroke="#dbeeff" stroke-width="1.6"/>
      <path d="M13 22h22l-3 4h-5v5l4 4H17l4-4v-5h-5z" fill="#eaf5ff" stroke="#0b2f86" stroke-width="1"/>
      <path d="M26 8l2 6 5-3-3 5 6 1-6 2" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
      ${shine(10, 8, 28, 10, 5)}`),
    computer: svg(`<rect x="6" y="6" width="36" height="26" rx="3" fill="url(#gSteel)" stroke="#39414f"/>
      <rect x="10" y="9" width="28" height="19" rx="1.5" fill="url(#gGlass)"/>${shine(11, 10, 26, 7, 1)}
      <rect x="18" y="32" width="12" height="4" fill="#8d98ab"/><rect x="12" y="36" width="24" height="5" rx="2" fill="url(#gSteel)" stroke="#39414f"/>`),
    documents: svg(`<path d="M4 12h14l4 4h22v24a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="url(#gFolder)" stroke="#8a5d12"/>
      <rect x="12" y="10" width="22" height="20" fill="#fff" stroke="#9aa7bd" transform="rotate(-6 23 20)"/>
      <path d="M4 20h40v20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="url(#gFolder)" stroke="#8a5d12"/><rect x="8" y="22" width="32" height="4" rx="2" fill="#fff" opacity=".4"/>`),
    folder: svg(`<path d="M4 12h14l4 4h22v24a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="url(#gFolder)" stroke="#8a5d12"/><path d="M4 20h40v20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="url(#gFolder)" stroke="#8a5d12"/>`),
    recycle: svg(`<path d="M11 12h26l-3 30H14z" fill="#cfe6ff" fill-opacity=".55" stroke="#5c7fb3" stroke-width="1.5"/>
      <ellipse cx="24" cy="12" rx="14" ry="4" fill="#e9f4ff" stroke="#5c7fb3" stroke-width="1.5"/>
      <path d="M19 26l3-5 3 5m-8 5h6m7-5-3 5" fill="none" stroke="#2d7fff" stroke-width="2" stroke-linecap="round"/>`),
    forgeamp: svg(`<circle cx="24" cy="22" r="18" fill="url(#gGlass)" stroke="#dbeeff" stroke-width="1.5"/>${shine(10, 6, 28, 12, 8)}
      <path d="M21 12v14a4 4 0 1 1-2-3.4V10l10-2v5z" fill="#fff"/>
      <g fill="#7fd0ff"><rect x="10" y="40" width="4" height="6"/><rect x="16" y="37" width="4" height="9"/><rect x="22" y="39" width="4" height="7"/><rect x="28" y="35" width="4" height="11"/><rect x="34" y="38" width="4" height="8"/></g>`),
    forgevision: svg(`<rect x="5" y="16" width="38" height="26" rx="3" fill="#1b2130" stroke="#6f7c96"/>
      <path d="M5 9l36-5 2 8-36 5z" fill="#fff" stroke="#6f7c96"/><path d="M11 8l4 7m6-8 4 7m6-8 4 7" stroke="#2d7fff" stroke-width="3"/>
      <path d="M20 22v14l12-7z" fill="url(#gGlass)" stroke="#bfe3ff"/>`),
    forgecraft: svg(`<path d="M24 6C12 6 4 13 4 22c0 8 7 12 12 10 3-1 5 1 5 4 0 4 3 6 7 6 11 0 16-9 16-18S36 6 24 6z" fill="#f1e2c6" stroke="#8a6a3a"/>
      <circle cx="14" cy="18" r="3.5" fill="#2d7fff"/><circle cx="23" cy="13" r="3.5" fill="#ff8a1f"/><circle cx="33" cy="16" r="3.5" fill="#e02b3a"/><circle cx="36" cy="26" r="3.5" fill="#fff" stroke="#bbb"/>
      <path d="M18 44 38 24" stroke="#6b4a2a" stroke-width="3" stroke-linecap="round"/><path d="M38 24l4-4" stroke="#2d7fff" stroke-width="5" stroke-linecap="round"/>`),
    forgechat: svg(`<path d="M6 8h28a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H18l-8 7v-7H6a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" fill="url(#gGlass)" stroke="#dbeeff" stroke-width="1.5"/>${shine(4, 9, 32, 8, 4)}
      <path d="M26 24h16a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-2v5l-6-5h-8a4 4 0 0 1-4-4v-8a4 4 0 0 1 4-4z" fill="#fff" stroke="#6f7c96"/>
      <circle cx="16" cy="16" r="3" fill="#ffd34d"/><path d="M13 26l3-7 3 7m-5-3h4" stroke="#ffd34d" stroke-width="2" fill="none" stroke-linecap="round"/>`),
    browser: svg(`<circle cx="24" cy="24" r="17" fill="url(#gGlass)" stroke="#dbeeff" stroke-width="1.5"/>
      <path d="M7 24h34M24 7c-6 5-6 29 0 34m0-34c6 5 6 29 0 34M10 15h28M10 33h28" fill="none" stroke="#bfe3ff" stroke-width="1.2"/>${shine(12, 8, 24, 10, 6)}
      <ellipse cx="24" cy="24" rx="23" ry="8" fill="none" stroke="#fff" stroke-width="2" transform="rotate(-25 24 24)"/>`),
    notepad: svg(`<rect x="9" y="7" width="30" height="36" rx="2" fill="#fff" stroke="#6f7c96"/>
      <g stroke="#9cc8ff"><path d="M13 17h22M13 22h22M13 27h22M13 32h22M13 37h16"/></g>
      <g fill="#6f7c96">${[13, 18, 23, 28, 33].map(x => `<circle cx="${x}" cy="7" r="1.6"/>`).join("")}</g>
      <path d="M27 40 42 18l3 2-15 22-4 1z" fill="#2d7fff" stroke="#0b2f86"/>`),
    control: svg(`<rect x="5" y="7" width="38" height="34" rx="4" fill="url(#gGlass)" stroke="#dbeeff" stroke-width="1.5"/>${shine(6, 8, 36, 10, 4)}
      <circle cx="18" cy="24" r="7" fill="url(#gSteel)" stroke="#39414f"/><circle cx="18" cy="24" r="2.5" fill="#39414f"/>
      <path d="M31 16v18m6-18v18" stroke="#0b2f86" stroke-width="2"/><rect x="28" y="19" width="6" height="4" rx="1" fill="#fff"/><rect x="34" y="27" width="6" height="4" rx="1" fill="#fff"/>`),
    arcade: svg(`<path d="M8 18h32c4 0 6 4 6 10s-2 12-6 12c-3 0-5-3-8-6H16c-3 3-5 6-8 6-4 0-6-6-6-12s2-10 6-10z" fill="#2a3040" stroke="#8d98ab"/>
      <path d="M10 26h8m-4-4v8" stroke="#bfe3ff" stroke-width="2.5"/><circle cx="32" cy="24" r="2.4" fill="#2d7fff"/><circle cx="37" cy="28" r="2.4" fill="#7fd0ff"/>
      <path d="M17 11h7l-2-3m2 3-2 3M31 7h-7l2-3m-2 3 2 3" stroke="#7fd0ff" stroke-width="1.8" fill="none"/>`),
    network: svg(`<rect x="4" y="8" width="18" height="14" rx="2" fill="url(#gGlass)" stroke="#dbeeff"/><rect x="26" y="8" width="18" height="14" rx="2" fill="url(#gGlass)" stroke="#dbeeff"/>
      <path d="M13 22v6h22v-6M24 28v8" stroke="#8d98ab" stroke-width="2" fill="none"/><circle cx="24" cy="38" r="5" fill="url(#gSteel)" stroke="#39414f"/>`),
    doom: svg(`<rect x="2" y="6" width="44" height="36" rx="3" fill="#2a0604" stroke="#ff5b1f"/><path d="M2 30c8-4 12 2 20-2s14 0 24-4v18H2z" fill="#ff5b1f" opacity=".7"/>
      <text x="24" y="27" font-family="Impact,sans-serif" font-size="14" text-anchor="middle" fill="#ffcc4d" stroke="#8a1a06" stroke-width=".8">DOOM</text>`),
    quake: svg(`<rect x="2" y="6" width="44" height="36" rx="3" fill="#2b2418" stroke="#a88a54"/><circle cx="24" cy="22" r="11" fill="none" stroke="#c9a567" stroke-width="3"/><path d="M24 11v26m-4 0h8" stroke="#c9a567" stroke-width="3"/>`),
    duke: svg(`<rect x="2" y="6" width="44" height="36" rx="3" fill="#1c1c1c" stroke="#ffd34d"/><path d="M24 10l3 9h9l-7 6 3 9-8-6-8 6 3-9-7-6h9z" fill="#ffd34d"/>`),
    info: svg(`<circle cx="24" cy="24" r="20" fill="url(#gGlass)" stroke="#dbeeff" stroke-width="1.5"/>${shine(9, 6, 30, 14, 10)}<circle cx="24" cy="14" r="3" fill="#fff"/><rect x="21" y="20" width="6" height="16" rx="2" fill="#fff"/>`),
    warning: svg(`<path d="M24 4 45 42H3z" fill="#ffd34d" stroke="#8a5d12" stroke-width="1.5" stroke-linejoin="round"/><rect x="21.5" y="16" width="5" height="14" rx="2" fill="#1b1b1b"/><circle cx="24" cy="35" r="2.8" fill="#1b1b1b"/>`),
    question: svg(`<circle cx="24" cy="24" r="20" fill="url(#gGlass)" stroke="#dbeeff" stroke-width="1.5"/>${shine(9, 6, 30, 14, 10)}<path d="M18 18a6 6 0 1 1 9 5c-2 1-3 2-3 5" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="35" r="2.8" fill="#fff"/>`),
    error: svg(`<circle cx="24" cy="24" r="20" fill="#e0293a" stroke="#ffd0d4" stroke-width="1.5"/>${shine(9, 6, 30, 14, 10)}<path d="M16 16l16 16m0-16L16 32" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`),
    volume: svg(`<path d="M6 18h8l10-8v28l-10-8H6z" fill="#e6f3ff"/><path d="M30 16a10 10 0 0 1 0 16m5-21a16 16 0 0 1 0 26" fill="none" stroke="#e6f3ff" stroke-width="3" stroke-linecap="round"/>`),
    file: svg(`<path d="M10 4h20l10 10v30H10z" fill="#fff" stroke="#6f7c96"/><path d="M30 4v10h10" fill="#dbe6f5" stroke="#6f7c96"/><g stroke="#9cc8ff"><path d="M15 22h20M15 27h20M15 32h14"/></g>`),
    image: svg(`<rect x="4" y="8" width="40" height="32" rx="3" fill="#fff" stroke="#6f7c96"/><rect x="8" y="12" width="32" height="24" fill="#bfe3ff"/><circle cx="16" cy="19" r="3.5" fill="#ffd34d"/><path d="M8 36l10-11 7 7 5-5 10 9z" fill="#2d7fff"/>`),
    run: svg(`<rect x="5" y="8" width="38" height="32" rx="3" fill="#1b2130" stroke="#8d98ab"/><path d="M11 18l6 5-6 5M20 30h12" stroke="#7fd0ff" stroke-width="2.5" fill="none" stroke-linecap="round"/>`),
    shutdown: svg(`<circle cx="24" cy="26" r="15" fill="none" stroke="#ff6b5b" stroke-width="4" stroke-dasharray="72 22" transform="rotate(-72 24 26)"/><path d="M24 6v18" stroke="#ff6b5b" stroke-width="4" stroke-linecap="round"/>`),
  };

  const src = {};
  const dataUrl = (id) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(art[id] || art.file);
  for (const id of Object.keys(art)) src[id] = dataUrl(id);

  window.CFIcons = {
    ids: Object.keys(art),
    get: (id) => src[id] || src.file,
    // Swap in raster art for any icon that has a PNG on disk (SpriteCook exports).
    resolve() {
      return Promise.all(Object.keys(art).map(id => new Promise(done => {
        const img = new Image();
        img.onload = () => { src[id] = img.src; done(); };
        img.onerror = done;
        img.src = `assets/art/icons/${id}.png`;
      })));
    },
  };
})();
