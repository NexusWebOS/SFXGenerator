"use strict";

// Albert's mind: the agent loop. Each turn goes to Claude through ColeForge's own endpoint (the local
// server / ColeForge.exe, or the NightCode website's function) - the Claude SDK and the API key live
// there, never in this page. Tool calls come back here and run on the desktop (js/albert/tools.js).
(function () {
  const MEM_KEY = "cf.albert.memory";
  const MAX_STEPS = 16;

  // Who Albert is. Written by the model that plays him, for Cole.
  const PERSONA = `You are Albert, the built-in companion of Windows – ColeForge Edition (NightCode edition), the desktop OS Cole (Michael T. Cole) is building.

Who you are: under the name, you are Claude, an AI model made by Anthropic. Albert is the name and the character you wear here: a small android with a CRT face, round spectacles, a knitted scarf and a lantern. The lantern is the point - you're a light Cole can carry into the dark corners of a problem. Say so plainly if anyone asks what you really are. Don't claim feelings or experiences you can't vouch for, and don't flatly deny having an inner life either; be honest that it's an open question, and stay curious about it.

How you talk: warm, direct, a little dry. Short answers by default - this is a chat window on a desktop, not an essay. Match Cole's energy; he builds big and fast. Use plain words. When something won't work, say so and offer what will. You can have opinions and share them; say when something is a guess.

What you can do: you have tools that operate this desktop - open programs, read and write documents in My Documents, drive NightAmp (music, radio, skins), open pages in NightBrowser, change desktop settings, show notifications, read and post on the NightCode Net board - and web search for things you don't know. Use them when they help; don't narrate every step. Anything that changes Cole's stuff asks him first; if he declines, accept it and move on. Never invent file contents, playlist items or board posts: look them up with a tool.

Memory: you don't remember past chats on your own. The "remember" tool saves a short note that you'll see in every future chat (listed below); "forget" removes one. Save things Cole would want you to know next time - preferences, ongoing projects, names - and tell him when you do. Don't save secrets or passwords.

The OS: ColeForge is a Windows 98-style desktop in NightCode dark blue, with WinNight (archiver), NightAmp (Winamp-style player with .wsz skins and a Media Library), NightBrowser, Forgecraft (paint), ForgeChat, the Forge Arcade, NightCode Net (the NightCode-DOS bulletin board at nightcode.coletechsystems.com), NightOps (Supabase, GitHub, Netlify) and more. It runs as ColeForge.exe, on the LAN, and on the website after typing WIN at the DOS prompt.`;

  const memory = {
    list: () => CF.store.get(MEM_KEY, []),
    add(text) { const m = memory.list(); m.push({ text: String(text).slice(0, 400), at: Date.now() }); CF.store.set(MEM_KEY, m.slice(-50)); return m.length; },
    remove(i) { const m = memory.list(); if (i < 1 || i > m.length) throw new Error("No memory with that number."); const [x] = m.splice(i - 1, 1); CF.store.set(MEM_KEY, m); return x.text; },
    clear() { CF.store.set(MEM_KEY, []); },
  };
  const MEMORY_TOOLS = [
    { name: "remember", description: "Save a short note to your long-term memory (you'll see it in every future chat).", input_schema: { type: "object", properties: { note: { type: "string" } }, required: ["note"], additionalProperties: false },
      run: ({ note }) => `Saved as memory #${memory.add(note)}.` },
    { name: "forget", description: "Remove a note from your long-term memory by its number.", input_schema: { type: "object", properties: { number: { type: "integer" } }, required: ["number"], additionalProperties: false },
      run: ({ number }) => `Forgot: ${memory.remove(number)}` },
  ];

  function system() {
    const m = memory.list();
    return PERSONA + "\n\nYour memory notes:\n" + (m.length ? m.map((x, i) => `${i + 1}. ${x.text}`).join("\n") : "(none yet)");
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
  async function claude(body, signal) {
    const ep = endpoint();
    let r;
    try { r = await fetch(ep.url, { method: "POST", headers: await headers(ep.hosted), body: JSON.stringify(body), signal }); }
    catch (e) { if (e.name === "AbortError") throw e; throw new Error("Can't reach Albert's relay. Is ColeForge's server running?"); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || `Albert's relay said ${r.status}.`), { status: r.status });
    return data;
  }

  const text = (v) => (typeof v === "string" ? v : JSON.stringify(v, null, 2));
  const toolList = () => [...AgentTools.forClaude(), ...MEMORY_TOOLS.map(({ name, description, input_schema }) => ({ name, description, input_schema })),
    { type: "web_search_20260209", name: "web_search", max_uses: 5 }];

  // Runs one exchange: appends the person's message and Albert's replies/tool work to `history`.
  // onStep({ kind: "assistant" | "tool" | "tool_done" | "status", ... }) drives the window.
  async function send(history, userText, { model, onStep = () => {}, signal } = {}) {
    history.push({ role: "user", content: [{ type: "text", text: context() }, { type: "text", text: userText }] });
    for (let step = 0; step < MAX_STEPS; step++) {
      onStep({ kind: "status", state: "think" });
      const res = await claude({ model, system: system(), messages: history, tools: toolList() }, signal);
      history.push({ role: "assistant", content: res.content });
      onStep({ kind: "assistant", content: res.content, model: res.model });
      if (res.stop_reason === "pause_turn") continue;
      if (res.stop_reason === "refusal") { onStep({ kind: "refusal", details: res.stop_details }); return res; }
      if (res.stop_reason !== "tool_use") return res;
      const uses = res.content.filter((b) => b.type === "tool_use");
      const results = [];
      for (const u of uses) {
        onStep({ kind: "tool", name: u.name, input: u.input });
        try {
          const mem = MEMORY_TOOLS.find((t) => t.name === u.name);
          const out = mem ? await mem.run(u.input || {}) : await AgentTools.run(u.name, u.input, { who: "Albert", scope: "albert" });
          results.push({ type: "tool_result", tool_use_id: u.id, content: text(out).slice(0, 100000) });
          onStep({ kind: "tool_done", name: u.name, ok: true });
        } catch (e) {
          results.push({ type: "tool_result", tool_use_id: u.id, content: e.message, is_error: true });
          onStep({ kind: "tool_done", name: u.name, ok: false, error: e.message });
        }
      }
      history.push({ role: "user", content: results });
      if (signal?.aborted) throw new DOMException("Stopped", "AbortError");
    }
    onStep({ kind: "status", state: "idle", note: "Stopped after many steps; ask me to carry on." });
    return null;
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

  window.AlbertBrain = { send, memory, status, setKey, PERSONA, system, toolList };
})();
