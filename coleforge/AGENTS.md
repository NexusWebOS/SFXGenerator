# ColeForge for AI agents

Windows – ColeForge Edition works with AI agent software. There are three ways in.

## 1. Albert (built in)

Albert is ColeForge's own agent: Start > Programs > **Albert** (Run: `albert`). He runs on Claude
(Claude Opus 5 by default; Sonnet 5 and Haiku 4.5 in his settings) and uses the tools below, plus web
search. Anything that changes something asks you first (Allow / Always allow / Deny). He keeps a short
memory you can read and edit (Albert > Memory).

- **ColeForge.exe / local server:** add your Anthropic API key in Albert > Settings (or set
  `ANTHROPIC_API_KEY` before starting). It's kept in `~/.coleforge/anthropic-key` (private to your user)
  and used by ColeForge's server; the browser never sees it. Other PCs on the LAN can't use it unless the
  host sets `ALBERT_LAN=1`.
- **nightcode.coletechsystems.com** (WIN at the DOS prompt): the site's Netlify function
  (`web/nightcode/netlify/functions/albert.mjs`) uses `ANTHROPIC_API_KEY` from the site's environment,
  for the sysop only unless `ALBERT_ACCESS=members`.

Code: `shell/js/albert/` (tools, agent loop, desktop bridge), `shell/js/apps/albert.js` (window),
`agent/relay-core.js` (the Claude call, with the official `@anthropic-ai/sdk`), art in `art/albert/`.

## 2. MCP: Claude Code, Claude Desktop, Codex, Cursor, ...

While ColeForge is running (ColeForge.exe, or `node coleforge/server/forgechat-server.js`) and its desktop
is open, it is a Model Context Protocol server:

- **URL:** `http://localhost:8098/mcp` (Streamable HTTP, JSON responses)
- **Auth:** `Authorization: Bearer <token>`. The token is in `~/.coleforge/agent-token` and in
  Albert > Settings.

**Claude Code**

```bash
claude mcp add --transport http coleforge http://localhost:8098/mcp --header "Authorization: Bearer $(cat ~/.coleforge/agent-token)"
```

**Claude Desktop** (`claude_desktop_config.json`) and other clients that start a command:

```json
{ "mcpServers": { "coleforge": { "command": "node", "args": ["C:/path/to/coleforge/agent/mcp-stdio.js"] } } }
```

**Codex** (`~/.codex/config.toml`):

```toml
[mcp_servers.coleforge]
command = "node"
args = ["C:/path/to/coleforge/agent/mcp-stdio.js"]
```

`agent/mcp-stdio.js` forwards stdio JSON-RPC to the running ColeForge and reads the token itself
(`COLEFORGE_MCP_URL` / `COLEFORGE_AGENT_TOKEN` override). The first time an agent calls a tool, the
desktop shows "Agent connected"; tools that change something ask you first, and a declined call comes
back to the agent as an error.

## 3. In the browser (WebMCP)

In browsers that expose `navigator.modelContext`, the desktop registers the same tools with the page.

## The tools

| Tool | Does | Asks first |
| --- | --- | --- |
| `system_info` | time, user, theme, where it runs, open windows | |
| `list_apps`, `open_app` | the installed programs; open one (a URL for NightBrowser, a document for others) | |
| `close_window` | close a program window | yes |
| `list_documents`, `read_document` | My Documents | |
| `write_document`, `delete_document` | create / overwrite / append a text document; move one to the Recycle Bin | yes |
| `nightamp` | status, play, pause, stop, next, previous, volume, play a track, add a URL, change skin, Media Library | |
| `open_web` | open a page in NightBrowser | |
| `change_setting` | theme, wallpaper, clock, sounds, screen saver | |
| `notify` | a desktop notification | |
| `nightcode_board` | read the NightCode Net board, who's online, or post (as you) | posting |

Albert also has `remember` / `forget` (his memory) and Claude's web search.

## Safety

- The MCP endpoint needs the token and refuses browser pages from other sites (Origin check); the desktop
  endpoints (`/api/albert`, `/api/agent/*`) need a ColeForge-only header, a same-site Origin, and a
  connection from this PC.
- Your API key and the agent token live in `~/.coleforge` with owner-only permissions.
- Tools only touch ColeForge (its documents, programs and settings), never your Windows files.

Tests: `node coleforge/tests/albert.test.js` (mock Claude API in `tests/mock-anthropic.js`).
