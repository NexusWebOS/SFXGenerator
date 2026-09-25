"use strict";

// Albert: ColeForge's own agent, powered by Claude. A chat window with Albert himself on the left
// (animated from assets/art/albert/albert-sheet.png), who can use the desktop's tools (js/albert/).
(function () {
  const { h } = CF;
  const ART = "assets/art/albert/";
  const CHAT_KEY = "cf.albert.chat", MODEL_KEY = "cf.albert.model";
  const ROWS = { idle: 0, talk: 1, think: 2, happy: 3 };
  const TOOL_WORDS = { system_info: "looking around the desktop", list_apps: "checking the programs", open_app: "opening a program", close_window: "closing a window", list_documents: "looking in My Documents",
    read_document: "reading a document", write_document: "writing a document", delete_document: "tidying My Documents", nightamp: "working NightAmp", open_web: "opening NightBrowser", change_setting: "changing a setting",
    notify: "leaving a note", nightcode_board: "checking NightCode Net", remember: "remembering that", forget: "forgetting that", web_search: "searching the web" };

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

  CF.register({
    id: "albert", name: "Albert", icon: "albert", single: true,
    desc: "Albert, your ColeForge companion (powered by Claude): he can use the desktop's programs, files, NightAmp and the web.",
    window: { w: 820, h: 580 },
    open(win) {
      let history = CF.store.get(CHAT_KEY, []);
      let model = CF.store.get(MODEL_KEY, "claude-opus-5");
      let busy = false, abort = null;

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
      const input = h("textarea", { class: "alb-input", rows: 2, placeholder: "Talk to Albert…  (Enter sends, Shift+Enter for a new line)" });
      const sendBtn = h("button", { class: "btn alb-send" }, "Send");
      const stopBtn = h("button", { class: "btn alb-stop", hidden: true }, "Stop");
      const side = h("div", { class: "alb-side" }, h("div", { class: "alb-stage" }, sprite), h("div", { class: "alb-name" }, "ALBERT"), mood,
        h("div", { class: "alb-btns" }, btn("New chat", newChat), btn("Memory…", memoryDlg), btn("Settings…", settingsDlg)),
        h("div", { class: "alb-foot muted" }, "Powered by Claude"));
      win.body.append(h("div", { class: "alb" }, side, h("div", { class: "alb-main" }, log, h("div", { class: "alb-bar" }, input, sendBtn, stopBtn))));
      function btn(label, fn) { const b = h("button", { class: "btn" }, label); b.addEventListener("click", fn); return b; }

      const scroll = () => { log.scrollTop = log.scrollHeight; };
      function bubble(who, html, cls = "") {
        const b = h("div", { class: `alb-msg ${who} ${cls}` }, who === "albert" ? h("img", { class: "alb-face", src: `${ART}albert-icon.png`, alt: "" }) : null, h("div", { class: "alb-text", html }));
        b.querySelectorAll("a[data-link]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); CF.open("nightbrowser", { url: a.dataset.link }); }));
        log.append(b); scroll();
        return b;
      }
      const chip = (text, cls = "") => { const c = h("div", { class: `alb-chip ${cls}` }, text); log.append(c); scroll(); return c; };
      function renderBlocks(content) {
        for (const b of content || []) {
          if (b.type === "text" && b.text.trim()) bubble("albert", md(b.text));
          else if (b.type === "tool_use") chip(`⚙ ${TOOL_WORDS[b.name] || b.name}`);
          else if (b.type === "server_tool_use") chip(`🔎 ${TOOL_WORDS[b.name] || b.name}${b.input?.query ? `: ${b.input.query}` : ""}`);
        }
      }
      function renderAll() {
        log.replaceChildren();
        if (!history.length) greet();
        for (const m of history) {
          if (m.role === "user") {
            const texts = (Array.isArray(m.content) ? m.content : [{ type: "text", text: m.content }]).filter((b) => b.type === "text" && !b.text.startsWith("<desktop "));
            texts.forEach((t) => bubble("you", md(t.text)));
          } else renderBlocks(m.content);
        }
      }
      function greet() {
        bubble("albert", md(`Hi Cole. I'm **Albert**, your ColeForge companion.\n\nI can open programs, work with your documents, drive NightAmp, look things up on the web and check NightCode Net for you. I'll ask before I change anything.\n\nWhat are we working on?`));
      }
      const save = () => CF.store.set(CHAT_KEY, history.length > 120 ? history.slice(-120) : history);

      async function send() {
        const text = input.value.trim();
        if (!text || busy) return;
        input.value = "";
        bubble("you", md(text));
        busy = true; sendBtn.hidden = true; stopBtn.hidden = false;
        abort = new AbortController();
        const before = history.length;
        let thinkingChip = chip("…", "alb-wait");
        try {
          await AlbertBrain.send(history, text, {
            model, signal: abort.signal,
            onStep: (s) => {
              if (s.kind === "status") setState(s.state === "think" ? "think" : "idle");
              if (s.kind === "assistant") { thinkingChip?.remove(); thinkingChip = null; setState("talk"); renderBlocks(s.content); }
              if (s.kind === "tool") { setState("think", TOOL_WORDS[s.name] || "working…"); if (!thinkingChip) thinkingChip = chip("…", "alb-wait"); }
              if (s.kind === "tool_done" && !s.ok) chip(`✗ ${s.error}`, "alb-err");
              if (s.kind === "refusal") bubble("albert", md("I can't help with that one."), "alb-err");
            },
          });
          happyUntil = Date.now() + 1800;
        } catch (e) {
          if (e.name === "AbortError") chip("Stopped.");
          else {
            bubble("albert", md(e.status === 412 ? `I need an Anthropic API key before I can think. Open **Settings…** to add one.` : `Something went wrong: ${e.message}`), "alb-err");
            // Keep the history valid: drop the half-finished exchange.
            if (history.length > before && history[history.length - 1].role === "user" && !history[history.length - 1].content.some?.((b) => b.type === "tool_result")) history.length = before;
          }
        } finally {
          thinkingChip?.remove();
          busy = false; sendBtn.hidden = false; stopBtn.hidden = true; abort = null;
          setState("idle"); save(); input.focus();
        }
      }
      sendBtn.addEventListener("click", send);
      stopBtn.addEventListener("click", () => abort?.abort());
      input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } e.stopPropagation(); });

      function newChat() { if (busy) return; history = []; save(); AgentTools.allowed.clear(); renderAll(); input.focus(); }

      async function memoryDlg() {
        const list = h("div", { class: "alb-memlist" });
        const paint = () => {
          const m = AlbertBrain.memory.list();
          list.replaceChildren(...(m.length ? m.map((x, i) => h("div", { class: "alb-memrow" }, h("span", {}, `${i + 1}. ${x.text}`), h("button", { class: "btn", onclick: () => { AlbertBrain.memory.remove(i + 1); paint(); } }, "Forget")))
            : [h("p", { class: "muted" }, "Albert hasn't saved anything yet. Ask him to remember something.")]));
        };
        paint();
        const add = h("input", { class: "field", placeholder: "Add a note for Albert…", style: "width:100%" });
        const r = await CF.dialog({ title: "Albert's memory", icon: "albert", content: h("div", { class: "alb-wide" }, h("p", { class: "muted", style: "margin-top:0" }, "Albert sees these notes in every chat. They're saved on this desktop (and in your NightCode cloud on the website)."), list, add), buttons: ["Add note", "Close"] });
        if (r.button === "Add note" && add.value.trim()) AlbertBrain.memory.add(add.value.trim());
      }

      async function settingsDlg() {
        let st = null, err = null;
        try { st = await AlbertBrain.status(); } catch (e) { err = e.message; }
        const models = st?.models || [{ id: "claude-opus-5", label: "Claude Opus 5" }, { id: "claude-sonnet-5", label: "Claude Sonnet 5" }, { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" }];
        const sel = h("select", { class: "field" }, models.map((m) => h("option", { value: m.id, selected: m.id === model }, m.label + (m.id === "claude-opus-5" ? " (default)" : ""))));
        const key = h("input", { class: "field", type: "password", placeholder: st?.key ? `set (${st.key.source}, ${st.key.hint})` : "sk-ant-…", autocomplete: "off", style: "width:100%" });
        const parts = [h("label", { class: "row" }, "Model ", sel)];
        if (st?.hosted) parts.push(h("p", { class: "muted" }, "On the NightCode website Albert uses the site's Anthropic key (set by the sysop on Netlify) and your NightCode account."));
        else if (err) parts.push(h("p", { class: "muted" }, `Albert's relay isn't reachable here (${err}). Run ColeForge.exe, or the ColeForge server (node coleforge/server/forgechat-server.js).`));
        else {
          parts.push(h("p", { style: "margin:10px 0 4px" }, h("b", {}, "Anthropic API key "), st.key ? `— ${st.key.source} (${st.key.hint})` : "— not set"), key,
            h("p", { class: "muted", style: "margin:4px 0 0" }, "Get one at console.anthropic.com → API Keys. It's kept by ColeForge's server on this PC (~/.coleforge), never in the browser."));
          if (st.mcp) {
            const mcpBox = h("pre", { class: "alb-mcp" }, [
              `MCP endpoint: ${st.mcp.url}`, `Token:        ${st.mcp.token}`, "",
              "Claude Code:", `  claude mcp add --transport http coleforge ${st.mcp.url} --header "Authorization: Bearer ${st.mcp.token}"`, "",
              "Claude Desktop / Codex / other stdio clients: run", "  node <ColeForge folder>/agent/mcp-stdio.js", "(see coleforge/AGENTS.md)"].join("\n"));
            parts.push(h("h4", { style: "margin:14px 0 4px" }, "AI agent software (MCP)"), h("p", { class: "muted", style: "margin:0 0 4px" }, "Other agents can use ColeForge's tools too; they ask you before changing anything."), mcpBox);
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
