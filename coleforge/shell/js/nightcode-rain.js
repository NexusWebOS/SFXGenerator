"use strict";

// NightCode code rain: the animated NightCode background. Standalone (no ColeForge dependencies) so
// the same file drives the screen saver, the "NightCode Live" desktop wallpaper and the Lively
// Wallpaper package in coleforge/lively/.
//
//   const rain = NightCodeRain(element, { logo: "fixed", logoX: 0.62 });
//   rain.set({ speed: 1.5 });   rain.stop();
//
// The rain layer fades to transparent, so whatever is behind `element` (a colour or a picture)
// shows through. The logo is drawn on its own layer with a breathing glow.
(function (global) {
  const DEFAULTS = {
    logoSrc: "assets/art/nightcode/logo.png",
    logo: "drift",        // "drift" (screen saver), "fixed" (wallpaper) or "off"
    logoX: 0.5, logoY: 0.5, logoSize: 0.42,  // fixed position (fractions) and size (fraction of the shorter side)
    speed: 1,             // rain speed multiplier
    density: 110,         // columns across a 1920px-wide screen
    head: "#bff4ff", trail: ["#1e78ff", "#1e78ff", "#31d7e8"],
    fade: 0.12,           // how fast trails fade (per frame at 60 fps)
    rainOpacity: 1,
    fps: 60,              // frame cap; 30 keeps a desktop wallpaper light on the CPU
    font: '"Share Tech Mono", Consolas, "Lucida Console", monospace',
    paused: () => false,  // return true to skip frames (e.g. a maximized window covers the desktop)
  };
  const GLYPHS = "01ABCDEF<>{}[]/\\=+*#$%&;:NIGHTCODE0x7F".split("");

  function NightCodeRain(host, options) {
    const o = Object.assign({}, DEFAULTS, options);
    const doc = host.ownerDocument;
    const mk = (cls) => { const c = doc.createElement("canvas"); c.className = cls; c.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none"; host.append(c); return c; };
    const rainCv = mk("ncr-rain"), logoCv = mk("ncr-logo");
    const ctx = rainCv.getContext("2d"), lctx = logoCv.getContext("2d");
    const reduced = global.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, dpr = 1, size = 16, cols = [], frame = 0, raf = 0, last = 0, stopped = false;
    let logoImg = null, glow = null;

    function loadLogo() {
      logoImg = null; glow = null;
      if (o.logo === "off" || !o.logoSrc) return;
      const img = new Image();
      img.onload = () => { logoImg = img; prerender(); };
      img.src = o.logoSrc;
    }
    // Pre-render the glow once; each frame only changes its opacity.
    function prerender() {
      if (!logoImg || !w) return;
      const s = logoSide(), pad = Math.round(s * 0.18);
      glow = doc.createElement("canvas");
      glow.width = Math.round(s + pad * 2); glow.height = Math.round(s * logoImg.naturalHeight / logoImg.naturalWidth + pad * 2);
      const g = glow.getContext("2d");
      g.shadowColor = "#1e78ff"; g.shadowBlur = pad * 0.9;
      g.drawImage(logoImg, pad, pad, s, s * logoImg.naturalHeight / logoImg.naturalWidth);
    }
    const logoSide = () => Math.min(w, h) * o.logoSize;

    function resize() {
      dpr = Math.min(2, global.devicePixelRatio || 1);
      const r = host.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width * dpr)); h = Math.max(1, Math.round(r.height * dpr));
      rainCv.width = logoCv.width = w; rainCv.height = logoCv.height = h;
      size = Math.round(Math.max(14, r.width / o.density) * dpr);
      cols = Array.from({ length: Math.ceil(w / size) }, () => ({ y: -Math.random() * h / size, speed: 0.25 + Math.random() * 0.6 }));
      prerender();
      if (reduced) drawStill();
    }

    function drawRain() {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = `rgba(0,0,0,${o.fade})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = o.rainOpacity;
      ctx.font = `${size}px ${o.font}`;
      const trail = [].concat(o.trail);
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i], x = i * size, y = c.y * size;
        ctx.fillStyle = o.head; ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], x, y);
        ctx.fillStyle = trail[i % trail.length]; ctx.fillText(GLYPHS[(i + frame) % GLYPHS.length], x, y - size);
        c.y += c.speed * o.speed;
        if (y > h && Math.random() > 0.975) { c.y = 0; c.speed = 0.25 + Math.random() * 0.6; }
      }
      ctx.globalAlpha = 1;
    }

    function drawLogo() {
      lctx.clearRect(0, 0, w, h);
      if (!logoImg || !glow || o.logo === "off") return;
      const s = logoSide(), lh = s * logoImg.naturalHeight / logoImg.naturalWidth, t = frame / 240;
      let x, y;
      if (o.logo === "drift") {
        x = w / 2 + Math.sin(t * 0.7) * w * 0.22 - s / 2; y = h / 2 + Math.sin(t * 1.1) * h * 0.18 - lh / 2;
      } else {
        x = w * o.logoX - s / 2; y = h * o.logoY - lh / 2 + Math.sin(t * 1.3) * h * 0.006; // a slow hover
      }
      const pad = (glow.width - s) / 2, breathe = 0.5 + 0.5 * Math.sin(frame / 50);
      lctx.globalAlpha = 0.35 + 0.65 * breathe;
      lctx.drawImage(glow, x - pad, y - pad);
      lctx.globalAlpha = o.logo === "drift" ? 0.75 + 0.25 * breathe : 1;
      lctx.drawImage(logoImg, x, y, s, lh);
      lctx.globalAlpha = 1;
    }

    function drawStill() {
      ctx.clearRect(0, 0, w, h);
      for (let k = 0; k < 90; k++) { frame++; drawRain(); }
      drawLogo();
    }

    function tick(now) {
      if (stopped) return;
      raf = global.requestAnimationFrame(tick);
      if (reduced || doc.hidden || o.paused()) return;
      if (now - last < 1000 / o.fps - 2) return;
      // At 30 fps, move and fade twice as far per frame so the look matches 60 fps.
      const steps = Math.max(1, Math.round(60 / o.fps));
      last = now;
      for (let k = 0; k < steps; k++) { frame++; drawRain(); }
      drawLogo();
    }

    const ro = global.ResizeObserver ? new ResizeObserver(resize) : null;
    ro ? ro.observe(host) : global.addEventListener("resize", resize);
    resize();
    loadLogo();
    raf = global.requestAnimationFrame(tick);

    return {
      set(next) {
        const logoChanged = "logoSrc" in next || ("logo" in next && next.logo !== o.logo);
        Object.assign(o, next);
        if ("density" in next) resize();
        if ("logoSize" in next) prerender();
        if (logoChanged) loadLogo();
      },
      stop() {
        stopped = true;
        global.cancelAnimationFrame(raf);
        ro ? ro.disconnect() : global.removeEventListener("resize", resize);
        rainCv.remove(); logoCv.remove();
      },
    };
  }

  global.NightCodeRain = NightCodeRain;
})(window);
