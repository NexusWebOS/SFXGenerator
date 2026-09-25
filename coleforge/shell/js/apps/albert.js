"use strict";

// Albert: ColeForge's own agent, powered by Claude. A chat window with Albert himself on the left
// (animated from assets/art/albert/albert-sheet.png), who can use the desktop's tools (js/albert/).
(function () {
  const { h } = CF;
  const ART = "assets/art/albert/";
  const CHAT_KEY = "cf.albert.chat", MODEL_KEY = "cf.albert.model", EFFORT_KEY = "cf.albert.effort";
  const EFFORTS = [["", "Auto"], ["low", "Quick"], ["medium", "Balanced"], ["high", "Deep"], ["max", "Deepest"]];
  const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
  const TEXT_FILE = /\.(txt|md|csv|tsv|json|js|mjs|ts|tsx|jsx|py|gd|cs|cpp|c|h|hpp|lua|java|rs|go|html|css|xml|ya?ml|toml|ini|cfg|log|sql|sh|bat|ps1|shader|glsl|hlsl)$/i;
  const ROWS = { idle: 0, talk: 1, think: 2, happy: 3 };
  const TOOL_WORDS = { system_info: "looking around the desktop", list_apps: "checking the programs", open_app: "opening a program", close_window: "closing a window", list_documents: "looking in My Documents",
    read_document: "reading a document", write_document: "writing a document", delete_document: "tidying My Documents", nightamp: "working NightAmp", open_web: "opening NightBrowser", change_setting: "changing a setting",
    notify: "leaving a note", nightcode_board: "checking NightCode Net", remember: "remembering that", forget: "forgetting that", web_search: "searching the web",
    web_fetch: "reading a web page", search_documents: "searching My Documents", run_javascript: "working it out in the scratchpad" };

  // Tiny Markdown: **bold**, *italic*, `code`, ``` blocks, lists, links. Everything else is escaped.
  function md(src) {
    const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const inline = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" data-link="$2">$1</a>').replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" data-link="$2">$2</a>');
    const out = [];
    const parts = String(src).split(/```[a-z0-9]*\n?/i);
    parts.forEach((part, i) => {
      if (i % 2) { out.push(`<pre>${esc(part.replace(/\n$/, ""))}</pre>`); return; }
      let list = null;
      for (const line of part.split("\n")) {
        const li = /^\s*(?:[-*•]|\d+\.)\s+(.*)$/.exec(line);
        if (li) { if (!list) { list = []; } list.push(`<li>${inline(li[1])}</li>`); continue; }
        if (list) { out.push(`<ul>${list.join("")}</ul>`); list = null; }
        if (line.trim()) out.push(`<p>${inline(line)}</p>`);
      }
      if (list) out.push(`<ul>${list.join("")}</ul>`);
    });
    return out.join("");
  }

  // What goes into storage: at most the newest 160 messages (cut where a new exchange starts, so the
  // chat stays valid), and pictures replaced by a note (they'd fill the browser's storage).
  const plainUser = (m) => m.role === "user" && Array.isArray(m.content) && !m.content.some((b) => b.type === "tool_result");
  const noPics = (list) => list.map((b) => (b.type === "image" ? { type: "text", text: "[a picture was here]" } : b.type === "tool_result" && Array.isArray(b.content) ? Object.assign({}, b, { content: noPics(b.content) }) : b));
  function forStorage(chat) {
    let msgs = chat.messages;
    if (msgs.length > 160) { let i = msgs.length - 160; while (i < msgs.length && !plainUser(msgs[i])) i++; msgs = msgs.slice(i); }
    return { v: 2, system: chat.system, messages: msgs.map((m) => (m.role === "user" && Array.isArray(m.content) ? Object.assign({}, m, { content: noPics(m.content) }) : m)) };
  }
  const kfmt = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(n));

  // Pictures bigger than Claude needs are scaled down (long side 1568 px) before they're sent.
  function readAttachment(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error(`Couldn't read ${file.name}.`));
      if (IMAGE_TYPES.includes(file.type)) {
        fr.onload = () => {
          const img = new Image();
          img.onload = () => {
            const scale = Math.min(1, 1568 / Math.max(img.width, img.height));
            if (scale === 1 && file.size < 3.5 * 1024 * 1024) return resolve({ kind: "image", name: file.name, media_type: file.type, data: String(fr.result).split(",")[1], url: fr.result });
            const c = document.createElement("canvas");
            c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
            const g = c.getContext("2d"); g.imageSmoothingEnabled = scale < 1 && !/pixel|sprite/i.test(file.name); g.drawImage(img, 0, 0, c.width, c.height);
            const url = c.toDataURL(file.type === "image/jpeg" ? "image/jpeg" : "image/png", 0.9);
            resolve({ kind: "image", name: file.name, media_type: url.slice(5, url.indexOf(";")), data: url.split(",")[1], url });
          };
          img.onerror = () => reject(new Error(`${file.name} isn't a picture I can read.`));
          img.src = fr.result;
        };
        fr.readAsDataURL(file);
      } else if (TEXT_FILE.test(file.name) || file.type.startsWith("text/")) {
        if (file.size > 400 * 1024) return reject(new Error(`${file.name} is too big to attach (400 KB max). Put it in My Documents and ask me to read it.`));
        fr.onload = () => resolve({ kind: "text", name: file.name, text: String(fr.result) });
        fr.readAsText(file);
      } else reject(new Error(`I can take pictures (PNG, JPEG, GIF, WebP) and text files, not ${file.name}.`));
    });
  }

  CF.register({
    id: "albert", name: "Albert", icon: "albert", single: true,
    desc: "Albert, your ColeForge companion (powered by Claude): he can use the desktop's programs, files, NightAmp and the web, see pictures and work things out.",
    window: { w: 860, h: 600 },
    open(win) {
      let chat = AlbertBrain.upgrade(CF.store.get(CHAT_KEY, null));
      let model = CF.store.get(MODEL_KEY, "claude-opus-5");
      let effort = CF.store.get(EFFORT_KEY, "");
      let busy = false, abort = null, pending = [];

      /* ---------- Albert himself ---------- */
      const sprite = h("canvas", { class: "alb-sprite", width: 64, height: 64, title: "Albert" });
      const mood = h("div", { class: "alb-mood" }, "listening");
      let state = "idle", frame = 0, tick = 0, happyUntil = 0;
      const sheet = new Image(); sheet.src = `${ART}albert-sheet.png`;
      const sctx = sprite.getContext("2d");
      const anim = setInterval(() => {
        const s = Date.now() < happyUntil ? "happy" : state;
        tick++;
        const speed = s === "idle" ? 3 : 1;                                   // idle breathes slowly
        if (tick % speed) return;
        frame = (frame + 1) % 4;
        if (s === "idle" && frame === 2 && Math.random() < 0.6) frame = 3;     // blinks now and then
        sctx.clearRect(0, 0, 64, 64);
        if (sheet.complete) sctx.drawImage(sheet, frame * 64, ROWS[s] * 64, 64, 64, 0, 0, 64, 64);
      }, 180);
      const setState = (s, words) => { state = s; mood.textContent = words || { idle: "listening", think: "thinking…", talk: "talking", happy: "done!" }[s]; };

      /* ---------- chat ---------- */
      const log = h("div", { class: "alb-log" });
      const input = h("textarea", { class: "alb-input", rows: 2, placeholder: "Talk to Albert…  (Enter sends, Shift+Enter for a new line; paste or drop pictures and files)" });
      const sendBtn = h("button", { class: "btn alb-send" }, "Send");
      const stopBtn = h("button", { class: "btn alb-stop", hidden: true }, "Stop");
      const picker = h("input", { type: "file", multiple: true, hidden: true, accept: "image/png,image/jpeg,image/gif,image/webp,text/*,.md,.csv,.json,.js,.ts,.py,.gd,.cs,.lua,.html,.css,.xml,.yaml,.yml,.toml,.ini,.log,.glsl,.shader" });
      const attachBtn = h("button", { class: "btn alb-attach", title: "Attach pictures or files" }, "📎");
      const tray = h("div", { class: "alb-tray", hidden: true });
      const effortSel = h("select", { class: "field alb-effort", title: "How hard Albert thinks: Auto lets Claude decide; Deep and Deepest take longer and cost more" }, EFFORTS.map(([v, l]) => h("option", { value: v, selected: v === effort }, l)));
      effortSel.addEventListener("change", () => { effort = effortSel.value; CF.store.set(EFFORT_KEY, effort); });
      const side = h("div", { class: "alb-side" }, h("div", { class: "alb-stage" }, sprite), h("div", { class: "alb-name" }, "ALBERT"), mood,
        h("label", { class: "alb-think" }, "Thinking ", effortSel),
        h("div", { class: "alb-btns" }, btn("New chat", newChat), btn("Memory…", memoryDlg), btn("Settings…", settingsDlg)),
        h("div", { class: "alb-foot muted" }, "Powered by Claude"));
      const main = h("div", { class: "alb-main" }, log, tray, h("div", { class: "alb-bar" }, attachBtn, picker, input, sendBtn, stopBtn));
      win.body.append(h("div", { class: "alb" }, side, main));
      function btn(label, fn) { const b = h("button", { class: "btn" }, label); b.addEventListener("click", fn); return b; }

      const scroll = () => { if (log.scrollHeight - log.scrollTop - log.clientHeight < 160) log.scrollTop = log.scrollHeight; };
      const links = (el) => el.querySelectorAll("a[data-link]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); CF.open("nightbrowser", { url: a.dataset.link }); }));
      const bubbleEl = (who, html, cls = "") => {
        const b = h("div", { class: `alb-msg ${who} ${cls}` }, who === "albert" ? h("img", { class: "alb-face", src: `${ART}albert-icon.png`, alt: "" }) : null, h("div", { class: "alb-text", html }));
        links(b); return b;
      };
      const chipEl = (text, cls = "") => h("div", { class: `alb-chip ${cls}` }, text);
      const thoughtsEl = (text, open = false) => h("details", { class: "alb-thoughts", open }, h("summary", {}, "💭 Albert's thoughts"), h("div", { class: "alb-thoughts-text" }, text));
      function bubble(who, html, cls) { const b = bubbleEl(who, html, cls); log.append(b); log.scrollTop = log.scrollHeight; return b; }
      function chip(text, cls) { const c = chipEl(text, cls); log.append(c); scroll(); return c; }
      function blockNodes(content) {
        const out = [];
        for (const b of content || []) {
          if (b.type === "thinking" && b.thinking?.trim()) out.push(thoughtsEl(b.thinking));
          else if (b.type === "text" && b.text.trim()) out.push(bubbleEl("albert", md(b.text)));
          else if (b.type === "tool_use") out.push(chipEl(`⚙ ${TOOL_WORDS[b.name] || b.name}`));
          else if (b.type === "server_tool_use") out.push(chipEl(`${b.name === "web_fetch" ? "🌐" : "🔎"} ${TOOL_WORDS[b.name] || b.name}${b.input?.query ? `: ${b.input.query}` : b.input?.url ? `: ${b.input.url}` : ""}`));
          else if (b.type === "compaction") out.push(chipEl("🗜 Albert summarized the older part of this chat to make room", "alb-note"));
        }
        return out;
      }
      function userNodes(m) {
        const out = [];
        const blocks = Array.isArray(m.content) ? m.content : [{ type: "text", text: m.content }];
        if (blocks.some((b) => b.type === "tool_result")) return out;
        for (const b of blocks) {
          if (b.type === "image") out.push(h("div", { class: "alb-msg you" }, h("img", { class: "alb-pic", src: `data:${b.source.media_type};base64,${b.source.data}`, alt: "" })));
          else if (b.type === "text" && /^<attached_file name="([^"]*)">/.test(b.text)) out.push(chipEl(`📎 ${/^<attached_file name="([^"]*)">/.exec(b.text)[1]}`, "alb-you"));
          else if (b.type === "text" && !/^<desktop |^Attached picture: |^\[a picture was here\]/.test(b.text)) out.push(bubbleEl("you", md(b.text)));
          else if (b.type === "text" && b.text.startsWith("[a picture was here]")) out.push(chipEl("🖼 (picture)", "alb-you"));
        }
        return out;
      }
      function renderAll() {
        log.replaceChildren();
        if (!chat.messages.length) greet();
        for (const m of chat.messages) log.append(...(m.role === "user" ? userNodes(m) : blockNodes(m.content)));
        log.scrollTop = log.scrollHeight;
      }
      function greet() {
        bubble("albert", md(`Hi Cole. I'm **Albert**, your ColeForge companion.\n\nI can open programs, read and write your documents, drive NightAmp, search and read the web, look at pictures you drop in here, work things out in my scratchpad and check NightCode Net. I'll ask before I change anything.\n\nWhat are we building?`));
      }
      const save = () => CF.store.set(CHAT_KEY, forStorage(chat));

      /* ---------- attachments ---------- */
      function paintTray() {
        tray.hidden = !pending.length;
        tray.replaceChildren(...pending.map((a, i) => h("span", { class: "alb-att" }, a.kind === "image" ? h("img", { src: a.url, alt: "" }) : "📄", ` ${a.name} `,
          h("button", { class: "alb-x", title: "Remove", onclick: () => { pending.splice(i, 1); paintTray(); } }, "×"))));
      }
      async function attach(files) {
        for (const f of [...files].slice(0, 8)) {
          try { pending.push(await readAttachment(f)); } catch (e) { CF.toast({ title: "Albert", body: e.message, icon: "albert" }); }
        }
        paintTray(); input.focus();
      }
      attachBtn.addEventListener("click", () => picker.click());
      picker.addEventListener("change", () => { attach(picker.files); picker.value = ""; });
      input.addEventListener("paste", (e) => { const f = [...(e.clipboardData?.files || [])]; if (f.length) { e.preventDefault(); attach(f); } });
      main.addEventListener("dragover", (e) => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); main.classList.add("alb-drop"); } });
      main.addEventListener("dragleave", (e) => { if (!main.contains(e.relatedTarget)) main.classList.remove("alb-drop"); });
      main.addEventListener("drop", (e) => { main.classList.remove("alb-drop"); if (e.dataTransfer?.files?.length) { e.preventDefault(); attach(e.dataTransfer.files); } });

      /* ---------- one exchange, drawn live ---------- */
      let live = null;          // the step Claude is writing right now
      const paintSoon = (fn) => { if (!live || live.raf) return; live.raf = requestAnimationFrame(() => { if (live) { live.raf = 0; fn(); } }); };
      function liveStep() {
        if (!live) { live = { el: h("div", { class: "alb-step" }), texts: new Map(), thoughts: null, raf: 0 }; log.append(live.el); }
        return live;
      }
      function paintLive() {
        for (const t of live.texts.values()) { t.body.innerHTML = md(t.text); links(t.el); }
        if (live.thoughts) live.thoughts.body.textContent = live.thoughts.text;
        scroll();
      }
      function onStep(s) {
        switch (s.kind) {
          case "status": setState(s.state === "think" ? "think" : "idle", s.note); break;
          case "thinking": {
            const l = liveStep();
            if (!l.thoughts) { const el = thoughtsEl("", true); l.thoughts = { el, body: el.querySelector(".alb-thoughts-text"), text: "" }; l.el.append(el); setState("think", "thinking it through…"); }
            l.thoughts.text += s.d; paintSoon(paintLive); break;
          }
          case "text": {
            const l = liveStep();
            let t = l.texts.get(s.i);
            if (!t) { const el = bubbleEl("albert", ""); t = { el, body: el.querySelector(".alb-text"), text: "" }; l.texts.set(s.i, t); l.el.append(el); setState("talk"); }
            t.text += s.d; paintSoon(paintLive); break;
          }
          case "block": {
            const l = liveStep();
            l.el.append(chipEl(s.type === "server_tool_use" ? `${s.name === "web_fetch" ? "🌐" : "🔎"} ${TOOL_WORDS[s.name] || s.name}…` : s.type === "tool_use" ? `⚙ ${TOOL_WORDS[s.name] || s.name}…` : "…", "alb-wait"));
            if (s.name) setState("think", TOOL_WORDS[s.name] || "working…");
            scroll(); break;
          }
          case "assistant": {
            const nodes = blockNodes(s.content);
            if (live) { cancelAnimationFrame(live.raf); live.el.replaceWith(...nodes); live = null; } else log.append(...nodes);
            scroll(); break;
          }
          case "tool": setState("think", TOOL_WORDS[s.name] || "working…"); break;
          case "tool_done": if (!s.ok) chip(`✗ ${s.error}`, "alb-err"); break;
          case "refusal": bubble("albert", md("I can't help with that one."), "alb-err"); break;
          case "truncated": chip("✂ I ran out of room in that answer. Say “continue” and I'll pick it up.", "alb-note"); break;
          case "steps": chip("That took a lot of steps, so I paused. Say “carry on” to keep going.", "alb-note"); break;
          case "usage": {
            const u = s.total, read = u.input + u.cached + u.written;
            if (read) chip(`${kfmt(read)} tokens read${u.cached ? ` (${Math.round(u.cached * 100 / read)}% from cache)` : ""} · ${kfmt(u.output)} written · ${u.steps} step${u.steps > 1 ? "s" : ""}`, "alb-usage");
            break;
          }
        }
      }

      async function send() {
        const text = input.value.trim();
        if ((!text && !pending.length) || busy) return;
        const attachments = pending; pending = []; paintTray();
        input.value = "";
        const preview = [...attachments.map((a) => (a.kind === "image" ? { type: "image", source: { media_type: a.media_type, data: a.data } } : { type: "text", text: `<attached_file name="${a.name}">` })), { type: "text", text: text || "(see the attachments)" }];
        log.append(...userNodes({ role: "user", content: preview }));
        log.scrollTop = log.scrollHeight;
        busy = true; sendBtn.hidden = true; stopBtn.hidden = false; attachBtn.disabled = true;
        abort = new AbortController();
        try {
          await AlbertBrain.send(chat, text, { model, effort, attachments, signal: abort.signal, onStep });
          happyUntil = Date.now() + 1800;
        } catch (e) {
          if (live) { live.el.remove(); live = null; }
          if (e.name === "AbortError") chip("Stopped. (I've forgotten that last exchange; ask again if you need it.)", "alb-note");
          else if (!e.refusal) bubble("albert", md(e.status === 412 ? `I need an Anthropic API key before I can think. Open **Settings…** to add one.` : `Something went wrong: ${e.message}`), "alb-err");
        } finally {
          busy = false; sendBtn.hidden = false; stopBtn.hidden = true; attachBtn.disabled = false; abort = null;
          setState("idle"); save(); input.focus();
        }
      }
      sendBtn.addEventListener("click", send);
      stopBtn.addEventListener("click", () => abort?.abort());
      input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } e.stopPropagation(); });

      function newChat() { if (busy) return; chat = AlbertBrain.newChat(); pending = []; paintTray(); save(); AgentTools.allowed.clear(); renderAll(); input.focus(); }

      async function memoryDlg() {
        const list = h("div", { class: "alb-memlist" });
        const paint = () => {
          const m = AlbertBrain.memory.list();
          list.replaceChildren(...(m.length ? m.map((x, i) => h("div", { class: "alb-memrow" }, h("span", {}, `${i + 1}. ${x.text}`), h("button", { class: "btn", onclick: () => { AlbertBrain.memory.remove(i + 1); paint(); } }, "Forget")))
            : [h("p", { class: "muted" }, "Albert hasn't saved anything yet. Ask him to remember something.")]));
        };
        paint();
        const add = h("input", { class: "field", placeholder: "Add a note for Albert…", style: "width:100%" });
        const r = await CF.dialog({ title: "Albert's memory", icon: "albert", content: h("div", { class: "alb-wide" }, h("p", { class: "muted", style: "margin-top:0" }, "Albert sees these notes at the start of every new chat. They're saved on this desktop (and in your NightCode cloud on the website)."), list, add), buttons: ["Add note", "Close"] });
        if (r.button === "Add note" && add.value.trim()) AlbertBrain.memory.add(add.value.trim());
      }

      async function settingsDlg() {
        let st = null, err = null;
        try { st = await AlbertBrain.status(); } catch (e) { err = e.message; }
        const models = st?.models || [{ id: "claude-opus-5", label: "Claude Opus 5" }, { id: "claude-sonnet-5", label: "Claude Sonnet 5" }, { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" }];
        const NOTES = { "claude-opus-5": " (default, smartest)", "claude-sonnet-5": " (fast and smart)", "claude-haiku-4-5": " (quickest, cheapest)" };
        const sel = h("select", { class: "field" }, models.map((m) => h("option", { value: m.id, selected: m.id === model }, m.label + (NOTES[m.id] || ""))));
        const key = h("input", { class: "field", type: "password", placeholder: st?.key ? `set (${st.key.source}, ${st.key.hint})` : "sk-ant-…", autocomplete: "off", style: "width:100%" });
        const parts = [h("label", { class: "row" }, "Model ", sel)];
        if (st?.hosted) parts.push(h("p", { class: "muted" }, "On the NightCode website Albert uses the site's Anthropic key (set by the sysop on Netlify) and your NightCode account."));
        else if (err) parts.push(h("p", { class: "muted" }, `Albert's relay isn't reachable here (${err}). Run ColeForge.exe, or the ColeForge server (node coleforge/server/forgechat-server.js).`));
        else {
          parts.push(h("p", { style: "margin:10px 0 4px" }, h("b", {}, "Anthropic API key "), st.key ? `— ${st.key.source} (${st.key.hint})` : "— not set"), key,
            h("p", { class: "muted", style: "margin:4px 0 0" }, "Get one at console.anthropic.com → API Keys. It's kept by ColeForge's server on this PC (~/.coleforge), never in the browser."));
          if (st.mcp) {
            const box = h("pre", { class: "alb-mcp" }, [
              `Token:        ${st.mcp.token}`, "",
              `Albert API:   POST ${st.api?.url || "/api/albert/v1/ask"}`,
              `  curl -s ${st.api?.url || "http://localhost:8098/api/albert/v1/ask"} -H "Authorization: Bearer ${st.mcp.token}" \\`,
              `       -H "Content-Type: application/json" -d '{"message":"Hi Albert!","from":"My game"}'`, "",
              `MCP endpoint: ${st.mcp.url}`,
              "Claude Code:", `  claude mcp add --transport http coleforge ${st.mcp.url} --header "Authorization: Bearer ${st.mcp.token}"`,
              "Claude Desktop / Codex / other stdio clients: node <ColeForge folder>/agent/mcp-stdio.js", "(details in coleforge/AGENTS.md)"].join("\n"));
            parts.push(h("h4", { style: "margin:14px 0 4px" }, "Your programs and AI agent software"), h("p", { class: "muted", style: "margin:0 0 4px" }, "Your own programs can ask Albert things through the Albert API, and other AI agents can use ColeForge's tools over MCP. Anything that changes something asks you first."), box);
          }
        }
        const r = await CF.dialog({ title: "Albert settings", icon: "albert", content: h("div", { class: "alb-wide" }, ...parts), buttons: st && !st.hosted && !err ? ["Save", "Clear key", "Cancel"] : ["Save", "Cancel"] });
        if (r.button === "Cancel" || !r.button) return;
        model = sel.value; CF.store.set(MODEL_KEY, model);
        try {
          if (r.button === "Clear key") { await AlbertBrain.setKey(null); CF.toast({ title: "Albert", body: "API key removed.", icon: "albert" }); }
          else if (key.value.trim()) { await AlbertBrain.setKey(key.value.trim()); CF.toast({ title: "Albert", body: "API key saved. I'm ready.", icon: "albert" }); }
        } catch (e) { CF.dialog({ title: "Albert", icon: "error", message: e.message }); }
      }

      win.on("close", () => { clearInterval(anim); abort?.abort(); });
      win.on("focus", () => input.focus());
      renderAll();
      setTimeout(() => input.focus(), 50);
    },
  });
})();
