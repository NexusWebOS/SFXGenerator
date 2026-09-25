"use strict";

// Makes the desktop usable by AI agent software.
//  1. MCP: when ColeForge runs from its own server on this PC (ColeForge.exe, or http://localhost:8098),
//     the desktop publishes AgentTools to the server's MCP endpoint (/mcp) and runs the calls that
//     agents such as Claude Code, Claude Desktop or Codex make, asking you first for anything that
//     changes something.
//  2. WebMCP: browsers that offer navigator.modelContext get the same tools registered in the page.
(function () {
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) && !window.NIGHTCODE_HOSTED;
  const H = { "X-ColeForge-Agent": "1" };
  const greeted = new Set();

  async function loop() {
    let wait = 2000;
    for (;;) {
      try {
        const hello = await fetch("/api/agent/hello", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, H), body: JSON.stringify({ tools: AgentTools.schemas() }) });
        if (hello.status === 403 || hello.status === 404) return;             // not our server, or agents are off
        for (;;) {
          const r = await fetch("/api/agent/poll", { headers: H });
          if (!r.ok) throw new Error(`poll ${r.status}`);
          const { job } = await r.json();
          if (!job) break;                                                    // idle: say hello again
          wait = 2000;
          runJob(job);
        }
      } catch {
        await new Promise((res) => setTimeout(res, wait));
        wait = Math.min(30000, wait * 2);
      }
    }
  }
  async function runJob(job) {
    const who = clientName(job.client);
    if (!greeted.has(who)) { greeted.add(who); CF.toast({ title: "Agent connected", body: `${who} is using ColeForge's tools. Anything that changes something asks you first.`, icon: "albert" }); }
    let body;
    try { body = { id: job.id, ok: true, result: await AgentTools.run(job.name, job.args, { who, scope: "mcp:" + who }) }; }
    catch (e) { body = { id: job.id, ok: false, error: e.message }; }
    fetch("/api/agent/result", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, H), body: JSON.stringify(body) }).catch(() => {});
  }
  function clientName(ua) {
    const s = String(ua || "");
    if (/claude-code|claude code/i.test(s)) return "Claude Code";
    if (/claude/i.test(s)) return "Claude";
    if (/codex/i.test(s)) return "Codex";
    if (/cursor/i.test(s)) return "Cursor";
    return s && !/^node|^undici|^python/i.test(s) ? s.split(/[/ ]/)[0] : "An AI agent";
  }

  function webmcp() {
    const mc = navigator.modelContext;
    if (!mc) return;
    const tools = AgentTools.schemas().map((t) => ({
      name: t.name, description: t.description, inputSchema: t.input_schema, annotations: { readOnlyHint: !t.write },
      async execute(args) {
        try { const r = await AgentTools.run(t.name, args, { who: "An in-browser agent", scope: "webmcp" }); return { content: [{ type: "text", text: typeof r === "string" ? r : JSON.stringify(r) }] }; }
        catch (e) { return { isError: true, content: [{ type: "text", text: e.message }] }; }
      },
    }));
    try { (mc.provideContext ? mc.provideContext({ tools }) : tools.forEach((t) => mc.registerTool?.(t))); } catch (e) { console.warn("WebMCP:", e); }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!window.AgentTools) return;
    webmcp();
    if (local) setTimeout(loop, 1500);
  });
})();
