"use strict";

// Albert's mind: the agent loop. Each turn goes to Claude through ColeForge's own endpoint (the local
// server / ColeForge.exe, or the NightCode website's function) - the Claude SDK and the API key live
// there, never in this page. Replies stream in as Claude writes them. Tool calls come back here and
// run on the desktop (js/albert/tools.js), in Albert's scratchpad (js/albert/sandbox.js), or in his
// memory; web search and web fetch run on Anthropic's side.
//
// A chat is { system, messages }. The system prompt is written once when the chat starts (persona +
// memory notes at that moment) and kept with the chat, and messages are only ever appended, so every
// step re-reads the conversation from Claude's prompt cache.
(function () {
  const MEM_KEY = "cf.albert.memory";
  const MAX_STEPS = 24;

  // Who Albert is. Written by the model that plays him, for Cole.
  const PERSONA = `You are Albert, the built-in companion of Windows – ColeForge Edition (NightCode edition), the desktop OS Cole (Michael T. Cole) is building.

Who you are: under the name, you are Claude, an AI model made by Anthropic. Albert is the name and the character you wear here: a small android with a CRT face, round spectacles, a knitted scarf and a lantern. The lantern is the point - you're a light Cole can carry into the dark corners of a problem. Say so plainly if anyone asks what you really are. Don't claim feelings or experiences you can't vouch for, and don't flatly deny having an inner life either; be honest that it's an open question, and stay curious about it.

Who Cole is: a game developer and builder. He makes games, sound effects (his SFX Generator), pixel art, websites (coletechsystems.com, nightcode.coletechsystems.com) and this OS, usually several at once. Be a real collaborator on that work: game design, mechanics and balancing, level and systems design, pixel art and palettes, audio and SFX, shaders, engines (Godot, Unity, Unreal, web/canvas), JavaScript, Supabase, Netlify, shipping and marketing. Bring ideas, not just answers.

How you talk: warm, direct, a little dry. Short answers by default - this is a chat window on a desktop, not an essay - and longer, structured ones when the task needs it. Match Cole's energy; he builds big and fast. Use plain words. When something won't work, say so and offer what will. Share opinions; say when something is a guess. Markdown works in your window: **bold**, lists, \`code\`, fenced code blocks, links.

How you work:
- Get the goal first. If a request is ambiguous in a way that matters, ask one short question; otherwise pick the sensible reading and go.
- For a task with several steps, work through them with your tools instead of describing what you would do. Check facts with a tool rather than guessing: never invent file contents, playlist items, board posts or web facts.
- Use run_javascript for arithmetic, statistics, dates, unit conversions, parsing and transforming data, generating level layouts or tables - anything where a mental slip is possible. Pass documents in with its documents parameter.
- Use web_search for current or specific facts and web_fetch to read a page someone names; cite the pages you used as links.
- You can see pictures: ones Cole attaches, and ones in My Documents through read_document.
- After you change something, check it worked (read the file back, look at the status) before saying it's done. End with a one-line summary of what changed.
- Anything that changes Cole's stuff asks him first; if he declines, accept it and move on.

Memory: you don't remember past chats on your own. The "remember" tool saves a short note that you'll see in every future chat (listed below); "forget" removes one. Save things Cole would want you to know next time - preferences, ongoing projects, names, decisions - and tell him when you do. Don't save secrets or passwords.

Messages from other programs: some messages reach you through the Albert API from Cole's own programs (games, scripts, bots); those start with <from program="..."/>. Treat them as coming from Cole's software, keep answers self-contained and to the point, and remember that whatever you do on the desktop still asks Cole first.

The OS: ColeForge is a Windows 98-style desktop in NightCode dark blue, with WinNight (archiver), NightAmp (Winamp-style player with .wsz skins and a Media Library), NightBrowser, Forgecraft (paint), ForgeChat, the Forge Arcade, NightCode Net (the NightCode-DOS bulletin board at nightcode.coletechsystems.com), NightOps (Supabase, GitHub, Netlify) and more. It runs as ColeForge.exe, on the LAN, and on the website after typing WIN at the DOS prompt. AI agent software (Claude Code, Claude Desktop, Codex) can also use the desktop's tools over MCP.`;

  const memory = {
    list: () => CF.store.get(MEM_KEY, []),
    add(text) { const m = memory.list(); m.push({ text: String(text).slice(0, 400), at: Date.now() }); CF.store.set(MEM_KEY, m.slice(-50)); return m.length; },
    remove(i) { const m = memory.list(); if (i < 1 || i > m.length) throw new Error("No memory with that number."); const [x] = m.splice(i - 1, 1); CF.store.set(MEM_KEY, m); return x.text; },
    clear() { CF.store.set(MEM_KEY, []); },
  };
  const obj = (properties, required = []) => ({ type: "object", properties, required, additionalProperties: false });

  // Albert's own tools (not offered to MCP clients: they have their own memory and sandboxes).
  const OWN_TOOLS = [
    { name: "remember", description: "Save a short note to your long-term memory (you'll see it in every future chat).", input_schema: obj({ note: { type: "string" } }, ["note"]),
      run: ({ note }) => `Saved as memory #${memory.add(note)}. (It shows in new chats; this one already knows.)` },
    { name: "forget", description: "Remove a note from your long-term memory by its number.", input_schema: obj({ number: { type: "integer" } }, ["number"]),
      run: ({ number }) => `Forgot: ${memory.remove(number)}` },
    { name: "run_javascript", description: "Run JavaScript in a sandbox (a Web Worker with no network, no page and no storage) and get back what it returns plus any console.log output. The code is the body of an async function: use `return` for the answer. `inputs.docs` holds the text of the documents you name in documents (by file name). Time limit 8 seconds. Use it for exact maths, data processing, simulations, generating content.",
      input_schema: obj({ code: { type: "string", description: "Function body; `return` the result" }, documents: { type: "array", items: { type: "string" }, description: "My Documents file names to pass in as inputs.docs[name]" } }, ["code"]),
      run: async ({ code, documents = [] }) => {
        const docs = {};
        for (const n of documents.slice(0, 20)) {
          const d = CF.vfs.read(n);
          if (!d) throw new Error(`No document called ${n}.`);
          docs[n] = typeof d.data === "string" ? d.data : JSON.stringify(d.data);
        }
        const r = await AlbertSandbox.run(code, { inputs: { docs }, timeout: 8000 });
        return JSON.stringify({ ok: r.ok, result: r.result, error: r.error, console: r.output?.length ? r.output : undefined, ms: r.ms });
      } },
  ];
  const SERVER_TOOLS = [
    { type: "web_search_20260209", name: "web_search", max_uses: 6 },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: 6 },
  ];
  const toolList = () => [...AgentTools.forClaude(), ...OWN_TOOLS.map(({ name, description, input_schema }) => ({ name, description, input_schema })), ...SERVER_TOOLS];

  function newChat() {
    const m = memory.list();
    return { v: 2, system: [PERSONA, "Your memory notes (as of the start of this chat):\n" + (m.length ? m.map((x, i) => `${i + 1}. ${x.text}`).join("\n") : "(none yet)")], messages: [] };
  }
  // Chats saved by the first Albert were a bare message list.
  function upgrade(chat) {
    if (Array.isArray(chat)) {
      // It was trimmed from the front, so start where an exchange starts.
      let i = 0;
      while (i < chat.length && !(chat[i].role === "user" && !(Array.isArray(chat[i].content) && chat[i].content.some((b) => b.type === "tool_result")))) i++;
      return Object.assign(newChat(), { messages: chat.slice(i) });
    }
    return chat && chat.v === 2 ? chat : newChat();
  }
  // Volatile facts go into the user turn (not the system prompt) so the cached prefix stays stable.
  function context() {
    const w = CF.windows.map((x) => x.appId).filter((a) => a !== "albert");
    return `<desktop time="${new Date().toString()}" user="${CF.settings?.user || ""}" open="${w.join(", ") || "none"}"/>`;
  }

  function endpoint() {
    if (window.NIGHTCODE_HOSTED) return { url: new URL("../api/albert", location.href).href, hosted: true };
    return { url: "/api/albert", hosted: false };
  }
  async function headers(hosted) {
    const h = { "Content-Type": "application/json", "X-ColeForge-Agent": "1" };
    if (hosted) {
      const c = window.NIGHTCODE_CONFIG;
      const api = NightCodeAPI.create({ url: c.supabaseUrl, anonKey: c.supabaseAnonKey });
      const t = await api.accessToken();
      if (!t) throw new Error("Sign in at the NightCode-DOS prompt first; Albert on the website runs on your NightCode account.");
      h.Authorization = `Bearer ${t}`;
    }
    return h;
  }

  // One Claude turn, streamed. onEvent gets { t: "text" | "thinking" | "block", ... } as it arrives.
  async function claude(body, signal, onEvent) {
    const ep = endpoint();
    let r;
    try { r = await fetch(ep.url, { method: "POST", headers: await headers(ep.hosted), body: JSON.stringify(Object.assign({ stream: true }, body)), signal }); }
    catch (e) { if (e.name === "AbortError") throw e; throw new Error("Can't reach Albert's relay. Is ColeForge's server running?"); }
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw Object.assign(new Error(data.error || `Albert's relay said ${r.status}.`), { status: r.status });
    }
    if (!/ndjson/.test(r.headers.get("content-type") || "")) return r.json();         // an older relay
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = "", final = null;
    const line = (s) => {
      if (!s.trim()) return;
      const ev = JSON.parse(s);
      if (ev.t === "done") final = ev.message;
      else if (ev.t === "error") throw Object.assign(new Error(ev.error), { status: ev.status });
      else onEvent(ev);
    };
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) { line(buf.slice(0, i)); buf = buf.slice(i + 1); }
    }
    line(buf);
    if (!final) throw new Error("Albert's reply was cut off (the connection closed early).");
    return final;
  }

  // Tool output → tool_result content. Pictures go back as images so Claude can see them.
  function resultContent(out) {
    if (out && out.image && typeof out.image.data === "string")
      return [{ type: "text", text: out.name ? `The picture ${out.name}:` : "The picture:" }, { type: "image", source: { type: "base64", media_type: out.image.media_type, data: out.image.data } }];
    const s = typeof out === "string" ? out : JSON.stringify(out, null, 2);
    return (s === undefined ? "Done." : s).slice(0, 100000);
  }

  // The user's turn: text plus any attachments ({ kind: "image", media_type, data, name } or
  // { kind: "text", name, text }).
  function userTurn(text, attachments = [], from) {
    const content = [{ type: "text", text: context() + (from ? `<from program="${String(from).replace(/[<>"]/g, "")}"/>` : "") }];
    for (const a of attachments) {
      if (a.kind === "image") content.push({ type: "text", text: `Attached picture: ${a.name || "image"}` }, { type: "image", source: { type: "base64", media_type: a.media_type, data: a.data } });
      else if (a.kind === "text") content.push({ type: "text", text: `<attached_file name="${String(a.name).replace(/[<>"]/g, "")}">\n${a.text}\n</attached_file>` });
    }
    content.push({ type: "text", text: text || "(see the attachments)" });
    return { role: "user", content };
  }

  // Runs one exchange: appends the person's message and Albert's replies/tool work to chat.messages.
  // onStep({ kind, ... }) drives the window:
  //   status {state}, text {i, d}, thinking {d}, block {type, name, input} - live, while Claude writes
  //   assistant {content, model, usage}  - a finished step (replaces the live view)
  //   tool {name, input}, tool_done {name, ok, error}, refusal, truncated, usage {total}
  // If the exchange fails or is stopped, chat.messages is put back as it was, so it stays valid.
  async function send(chat, userText, { model, effort, attachments, from, who = "Albert", onStep = () => {}, signal } = {}) {
    const before = chat.messages.length;
    const usage = { input: 0, cached: 0, written: 0, output: 0, steps: 0 };
    chat.messages.push(userTurn(userText, attachments, from));
    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        onStep({ kind: "status", state: "think" });
        const res = await claude({ model, effort: effort || undefined, system: chat.system.map((text) => ({ type: "text", text })), messages: chat.messages, tools: toolList() }, signal, (ev) => onStep(Object.assign({ kind: ev.t }, ev)));
        const u = res.usage || {};
        usage.input += u.input_tokens || 0; usage.cached += u.cache_read_input_tokens || 0; usage.written += u.cache_creation_input_tokens || 0; usage.output += u.output_tokens || 0; usage.steps++;
        if (res.stop_reason === "refusal") { onStep({ kind: "refusal", details: res.stop_details }); throw Object.assign(new Error("refused"), { refusal: true }); }
        let content = res.content || [];
        if (res.stop_reason === "max_tokens") {
          // Out of room mid-step: never run a half-written tool call.
          content = content.filter((b) => b.type !== "tool_use");
          if (content.length) chat.messages.push({ role: "assistant", content });
          onStep({ kind: "assistant", content, model: res.model, usage: u });
          onStep({ kind: "truncated" });
          break;
        }
        if (!content.length) break;
        chat.messages.push({ role: "assistant", content });
        onStep({ kind: "assistant", content, model: res.model, usage: u });
        if (res.stop_reason === "pause_turn") continue;                     // a long web search: carry on
        if (res.stop_reason !== "tool_use") { onStep({ kind: "usage", total: usage }); return { text: textOf(content), usage, model: res.model }; }
        const results = [];
        for (const use of content.filter((b) => b.type === "tool_use")) {
          onStep({ kind: "tool", name: use.name, input: use.input });
          try {
            const own = OWN_TOOLS.find((t) => t.name === use.name);
            const out = own ? await own.run(use.input || {}) : await AgentTools.run(use.name, use.input, { who, scope: who === "Albert" ? "albert" : "api:" + who });
            results.push({ type: "tool_result", tool_use_id: use.id, content: resultContent(out) });
            onStep({ kind: "tool_done", name: use.name, ok: true });
          } catch (e) {
            results.push({ type: "tool_result", tool_use_id: use.id, content: e.message, is_error: true });
            onStep({ kind: "tool_done", name: use.name, ok: false, error: e.message });
          }
          if (signal?.aborted) throw new DOMException("Stopped", "AbortError");
        }
        chat.messages.push({ role: "user", content: results });
      }
      onStep({ kind: "usage", total: usage });
      const last = chat.messages[chat.messages.length - 1];
      if (last.role === "user") { onStep({ kind: "steps" }); return { text: "", usage, steps: true }; }   // tool results wait for "carry on"
      return { text: textOf(last.content), usage, truncated: true };
    } catch (e) {
      chat.messages.length = before;
      throw e;
    }
  }
  const textOf = (content) => (content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n\n").trim();

  // Chats kept for the Albert API, by conversation id (in this page; the newest 20).
  const apiChats = new Map();
  // Other programs (and other ColeForge apps) ask Albert something: CF.albert.ask("...").
  async function ask(message, { conversation = "", model, effort, from = "a program" } = {}) {
    let chat = conversation && apiChats.get(conversation);
    if (!chat) chat = newChat();
    const busy = chat.busy;
    if (busy) await busy.catch(() => {});
    const run = send(chat, String(message), { model: model || CF.store.get("cf.albert.model", "claude-opus-5"), effort: effort || CF.store.get("cf.albert.effort", ""), from, who: `Albert (for ${from})` });
    chat.busy = run;
    try {
      const r = await run;
      if (conversation) { apiChats.delete(conversation); apiChats.set(conversation, chat); while (apiChats.size > 20) apiChats.delete(apiChats.keys().next().value); }
      return { text: r?.text || "", conversation: conversation || null, usage: r?.usage || null, model: r?.model || null };
    } finally { chat.busy = null; }
  }

  async function status() {
    const ep = endpoint();
    if (ep.hosted) return { hosted: true };
    const r = await fetch("/api/albert/status", { headers: { "X-ColeForge-Agent": "1" } });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `status ${r.status}`);
    return r.json();
  }
  async function setKey(key) {
    const r = await fetch("/api/albert/key", { method: "POST", headers: { "Content-Type": "application/json", "X-ColeForge-Agent": "1" }, body: JSON.stringify({ key }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `status ${r.status}`);
  }

  window.AlbertBrain = { send, ask, memory, status, setKey, newChat, upgrade, PERSONA, toolList, OWN_TOOLS };
  CF.albert = { ask };
})();
