"use strict";

// Forgecraft: Paint meets Photoshop. Layers with opacity/blend modes, soft brushes,
// shapes, flood fill, text, eyedropper, move, filters/adjustments, undo/redo, zoom.
(function () {
  const { h } = CF;
  const PALETTE = ["#000000", "#808080", "#800000", "#808000", "#008000", "#008080", "#000080", "#800080", "#808040", "#004040", "#0080ff", "#004080", "#8000ff", "#804000",
    "#ffffff", "#c0c0c0", "#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ffff80", "#00ff80", "#80ffff", "#8080ff", "#ff0080", "#ff8040"];
  const BLENDS = ["source-over", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"];
  const TOOLS = [["brush", "🖌", "Brush (B)"], ["pencil", "✏", "Pencil (N)"], ["eraser", "⌫", "Eraser (E)"], ["fill", "🪣", "Fill (G)"], ["picker", "💧", "Eyedropper (I)"],
    ["line", "╱", "Line (L)"], ["rect", "▭", "Rectangle (R)"], ["ellipse", "◯", "Ellipse (O)"], ["text", "T", "Text (T)"], ["move", "✥", "Move layer (V)"]];
  const KEYS = { b: "brush", n: "pencil", e: "eraser", g: "fill", i: "picker", l: "line", r: "rect", o: "ellipse", t: "text", v: "move" };

  CF.register({
    id: "forgecraft", name: "Forgecraft", icon: "forgecraft", desc: "Layered paint and photo editor.",
    window: { w: 980, h: 660 },
    open(win, args) {
      const st = { tool: "brush", fg: "#1f6fff", bg: "#ffffff", size: 12, opacity: 1, hardness: 0.6, filled: false, zoom: 1, name: null, dirty: false };
      let W = 800, H = 600, layers = [], active = 0;
      const undo = [], redo = [];

      const view = h("canvas", { class: "fc-view" });
      const over = h("canvas", { class: "fc-over" });
      const wrap = h("div", { class: "fc-canvas" }, view, over);
      const scroller = h("div", { class: "fc-scroll" }, wrap);
      const vctx = view.getContext("2d"), octx = over.getContext("2d");

      /* ---------- document ---------- */
      const mkCanvas = (w = W, hh = H) => { const c = document.createElement("canvas"); c.width = w; c.height = hh; return c; };
      function newLayer(name, fill) {
        const c = mkCanvas();
        if (fill) { const g = c.getContext("2d"); g.fillStyle = fill; g.fillRect(0, 0, W, H); }
        return { name, canvas: c, ctx: c.getContext("2d", { willReadFrequently: true }), visible: true, opacity: 1, blend: "source-over", x: 0, y: 0 };
      }
      function newDoc(w, hh, fill = "#ffffff") {
        W = w; H = hh;
        layers = [newLayer("Background", fill)];
        active = 0; undo.length = 0; redo.length = 0; st.name = null; st.dirty = false;
        sizeViews(); composite(); renderLayers(); title();
      }
      function sizeViews() {
        [view, over].forEach(c => { c.width = W; c.height = H; });
        applyZoom();
      }
      function applyZoom() {
        wrap.style.width = W * st.zoom + "px"; wrap.style.height = H * st.zoom + "px";
        wrap.classList.toggle("pixelated", st.zoom > 1);
        status();
      }
      function composite() {
        vctx.clearRect(0, 0, W, H);
        for (const l of layers) {
          if (!l.visible) continue;
          vctx.globalAlpha = l.opacity; vctx.globalCompositeOperation = l.blend;
          vctx.drawImage(l.canvas, l.x, l.y);
        }
        vctx.globalAlpha = 1; vctx.globalCompositeOperation = "source-over";
      }
      const L = () => layers[active];
      function title() { win.setTitle(`${st.dirty ? "*" : ""}${st.name || "Untitled"} - Forgecraft`); }
      function touched() { if (!st.dirty) { st.dirty = true; title(); } }

      /* ---------- history ---------- */
      function snapshot() {
        return { W, H, active, layers: layers.map(l => ({ name: l.name, visible: l.visible, opacity: l.opacity, blend: l.blend, x: l.x, y: l.y, data: l.ctx.getImageData(0, 0, l.canvas.width, l.canvas.height) })) };
      }
      function restore(s) {
        W = s.W; H = s.H; active = s.active;
        layers = s.layers.map(m => { const l = newLayer(m.name); Object.assign(l, { visible: m.visible, opacity: m.opacity, blend: m.blend, x: m.x, y: m.y }); l.canvas.width = m.data.width; l.canvas.height = m.data.height; l.ctx.putImageData(m.data, 0, 0); return l; });
        sizeViews(); composite(); renderLayers();
      }
      function commit() { undo.push(snapshot()); if (undo.length > 25) undo.shift(); redo.length = 0; touched(); }
      function doUndo() { if (!undo.length) return; redo.push(snapshot()); restore(undo.pop()); }
      function doRedo() { if (!redo.length) return; undo.push(snapshot()); restore(redo.pop()); }

      /* ---------- painting ---------- */
      const stampCache = {};
      function stamp(color, size, hardness) {
        const key = color + size + hardness;
        if (stampCache[key]) return stampCache[key];
        const d = Math.max(1, Math.ceil(size)), c = mkCanvas(d, d), g = c.getContext("2d");
        const grad = g.createRadialGradient(d / 2, d / 2, 0, d / 2, d / 2, d / 2);
        grad.addColorStop(0, color); grad.addColorStop(Math.min(0.99, hardness), color); grad.addColorStop(1, color + "00");
        g.fillStyle = grad; g.fillRect(0, 0, d, d);
        const keys = Object.keys(stampCache); if (keys.length > 40) delete stampCache[keys[0]];
        return (stampCache[key] = c);
      }
      function dab(ctx, x, y, color) {
        if (st.tool === "pencil") { ctx.fillStyle = color; const s = Math.max(1, Math.round(st.size / 4)); ctx.fillRect(Math.floor(x - s / 2), Math.floor(y - s / 2), s, s); return; }
        const s = stamp(color, st.size, st.hardness);
        ctx.drawImage(s, x - s.width / 2, y - s.height / 2);
      }
      function strokeSeg(ctx, a, b, color) {
        const dist = Math.hypot(b.x - a.x, b.y - a.y), stepLen = Math.max(1, st.size * (st.tool === "pencil" ? 0.1 : 0.15));
        for (let d = 0; d <= dist; d += stepLen) dab(ctx, a.x + (b.x - a.x) * d / dist || a.x, a.y + (b.y - a.y) * d / dist || a.y, color);
      }
      // Paint strokes go to a scratch canvas so stroke opacity applies once, not per dab.
      // The eraser works directly on the layer so the result is visible while dragging.
      let scratch = null;
      function beginStroke() {
        if (st.tool === "eraser") { const g = L().ctx; g.save(); g.globalCompositeOperation = "destination-out"; g.globalAlpha = st.opacity; return g; }
        scratch = mkCanvas(L().canvas.width, L().canvas.height); return scratch.getContext("2d");
      }
      function endStroke() {
        if (st.tool === "eraser") { L().ctx.restore(); composite(); return; }
        const l = L(), g = l.ctx;
        g.save(); g.globalAlpha = st.opacity;
        g.drawImage(scratch, 0, 0); g.restore();
        scratch = null; octx.clearRect(0, 0, W, H); composite();
      }
      function previewScratch() {
        if (st.tool === "eraser") return composite();
        octx.clearRect(0, 0, W, H);
        if (!scratch) return;
        octx.globalAlpha = st.opacity;
        octx.drawImage(scratch, L().x, L().y);
        octx.globalAlpha = 1;
      }
      function shape(ctx, a, b, color, shift) {
        let x0 = a.x, y0 = a.y, x1 = b.x, y1 = b.y;
        if (shift && st.tool !== "line") { const s = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); x1 = x0 + Math.sign(x1 - x0 || 1) * s; y1 = y0 + Math.sign(y1 - y0 || 1) * s; }
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(1, st.size / 2); ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath();
        if (st.tool === "line") { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); return; }
        if (st.tool === "rect") ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
        else ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2);
        if (st.filled) { ctx.fillStyle = color === st.fg ? st.bg : st.fg; ctx.fill(); }
        ctx.stroke();
      }
      function hexToRgba(hex, a = 255) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255, a]; }
      function flood(x, y, color) {
        const l = L(), cw = l.canvas.width, ch = l.canvas.height;
        x = Math.floor(x); y = Math.floor(y);
        if (x < 0 || y < 0 || x >= cw || y >= ch) return;
        const img = l.ctx.getImageData(0, 0, cw, ch), d = img.data;
        const i0 = (y * cw + x) * 4, target = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
        const fill = hexToRgba(color, Math.round(255 * st.opacity)), tol = 32;
        if (target.every((v, k) => Math.abs(v - fill[k]) < 2)) return;
        const match = (i) => Math.abs(d[i] - target[0]) <= tol && Math.abs(d[i + 1] - target[1]) <= tol && Math.abs(d[i + 2] - target[2]) <= tol && Math.abs(d[i + 3] - target[3]) <= tol;
        const seen = new Uint8Array(cw * ch), stack = [x, y];
        while (stack.length) {
          const py = stack.pop(), px = stack.pop();
          let lx = px;
          while (lx >= 0 && !seen[py * cw + lx] && match((py * cw + lx) * 4)) lx--;
          lx++;
          let rx = px;
          while (rx < cw && !seen[py * cw + rx] && match((py * cw + rx) * 4)) rx++;
          for (let xx = lx; xx < rx; xx++) {
            const p = py * cw + xx; seen[p] = 1; const i = p * 4;
            d[i] = fill[0]; d[i + 1] = fill[1]; d[i + 2] = fill[2]; d[i + 3] = fill[3];
            if (py > 0 && !seen[p - cw] && match(i - cw * 4)) stack.push(xx, py - 1);
            if (py < ch - 1 && !seen[p + cw] && match(i + cw * 4)) stack.push(xx, py + 1);
          }
        }
        l.ctx.putImageData(img, 0, 0);
      }
      function pick(x, y) {
        const p = vctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
        return "#" + [p[0], p[1], p[2]].map(v => v.toString(16).padStart(2, "0")).join("");
      }

      /* ---------- pointer ---------- */
      const toDoc = (e) => { const r = view.getBoundingClientRect(); return { x: (e.clientX - r.left) / st.zoom, y: (e.clientY - r.top) / st.zoom }; };
      let drag = null;
      over.addEventListener("pointerdown", async (e) => {
        if (e.button === 2) return;
        const p = toDoc(e), color = e.button === 1 ? st.bg : st.fg, l = L();
        if (!l.visible) return CF.dialog({ title: "Forgecraft", icon: "warning", message: "The active layer is hidden. Show it before painting." });
        const lp = { x: p.x - l.x, y: p.y - l.y };
        if (st.tool === "picker" || e.altKey) { setColor(pick(p.x, p.y)); return; }
        if (st.tool === "fill") { commit(); flood(lp.x, lp.y, color); composite(); return; }
        if (st.tool === "text") {
          const r = await CF.dialog({ title: "Text", icon: "forgecraft", message: "Enter text:", input: "", buttons: ["OK", "Cancel"] });
          if (r.button !== "OK" || !r.value) return;
          commit();
          l.ctx.save(); l.ctx.globalAlpha = st.opacity; l.ctx.fillStyle = color; l.ctx.textBaseline = "top";
          l.ctx.font = `bold ${Math.max(8, st.size * 2)}px Tahoma, sans-serif`;
          r.value.split("\n").forEach((line, i) => l.ctx.fillText(line, lp.x, lp.y + i * st.size * 2.3));
          l.ctx.restore(); composite(); return;
        }
        over.setPointerCapture(e.pointerId);
        commit();
        if (st.tool === "move") { drag = { start: p, ox: l.x, oy: l.y }; return; }
        drag = { start: lp, last: lp, color, ctx: beginStroke() };
        if (["brush", "pencil", "eraser"].includes(st.tool)) { dab(drag.ctx, lp.x, lp.y, st.tool === "eraser" ? "#000000" : color); previewScratch(); }
      });
      over.addEventListener("pointermove", (e) => {
        const p = toDoc(e);
        win.statusbar([`${Math.floor(p.x)}, ${Math.floor(p.y)} px`, `${W}×${H}`, `${Math.round(st.zoom * 100)}%`, `Layer: ${L()?.name || ""}`]);
        if (!drag) return;
        const l = L();
        if (st.tool === "move") { l.x = Math.round(drag.ox + p.x - drag.start.x); l.y = Math.round(drag.oy + p.y - drag.start.y); composite(); return; }
        const lp = { x: p.x - l.x, y: p.y - l.y };
        if (["brush", "pencil", "eraser"].includes(st.tool)) { strokeSeg(drag.ctx, drag.last, lp, st.tool === "eraser" ? "#000000" : drag.color); drag.last = lp; previewScratch(); }
        else { drag.ctx.clearRect(0, 0, scratch.width, scratch.height); shape(drag.ctx, drag.start, lp, drag.color, e.shiftKey); previewScratch(); }
      });
      const finish = () => {
        if (!drag) return;
        if (st.tool !== "move") endStroke(); else composite();
        drag = null;
      };
      over.addEventListener("pointerup", finish);
      over.addEventListener("pointercancel", finish);
      over.addEventListener("wheel", (e) => { if (e.ctrlKey) { e.preventDefault(); zoom(e.deltaY < 0 ? 1.25 : 0.8); } }, { passive: false });
      over.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        CF.contextMenu({ x: e.clientX, y: e.clientY }, [
          { label: "Undo", key: "Ctrl+Z", action: doUndo, disabled: !undo.length }, { label: "Redo", key: "Ctrl+Y", action: doRedo, disabled: !redo.length }, "-",
          { label: "Pick colour here", icon: "forgecraft", action: () => setColor(pick(toDoc(e).x, toDoc(e).y)) },
          { label: "Swap colours", key: "X", action: swap }, "-",
          { label: "Tool", items: TOOLS.map(([id, , name]) => ({ label: name, checked: st.tool === id, action: () => setTool(id) })) },
          { label: "Layer", items: layerMenu() }, { label: "Filters", items: filterMenu() }, "-",
          { label: "Zoom in", action: () => zoom(1.25) }, { label: "Zoom out", action: () => zoom(0.8) }, { label: "Actual size", action: () => { st.zoom = 1; applyZoom(); } },
        ]);
      });

      /* ---------- filters ---------- */
      function applyFilter(fn) { commit(); const l = L(); const img = l.ctx.getImageData(0, 0, l.canvas.width, l.canvas.height); fn(img.data, img.width, img.height); l.ctx.putImageData(img, 0, 0); composite(); }
      function cssFilter(f) { commit(); const l = L(); const c = mkCanvas(l.canvas.width, l.canvas.height), g = c.getContext("2d"); g.filter = f; g.drawImage(l.canvas, 0, 0); l.ctx.clearRect(0, 0, c.width, c.height); l.ctx.drawImage(c, 0, 0); composite(); }
      function convolve(k) {
        applyFilter((d, w, hh) => {
          const src = new Uint8ClampedArray(d);
          for (let y = 1; y < hh - 1; y++) for (let x = 1; x < w - 1; x++) for (let c = 0; c < 3; c++) {
            let v = 0, i = 0;
            for (let ky = -1; ky <= 1; ky++) for (let kx = -1; kx <= 1; kx++) v += src[((y + ky) * w + x + kx) * 4 + c] * k[i++];
            d[(y * w + x) * 4 + c] = v;
          }
        });
      }
      async function brightnessContrast() {
        const r = await CF.dialog({ title: "Brightness / Contrast", icon: "forgecraft", message: "Enter brightness and contrast (-100..100), e.g. 10, 20", input: "10, 20", buttons: ["Apply", "Cancel"] });
        if (r.button !== "Apply") return;
        const [b, c] = r.value.split(/[ ,]+/).map(Number);
        const f = (259 * ((c || 0) + 255)) / (255 * (259 - (c || 0)));
        applyFilter(d => { for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) d[i + k] = f * (d[i + k] - 128) + 128 + (b || 0) * 2.55; });
      }
      async function hueShift() {
        const r = await CF.dialog({ title: "Hue / Saturation", icon: "forgecraft", message: "Hue rotation in degrees and saturation %, e.g. 90, 120", input: "90, 100", buttons: ["Apply", "Cancel"] });
        if (r.button !== "Apply") return;
        const [hu, sa] = r.value.split(/[ ,]+/).map(Number);
        cssFilter(`hue-rotate(${hu || 0}deg) saturate(${isFinite(sa) ? sa : 100}%)`);
      }
      const filterMenu = () => [
        { label: "Grayscale", action: () => applyFilter(d => { for (let i = 0; i < d.length; i += 4) { const v = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; d[i] = d[i + 1] = d[i + 2] = v; } }) },
        { label: "Invert", key: "Ctrl+I", action: () => applyFilter(d => { for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; } }) },
        { label: "Sepia", action: () => cssFilter("sepia(100%)") },
        { label: "Brightness / Contrast…", action: brightnessContrast },
        { label: "Hue / Saturation…", action: hueShift }, "-",
        { label: "Blur", action: () => cssFilter("blur(2px)") }, { label: "Sharpen", action: () => convolve([0, -1, 0, -1, 5, -1, 0, -1, 0]) },
        { label: "Emboss", action: () => convolve([-2, -1, 0, -1, 1, 1, 0, 1, 2]) }, { label: "Edge detect", action: () => convolve([-1, -1, -1, -1, 8, -1, -1, -1, -1]) },
        { label: "Posterize (retro 16-colour)", action: () => applyFilter(d => { for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) d[i + k] = Math.round(d[i + k] / 85) * 85; }) },
        { label: "Forge Glow", action: () => { commit(); const l = L(); const c = mkCanvas(l.canvas.width, l.canvas.height), g = c.getContext("2d"); g.filter = "blur(8px) brightness(1.4)"; g.drawImage(l.canvas, 0, 0); l.ctx.save(); l.ctx.globalCompositeOperation = "lighter"; l.ctx.globalAlpha = 0.6; l.ctx.drawImage(c, 0, 0); l.ctx.restore(); composite(); } },
      ];

      /* ---------- image ops ---------- */
      function transformAll(nw, nh, draw) {
        commit();
        layers.forEach(l => { const c = mkCanvas(nw, nh), g = c.getContext("2d"); draw(g, l.canvas); l.canvas.width = nw; l.canvas.height = nh; l.ctx.drawImage(c, 0, 0); l.x = 0; l.y = 0; });
        W = nw; H = nh; sizeViews(); composite();
      }
      const flipH = () => transformAll(W, H, (g, c) => { g.translate(W, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); });
      const flipV = () => transformAll(W, H, (g, c) => { g.translate(0, H); g.scale(1, -1); g.drawImage(c, 0, 0); });
      const rotate = () => { const ow = W, oh = H; transformAll(oh, ow, (g, c) => { g.translate(oh, 0); g.rotate(Math.PI / 2); g.drawImage(c, 0, 0, ow, oh); }); };
      async function resizeImage(canvasOnly) {
        const r = await CF.dialog({ title: canvasOnly ? "Canvas Size" : "Resize Image", icon: "forgecraft", message: "Width × height in pixels:", input: `${W} x ${H}`, buttons: ["OK", "Cancel"] });
        if (r.button !== "OK") return;
        const [nw, nh] = r.value.split(/[^\d]+/).map(Number).filter(Boolean);
        if (!nw || !nh || nw > 8000 || nh > 8000) return;
        transformAll(nw, nh, (g, c) => canvasOnly ? g.drawImage(c, 0, 0) : g.drawImage(c, 0, 0, nw, nh));
      }

      /* ---------- layers ---------- */
      const layerList = h("div", { class: "list fc-layers" });
      const layerOpacity = h("input", { type: "range", min: 0, max: 1, step: 0.01, style: "width:100%" });
      const layerBlend = h("select", { class: "field", style: "width:100%" }, BLENDS.map(b => h("option", { value: b }, b === "source-over" ? "normal" : b)));
      layerOpacity.addEventListener("input", () => { L().opacity = +layerOpacity.value; composite(); });
      layerOpacity.addEventListener("change", touched);
      layerBlend.addEventListener("change", () => { commit(); L().blend = layerBlend.value; composite(); });
      function addLayer() { commit(); layers.splice(active + 1, 0, newLayer("Layer " + (layers.length + 1))); active++; renderLayers(); composite(); }
      function dupLayer() { commit(); const s = L(), n = newLayer(s.name + " copy"); Object.assign(n, { opacity: s.opacity, blend: s.blend, x: s.x, y: s.y }); n.canvas.width = s.canvas.width; n.canvas.height = s.canvas.height; n.ctx.drawImage(s.canvas, 0, 0); layers.splice(active + 1, 0, n); active++; renderLayers(); composite(); }
      function delLayer() { if (layers.length < 2) return; commit(); layers.splice(active, 1); active = Math.max(0, active - 1); renderLayers(); composite(); }
      function moveLayer(dir) { const j = active + dir; if (j < 0 || j >= layers.length) return; commit(); [layers[active], layers[j]] = [layers[j], layers[active]]; active = j; renderLayers(); composite(); }
      function mergeDown() {
        if (active === 0) return; commit();
        const top = layers[active], below = layers[active - 1];
        below.ctx.save(); below.ctx.globalAlpha = top.opacity; below.ctx.globalCompositeOperation = top.blend; below.ctx.drawImage(top.canvas, top.x - below.x, top.y - below.y); below.ctx.restore();
        layers.splice(active, 1); active--; renderLayers(); composite();
      }
      function flatten() { commit(); const c = newLayer("Background"); c.ctx.drawImage(view, 0, 0); layers = [c]; active = 0; renderLayers(); composite(); }
      async function renameLayer() { const r = await CF.dialog({ title: "Layer Properties", icon: "forgecraft", message: "Layer name:", input: L().name, buttons: ["OK", "Cancel"] }); if (r.button === "OK" && r.value.trim()) { L().name = r.value.trim(); renderLayers(); } }
      const layerMenu = () => [{ label: "New Layer", key: "Ctrl+Shift+N", action: addLayer }, { label: "Duplicate Layer", action: dupLayer }, { label: "Delete Layer", action: delLayer, disabled: layers.length < 2 },
        { label: "Rename…", action: renameLayer }, "-", { label: "Move Up", action: () => moveLayer(1) }, { label: "Move Down", action: () => moveLayer(-1) }, "-", { label: "Merge Down", key: "Ctrl+E", action: mergeDown, disabled: active === 0 }, { label: "Flatten Image", action: flatten }];
      function renderLayers() {
        layerList.replaceChildren(...layers.map((l, i) => {
          const thumb = mkCanvas(40, 30); thumb.getContext("2d").drawImage(l.canvas, 0, 0, 40, 30); thumb.className = "fc-thumb";
          const eye = h("span", { class: "fc-eye clickable", title: "Show/hide" }, l.visible ? "👁" : "—");
          eye.addEventListener("click", (e) => { e.stopPropagation(); l.visible = !l.visible; renderLayers(); composite(); });
          const row = h("div", { class: "item clickable" + (i === active ? " sel" : "") }, eye, thumb, h("span", { style: "flex:1;overflow:hidden;text-overflow:ellipsis" }, l.name));
          row.addEventListener("click", () => { active = i; renderLayers(); });
          row.addEventListener("dblclick", renameLayer);
          row.addEventListener("contextmenu", (e) => { e.preventDefault(); active = i; renderLayers(); CF.contextMenu({ x: e.clientX, y: e.clientY }, layerMenu()); });
          return row;
        }).reverse());
        layerOpacity.value = L().opacity; layerBlend.value = L().blend;
        status();
      }

      /* ---------- files ---------- */
      function loadImage(src, name, asLayer) {
        const img = new Image();
        img.onload = () => {
          if (asLayer) {
            commit();
            const l = newLayer(name || "Imported");
            l.ctx.drawImage(img, 0, 0, Math.min(img.width, W * 2), Math.min(img.height, H * 2));
            layers.splice(active + 1, 0, l); active++;
          } else {
            newDoc(Math.min(img.width, 8000), Math.min(img.height, 8000), null);
            layers[0].ctx.drawImage(img, 0, 0);
            st.name = name || null;
          }
          fitZoom(); composite(); renderLayers(); title();
        };
        img.onerror = () => CF.dialog({ title: "Forgecraft", icon: "error", message: "That file isn't an image Forgecraft can read." });
        img.src = src;
      }
      function openFile(asLayer) {
        const inp = h("input", { type: "file", accept: "image/*" });
        inp.addEventListener("change", () => { const f = inp.files[0]; if (!f) return; const u = URL.createObjectURL(f); loadImage(u, f.name, asLayer); });
        inp.click();
      }
      function exportAs(type) {
        const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[type];
        const base = (st.name || "Untitled").replace(/\.[^.]+$/, "");
        let src = view;
        if (type === "image/jpeg") { src = mkCanvas(); const g = src.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.drawImage(view, 0, 0); }
        src.toBlob(b => { const a = h("a", { href: URL.createObjectURL(b), download: `${base}.${ext}` }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }, type, 0.92);
      }
      async function saveDoc() {
        let name = st.name;
        if (!name) {
          const r = await CF.dialog({ title: "Save As", icon: "documents", message: "Save to My Documents as:", input: "Untitled.png", buttons: ["Save", "Cancel"] });
          if (r.button !== "Save" || !r.value.trim()) return;
          name = r.value.trim().replace(/(\.png)?$/i, ".png");
        }
        if (CF.vfs.write(name, view.toDataURL("image/png"), "image")) { st.name = name; st.dirty = false; title(); CF.toast({ title: "Forgecraft", body: `Saved ${name} to My Documents.`, icon: "forgecraft" }); }
      }
      async function newDialog() {
        const r = await CF.dialog({ title: "New Image", icon: "forgecraft", message: "Size (width × height):", input: "800 x 600", buttons: ["Create", "Cancel"] });
        if (r.button !== "Create") return;
        const [nw, nh] = r.value.split(/[^\d]+/).map(Number).filter(Boolean);
        if (nw && nh) { newDoc(Math.min(nw, 8000), Math.min(nh, 8000)); fitZoom(); }
      }
      function fitZoom() {
        const aw = scroller.clientWidth - 30, ah = scroller.clientHeight - 30;
        st.zoom = Math.min(1, aw / W, ah / H) || 1; applyZoom();
      }
      function zoom(f) { st.zoom = Math.max(0.1, Math.min(16, st.zoom * f)); applyZoom(); }

      /* ---------- UI ---------- */
      const toolBtns = {};
      const toolbox = h("div", { class: "fc-tools" }, TOOLS.map(([id, glyph, name]) => {
        const b = h("button", { class: "tool", title: name }, h("b", {}, glyph));
        b.addEventListener("click", () => setTool(id));
        toolBtns[id] = b; return b;
      }));
      function setTool(id) { st.tool = id; Object.entries(toolBtns).forEach(([k, b]) => b.classList.toggle("on", k === id)); over.dataset.tool = id; }
      const fgSw = h("div", { class: "fc-fg clickable", title: "Primary colour" }), bgSw = h("div", { class: "fc-bg clickable", title: "Secondary colour (middle-click paints with it)" });
      const fgIn = h("input", { type: "color", value: st.fg, style: "display:none" }), bgIn = h("input", { type: "color", value: st.bg, style: "display:none" });
      fgSw.addEventListener("click", () => fgIn.click()); bgSw.addEventListener("click", () => bgIn.click());
      fgIn.addEventListener("input", () => setColor(fgIn.value)); bgIn.addEventListener("input", () => { st.bg = bgIn.value; paintSwatches(); });
      function setColor(c) { st.fg = c; fgIn.value = c; paintSwatches(); }
      function swap() { [st.fg, st.bg] = [st.bg, st.fg]; fgIn.value = st.fg; bgIn.value = st.bg; paintSwatches(); }
      function paintSwatches() { fgSw.style.background = st.fg; bgSw.style.background = st.bg; }
      const palette = h("div", { class: "fc-palette" }, PALETTE.map(c => {
        const s = h("span", { class: "clickable", style: `background:${c}`, title: c });
        s.addEventListener("click", () => setColor(c));
        s.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); st.bg = c; bgIn.value = c; paintSwatches(); });
        return s;
      }));
      const size = h("input", { type: "range", min: 1, max: 200, value: st.size, style: "width:110px" });
      const sizeLbl = h("span", {}, st.size + "px");
      const opac = h("input", { type: "range", min: 0.05, max: 1, step: 0.05, value: st.opacity, style: "width:90px" });
      const hard = h("input", { type: "range", min: 0.05, max: 1, step: 0.05, value: st.hardness, style: "width:80px" });
      const filled = h("input", { type: "checkbox" });
      size.addEventListener("input", () => { st.size = +size.value; sizeLbl.textContent = st.size + "px"; });
      opac.addEventListener("input", () => { st.opacity = +opac.value; });
      hard.addEventListener("input", () => { st.hardness = +hard.value; });
      filled.addEventListener("change", () => { st.filled = filled.checked; });

      win.menubar([
        { label: "File", items: [{ label: "New…", key: "Ctrl+N", action: newDialog }, { label: "Open…", key: "Ctrl+O", action: () => openFile(false) }, { label: "Import as Layer…", action: () => openFile(true) }, "-",
          { label: "Save to My Documents", key: "Ctrl+S", action: saveDoc }, { label: "Export", items: [{ label: "PNG", action: () => exportAs("image/png") }, { label: "JPEG", action: () => exportAs("image/jpeg") }, { label: "WebP", action: () => exportAs("image/webp") }] },
          { label: "Set as Wallpaper", action: () => { CF.settings.customWall = view.toDataURL("image/jpeg", 0.85); CF.settings.wallpaper = "custom"; CF.saveSettings(); } },
          { label: "Set as Avatar", action: () => { const c = mkCanvas(128, 128); const k = Math.min(W, H); c.getContext("2d").drawImage(view, (W - k) / 2, (H - k) / 2, k, k, 0, 0, 128, 128); CF.settings.avatar = c.toDataURL(); CF.saveSettings(); } },
          "-", { label: "Close", action: () => win.close() }] },
        { label: "Edit", items: () => [{ label: "Undo", key: "Ctrl+Z", action: doUndo, disabled: !undo.length }, { label: "Redo", key: "Ctrl+Y", action: doRedo, disabled: !redo.length }, "-",
          { label: "Clear Layer", key: "Del", action: () => { commit(); L().ctx.clearRect(0, 0, L().canvas.width, L().canvas.height); composite(); } },
          { label: "Fill Layer with Primary", action: () => { commit(); L().ctx.fillStyle = st.fg; L().ctx.fillRect(0, 0, L().canvas.width, L().canvas.height); composite(); } },
          { label: "Copy Image", key: "Ctrl+C", action: () => view.toBlob(b => navigator.clipboard?.write?.([new ClipboardItem({ "image/png": b })]).catch(() => {})) },
          { label: "Paste as Layer", key: "Ctrl+V", action: paste }] },
        { label: "Image", items: () => [{ label: "Resize Image…", action: () => resizeImage(false) }, { label: "Canvas Size…", action: () => resizeImage(true) }, "-", { label: "Flip Horizontal", action: flipH }, { label: "Flip Vertical", action: flipV }, { label: "Rotate 90°", action: rotate }] },
        { label: "Layer", items: layerMenu },
        { label: "Filters", items: filterMenu },
        { label: "View", items: () => [{ label: "Zoom In", key: "Ctrl++", action: () => zoom(1.25) }, { label: "Zoom Out", key: "Ctrl+-", action: () => zoom(0.8) }, { label: "Fit to Window", action: fitZoom }, { label: "Actual Pixels", action: () => { st.zoom = 1; applyZoom(); } }] },
      ]);
      async function paste() {
        try {
          const items = await navigator.clipboard.read();
          for (const it of items) { const t = it.types.find(x => x.startsWith("image/")); if (t) { const b = await it.getType(t); loadImage(URL.createObjectURL(b), "Pasted", true); return; } }
        } catch { CF.dialog({ title: "Forgecraft", icon: "info", message: "Nothing to paste (or clipboard access was blocked)." }); }
      }

      win.body.append(h("div", { class: "fc" },
        h("div", { class: "toolbar fc-opts" },
          h("span", { class: "muted" }, "Size"), size, sizeLbl, h("div", { class: "sep" }),
          h("span", { class: "muted" }, "Opacity"), opac, h("span", { class: "muted" }, "Hardness"), hard, h("div", { class: "sep" }),
          h("label", { class: "row clickable", style: "margin:0" }, filled, "Fill shapes"), h("div", { class: "sep" }),
          h("button", { class: "tool", title: "Undo", onclick: doUndo }, h("b", {}, "↶")), h("button", { class: "tool", title: "Redo", onclick: doRedo }, h("b", {}, "↷"))),
        h("div", { class: "fc-mid" },
          h("div", { class: "fc-left" }, toolbox, h("div", { class: "fc-swatch" }, fgSw, bgSw, h("span", { class: "fc-swap clickable", title: "Swap (X)", onclick: swap }, "⇄")), fgIn, bgIn),
          scroller,
          h("div", { class: "fc-right" }, h("div", { class: "fc-ph" }, "Layers"), layerList,
            h("div", { class: "pad", style: "padding:6px" }, h("small", { class: "muted" }, "Opacity"), layerOpacity, h("small", { class: "muted" }, "Blend mode"), layerBlend,
              h("div", { class: "row", style: "flex-wrap:wrap;gap:3px" }, ...[["+", "New layer", addLayer], ["⧉", "Duplicate", dupLayer], ["🗑", "Delete", delLayer], ["▲", "Move up", () => moveLayer(1)], ["▼", "Move down", () => moveLayer(-1)], ["⤓", "Merge down", mergeDown]].map(([g, t, fn]) => h("button", { class: "tool", title: t, onclick: fn }, h("b", {}, g))))))),
        palette));

      win.el.tabIndex = -1;
      win.el.addEventListener("keydown", (e) => {
        if (e.target.closest("input, select, textarea")) return;
        const k = e.key.toLowerCase();
        if (e.ctrlKey && k === "z") { e.preventDefault(); doUndo(); }
        else if (e.ctrlKey && k === "y") { e.preventDefault(); doRedo(); }
        else if (e.ctrlKey && k === "s") { e.preventDefault(); saveDoc(); }
        else if (e.ctrlKey && k === "o") { e.preventDefault(); openFile(false); }
        else if (e.ctrlKey && k === "n") { e.preventDefault(); e.shiftKey ? addLayer() : newDialog(); }
        else if (e.ctrlKey && k === "e") { e.preventDefault(); mergeDown(); }
        else if (e.ctrlKey && k === "v") { e.preventDefault(); paste(); }
        else if (e.ctrlKey && (k === "+" || k === "=")) { e.preventDefault(); zoom(1.25); }
        else if (e.ctrlKey && k === "-") { e.preventDefault(); zoom(0.8); }
        else if (!e.ctrlKey && KEYS[k]) setTool(KEYS[k]);
        else if (k === "x") swap();
        else if (k === "[") { st.size = Math.max(1, st.size - 2); size.value = st.size; sizeLbl.textContent = st.size + "px"; }
        else if (k === "]") { st.size = Math.min(200, st.size + 2); size.value = st.size; sizeLbl.textContent = st.size + "px"; }
      });
      win.body.addEventListener("dragover", (e) => e.preventDefault());
      win.body.addEventListener("drop", (e) => { e.preventDefault(); const f = [...e.dataTransfer.files].find(x => x.type.startsWith("image/")); if (f) loadImage(URL.createObjectURL(f), f.name, layers.length > 0 && st.dirty); });
      win.on("beforeclose", () => {
        if (!st.dirty) return true;
        CF.dialog({ title: "Forgecraft", icon: "warning", message: `Save changes to ${st.name || "Untitled"}?`, buttons: ["Yes", "No", "Cancel"] })
          .then(async r => { if (r.button === "No") win.close(true); else if (r.button === "Yes") { await saveDoc(); if (!st.dirty) win.close(true); } });
        return false;
      });
      function status() { win.statusbar([`${W}×${H}`, `${Math.round(st.zoom * 100)}%`, `Layer: ${L()?.name || ""}`]); }

      paintSwatches(); setTool("brush");
      newDoc(800, 600);
      requestAnimationFrame(fitZoom);
      if (args.file) { const d = CF.vfs.read(args.file); if (d) { loadImage(d.data, d.name, false); st.name = d.name; } }
      else if (args.dataUrl) loadImage(args.dataUrl, args.name, false);
    },
  });
})();
