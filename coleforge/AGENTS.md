# ColeForge for AI agents

Windows – ColeForge Edition works with AI agent software. There are four ways in.

## 1. Albert (built in)

Albert is ColeForge's own agent: Start > Programs > **Albert** (Run: `albert`). He runs on Claude
(Claude Opus 5 by default; Sonnet 5 and Haiku 4.5 in his settings), or for free on an open model hosted
by Groq (see below), and uses the tools below. Anything
that changes something asks you first (Allow / Always allow / Deny). He keeps a short memory you can read
and edit (Albert > Memory).

What makes him more than a chat box:

- **Live answers.** Replies stream in as Claude writes them, with his summarized thinking in a
  collapsible "Albert's thoughts".
- **Thinking level.** Auto, Quick, Balanced, Deep or Deepest (Claude's effort setting), next to his
  portrait.
- **Eyes.** Paste, drop or attach pictures (and text files) in the chat, and he can open pictures in My
  Documents himself.
- **A scratchpad.** `run_javascript` runs code he writes (exact maths, data crunching, generating tables
  or level layouts) in a Web Worker inside a sandboxed iframe: no network, no storage, no ColeForge, 8
  second limit.
- **The web.** Claude's web search and web fetch (run on Anthropic's side).
- **Long chats and low cost.** Prompt caching (the persona, tools and conversation are re-read from
  cache; the window shows how much), and server-side compaction on Claude Opus 5 for very long chats.
  Each chat keeps the system prompt it started with and only appends, so the cache keeps working.
- **Safe fallbacks.** If the API turns down one of these extras, the turn is retried once without them.

### Free brain: Groq

Albert can also run on Groq's free tier (open models: GPT-OSS 120B / 20B, Llama 4, Kimi K2, Qwen3 and
whatever else Groq offers; the list comes from Groq live). Get a free key at **console.groq.com → API
Keys** (`gsk_…`), paste it in Albert > Settings (or set `GROQ_API_KEY`), and pick a model under "Free on
Groq". With only a Groq key, Albert switches to GPT-OSS 120B by himself. The footer shows which brain is
running.

- Everything on the desktop works the same: tools, approvals, memory, the scratchpad, the Albert API.
  Chats stay in one format, so you can switch between Claude and Groq mid-chat.
- GPT-OSS models show their reasoning as thoughts, take the Thinking level (as `reasoning_effort`) and
  search the web with Groq's `browser_search`. Llama 4 models can see pictures; the others can't.
- Not on Groq: web fetch, prompt caching, compaction. Free-tier rate limits are tight (a short wait is
  retried once), and open models are less reliable with long multi-step jobs than Claude.
- Code: `agent/groq.js` (Claude format ⇄ OpenAI format, streaming, retries, model list).

- **ColeForge.exe / local server:** add your Anthropic API key in Albert > Settings (or set
  `ANTHROPIC_API_KEY` before starting). It's kept in `~/.coleforge/anthropic-key` (private to your user)
  and used by ColeForge's server; the browser never sees it. Other PCs on the LAN can't use it unless the
  host sets `ALBERT_LAN=1`.
- **nightcode.coletechsystems.com** (WIN at the DOS prompt): the site's Netlify function
  (`web/nightcode/netlify/functions/albert.mjs`) uses `ANTHROPIC_API_KEY` from the site's environment,
  for the sysop only unless `ALBERT_ACCESS=members`.

Code: `shell/js/albert/` (tools, agent loop, scratchpad sandbox, desktop bridge), `shell/js/apps/albert.js` (window),
`agent/relay-core.js` (the Claude call, with the official `@anthropic-ai/sdk`), art in `art/albert/`.

## 2. The Albert API: your programs talk to Albert

Your own games, tools, scripts and bots can ask Albert things while ColeForge runs and its desktop is open.
He answers from the desktop with everything he has (tools, memory, web, scratchpad), and anything that
changes something still pops up for your approval, labelled with the program's name.

```bash
curl -s http://localhost:8098/api/albert/v1/ask \
  -H "Authorization: Bearer $(cat ~/.coleforge/agent-token)" -H "Content-Type: application/json" \
  -d '{"message": "Give me 5 names for a neon boss fight track", "from": "SFX Generator", "conversation": "sfx-1"}'
# → {"text": "...", "conversation": "sfx-1", "usage": {...}, "model": "claude-opus-5"}
```

| Field | |
| --- | --- |
| `message` | what to ask (required) |
| `from` | your program's name (shown on the desktop and to Albert) |
| `conversation` | any id: messages with the same id continue one conversation (the newest 20 are kept while the desktop is open); leave it out for a one-off question |
| `model`, `effort` | optional: `claude-opus-5`, `claude-sonnet-5`, `claude-haiku-4-5`, or a Groq model such as `groq:openai/gpt-oss-120b`; `low` … `max` |

`GET /api/albert/v1/status` says whether the desktop is open and a key is set. Same token as MCP; answers
can take a while (up to 10 minutes with approvals), so give your HTTP client a long timeout. Inside
ColeForge, other apps can call `CF.albert.ask(message, { conversation, from })` directly.

```js
// e.g. from a Node game server or tool
const r = await fetch("http://localhost:8098/api/albert/v1/ask", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ message: "Describe a sound for a laser pickup in 1 line", from: "SFX Generator" }),
});
console.log((await r.json()).text);
```

## 3. MCP: Claude Code, Claude Desktop, Codex, Cursor, ...

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

## 4. In the browser (WebMCP)

In browsers that expose `navigator.modelContext`, the desktop registers the same tools with the page.

## The tools

| Tool | Does | Asks first |
| --- | --- | --- |
| `system_info` | time, user, theme, where it runs, open windows | |
| `list_apps`, `open_app` | the installed programs; open one (a URL for NightBrowser, a document for others) | |
| `close_window` | close a program window | yes |
| `list_documents`, `read_document` | My Documents (pictures come back as images; long text by line range) | |
| `search_documents` | find text (and file names) across My Documents, with line numbers | |
| `write_document`, `delete_document` | create / overwrite / append a text document; move one to the Recycle Bin | yes |
| `nightamp` | status, play, pause, stop, next, previous, volume, play a track, add a URL, change skin, Media Library | |
| `open_web` | open a page in NightBrowser | |
| `change_setting` | theme, wallpaper, clock, sounds, screen saver | |
| `notify` | a desktop notification | |
| `nightcode_board` | read the NightCode Net board, who's online, or post (as you) | posting |
| `make_sound` | make a retro sound effect with SFX Lab's synth (preset + settings), play it, save it as .wav, open it in SFX Lab | saving |

Albert also has `remember` / `forget` (his memory), `run_javascript` (his sandboxed scratchpad) and
Claude's web search and web fetch.

## Safety

- The MCP endpoint and the Albert API need the token and refuse browser pages from other sites (Origin check); the desktop
  endpoints (`/api/albert`, `/api/agent/*`) need a ColeForge-only header, a same-site Origin, and a
  connection from this PC.
- Your API keys (`anthropic-key`, `groq-key`) and the agent token live in `~/.coleforge` with owner-only permissions.
- Tools only touch ColeForge (its documents, programs and settings), never your Windows files.

- Albert's scratchpad code can't reach the network, storage or the desktop, and is stopped after 8 seconds.

Tests: `node coleforge/tests/albert.test.js` (mock Claude API in `tests/mock-anthropic.js` and mock Groq
in `tests/mock-groq.js`, both streaming like the real ones).
