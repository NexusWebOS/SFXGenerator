"use strict";

// A small Model Context Protocol server core (JSON-RPC 2.0): initialize, ping, tools/list, tools/call.
// Transport-agnostic: local-agent.js serves it over Streamable HTTP, mcp-stdio.js over stdio.
// The tools are the ColeForge desktop's (js/albert/tools.js), published by the desktop when it opens.

const SUPPORTED = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const INFO = { name: "coleforge", title: "ColeForge (Windows – ColeForge Edition)", version: "1.0.0" };
const INSTRUCTIONS = [
  "Tools that operate the ColeForge desktop (NightCode edition): open programs, read and write files in My Documents,",
  "control NightAmp, open pages in NightBrowser, read and post on the NightCode Net board, show notifications.",
  "Actions that change things ask the person at the desktop to approve them first; a declined call returns an error.",
].join(" ");
const seenClients = new Map();

const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const fail = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function one(msg, ctx) {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return fail(msg?.id, -32600, "Invalid Request");
  const isNote = msg.id === undefined || msg.id === null;
  const p = msg.params || {};
  switch (msg.method) {
    case "initialize": {
      const v = SUPPORTED.includes(p.protocolVersion) ? p.protocolVersion : SUPPORTED[0];
      if (p.clientInfo?.name) seenClients.set(p.clientInfo.name, Date.now());
      return ok(msg.id, { protocolVersion: v, capabilities: { tools: { listChanged: false } }, serverInfo: INFO, instructions: INSTRUCTIONS });
    }
    case "notifications/initialized": case "notifications/cancelled": return null;
    case "ping": return isNote ? null : ok(msg.id, {});
    case "tools/list":
      return ok(msg.id, {
        tools: ctx.listTools().map((t) => ({
          name: t.name, title: t.title, description: t.description, inputSchema: t.input_schema || { type: "object", properties: {} },
          annotations: { readOnlyHint: !t.write, destructiveHint: !!t.destructive, openWorldHint: !!t.openWorld },
        })),
      });
    case "tools/call": {
      const tool = ctx.listTools().find((t) => t.name === p.name);
      if (!tool) {
        if (!ctx.connected()) return ok(msg.id, { isError: true, content: [{ type: "text", text: "The ColeForge desktop isn't open, so its tools aren't available. Open ColeForge and try again." }] });
        return fail(msg.id, -32602, `Unknown tool: ${p.name}`);
      }
      try {
        const r = await ctx.callTool(p.name, p.arguments || {}, p._meta?.client);
        const text = typeof r === "string" ? r : JSON.stringify(r, null, 2);
        return ok(msg.id, { content: [{ type: "text", text }], ...(r && typeof r === "object" && !Array.isArray(r) ? { structuredContent: r } : {}) });
      } catch (e) {
        return ok(msg.id, { isError: true, content: [{ type: "text", text: e.message }] });
      }
    }
    default:
      if (msg.method.startsWith("notifications/")) return null;
      return isNote ? null : fail(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

// A single message or a batch; null when nothing needs an answer (notifications only).
async function handle(msg, ctx) {
  if (Array.isArray(msg)) {
    const outs = (await Promise.all(msg.map((m) => one(m, ctx)))).filter(Boolean);
    return outs.length ? outs : null;
  }
  return one(msg, ctx);
}
const clients = () => [...seenClients.entries()].filter(([, t]) => Date.now() - t < 86400000).map(([name]) => name);

module.exports = { handle, clients, SUPPORTED, INFO };
