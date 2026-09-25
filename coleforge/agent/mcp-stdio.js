#!/usr/bin/env node
"use strict";

// ColeForge as a stdio MCP server, for agent apps that launch their MCP servers as a command
// (Claude Desktop, Codex, ...). It forwards every JSON-RPC message to the running ColeForge
// (http://localhost:8098/mcp) with the token from ~/.coleforge/agent-token.
//
//   node coleforge/agent/mcp-stdio.js [--url http://localhost:8098/mcp]
// Env: COLEFORGE_MCP_URL, COLEFORGE_AGENT_TOKEN, COLEFORGE_HOME.

const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");

const argUrl = (() => { const i = process.argv.indexOf("--url"); return i > 0 ? process.argv[i + 1] : null; })();
const URL_ = argUrl || process.env.COLEFORGE_MCP_URL || "http://localhost:8098/mcp";
const HOME = process.env.COLEFORGE_HOME || path.join(os.homedir(), ".coleforge");
const tokenOf = () => process.env.COLEFORGE_AGENT_TOKEN || (() => { try { return fs.readFileSync(path.join(HOME, "agent-token"), "utf8").trim(); } catch { return ""; } })();
const write = (obj) => process.stdout.write(JSON.stringify(obj) + "\n");

async function forward(msg) {
  try {
    const r = await fetch(URL_, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${tokenOf()}` }, body: JSON.stringify(msg) });
    if (r.status === 202) return;
    const body = await r.json().catch(() => null);
    if (body) return write(body);
    throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    if (msg.id === undefined || msg.id === null) return;
    write({ jsonrpc: "2.0", id: msg.id, error: { code: -32000, message: `Can't reach ColeForge at ${URL_} (${e.message}). Is ColeForge running?` } });
  }
}

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }); }
  forward(msg);
});
