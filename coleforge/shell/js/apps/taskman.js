"use strict";

// Task Manager (Ctrl+Shift+Esc): the open programs, with End Task that works even when a program's
// own close code fails, and live performance: how busy the desktop is, memory, frame rate and storage.
(function () {
  const { h } = CF;
  const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(0, Math.round(n / 1024))} KB`);

  // Close a window; if its program's close handlers throw, take it off the desktop anyway.
  CF.endTask = async (w) => {
    try { await w.close(true); } catch (e) { console.warn("End Task:", e); }
    if (CF.windows.includes(w)) {
      try { w.el.remove(); w.taskBtn?.remove(); } catch { /* gone */ }
      CF.windows = CF.windows.filter((o) => o !== w);
    }
  };

  // Local storage use per key (ColeForge keeps settings, documents and chats there).
  function storageUse() {
    const rows = [];
    let total = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i), v = localStorage.getItem(k) || "";
        const bytes = (k.length + v.length) * 2;
        total += bytes; rows.push([k, bytes]);
      }
    } catch { /* storage blocked */ }
    return { total, rows: rows.sort((a, b) => b[1] - a[1]) };
  }
  const LABELS = { "cf.vfs": "My Documents + Recycle Bin", "cf.albert.chat": "Albert's chat", "cf.albert.memory": "Albert's memory", "cf.nightamp": "NightAmp playlist and settings",
    "cf.settings": "Desktop settings", "cf.sfxlab": "SFX Lab", "cf.nightbrowser": "NightBrowser", "cf.nightcodeNet.config": "NightCode Net" };

  CF.register({
    id: "taskman", name: "Task Manager", icon: "taskman", single: true,
    desc: "Task Manager: see and end running programs, and watch the desktop's performance and storage.",
    window: { w: 560, h: 480 },
    open(win) {
      let tab = "apps";
      const tabs = h("div", { class: "tm-tabs" }, [["apps", "Applications"], ["perf", "Performance"], ["storage", "Storage"], ["about", "About"]].map(([id, label]) =>
        h("button", { class: "tm-tab", "data-tab": id, onclick: () => { tab = id; paint(); } }, label)));
      const body = h("div", { class: "tm-body" });
      const foot = h("div", { class: "tm-foot" });
      win.body.append(h("div", { class: "tm" }, tabs, body, foot));

      /* ---------- Applications ---------- */
      let selected = null;
      const list = h("div", { class: "tm-list" });
      const endBtn = h("button", { class: "btn", onclick: async () => { const w = CF.windows.find((x) => x.id === selected); if (w) { await CF.endTask(w); CF.toast({ title: "Task Manager", body: `Ended ${CF.apps[w.appId]?.name || "the program"}.`, icon: "taskman" }); } paint(); } }, "End Task");
      const switchBtn = h("button", { class: "btn", onclick: () => { const w = CF.windows.find((x) => x.id === selected); if (w) { w.restore(); w.focus(); } } }, "Switch To");
      const newBtn = h("button", { class: "btn", onclick: () => CF.runDialog ? CF.runDialog() : CF.toggleStart(true) }, "New Task…");
      function apps() {
        const rows = CF.windows.filter((w) => w !== win).map((w) => {
          const a = CF.apps[w.appId] || {};
          const status = w.el.classList.contains("min") ? "Minimized" : w.el.classList.contains("active") ? "Running (active)" : "Running";
          const title = w.el.querySelector(".titlebar .title, .title")?.textContent || a.name || w.appId;
          const row = h("div", { class: "tm-row clickable" + (selected === w.id ? " sel" : "") }, h("img", { src: CF.icon(a.icon || "logo"), alt: "" }), h("span", { class: "tm-name" }, a.name || w.appId), h("span", { class: "tm-title muted" }, title), h("span", { class: "tm-status" }, status));
          row.addEventListener("click", () => { selected = w.id; paint(); });
          row.addEventListener("dblclick", () => { w.restore(); w.focus(); });
          return row;
        });
        list.replaceChildren(h("div", { class: "tm-row tm-head" }, h("span"), h("span", { class: "tm-name" }, "Program"), h("span", { class: "tm-title" }, "Window"), h("span", { class: "tm-status" }, "Status")),
          ...(rows.length ? rows : [h("p", { class: "muted", style: "padding:10px" }, "No other programs are open.")]));
        endBtn.disabled = switchBtn.disabled = !CF.windows.some((x) => x.id === selected);
        body.replaceChildren(list, h("div", { class: "row tm-btns" }, endBtn, switchBtn, newBtn));
      }

      /* ---------- Performance ---------- */
      const N = 60;
      const hist = { busy: Array(N).fill(0), fps: Array(N).fill(0), heap: Array(N).fill(0) };
      let frames = 0, lastTick = performance.now(), lagSum = 0, lagN = 0;
      const graph = (vals, max, color, label, value) => {
        const c = h("canvas", { class: "tm-graph", width: 240, height: 80 });
        const g = c.getContext("2d");
        g.fillStyle = "#02050e"; g.fillRect(0, 0, 240, 80);
        g.strokeStyle = "#0f3a2a"; for (let x = 0; x < 240; x += 20) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, 80); g.stroke(); }
        for (let y = 0; y < 80; y += 20) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(240, y + 0.5); g.stroke(); }
        g.strokeStyle = color; g.lineWidth = 2; g.beginPath();
        vals.forEach((v, i) => { const x = i * 240 / (N - 1), y = 78 - Math.min(1, v / max) * 76; i ? g.lineTo(x, y) : g.moveTo(x, y); });
        g.stroke();
        return h("div", { class: "tm-card" }, h("div", { class: "tm-card-h" }, h("b", {}, label), h("span", {}, value)), c);
      };
      function perf() {
        const mem = performance.memory;
        const busy = hist.busy[N - 1], fps = hist.fps[N - 1];
        const cards = [graph(hist.busy, 100, "#3cff9e", "Desktop busy", `${Math.round(busy)}%`), graph(hist.fps, 60, "#31d7e8", "Frame rate", `${Math.round(fps)} fps`)];
        if (mem) cards.push(graph(hist.heap, mem.jsHeapSizeLimit / 1048576, "#ffc44d", "Memory (JS heap)", `${kb(mem.usedJSHeapSize)} of ${kb(mem.jsHeapSizeLimit)}`));
        const up = Math.round(performance.now() / 1000);
        cards.push(h("div", { class: "tm-card tm-facts" },
          h("div", {}, h("b", {}, "Programs open: "), String(CF.windows.length)),
          h("div", {}, h("b", {}, "Up for: "), `${Math.floor(up / 3600)}h ${Math.floor(up / 60) % 60}m ${up % 60}s`),
          h("div", {}, h("b", {}, "Running in: "), CF.host ? "ColeForge.exe" : window.NIGHTCODE_HOSTED ? "nightcode.coletechsystems.com" : "a browser"),
          h("div", {}, h("b", {}, "Cores: "), String(navigator.hardwareConcurrency || "?")),
          h("p", { class: "muted", style: "margin:6px 0 0" }, "Busy is how late the desktop answers its own timer: high means a program is doing heavy work.")));
        body.replaceChildren(h("div", { class: "tm-perf" }, cards));
      }

      /* ---------- Storage ---------- */
      async function storage() {
        const use = storageUse();
        const quota = 5 * 1024 * 1024 * 2;                                   // ~5M characters, 2 bytes each
        const est = await navigator.storage?.estimate?.().catch(() => null);
        const bar = (part, whole) => h("div", { class: "tm-bar" }, h("i", { style: `width:${Math.min(100, part * 100 / whole).toFixed(1)}%` }));
        body.replaceChildren(h("div", { class: "tm-store" },
          h("div", { class: "tm-card-h" }, h("b", {}, "Desktop storage (settings, documents, chats)"), h("span", {}, `${kb(use.total)} of about ${kb(quota)}`)), bar(use.total, quota),
          est ? h("div", {}, h("div", { class: "tm-card-h" }, h("b", {}, "Media Library and skins (IndexedDB)"), h("span", {}, `${kb(est.usage || 0)} used`)), bar(est.usage || 0, est.quota || 1)) : null,
          h("div", { class: "tm-list" }, use.rows.slice(0, 12).map(([k, b]) => h("div", { class: "tm-row" }, h("span", { class: "tm-name" }, LABELS[k] || k), h("span", { class: "tm-title muted" }, k), h("span", { class: "tm-status" }, kb(b))))),
          h("p", { class: "muted" }, "When desktop storage gets full, empty the Recycle Bin, export big files from My Documents, or start a new chat with Albert.")));
      }

      function about() {
        body.replaceChildren(h("div", { class: "tm-about" }, h("img", { src: "assets/art/nightapps/taskman-title.png", alt: "Task Manager" }),
          h("p", {}, "Task Manager · ColeForge Edition · Ctrl+Shift+Esc"), h("p", { class: "muted" }, "End Task closes a program even when its own close code fails.")));
      }
      function paint() {
        tabs.querySelectorAll(".tm-tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
        if (tab === "apps") apps(); else if (tab === "perf") perf(); else if (tab === "about") about(); else storage();
        foot.textContent = footText();
      }
      const footText = () => `Programs: ${CF.windows.length}   ·   Busy: ${Math.round(hist.busy[N - 1])}%   ·   Storage: ${kb(storageUse().total)}`;

      // Sample every 500 ms: timer lateness (busy), frames drawn, heap.
      let raf = 0;
      const countFrame = () => { frames++; raf = requestAnimationFrame(countFrame); };
      raf = requestAnimationFrame(countFrame);
      const lagTimer = setInterval(() => { const now = performance.now(); lagSum += Math.max(0, now - lastTick - 50); lagN++; lastTick = now; }, 50);
      const sampler = setInterval(() => {
        const push = (k, v) => { hist[k].push(v); hist[k].shift(); };
        push("busy", Math.min(100, lagN ? (lagSum / (lagN * 50)) * 100 : 0));
        push("fps", frames * 2);
        push("heap", performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0);
        frames = 0; lagSum = 0; lagN = 0;
        // The list is only rebuilt when something changed, so clicks and double-clicks on it work.
        const sig = CF.windows.map((w) => w.id + w.el.className).join("|");
        if (tab === "perf" || (tab === "apps" && sig !== lastSig)) paint();
        else if (tab === "about") { lastSig = sig; return; }
        else foot.textContent = footText();
        lastSig = sig;
      }, 500);
      let lastSig = "";
      win.on("close", () => { clearInterval(sampler); clearInterval(lagTimer); cancelAnimationFrame(raf); });
      paint();
    },
  });
})();
