"use strict";

// NightCode screen saver: neon code rain with the NightCode logo drifting through it.
// Starts after settings.saverMinutes of no input (Control Panel → Display → Screen saver),
// never while a video is playing, and stops on any key, click or real mouse movement.
(function () {
  const { h, settings } = CF;
  const GLYPHS = "01ABCDEF<>{}[]/\\=+*#$%&;:NIGHTCODE0x7F".split("");
  let idleTimer = null, active = null;

  CF.SAVERS = [["nightcode", "NightCode Code Rain"], ["none", "(None)"]];

  function start() {
    if (active) return;
    // Two layers: the rain keeps fading trails; the logo is redrawn clean on top every frame.
    const canvas = h("canvas", { id: "screensaver" }), top = h("canvas", { class: "saver-top" });
    const wrap = h("div", { id: "screensaver-wrap" }, canvas, top);
    document.body.append(wrap);
    const ctx = canvas.getContext("2d"), tctx = top.getContext("2d");
    const logo = new Image();
    logo.src = "assets/art/nightcode/logo.png";
    let cols = [], size = 16, w = 0, ht = 0, frame = 0, raf = 0;
    const resize = () => {
      w = canvas.width = top.width = innerWidth; ht = canvas.height = top.height = innerHeight;
      size = Math.max(14, Math.round(w / 110));
      cols = Array.from({ length: Math.ceil(w / size) }, () => ({ y: -Math.random() * ht / size, speed: 0.25 + Math.random() * 0.6 }));
      ctx.fillStyle = "#02050e"; ctx.fillRect(0, 0, w, ht);
    };
    resize();
    addEventListener("resize", resize);
    const draw = () => {
      frame++;
      ctx.fillStyle = "rgba(2, 5, 14, 0.12)";
      ctx.fillRect(0, 0, w, ht);
      ctx.font = `${size}px "Share Tech Mono", Consolas, monospace`;
      cols.forEach((c, i) => {
        const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        const x = i * size, y = c.y * size;
        ctx.fillStyle = "#bff4ff"; ctx.fillText(ch, x, y);
        ctx.fillStyle = i % 3 ? "#1e78ff" : "#31d7e8"; ctx.fillText(GLYPHS[(i + frame) % GLYPHS.length], x, y - size);
        c.y += c.speed;
        if (y > ht && Math.random() > 0.975) { c.y = 0; c.speed = 0.25 + Math.random() * 0.6; }
      });
      tctx.clearRect(0, 0, w, ht);
      if (logo.complete && logo.naturalWidth) {
        // Slow Lissajous drift with a breathing glow.
        const t = frame / 240, s = Math.min(w, ht) * 0.42;
        const lx = w / 2 + Math.sin(t * 0.7) * w * 0.22 - s / 2, ly = ht / 2 + Math.sin(t * 1.1) * ht * 0.18 - s / 2;
        tctx.save();
        tctx.globalAlpha = 0.75 + 0.25 * Math.sin(frame / 50);
        tctx.shadowColor = "#1e78ff"; tctx.shadowBlur = 40;
        tctx.drawImage(logo, lx, ly, s, s * logo.naturalHeight / logo.naturalWidth);
        tctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    let moved = 0, last = null;
    const stop = (e) => {
      if (e.type === "mousemove") {
        if (last) moved += Math.abs(e.clientX - last[0]) + Math.abs(e.clientY - last[1]);
        last = [e.clientX, e.clientY];
        if (moved < 24) return; // ignore a nudge or sensor jitter
      }
      e.preventDefault?.();
      finish();
    };
    const events = ["mousemove", "mousedown", "keydown", "wheel", "touchstart"];
    const finish = () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
      events.forEach(ev => removeEventListener(ev, stop, true));
      wrap.remove();
      active = null;
      arm();
    };
    // Let the event that started a preview finish first.
    setTimeout(() => events.forEach(ev => addEventListener(ev, stop, { capture: true, passive: false })), 400);
    active = { finish };
    clearTimeout(idleTimer);
  }

  function videoPlaying() {
    return [...document.querySelectorAll("video")].some(v => !v.paused && !v.ended);
  }

  function arm() {
    clearTimeout(idleTimer);
    if (active || settings.screensaver === "none") return;
    const minutes = Math.max(1, +settings.saverMinutes || 10);
    idleTimer = setTimeout(() => {
      if (videoPlaying() || document.getElementById("welcome") || document.getElementById("boot")) return arm();
      start();
    }, minutes * 60000);
  }

  CF.screensaver = { start, arm, get active() { return !!active; } };
  let lastArm = 0;
  ["mousemove", "mousedown", "keydown", "wheel", "touchstart"].forEach(ev => addEventListener(ev, () => {
    if (!active && Date.now() - lastArm > 1000) { lastArm = Date.now(); arm(); }
  }, { passive: true }));
  CF.on("logon", arm);
  arm();
})();
