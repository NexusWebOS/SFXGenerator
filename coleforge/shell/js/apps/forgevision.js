"use strict";

// ForgeVision: modern video player with playlist, subtitles (.srt/.vtt), speed control,
// picture-in-picture, fullscreen and frame capture to Forgecraft.
(function () {
  const { h } = CF;
  const VIDEO_EXT = /\.(mp4|m4v|webm|ogv|ogg|mkv|mov|avi|3gp|ts|m2ts)$/i;

  function srtToVtt(text) {
    return "WEBVTT\n\n" + text.replace(/\r/g, "").replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, "$1.$2").replace(/^\d+\n(?=\d\d:)/gm, "");
  }

  CF.register({
    id: "forgevision", name: "ForgeVision", icon: "forgevision", single: true, desc: "Video player for MP4, WebM, MKV, MOV, OGV and more, with subtitles.",
    window: { w: 800, h: 540 },
    open(win, args) {
      const video = h("video", { class: "vis-video", playsinline: true });
      const empty = h("div", { class: "vis-empty" }, h("img", { src: CF.icon("forgevision"), alt: "" }), h("div", {}, "Drop a video here or use File → Open"));
      const stage = h("div", { class: "vis-stage" }, video, empty);
      const seek = h("input", { type: "range", min: 0, max: 1000, value: 0, class: "vis-seek" });
      const time = h("span", { class: "vis-time" }, "0:00 / 0:00");
      const btn = (label, title, fn) => { const b = h("button", { class: "btn icon", title }, label); b.addEventListener("click", fn); return b; };
      const playBtn = btn("▶", "Play / Pause (Space)", toggle);
      const vol = h("input", { type: "range", min: 0, max: 1, step: 0.01, value: CF.settings.volume, style: "width:90px", title: "Volume" });
      const speed = h("select", { class: "field", title: "Playback speed" }, [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(s => h("option", { value: s, selected: s === 1 }, s + "×")));
      const list = h("div", { class: "list vis-list" });
      const body = h("div", { class: "vis" }, h("div", { class: "vis-main" }, stage, seek,
        h("div", { class: "vis-ctrl" }, btn("⏮", "Previous", () => go(cur - 1)), playBtn, btn("⏭", "Next", () => go(cur + 1)), btn("⏪", "Back 10s", () => nudge(-10)), btn("⏩", "Forward 10s", () => nudge(10)), time,
          h("span", { style: "flex:1" }), h("img", { src: CF.icon("volume"), alt: "", style: "width:18px" }), vol, speed, btn("⧉", "Picture-in-picture", pip), btn("⛶", "Fullscreen (F)", full))), list);
      win.body.append(body);

      const items = [];
      let cur = -1, url = null, showList = true;
      win.menubar([
        { label: "File", items: [{ label: "Open…", key: "Ctrl+O", action: openFiles }, { label: "Load subtitles…", action: openSubs }, "-", { label: "Capture frame to Forgecraft", action: capture }, "-", { label: "Close", action: () => win.close() }] },
        { label: "View", items: () => [{ label: "Playlist", checked: showList, action: () => { showList = !showList; list.style.display = showList ? "" : "none"; } }, { label: "Fullscreen", key: "F", action: full }, { label: "Picture-in-picture", action: pip }] },
        { label: "Play", items: () => [{ label: "Play/Pause", key: "Space", action: toggle }, { label: "Loop", checked: video.loop, action: () => { video.loop = !video.loop; } }, { label: "Mute", key: "M", checked: video.muted, action: () => { video.muted = !video.muted; } }] },
      ]);

      function openFiles() {
        const inp = h("input", { type: "file", multiple: true, accept: "video/*,.mkv,.mov,.avi,.ogv,.srt,.vtt" });
        inp.addEventListener("change", () => add([...inp.files]));
        inp.click();
      }
      function openSubs() {
        const inp = h("input", { type: "file", accept: ".srt,.vtt" });
        inp.addEventListener("change", () => inp.files[0] && subs(inp.files[0]));
        inp.click();
      }
      async function subs(file) {
        let text = await file.text();
        if (/\.srt$/i.test(file.name)) text = srtToVtt(text);
        video.querySelectorAll("track").forEach(t => t.remove());
        const track = h("track", { kind: "subtitles", label: file.name, srclang: "en", src: URL.createObjectURL(new Blob([text], { type: "text/vtt" })), default: true });
        video.append(track);
        track.track.mode = "showing";
        CF.toast({ title: "ForgeVision", body: "Subtitles loaded: " + file.name, icon: "forgevision" });
      }
      function add(files) {
        const start = items.length;
        for (const f of files) {
          if (/\.(srt|vtt)$/i.test(f.name)) subs(f);
          else if (VIDEO_EXT.test(f.name) || f.type.startsWith("video/")) items.push(f);
        }
        render();
        if (cur < 0 && items.length > start) go(start);
      }
      function render() {
        list.replaceChildren(h("div", { class: "item muted" }, "Playlist"), ...items.map((f, i) => {
          const r = h("div", { class: "item clickable" + (i === cur ? " sel" : "") }, h("img", { src: CF.icon("forgevision"), alt: "" }), h("span", { style: "overflow:hidden;text-overflow:ellipsis;white-space:nowrap" }, f.name));
          r.addEventListener("dblclick", () => go(i));
          return r;
        }));
      }
      function go(i) {
        if (i < 0 || i >= items.length) return;
        cur = i;
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(items[i]);
        video.querySelectorAll("track").forEach(t => t.remove());
        video.src = url;
        empty.style.display = "none";
        win.setTitle(items[i].name + " - ForgeVision");
        video.play().catch(() => CF.dialog({ title: "ForgeVision", icon: "error", message: `The codec in ${items[i].name} isn't available on this system.\nMP4 (H.264/AAC), WebM (VP9/AV1/Opus) and OGV play everywhere; MKV/MOV depend on their codecs.` }));
        render();
      }
      function toggle() { if (cur < 0) return openFiles(); video.paused ? video.play() : video.pause(); }
      function nudge(s) { video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + s)); }
      function full() { (document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen()).catch(() => {}); }
      function pip() { if (document.pictureInPictureEnabled && cur >= 0) (document.pictureInPictureElement ? document.exitPictureInPicture() : video.requestPictureInPicture()).catch(() => {}); }
      function capture() {
        if (!video.videoWidth) return;
        const c = document.createElement("canvas");
        c.width = video.videoWidth; c.height = video.videoHeight;
        c.getContext("2d").drawImage(video, 0, 0);
        CF.open("forgecraft", { dataUrl: c.toDataURL("image/png"), name: "Frame capture.png" });
      }

      const fmt = (s) => !isFinite(s) ? "0:00" : (s >= 3600 ? Math.floor(s / 3600) + ":" + String(Math.floor(s / 60) % 60).padStart(2, "0") : Math.floor(s / 60)) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
      video.addEventListener("timeupdate", () => { if (!seek.matches(":active")) seek.value = video.duration ? video.currentTime / video.duration * 1000 : 0; time.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`; });
      video.addEventListener("play", () => { playBtn.textContent = "⏸"; });
      video.addEventListener("pause", () => { playBtn.textContent = "▶"; });
      video.addEventListener("ended", () => { if (cur + 1 < items.length) go(cur + 1); });
      video.addEventListener("loadedmetadata", () => win.statusbar([`${video.videoWidth}×${video.videoHeight}`, fmt(video.duration), items[cur]?.type || ""]));
      video.addEventListener("click", toggle);
      video.addEventListener("dblclick", full);
      video.volume = CF.settings.volume;
      seek.addEventListener("input", () => { if (video.duration) video.currentTime = seek.value / 1000 * video.duration; });
      vol.addEventListener("input", () => { video.volume = +vol.value; });
      speed.addEventListener("change", () => { video.playbackRate = +speed.value; });
      stage.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        CF.contextMenu({ x: e.clientX, y: e.clientY }, [
          { label: video.paused ? "Play" : "Pause", action: toggle }, { label: "Open…", action: openFiles }, "-",
          { label: "Speed", items: [0.5, 1, 1.5, 2].map(s => ({ label: s + "×", checked: video.playbackRate === s, action: () => { video.playbackRate = s; speed.value = s; } })) },
          { label: "Loop", checked: video.loop, action: () => { video.loop = !video.loop; } },
          { label: "Load subtitles…", action: openSubs }, "-",
          { label: "Capture frame", action: capture }, { label: "Fullscreen", action: full }, { label: "Picture-in-picture", action: pip },
        ]);
      });
      win.el.addEventListener("keydown", (e) => {
        if (e.target.closest("input, select")) return;
        if (e.code === "Space") { e.preventDefault(); toggle(); }
        else if (e.key === "ArrowRight") nudge(5);
        else if (e.key === "ArrowLeft") nudge(-5);
        else if (e.key.toLowerCase() === "f") full();
        else if (e.key.toLowerCase() === "m") video.muted = !video.muted;
      });
      win.el.tabIndex = -1;
      win.body.addEventListener("dragover", (e) => e.preventDefault());
      win.body.addEventListener("drop", (e) => { e.preventDefault(); add([...e.dataTransfer.files]); });
      win.on("args", (a) => a.files && add(a.files));
      win.on("close", () => { video.pause(); video.removeAttribute("src"); if (url) URL.revokeObjectURL(url); });
      render();
      win.statusbar(["No media", "ForgeVision"]);
      if (args.files) add(args.files);
    },
  });
})();
