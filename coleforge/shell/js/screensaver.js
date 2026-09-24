"use strict";

// NightCode screen saver: neon code rain (js/nightcode-rain.js) with the NightCode logo drifting through it.
// Starts after settings.saverMinutes of no input (Control Panel → Display → Screen saver),
// never while a video is playing, and stops on any key, click or real mouse movement.
(function () {
  const { h, settings } = CF;
  let idleTimer = null, active = null;

  CF.SAVERS = [["nightcode", "NightCode Code Rain"], ["none", "(None)"]];

  function start() {
    if (active) return;
    const wrap = h("div", { id: "screensaver-wrap" });
    document.body.append(wrap);
    const rain = NightCodeRain(wrap, { logo: "drift" });
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
      rain.stop();
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
