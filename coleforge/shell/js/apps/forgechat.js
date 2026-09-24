"use strict";

// ForgeChat: AIM's buddy list and away messages, Discord's channels, Messenger's media.
// Connects to the ColeForge LAN server over WebSocket when available; otherwise runs a
// local hub over BroadcastChannel so several windows/tabs on one machine can talk.
(function () {
  const { h, esc } = CF;
  const P = window.ForgeChatProtocol;
  // 16-bit pixel art (assets/art/forgechat/) in the Windows 98 theme, emoji glyphs otherwise.
  const is98 = () => CF.settings.theme === "98";
  const pix = (name, glyph) => is98() ? h("img", { class: "px-ico", src: `assets/art/forgechat/${name}.png`, alt: glyph }) : glyph;

  /* ---------------- transports ---------------- */
  class Emitter {
    constructor() { this.fns = []; }
    on(fn) { this.fns.push(fn); }
    deliver(type, data) { this.fns.forEach(fn => fn(type, data)); }
  }

  class WsHub extends Emitter {
    constructor(url) { super(); this.url = url; this.mode = "LAN server"; }
    connect(me) {
      return new Promise((resolve, reject) => {
        const ws = this.ws = new WebSocket(this.url);
        const timer = setTimeout(() => { ws.close(); reject(new Error("timeout")); }, 3000);
        ws.onopen = () => { clearTimeout(timer); ws.send(JSON.stringify({ type: "hello", user: me })); resolve(); };
        ws.onerror = () => { clearTimeout(timer); reject(new Error("unreachable")); };
        ws.onmessage = (e) => { try { const m = JSON.parse(e.data); this.deliver(m.type, m); } catch { /* ignore */ } };
        ws.onclose = () => { if (!this.closing) this.deliver("disconnected", {}); };
      });
    }
    send(type, payload = {}) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ type, ...payload })); }
    close() { this.closing = true; try { this.ws.close(); } catch { /* closed */ } }
  }

  // Serverless hub: every window runs this; presence/lobby state converge over BroadcastChannel,
  // history is shared through localStorage (same origin).
  class LocalHub extends Emitter {
    constructor() { super(); this.mode = "Local (this PC)"; this.users = new Map(); this.lobbies = new Map(); }
    connect(me) {
      this.me = P.cleanUser(me);
      this.bc = new BroadcastChannel("forgechat-v1");
      this.bc.onmessage = (e) => this.recv(e.data);
      this.post({ type: "presence", user: this.me });
      this.post({ type: "who", from: this.me.id });
      this.beat = setInterval(() => { this.post({ type: "presence", user: this.me }); this.prune(); }, 8000);
      this.unload = () => this.post({ type: "leave", id: this.me.id });
      addEventListener("beforeunload", this.unload);
      setTimeout(() => this.deliver("welcome", { you: this.me, users: [this.me, ...[...this.users.values()].map(u => u.user)], lobbies: [...this.lobbies.values()], history: this.history(), channels: P.CHANNELS }), 150);
      return Promise.resolve();
    }
    post(m) { try { this.bc.postMessage(m); } catch { /* channel closed */ } }
    history() { return CF.store.get("cf.chat.history", {}); }
    saveHistory(msg) {
      const all = this.history(), room = P.roomOf(msg);
      (all[room] = all[room] || []).push(P.forHistory(msg));
      if (all[room].length > P.LIMITS.historyPerRoom) all[room].splice(0, all[room].length - P.LIMITS.historyPerRoom);
      if (!CF.store.set("cf.chat.history", all)) { // storage full: keep only the newest messages
        for (const k of Object.keys(all)) all[k] = all[k].slice(-30);
        CF.store.set("cf.chat.history", all);
      }
    }
    prune() {
      const now = Date.now();
      for (const [id, u] of this.users) if (now - u.seen > 25000) { this.users.delete(id); this.deliver("leave", { id }); }
    }
    broadcastLobby(l, closedId) {
      if (l) this.lobbies.set(l.id, l); else this.lobbies.delete(closedId);
      this.post({ type: "lobby", lobby: l, closed: closedId });
      this.deliver("lobbies", { lobbies: [...this.lobbies.values()] });
    }
    send(type, p = {}) {
      const me = this.me;
      switch (type) {
        case "status": Object.assign(me, P.cleanUser({ ...me, ...p })); this.post({ type: "presence", user: me }); this.deliver("presence", { user: me }); break;
        case "msg": {
          const msg = P.cleanMessage(p, me);
          if (!msg) return;
          this.saveHistory(msg);
          this.post({ type: "msg", msg });
          this.deliver("msg", { msg });
          break;
        }
        case "typing": this.post({ type: "typing", from: me.id, to: p.to }); break;
        case "lobby.create": this.broadcastLobby(P.cleanLobby(p.lobby || {}, me)); break;
        case "rtc": this.post({ type: "rtc", from: me.id, to: p.to, kind: p.kind, data: p.data }); break;
        default:
          if (type.startsWith("lobby.")) {
            const op = type.slice(6), l = this.lobbies.get(p.id);
            if (!l) return;
            if (l.host === me.id) { const next = P.applyLobbyOp(l, op, me, p); this.broadcastLobby(next, next ? null : l.id); }
            else this.post({ type: "lobby.req", op, id: p.id, user: me, payload: p });
          }
      }
    }
    recv(m) {
      const me = this.me;
      switch (m.type) {
        case "presence": {
          const known = this.users.has(m.user.id);
          this.users.set(m.user.id, { user: m.user, seen: Date.now() });
          this.deliver("presence", { user: m.user, joined: !known });
          break;
        }
        case "who": this.post({ type: "presence", user: me }); for (const l of this.lobbies.values()) if (l.host === me.id) this.post({ type: "lobby", lobby: l }); break;
        case "leave": this.users.delete(m.id); this.deliver("leave", { id: m.id }); for (const l of [...this.lobbies.values()]) if (l.host === m.id) this.broadcastLobby(null, l.id); break;
        case "msg": if (m.msg.to.startsWith("#") || m.msg.to === me.id) this.deliver("msg", { msg: m.msg }); break;
        case "typing": if (m.to.startsWith("#") || m.to === me.id) this.deliver("typing", m); break;
        case "lobby": if (m.lobby) this.lobbies.set(m.lobby.id, m.lobby); else this.lobbies.delete(m.closed); this.deliver("lobbies", { lobbies: [...this.lobbies.values()] }); break;
        case "lobby.req": {
          const l = this.lobbies.get(m.id);
          if (l && l.host === me.id) { const next = P.applyLobbyOp(l, m.op, m.user, m.payload); this.broadcastLobby(next, next ? null : l.id); }
          break;
        }
        case "rtc": if (m.to === me.id) this.deliver("rtc", m); break;
      }
    }
    close() { clearInterval(this.beat); this.post({ type: "leave", id: this.me.id }); for (const l of this.lobbies.values()) if (l.host === this.me.id) this.post({ type: "lobby", lobby: null, closed: l.id }); removeEventListener("beforeunload", this.unload); this.bc.close(); }
  }

  /* ---------------- helpers ---------------- */
  const EMOJI = "😀 😂 🤣 😊 😍 😎 🤔 😴 😭 😡 👍 👎 👏 🙌 🔥 💯 🎉 ❤️ 💙 ⭐ 💀 👾 🎮 🕹 🔫 💣 🚀 🍕 ☕ 🎧 🎸 🥁".split(" ");
  const SMILEYS = { ":)": "🙂", ":-)": "🙂", ":D": "😃", ";)": "😉", ":(": "🙁", ":P": "😛", ":p": "😛", "<3": "❤️", ":o": "😮", "B)": "😎" };
  function formatText(text) {
    let s = esc(text);
    s = s.replace(/(^|\s)(:\)|:-\)|:D|;\)|:\(|:P|:p|&lt;3|:o|B\))(?=\s|$)/g, (m, sp, code) => sp + (SMILEYS[code.replace("&lt;", "<")] || code));
    s = s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<i>$2</i>").replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\bhttps?:\/\/[^\s<]+/g, (u) => `<a class="chat-link clickable" data-url="${u}">${u}</a>`);
    return s;
  }
  const fileToDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  const blobToDataUrl = fileToDataUrl;
  const fmtSize = (n) => n > 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.ceil(n / 1e3) + " KB";
  const uid = () => CF.store.get("cf.chat.uid", null) || (() => { const id = "u" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); CF.store.set("cf.chat.uid", id); return id; })();
  // Each browser tab gets its own identity suffix so two tabs on one PC can chat with each other.
  const tabId = (() => { try { let t = sessionStorage.getItem("cf.chat.tab"); if (!t) { t = Math.random().toString(36).slice(2, 7); sessionStorage.setItem("cf.chat.tab", t); } return t; } catch { return Math.random().toString(36).slice(2, 7); } })();

  CF.register({
    id: "forgechat", name: "ForgeChat", icon: "forgechat", single: true, desc: "Instant messenger with channels, DMs, media, video calls and LAN game lobbies.",
    window: { w: 900, h: 600, maximized: true },
    open(win, args) {
      let hub = null, me = null, current = "#general", channels = P.CHANNELS;
      const users = new Map(), rooms = new Map(), unread = new Map(), typing = new Map();
      let lobbies = [], autoReplied = new Map(), call = null, ready = false;

      /* ---------- sign on ---------- */
      function signOnScreen() {
        const name = h("input", { class: "field", value: CF.settings.user, maxlength: 24 });
        const server = h("input", { class: "field", placeholder: "auto", value: CF.store.get("cf.chat.server", "") });
        const status = h("select", { class: "field" }, P.STATUSES.map(s => h("option", { value: s }, s[0].toUpperCase() + s.slice(1))));
        const av = h("img", { class: "chat-signon-av clickable", src: CF.avatar(), alt: "Avatar", title: "Click to change your picture" });
        av.addEventListener("click", pickAvatar);
        const go = h("button", { class: "btn", style: "width:100%;padding:8px" }, "Sign On");
        const note = h("div", { class: "muted", style: "font-size:11px;margin-top:8px" }, "Server: leave blank to auto-detect the ColeForge LAN server, or enter ws://<ip>:8098/forgechat to join a friend's.");
        go.addEventListener("click", () => signOn(name.value, server.value.trim(), status.value));
        name.addEventListener("keydown", (e) => { if (e.key === "Enter") go.click(); });
        win.body.replaceChildren(h("div", { class: "chat-signon" },
          h("div", { class: "chat-signon-card" },
            ...(is98() ? [h("img", { class: "fc-banner", src: "assets/art/forgechat/banner.png", alt: "ForgeChat" })] : [h("img", { src: CF.icon("forgechat"), alt: "", style: "width:72px" }), h("h2", {}, "ForgeChat")]), av,
            h("label", {}, "Screen Name"), name, h("label", {}, "Status"), status, h("label", {}, "Server"), server, go, note)));
        name.focus();
        function pickAvatar() { CF.pickAvatar().then(() => { av.src = CF.avatar(); }); }
      }

      async function signOn(name, server, status) {
        name = name.trim() || CF.settings.user;
        CF.store.set("cf.chat.server", server);
        me = P.cleanUser({ id: uid() + "-" + tabId, name, avatar: CF.avatar(), status });
        win.body.replaceChildren(h("div", { class: "chat-signon" }, h("div", { class: "chat-signon-card" }, h("img", { src: CF.icon("forgechat"), alt: "", style: "width:72px" }), h("h2", {}, "Signing on…"), h("div", { class: "seg-bar small", style: "width:220px;margin:auto" }, Array.from({ length: 10 }, (_, i) => h("i", { class: i < 4 ? "on" : "" }))))));
        const candidates = [];
        if (server) candidates.push(server);
        else if (location.protocol.startsWith("http")) candidates.push(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/forgechat`);
        for (const url of candidates) {
          try { const ws = new WsHub(url); ws.on(onEvent); await ws.connect(me); hub = ws; break; } catch { /* try next */ }
        }
        if (!hub) { hub = new LocalHub(); hub.on(onEvent); await hub.connect(me); }
        buildMain();
        CF.sound("logon");
      }

      /* ---------- main layout ---------- */
      const rail = h("div", { class: "chat-rail" });
      const header = h("div", { class: "chat-head" });
      const log = h("div", { class: "chat-log" });
      const typingEl = h("div", { class: "chat-typing" });
      const input = h("textarea", { class: "chat-input", rows: 2, placeholder: "Say something…  (Enter to send, Shift+Enter for a new line)" });
      const composer = h("div", { class: "chat-compose" });
      const center = h("div", { class: "chat-center" }, header, log, typingEl, composer);
      function buildMain() {
        const tool = (glyph, title, fn) => { const b = h("button", { class: "tool", title }, h("b", {}, glyph)); b.addEventListener("click", fn); return b; };
        composer.replaceChildren(
          h("div", { class: "chat-tools" }, tool(pix("smiley", "😊"), "Emoji", emojiPicker), tool(pix("gif", "GIF"), "Send a GIF", gifPicker), tool(pix("file", "📎"), "Share a file", shareFile), tool(pix("picture", "🖼"), "Send a picture", sharePicture),
            tool(pix("webcam", "📷"), "Webcam snapshot", webcamSnap), tool(pix("mic", "🎙"), "Record a voice clip", voiceClip), h("span", { style: "flex:1" }), h("span", { class: "muted", style: "font-size:11px" }, `Connected via ${hub.mode}`)),
          h("div", { class: "row", style: "margin:0" }, input, h("button", { class: "btn send-btn", onclick: sendText }, pix("send", ""), "Send")));
        win.body.replaceChildren(h("div", { class: "chat" }, rail, center));
        win.menubar([
          { label: "ForgeChat", items: () => [
            { label: "My Status", items: P.STATUSES.map(s => ({ label: s[0].toUpperCase() + s.slice(1), checked: me.status === s, action: () => setStatus(s) })) },
            { label: "Set Away Message…", action: setAway }, { label: "Change Picture…", action: () => CF.open("control", { tab: "account" }) }, "-",
            { label: "Sign Off", action: signOff }, { label: "Close", action: () => win.close() }] },
          { label: "Games", items: () => [{ label: "Game Lobbies", action: () => openRoom("lobbies") }, { label: "Host a Game…", action: hostLobby }, { label: "Open Forge Arcade", action: () => CF.open("arcade") }] },
          { label: "Help", items: [{ label: "About ForgeChat", action: () => CF.dialog({ title: "ForgeChat", icon: "forgechat", message: `Connected via ${hub.mode}.\n\nRun 'node coleforge/server/forgechat-server.js' on one PC and point friends at ws://<that-ip>:8098/forgechat to chat and host LAN games across machines.` }) }] },
        ]);
        renderRail(); openRoom(current);
      }

      /* ---------- events from hub ---------- */
      function onEvent(type, d) {
        switch (type) {
          case "welcome":
            if (d.you) me = d.you;
            channels = d.channels || channels;
            (d.users || []).forEach(u => users.set(u.id, u));
            lobbies = d.lobbies || [];
            for (const [room, msgs] of Object.entries(d.history || {})) rooms.set(room, msgs.slice());
            ready = true;
            if (log.isConnected) { renderRail(); openRoom(current); }
            break;
          case "presence": {
            const was = users.get(d.user.id);
            users.set(d.user.id, d.user);
            if (ready && d.user.id !== me.id && (!was || d.joined)) CF.sound("buddy_in");
            renderRail(); if (isDm(current) && current.includes(d.user.id)) renderHeader();
            break;
          }
          case "leave": if (users.has(d.id) && d.id !== me.id) { CF.sound("buddy_out"); users.delete(d.id); renderRail(); } break;
          case "msg": receive(d.msg); break;
          case "typing": {
            const room = d.to.startsWith("#") ? d.to : P.dmKey(d.from, me.id);
            typing.set(room + "|" + d.from, Date.now());
            if (room === current) renderTyping();
            break;
          }
          case "lobbies": {
            const before = lobbies;
            lobbies = d.lobbies;
            for (const l of lobbies) {
              const prev = before.find(b => b.id === l.id);
              const mine = l.players.some(p => p.id === me.id);
              if (mine && l.state === "starting" && prev?.state !== "starting") launchFromLobby(l);
              if (mine && l.host === me.id && l.players.length > 1 && l.players.every(p => p.ready) && !(prev && prev.players.length === l.players.length && prev.players.every(p => p.ready))) { CF.sound("lobby_ready"); CF.toast({ title: l.name, body: "Everyone is ready. Hit Start!", icon: "arcade" }); }
            }
            if (current === "lobbies") renderLobbies();
            renderRail();
            break;
          }
          case "rtc": onRtc(d); break;
          case "disconnected": CF.toast({ title: "ForgeChat", body: "Disconnected from the server.", icon: "warning" }); break;
        }
      }

      /* ---------- rooms ---------- */
      const isDm = (room) => room.startsWith("dm:");
      const dmPeer = (room) => room.slice(3).split("|").find(id => id !== me.id);
      function roomTitle(room) {
        if (room === "lobbies") return "🎮 Game Lobbies";
        if (isDm(room)) return users.get(dmPeer(room))?.name || "Offline buddy";
        return room;
      }
      function openRoom(room) {
        current = room; unread.delete(room);
        renderRail(); renderHeader();
        if (room === "lobbies") { composer.style.display = "none"; renderLobbies(); pollLobbyServers(); return; }
        composer.style.display = "";
        log.replaceChildren(...(rooms.get(room) || []).map(renderMsg));
        if (!log.children.length) log.append(h("div", { class: "chat-empty muted" }, isDm(room) ? "This is the start of your conversation." : `Welcome to ${room}! ${channels.find(c => c.id === room)?.topic || ""}`));
        log.scrollTop = log.scrollHeight;
        renderTyping();
        input.focus();
      }
      function renderHeader() {
        const btns = [];
        if (isDm(current)) {
          const peer = users.get(dmPeer(current));
          btns.push(h("button", { class: "btn icon", title: "Voice call", onclick: () => startCall(dmPeer(current), false), disabled: !peer }, pix("call", "📞")),
            h("button", { class: "btn icon", title: "Video call", onclick: () => startCall(dmPeer(current), true), disabled: !peer }, pix("video", "📹")));
          header.replaceChildren(h("img", { class: "chat-av", src: peer?.avatar || CF.icon("forgechat"), alt: "" }), h("div", { style: "flex:1" }, h("b", {}, roomTitle(current)), h("div", { class: "muted", style: "font-size:11px" }, peer ? (peer.status === "away" && peer.away ? "Away: " + peer.away : peer.status) : "offline")), ...btns);
        } else if (current === "lobbies") {
          header.replaceChildren(h("b", { style: "flex:1" }, pix("lobby", "🎮"), " Game Lobbies"), h("button", { class: "btn", onclick: hostLobby }, "Host a Game"));
        } else {
          header.replaceChildren(h("b", {}, "# " + current.slice(1)), h("span", { class: "muted", style: "flex:1;margin-left:10px" }, channels.find(c => c.id === current)?.topic || ""));
        }
        win.setTitle(`${roomTitle(current)} - ForgeChat`);
      }
      function renderRail() {
        if (!me) return;
        const section = (label) => h("div", { class: "chat-sec" }, label);
        const row = (room, label, icon, extra) => {
          const n = unread.get(room);
          const r = h("div", { class: "chat-room clickable" + (room === current ? " on" : "") }, icon, h("span", { style: "flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" }, label), extra || null, n ? h("span", { class: "chat-badge" }, n) : null);
          r.addEventListener("click", () => openRoom(room));
          return r;
        };
        const buddies = [...users.values()].filter(u => u.id !== me.id).sort((a, b) => a.name.localeCompare(b.name));
        const meBox = h("div", { class: "chat-me" }, h("img", { class: "chat-av", src: me.avatar || CF.icon("forgechat"), alt: "" }), h("div", { style: "flex:1;min-width:0" }, h("b", {}, me.name), h("div", { class: "muted", style: "font-size:11px" }, h("i", { class: "chat-dot " + me.status }), " ", me.status === "away" && me.away ? me.away : me.status)));
        meBox.addEventListener("click", (e) => CF.contextMenu({ x: e.clientX, y: e.clientY }, [...P.STATUSES.map(s => ({ label: s, checked: me.status === s, action: () => setStatus(s) })), "-", { label: "Set Away Message…", action: setAway }, { label: "Sign Off", action: signOff }]));
        rail.replaceChildren(meBox,
          section("Channels"), ...channels.map(c => row(c.id, "# " + c.name, h("span", {}))),
          row("lobbies", "Game Lobbies", h("span", {}, pix("lobby", "🎮")), lobbies.length ? h("small", { class: "muted" }, lobbies.length) : null),
          section(`Buddies (${buddies.length} online)`),
          ...(buddies.length ? buddies.map(u => {
            const r = row(P.dmKey(me.id, u.id), u.name, h("span", { class: "chat-avwrap" }, h("img", { class: "chat-av sm", src: u.avatar || CF.icon("forgechat"), alt: "" }), h("i", { class: "chat-dot " + u.status })));
            r.title = u.away ? `Away: ${u.away}` : u.status;
            r.addEventListener("contextmenu", (e) => { e.preventDefault(); CF.contextMenu({ x: e.clientX, y: e.clientY }, [{ label: "Send Message", action: () => openRoom(P.dmKey(me.id, u.id)) }, { label: "Video Call", action: () => startCall(u.id, true) }, { label: "Voice Call", action: () => startCall(u.id, false) }, "-", { label: "Invite to my Lobby", disabled: !myLobby(), action: () => inviteToLobby(u.id) }]); });
            return r;
          }) : [h("div", { class: "muted pad", style: "font-size:11px" }, "No buddies online yet. Open another ForgeChat window or connect friends to your LAN server.")]));
      }
      function renderTyping() {
        const now = Date.now(), names = [];
        for (const [k, t] of typing) { const [room, from] = k.split(/\|(?=[^|]*$)/); if (now - t > 4000) typing.delete(k); else if (room === current && from !== me.id) names.push(users.get(from)?.name || "Someone"); }
        typingEl.textContent = names.length ? `${names.join(", ")} ${names.length > 1 ? "are" : "is"} typing…` : "";
      }
      const typingTimer = setInterval(() => { if (me && log.isConnected) renderTyping(); }, 1500);

      /* ---------- messages ---------- */
      function renderMsg(m) {
        const u = users.get(m.from) || { name: m.fromName || (m.from === me.id ? me.name : "Offline buddy"), avatar: null };
        const parts = [];
        if (m.text) parts.push(h("div", { class: "chat-text", html: formatText(m.text) }));
        if (m.gif) parts.push(h("img", { class: "chat-media", src: m.gif, alt: "GIF" }));
        if (m.image) parts.push(m.image.data ? h("img", { class: "chat-media clickable", src: m.image.data, alt: m.image.name, title: "Click to open in Forgecraft" }) : h("div", { class: "muted" }, "[image expired]"));
        if (m.voice) parts.push(m.voice.data ? h("audio", { controls: true, src: m.voice.data, class: "chat-voice" }) : h("div", { class: "muted" }, "[voice clip expired]"));
        if (m.file) parts.push(h("div", { class: "chat-file" }, h("img", { src: CF.icon("file"), alt: "" }), h("div", { style: "flex:1" }, h("b", {}, m.file.name), h("div", { class: "muted" }, fmtSize(m.file.size))),
          m.file.data ? h("a", { class: "btn icon", href: m.file.data, download: m.file.name }, pix("download", "⬇")) : h("span", { class: "muted" }, "expired")));
        if (m.server) parts.push(serverCard(m.server));
        const el = h("div", { class: "chat-msg" + (m.from === me.id ? " mine" : "") + (m.auto ? " auto" : "") },
          h("img", { class: "chat-av", src: u.avatar || CF.icon("forgechat"), alt: "" }),
          h("div", { class: "chat-bubble" }, h("div", { class: "chat-meta" }, h("b", {}, u.name), h("span", { class: "muted" }, new Date(m.ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })), m.auto ? h("span", { class: "muted" }, " (auto-response)") : null), ...parts));
        el.querySelectorAll(".chat-link").forEach(a => a.addEventListener("click", () => CF.open("browser", { url: a.dataset.url })));
        const img = el.querySelector("img.chat-media.clickable");
        if (img) img.addEventListener("click", () => CF.open("forgecraft", { dataUrl: m.image.data, name: m.image.name }));
        el.addEventListener("contextmenu", (e) => {
          if (e.target.closest("audio")) return;
          e.preventDefault();
          CF.contextMenu({ x: e.clientX, y: e.clientY }, [
            { label: "Copy text", disabled: !m.text, action: () => navigator.clipboard?.writeText(m.text) },
            { label: "Reply privately", disabled: m.from === me.id || !users.has(m.from), action: () => openRoom(P.dmKey(me.id, m.from)) },
            { label: "Save image to My Documents", disabled: !m.image?.data, action: () => CF.vfs.write(m.image.name, m.image.data, "image") },
          ]);
        });
        return el;
      }
      // A game server shared from Forge Game Browser: one click joins it.
      function serverCard(s) {
        const gb = (n) => h("img", { class: "px-ico", src: `assets/art/gamebrowser/${n}.png`, alt: "" });
        async function join() {
          const pw = {};
          if (s.password) {
            const r = await CF.dialog({ title: `Join ${s.name || s.address}`, icon: "question", message: "This server needs a password.", input: "", buttons: ["Join", "Cancel"] });
            if (r.button !== "Join") return;
            pw.password = r.value;
          }
          if (CF.joinServer) CF.joinServer({ address: s.address, name: s.name, iwad: s.iwad, pwads: s.pwads.map(name => ({ name })) }, pw);
        }
        return h("div", { class: "chat-server" },
          h("img", { class: "chat-server-logo", src: "assets/art/gamebrowser/logo.png", alt: "" }),
          h("div", { style: "flex:1;min-width:0" },
            h("b", {}, s.password ? gb("lock") : null, s.name || s.address),
            h("div", { class: "muted" }, [s.map, s.mode, `${s.players}/${s.max} players`, s.iwad].filter(Boolean).join(" · ")),
            h("div", { class: "muted chat-server-addr" }, s.address + (s.pwads.length ? " · " + s.pwads.join(", ") : ""))),
          h("div", { class: "chat-server-btns" },
            h("button", { class: "btn", onclick: join }, gb("join"), " Join"),
            h("button", { class: "btn flat", onclick: () => CF.open("gamebrowser", { select: s.address }) }, gb("logo"), " Browse")));
      }
      function receive(m) {
        const room = P.roomOf(m);
        if (!rooms.has(room)) rooms.set(room, []);
        const list = rooms.get(room);
        if (list.some(x => x.id === m.id)) return;
        list.push(m);
        if (list.length > P.LIMITS.historyPerRoom) list.shift();
        typing.delete(room + "|" + m.from);
        if (room === current && log.isConnected) {
          log.querySelector(".chat-empty")?.remove();
          const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
          log.append(renderMsg(m));
          if (nearBottom || m.from === me.id) log.scrollTop = log.scrollHeight;
          renderTyping();
        } else if (m.from !== me.id) {
          unread.set(room, (unread.get(room) || 0) + 1);
          renderRail();
        }
        if (m.from !== me.id) {
          CF.sound("chat_in");
          const hidden = room !== current || win.el.classList.contains("min") || !win.el.classList.contains("active");
          if (hidden) CF.toast({ title: `${users.get(m.from)?.name || "Buddy"}${room.startsWith("#") ? " in " + room : ""}`, body: m.text ? m.text.slice(0, 80) : m.image ? "sent a picture" : m.file ? "sent a file" : m.voice ? "sent a voice clip" : "sent a GIF", icon: "forgechat", onclick: () => { win.restore(); win.focus(); openRoom(room); } });
          // AIM-style auto-response while away
          if (isDm(room) && me.status === "away" && me.away && !m.auto && Date.now() - (autoReplied.get(m.from) || 0) > 120000) {
            autoReplied.set(m.from, Date.now());
            hub.send("msg", { to: m.from, text: me.away, auto: true });
          }
        }
      }
      function target() { return isDm(current) ? dmPeer(current) : current; }
      // Hooks for Forge Game Browser: see ForgeChat's lobbies, share a server into the chat.
      CF.chat = {
        online: () => !!(hub && me && ready),
        lobbies: () => lobbies,
        createLobby(lobby) { if (hub && me && !myLobby()) { hub.send("lobby.create", { lobby }); return true; } return false; },
        share(server) {
          if (!hub || !me) return false;
          if (current === "lobbies" || !current) openRoom("#games");
          send({ server, text: "" });
          win.restore(); win.focus();
          return true;
        },
      };
      function send(payload) {
        if (current === "lobbies") return;
        if (isDm(current) && !users.has(dmPeer(current))) return CF.dialog({ title: "ForgeChat", icon: "warning", message: "That buddy is offline." });
        hub.send("msg", { to: target(), id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...payload });
        CF.sound("chat_out");
      }
      function sendText() {
        const text = input.value.trim();
        if (!text) return;
        if (text.startsWith("/")) return command(text);
        send({ text }); input.value = "";
      }
      function command(text) {
        const [cmd, ...rest] = text.slice(1).split(" ");
        const arg = rest.join(" ");
        input.value = "";
        if (cmd === "away") { me.away = arg || "I'm away from my computer right now."; setStatus("away"); }
        else if (cmd === "back") setStatus("online");
        else if (cmd === "me") send({ text: `*${me.name} ${arg}*` });
        else if (cmd === "host") hostLobby();
        else if (cmd === "shrug") send({ text: (arg + " ¯\\_(ツ)_/¯").trim() });
        else CF.dialog({ title: "ForgeChat", icon: "info", message: "Commands: /away <message>, /back, /me <action>, /host, /shrug" });
      }
      let lastTyping = 0;
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); return; }
        if (Date.now() - lastTyping > 2500 && current !== "lobbies") { lastTyping = Date.now(); hub.send("typing", { to: target() }); }
      });
      input.addEventListener("paste", async (e) => {
        const f = [...e.clipboardData.files].find(x => x.type.startsWith("image/"));
        if (f) { e.preventDefault(); sendFileAs(f, f.type === "image/gif" ? "gif" : "image"); }
      });
      log.addEventListener("dragover", (e) => e.preventDefault());
      log.addEventListener("drop", (e) => { e.preventDefault(); [...e.dataTransfer.files].forEach(f => sendFileAs(f, f.type === "image/gif" ? "gif" : f.type.startsWith("image/") ? "image" : "file")); });

      async function sendFileAs(file, kind) {
        if (file.size > P.LIMITS.file) return CF.dialog({ title: "ForgeChat", icon: "warning", message: `${file.name} is ${fmtSize(file.size)}. The limit is ${fmtSize(P.LIMITS.file)}.` });
        const data = await fileToDataUrl(file);
        if (kind === "gif") send({ gif: data });
        else send({ [kind]: { name: file.name, type: file.type, size: file.size, data } });
      }
      const pickFile = (accept, kind) => { const inp = h("input", { type: "file", accept }); inp.addEventListener("change", () => inp.files[0] && sendFileAs(inp.files[0], kind === "auto" ? (inp.files[0].type === "image/gif" ? "gif" : "image") : kind)); inp.click(); };
      const shareFile = () => pickFile("*/*", "file");
      const sharePicture = () => pickFile("image/*", "auto");
      function emojiPicker(e) {
        const r = e.currentTarget.getBoundingClientRect();
        const menu = CF.contextMenu({ x: r.left, y: r.top - 180 }, []);
        menu.classList.add("chat-emoji");
        menu.append(...EMOJI.map(em => { const s = h("span", { class: "clickable" }, em); s.addEventListener("click", () => { input.setRangeText(em, input.selectionStart, input.selectionEnd, "end"); input.focus(); CF.closeMenus(); }); return s; }));
      }
      async function gifPicker() {
        const r = await CF.dialog({ title: "Send a GIF", icon: "forgechat", message: "Paste a GIF link, or leave it empty to pick a .gif from your PC.", input: "", buttons: ["Send", "Browse…", "Cancel"] });
        if (r.button === "Browse…" || (r.button === "Send" && !r.value.trim())) pickFile("image/gif", "gif");
        else if (r.button === "Send") send({ gif: r.value.trim() });
      }
      async function webcamSnap() {
        let stream;
        try { stream = await navigator.mediaDevices.getUserMedia({ video: true }); } catch (err) { return CF.dialog({ title: "Webcam", icon: "error", message: "No webcam available or permission denied.\n" + err.message }); }
        const v = h("video", { autoplay: true, playsinline: true, muted: true, style: "width:100%;border-radius:6px;background:#000" });
        v.srcObject = stream;
        const w = CF.createWindow({ title: "Webcam Snapshot", icon: "forgevision", w: 480, h: 440, resizable: false });
        const done = () => { stream.getTracks().forEach(t => t.stop()); w.close(true); };
        w.body.append(h("div", { class: "pad" }, v, h("div", { class: "row", style: "justify-content:center" },
          h("button", { class: "btn", onclick: () => { const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0); c.toBlob(async b => { send({ image: { name: "snapshot.jpg", type: "image/jpeg", size: b.size, data: await blobToDataUrl(b) } }); done(); }, "image/jpeg", 0.85); } }, "📷 Snap & Send"),
          h("button", { class: "btn flat", onclick: done }, "Cancel"))));
        w.on("close", () => stream.getTracks().forEach(t => t.stop()));
      }
      async function voiceClip() {
        let stream;
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (err) { return CF.dialog({ title: "Microphone", icon: "error", message: "No microphone available or permission denied.\n" + err.message }); }
        const rec = new MediaRecorder(stream), chunks = [];
        rec.ondataavailable = (e) => chunks.push(e.data);
        const started = Date.now();
        const label = h("div", { class: "msg" }, "Recording… 0s");
        const tick = setInterval(() => { label.textContent = `Recording… ${Math.round((Date.now() - started) / 1000)}s`; if (Date.now() - started > 60000) rec.stop(); }, 250);
        rec.onstop = async () => {
          clearInterval(tick); stream.getTracks().forEach(t => t.stop()); veil.remove();
          if (cancelled) return;
          const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
          send({ voice: { name: "voice-clip.webm", type: blob.type, size: blob.size, data: await blobToDataUrl(blob) } });
        };
        let cancelled = false;
        const veil = h("div", { class: "dlg-veil" }, h("div", { class: "dlg" }, h("div", { class: "win active" },
          h("div", { class: "titlebar" }, h("span", { class: "title" }, "Voice Clip")),
          h("div", { class: "dlg-body" }, h("img", { src: CF.icon("volume"), alt: "", style: "filter:invert(.6)" }), label),
          h("div", { class: "dlg-btns" }, h("button", { class: "btn", onclick: () => rec.stop() }, "⏹ Send"), h("button", { class: "btn flat", onclick: () => { cancelled = true; rec.stop(); } }, "Cancel")))));
        document.body.append(veil);
        rec.start();
      }
      function setStatus(s) { me.status = s; hub.send("status", { status: s, away: me.away }); renderRail(); }
      async function setAway() {
        const r = await CF.dialog({ title: "Away Message", icon: "forgechat", message: "Enter your away message. Buddies who message you will get it as an auto-response.", input: me.away || "I'm away from my computer right now.", buttons: ["I'm Away", "Cancel"] });
        if (r.button === "I'm Away") { me.away = r.value.trim().slice(0, P.LIMITS.away); setStatus("away"); }
      }
      function signOff() { endCall(); if (hub) hub.close(); hub = null; ready = false; rooms.clear(); users.clear(); CF.sound("buddy_out"); signOnScreen(); }

      /* ---------- game lobbies ---------- */
      const games = () => CF.games || { doom: { name: "Doom", maps: ["MAP01"] } };
      const myLobby = () => lobbies.find(l => l.players.some(p => p.id === me.id));
      function renderLobbies() {
        const mine = myLobby();
        log.replaceChildren(
          h("div", { class: "lobby-intro" }, h("img", { src: CF.icon("arcade"), alt: "" }), h("div", { style: "flex:1" }, h("b", {}, "LAN Game Lobbies"), h("div", { class: "muted" }, "Host a DOOM Legacy, Zandronum, Quake or Duke Nukem 3D match, invite buddies, ready up, and ColeForge launches everyone into the same game.")),
            h("button", { class: "btn", onclick: () => CF.open("gamebrowser") }, h("img", { class: "px-ico", src: "assets/art/gamebrowser/logo.png", alt: "" }), " Server Browser")),
          ...(lobbies.length ? lobbies.map(l => {
            const g = games()[l.game] || { name: l.game };
            const inIt = l.players.some(p => p.id === me.id), isHost = l.host === me.id;
            const meP = l.players.find(p => p.id === me.id);
            const actions = [];
            if (!inIt && l.state === "open" && l.players.length < l.max && !mine) actions.push(h("button", { class: "btn", onclick: () => hub.send("lobby.join", { id: l.id }) }, "Join"));
            if (inIt && !isHost) actions.push(h("button", { class: "btn" + (meP.ready ? " flat" : ""), onclick: () => hub.send("lobby.ready", { id: l.id, ready: !meP.ready }) }, meP.ready ? "Not Ready" : "Ready!"), h("button", { class: "btn flat", onclick: () => hub.send("lobby.leave", { id: l.id }) }, "Leave"));
            if (isHost) actions.push(h("button", { class: "btn", onclick: () => hub.send("lobby.start", { id: l.id }) }, "▶ Start"), h("button", { class: "btn flat", onclick: () => hub.send("lobby.close", { id: l.id }) }, "Close"));
            if (inIt && l.state === "starting") actions.push(h("button", { class: "btn", onclick: () => launchFromLobby(l) }, "Launch again"));
            return h("div", { class: "lobby-card" + (inIt ? " mine" : "") },
              h("img", { class: "lobby-art", src: CF.gameArt ? CF.gameArt(l.game) : CF.icon("arcade"), alt: "" }),
              h("div", { style: "flex:1;min-width:0" },
                h("div", {}, h("b", {}, l.name), h("span", { class: "muted" }, ` · ${g.name} · ${l.map} · ${l.mode} · ${l.players.length}/${l.max}`), l.state === "starting" ? h("span", { class: "lobby-live" }, " IN GAME") : null),
                h("div", { class: "muted", style: "font-size:11px" }, `Host: ${l.hostName}${l.address ? " @ " + l.address : ""}${l.files ? " · " + l.files : ""}`),
                l.game === "zandronum" && l.address ? lobbyServerLine(l) : null,
                h("div", { class: "lobby-players" }, l.players.map(p => h("span", { class: "lobby-p" + (p.ready ? " ready" : "") }, (p.id === l.host ? "★ " : "") + p.name + (p.ready ? " ✓" : ""))))),
              h("div", { class: "lobby-actions" }, actions));
          }) : [h("div", { class: "chat-empty muted" }, "No games running. Be the hero — host one!")]));
      }
      // Zandronum lobbies show what the real server says (map, players) once it's up.
      const serverStatus = new Map(); // address -> { at, text, ok }
      function lobbyServerLine(l) {
        const addr = /:\d+$/.test(l.address) ? l.address : l.address + ":10666";
        const st = serverStatus.get(addr);
        return h("div", { class: "lobby-server" + (st?.ok ? " up" : "") }, h("img", { class: "px-ico", src: "assets/art/gamebrowser/" + (st?.ok ? "ping-good" : "host") + ".png", alt: "" }), " ", st ? st.text : "Checking server…");
      }
      async function pollLobbyServers() {
        if (current !== "lobbies" || !log.isConnected) return;
        const addrs = [...new Set(lobbies.filter(l => l.game === "zandronum" && l.address).map(l => /:\d+$/.test(l.address) ? l.address : l.address + ":10666"))];
        if (!addrs.length) return;
        await Promise.all(addrs.map(async (addr) => {
          try {
            const r = await fetch("/api/zandronum/query?addr=" + encodeURIComponent(addr)).then(res => res.json());
            serverStatus.set(addr, r.status === "ok"
              ? { ok: true, text: `Server up: ${r.info.name} · ${r.info.map} · ${r.info.numPlayers}/${r.info.maxClients} players · ${r.ping} ms` }
              : { ok: false, text: "Server not answering yet (starts when the host hits Start)" });
          } catch { serverStatus.set(addr, { ok: false, text: "Server status needs the ColeForge LAN server" }); }
        }));
        if (current === "lobbies") renderLobbies();
      }
      const lobbyStatusTimer = setInterval(pollLobbyServers, 12000);
      async function hostLobby() {
        if (myLobby()) return CF.dialog({ title: "ForgeChat", icon: "info", message: "You're already in a lobby. Leave it first." });
        const gs = games();
        const gameSel = h("select", { class: "field" }, Object.entries(gs).map(([id, g]) => h("option", { value: id }, g.name)));
        const mapSel = h("select", { class: "field" });
        const fillMaps = () => mapSel.replaceChildren(...(gs[gameSel.value].maps || ["MAP01"]).map(m => h("option", {}, m)));
        gameSel.addEventListener("change", fillMaps); fillMaps();
        const mode = h("select", { class: "field" }, h("option", { value: "deathmatch" }, "Deathmatch"), h("option", { value: "coop" }, "Co-op"));
        const max = h("input", { class: "field", type: "number", min: 2, max: 16, value: 4, style: "width:70px" });
        const name = h("input", { class: "field", value: `${me.name}'s LAN Party` });
        const addr = h("input", { class: "field", placeholder: "your LAN IP, e.g. 192.168.1.20", value: CF.store.get("cf.lan.ip", "") });
        const files = h("input", { class: "field", placeholder: "optional: maps.wad, mod.pk3" });
        const w = CF.createWindow({ title: "Host a Game", icon: "arcade", w: 420, h: 390, resizable: false });
        w.body.append(h("div", { class: "pad form-grid" }, "Lobby name", name, "Game", gameSel, "Map", mapSel, "Mode", mode, "Max players", max, "Host address", addr, "WADs / mods", files,
          h("div", {}), h("div", { class: "row" }, h("button", { class: "btn", onclick: () => {
            CF.store.set("cf.lan.ip", addr.value.trim());
            hub.send("lobby.create", { lobby: { name: name.value, game: gameSel.value, map: mapSel.value, mode: mode.value, max: +max.value, address: addr.value.trim(), files: files.value.trim() } });
            w.close(true); openRoom("lobbies");
          } }, "Create Lobby"), h("button", { class: "btn flat", onclick: () => w.close(true) }, "Cancel"))));
      }
      function inviteToLobby(userId) {
        const l = myLobby(); if (!l) return;
        hub.send("msg", { to: userId, text: `🎮 Join my ${games()[l.game]?.name || l.game} lobby "${l.name}" (${l.map}, ${l.mode})! Open Game Lobbies to hop in.` });
      }
      function launchFromLobby(l) {
        CF.sound("lobby_ready");
        if (CF.launchGame) CF.launchGame(l, me.id === l.host);
        else CF.toast({ title: l.name, body: "Game starting!", icon: "arcade" });
      }

      /* ---------- WebRTC calls (1:1) ---------- */
      const rtcConfig = () => ({ iceServers: (CF.store.get("cf.chat.stun", "") || "").split(",").filter(Boolean).map(u => ({ urls: u.trim() })) });
      function callWindow(peerId, video) {
        const peer = users.get(peerId);
        const remote = h("video", { class: "call-remote", autoplay: true, playsinline: true });
        const local = h("video", { class: "call-local", autoplay: true, playsinline: true, muted: true });
        const stateEl = h("div", { class: "call-state" }, "Calling…");
        const w = CF.createWindow({ title: `Call with ${peer?.name || "buddy"}`, icon: "forgechat", w: 640, h: 480 });
        const tb = (glyph, title, fn) => h("button", { class: "btn icon", title, onclick: fn }, glyph);
        w.body.append(h("div", { class: "call" }, remote, local, stateEl,
          h("div", { class: "call-bar" }, tb(pix("mic", "🎙"), "Mute / unmute", () => toggleTrack("audio")), tb(pix("webcam", "📷"), "Camera on / off", () => toggleTrack("video")), tb(pix("screen", "🖥"), "Share screen", shareScreen), h("button", { class: "btn hangup", onclick: () => endCall() }, pix("hangup", ""), "Hang Up"))));
        w.on("close", () => endCall());
        return { w, remote, local, stateEl };
      }
      async function getMedia(video) {
        try { return await navigator.mediaDevices.getUserMedia({ audio: true, video }); }
        catch { try { return await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return new MediaStream(); } }
      }
      function makePc(peerId) {
        const pc = new RTCPeerConnection(rtcConfig());
        pc.onicecandidate = (e) => e.candidate && hub.send("rtc", { to: peerId, kind: "ice", data: e.candidate.toJSON() });
        pc.ontrack = (e) => { if (call) { call.ui.remote.srcObject = e.streams[0]; call.ui.stateEl.textContent = ""; } };
        pc.onconnectionstatechange = () => { if (call && ["failed", "disconnected"].includes(pc.connectionState)) { call.ui.stateEl.textContent = "Connection lost"; } };
        return pc;
      }
      async function startCall(peerId, video) {
        if (call) return CF.dialog({ title: "ForgeChat", icon: "info", message: "You're already in a call." });
        if (!window.RTCPeerConnection) return CF.dialog({ title: "ForgeChat", icon: "error", message: "Calls aren't supported here." });
        const stream = await getMedia(video);
        const ui = callWindow(peerId, video);
        ui.local.srcObject = stream;
        const pc = makePc(peerId);
        stream.getTracks().forEach(t => pc.addTrack(t, stream));
        call = { peerId, pc, stream, ui, pending: [] };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        hub.send("rtc", { to: peerId, kind: "offer", data: { sdp: { type: offer.type, sdp: offer.sdp }, video } });
      }
      async function onRtc(d) {
        const from = users.get(d.from);
        if (d.kind === "offer") {
          if (call) return hub.send("rtc", { to: d.from, kind: "busy" });
          const ring = setInterval(() => CF.sound("call_ring"), 1800); CF.sound("call_ring");
          const r = await CF.dialog({ title: "Incoming Call", icon: "forgechat", message: `${from?.name || "A buddy"} is ${d.data.video ? "video " : ""}calling you.`, buttons: ["Answer", "Decline"] });
          clearInterval(ring);
          if (r.button !== "Answer") return hub.send("rtc", { to: d.from, kind: "hangup" });
          const stream = await getMedia(!!d.data.video);
          const ui = callWindow(d.from, d.data.video);
          ui.local.srcObject = stream; ui.stateEl.textContent = "Connecting…";
          const pc = makePc(d.from);
          stream.getTracks().forEach(t => pc.addTrack(t, stream));
          call = { peerId: d.from, pc, stream, ui, pending: [] };
          await pc.setRemoteDescription(d.data.sdp);
          for (const c of call.pending) await pc.addIceCandidate(c).catch(() => {});
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          hub.send("rtc", { to: d.from, kind: "answer", data: { sdp: { type: ans.type, sdp: ans.sdp } } });
        } else if (!call || call.peerId !== d.from) {
          return;
        } else if (d.kind === "answer") {
          await call.pc.setRemoteDescription(d.data.sdp);
          for (const c of call.pending) await call.pc.addIceCandidate(c).catch(() => {});
          call.ui.stateEl.textContent = "Connecting…";
        } else if (d.kind === "ice") {
          if (call.pc.remoteDescription) call.pc.addIceCandidate(d.data).catch(() => {}); else call.pending.push(d.data);
        } else if (d.kind === "hangup" || d.kind === "busy") {
          CF.toast({ title: "ForgeChat", body: d.kind === "busy" ? `${from?.name || "Buddy"} is busy.` : "Call ended.", icon: "forgechat" });
          endCall(true);
        }
      }
      function toggleTrack(kind) { call?.stream.getTracks().filter(t => t.kind === kind).forEach(t => { t.enabled = !t.enabled; }); }
      async function shareScreen() {
        if (!call || !navigator.mediaDevices.getDisplayMedia) return;
        try {
          const scr = await navigator.mediaDevices.getDisplayMedia({ video: true });
          const track = scr.getVideoTracks()[0];
          const sender = call.pc.getSenders().find(s => s.track && s.track.kind === "video");
          if (sender) await sender.replaceTrack(track); else call.pc.addTrack(track, scr);
          call.ui.local.srcObject = scr;
          track.onended = () => { const cam = call?.stream.getVideoTracks()[0]; if (sender && cam) sender.replaceTrack(cam); if (call) call.ui.local.srcObject = call.stream; };
        } catch { /* user cancelled */ }
      }
      function endCall(remoteEnded) {
        if (!call) return;
        const c = call; call = null;
        if (!remoteEnded && hub) hub.send("rtc", { to: c.peerId, kind: "hangup" });
        c.stream.getTracks().forEach(t => t.stop());
        try { c.pc.close(); } catch { /* closed */ }
        c.ui.w.close(true);
      }

      win.on("args", (a) => { if (a.room && me) openRoom(a.room); });
      win.on("close", () => { clearInterval(typingTimer); clearInterval(lobbyStatusTimer); endCall(); if (hub) hub.close(); CF.chat = null; });
      signOnScreen();
      if (args.autoSignOn) signOn(CF.settings.user, "", "online");
    },
  });
})();
