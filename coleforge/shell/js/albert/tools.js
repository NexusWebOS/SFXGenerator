"use strict";

// The ColeForge agent tools: what Albert, and any AI agent software connected over MCP, can do on this
// desktop. Each tool has a JSON Schema (sent to Claude / listed over MCP) and a run() that acts on CF.
// Tools marked write: true change something, so the person at the desktop approves each call first
// (AgentTools.approve), unless they chose "allow for this chat".
(function () {
  const clip = (s, n) => (String(s).length > n ? String(s).slice(0, n) + `\n…[${String(s).length - n} more characters]` : String(s));
  const obj = (properties, required = []) => ({ type: "object", properties, required, additionalProperties: false });
  const docInfo = (d) => ({ name: d.name, type: d.type, size: typeof d.data === "string" ? d.data.length : 0, modified: new Date(d.modified || 0).toISOString() });
  const SETTINGS = { theme: "Desktop theme id", wallpaper: "Wallpaper id", clock24: "24-hour clock (true/false)", soundScheme: "Sound scheme id", screensaver: "Screen saver id", saverMinutes: "Minutes before the screen saver", volume: "System volume 0-1", sounds: "System sounds on (true/false)" };

  function nightApi() {
    const cfg = window.NIGHTCODE_CONFIG?.supabaseUrl ? window.NIGHTCODE_CONFIG : CF.store.get("cf.nightcodeNet.config", null);
    if (!cfg?.supabaseUrl || !window.NightCodeAPI) throw new Error("NightCode Net isn't set up on this desktop.");
    const api = NightCodeAPI.create({ url: cfg.supabaseUrl, anonKey: cfg.supabaseAnonKey });
    if (!api.session) throw new Error("Not signed in to NightCode Net. Open NightCode Net and log in first.");
    return api;
  }

  const TOOLS = [
    {
      name: "system_info", title: "Desktop info", description: "What's going on on the ColeForge desktop: date and time, user, theme, where it runs (ColeForge.exe, the NightCode website or a browser), open windows.",
      input_schema: obj({}),
      run: () => ({ now: new Date().toString(), user: CF.settings?.user || null, theme: CF.settings?.theme, wallpaper: CF.settings?.wallpaper, host: CF.host ? "ColeForge.exe" : window.NIGHTCODE_HOSTED ? "nightcode.coletechsystems.com" : "browser",
        screen: `${innerWidth}x${innerHeight}`, windows: CF.windows.map((w) => ({ app: w.appId, title: w.el.querySelector(".title")?.textContent || w.appId })) }),
    },
    {
      name: "list_apps", title: "List programs", description: "The programs installed on this desktop (id, name, what it does).",
      input_schema: obj({}),
      run: () => Object.values(CF.apps).filter((a) => !a.hidden).map((a) => ({ id: a.id, name: a.name, about: a.desc || "" })),
    },
    {
      name: "open_app", title: "Open a program", description: "Open a program by id (see list_apps), for example nightamp, nightbrowser, winnight, notepad, files, nightops, nightcode-net. For nightbrowser you can pass a url; for notepad a document name to open.",
      input_schema: obj({ app: { type: "string", description: "Program id" }, url: { type: "string", description: "Address for nightbrowser" }, file: { type: "string", description: "Document name in My Documents to open with the program" } }, ["app"]),
      run: ({ app, url, file }) => {
        if (!CF.apps[app]) throw new Error(`No program called ${app}. Use list_apps.`);
        CF.open(app, Object.assign({}, url ? { url } : {}, file ? { file } : {}));
        return `Opened ${CF.apps[app].name}.`;
      },
    },
    {
      name: "close_window", title: "Close a window", description: "Close an open program window (unsaved work in it is lost).", write: true,
      input_schema: obj({ app: { type: "string", description: "Program id of the window to close" } }, ["app"]),
      describe: ({ app }) => `close ${CF.apps[app]?.name || app}`,
      run: ({ app }) => { const w = CF.windows.find((x) => x.appId === app); if (!w) throw new Error(`${app} isn't open.`); w.close(); return `Closed ${app}.`; },
    },
    {
      name: "list_documents", title: "List My Documents", description: "Files in My Documents (name, type, size, last change).",
      input_schema: obj({}),
      run: () => CF.vfs.list().map(docInfo),
    },
    {
      name: "read_document", title: "Read a document", description: "Read a text document from My Documents. Binary files (music, archives, pictures) are described, not returned.",
      input_schema: obj({ name: { type: "string" } }, ["name"]),
      run: ({ name }) => {
        const d = CF.vfs.read(name);
        if (!d) throw new Error(`No document called ${name}. Use list_documents.`);
        if (typeof d.data === "string" && d.data.startsWith("data:")) return `${name} is a binary file (${d.data.slice(5, d.data.indexOf(";"))}, about ${Math.round(d.data.length * 0.75 / 1024)} KB).`;
        return clip(typeof d.data === "string" ? d.data : JSON.stringify(d.data), 60000);
      },
    },
    {
      name: "write_document", title: "Write a document", description: "Create or change a text document in My Documents. mode: create (fails if it exists), overwrite, or append.", write: true,
      input_schema: obj({ name: { type: "string", description: "File name, e.g. notes.txt" }, text: { type: "string" }, mode: { type: "string", enum: ["create", "overwrite", "append"] } }, ["name", "text"]),
      describe: ({ name, mode = "create", text = "" }) => `${mode === "append" ? "add to" : mode === "overwrite" ? "replace" : "create"} “${name}” (${text.length} characters)`,
      preview: ({ text = "" }) => clip(text, 600),
      run: ({ name, text, mode = "create" }) => {
        if (!/^[^\\/:*?"<>|]{1,120}$/.test(name)) throw new Error("That isn't a valid file name.");
        const cur = CF.vfs.read(name);
        if (cur && mode === "create") throw new Error(`${name} already exists. Use mode overwrite or append.`);
        const data = mode === "append" && cur && typeof cur.data === "string" ? cur.data + text : text;
        if (!CF.vfs.write(name, data, "text")) throw new Error("My Documents is full.");
        return `Saved ${name} (${data.length} characters).`;
      },
    },
    {
      name: "delete_document", title: "Delete a document", description: "Move a document from My Documents to the Recycle Bin (it can be restored).", write: true,
      input_schema: obj({ name: { type: "string" } }, ["name"]),
      describe: ({ name }) => `move “${name}” to the Recycle Bin`,
      run: ({ name }) => { if (!CF.vfs.read(name)) throw new Error(`No document called ${name}.`); CF.vfs.remove(name); return `${name} is in the Recycle Bin.`; },
    },
    {
      name: "nightamp", title: "Control NightAmp", description: "Control the NightAmp media player: status (what's playing, playlist), play, pause (toggles), stop, next, previous, volume (value 0-100), play_track (value = playlist number or part of a title), add_url (value = stream or file address; plays it), skin (value = nightcode, classic, silver or a saved skin), library (open the Media Library). NightAmp opens if needed.",
      input_schema: obj({ action: { type: "string", enum: ["status", "play", "pause", "stop", "next", "previous", "volume", "play_track", "add_url", "skin", "library"] }, value: { type: ["string", "number"] } }, ["action"]),
      run: async ({ action, value }) => {
        if (!CF.nightamp) { CF.open("nightamp"); for (let i = 0; i < 40 && !CF.nightamp; i++) await new Promise((r) => setTimeout(r, 100)); }
        const n = CF.nightamp;
        if (!n) throw new Error("NightAmp didn't start.");
        switch (action) {
          case "status": return n.status();
          case "volume": n.volume(Math.max(0, Math.min(100, +value || 0))); return `Volume ${Math.round(+value || 0)}%.`;
          case "play_track": {
            const i = /^\d+$/.test(String(value)) ? +value - 1 : n.find(value);
            if (i < 0) throw new Error(`Nothing in the playlist matches “${value}”.`);
            n.playIndex(i); return `Playing track ${i + 1}.`;
          }
          case "add_url": if (!/^https?:\/\//.test(String(value))) throw new Error("add_url needs an http(s) address."); await n.add(String(value)); return "Added and playing.";
          case "skin": await n.skin(String(value)); return `Skin: ${value}.`;
          case "library": n.toggle("showLib"); return "Toggled the Media Library.";
          default: n[action](); return `${action} done.`;
        }
      },
    },
    {
      name: "open_web", title: "Open a web page", description: "Open an address in NightBrowser on the desktop, for the person to look at.",
      input_schema: obj({ url: { type: "string", description: "https:// address" } }, ["url"]), openWorld: true,
      run: ({ url }) => { if (!/^https?:\/\//.test(url)) throw new Error("Give a full http(s) address."); CF.open("nightbrowser", { url }); return `Opened ${url} in NightBrowser.`; },
    },
    {
      name: "change_setting", title: "Change a desktop setting", description: `Change a desktop setting. Keys: ${Object.entries(SETTINGS).map(([k, v]) => `${k} (${v})`).join("; ")}. Themes: ${(CF.THEMES || []).map((t) => t[0]).join(", ")}.`,
      input_schema: obj({ key: { type: "string", enum: Object.keys(SETTINGS) }, value: { type: ["string", "number", "boolean"] } }, ["key", "value"]),
      run: ({ key, value }) => {
        if (!(key in SETTINGS)) throw new Error("That setting can't be changed by an agent.");
        if (key === "theme" && CF.THEMES && !CF.THEMES.some((t) => t[0] === value)) throw new Error(`Unknown theme. Themes: ${CF.THEMES.map((t) => t[0]).join(", ")}`);
        CF.settings[key] = value; CF.saveSettings();
        return `${key} is now ${JSON.stringify(value)}.`;
      },
    },
    {
      name: "notify", title: "Show a notification", description: "Show a small notification on the desktop.",
      input_schema: obj({ title: { type: "string" }, body: { type: "string" } }, ["body"]),
      run: ({ title, body }) => { CF.toast({ title: title || "Albert", body: clip(body, 400), icon: "albert" }); return "Shown."; },
    },
    {
      name: "nightcode_board", title: "NightCode Net board", description: "Read the NightCode Net message board (action read, optional board name, default main) or post to it (action post, text). Uses the person's NightCode Net account.",
      input_schema: obj({ action: { type: "string", enum: ["read", "post", "who"] }, board: { type: "string" }, text: { type: "string" } }, ["action"]),
      write: (a) => a.action === "post",
      describe: ({ board = "main", text = "" }) => `post to the NightCode Net board “${board}”: “${clip(text, 120)}”`,
      run: async ({ action, board = "main", text }) => {
        const api = nightApi();
        if (action === "who") return await api.who();
        if (action === "read") return (await api.posts(board, 20)).map((p) => ({ id: p.id, by: p.username, at: p.created_at, text: p.body }));
        if (!text?.trim()) throw new Error("Nothing to post.");
        const p = await api.post(board, text.trim().slice(0, 1000));
        return `Posted #${p?.id} to ${board}.`;
      },
    },
  ];

  const byName = new Map(TOOLS.map((t) => [t.name, t]));
  const isWrite = (t, args) => (typeof t.write === "function" ? t.write(args) : !!t.write);

  // Ask the person before a tool changes anything. who: "Albert" or the MCP client's name.
  const allowed = new Set();
  function approve(t, args, who, scope) {
    if (!isWrite(t, args)) return Promise.resolve(true);
    const key = `${scope || who}:${t.name}`;
    if (allowed.has(key)) return Promise.resolve(true);
    const what = t.describe ? t.describe(args) : t.title;
    const content = h("div", {}, h("p", { style: "margin:0 0 8px" }, `${who} wants to ${what}.`),
      t.preview ? h("pre", { style: "max-height:180px;overflow:auto;white-space:pre-wrap;margin:0;padding:6px;font:12px Consolas,monospace;border:1px solid rgba(127,127,127,.4)" }, t.preview(args)) : null);
    return CF.dialog({ title: `${who} asks`, icon: "albert", content, buttons: ["Allow", "Always allow", "Deny"] }).then((r) => {
      if (r.button === "Always allow") { allowed.add(key); return true; }
      return r.button === "Allow";
    });
  }
  const h = (...a) => CF.h(...a);

  async function run(name, args, { who = "Albert", scope } = {}) {
    const t = byName.get(name);
    if (!t) throw new Error(`Unknown tool ${name}.`);
    args = args && typeof args === "object" ? args : {};
    if (!(await approve(t, args, who, scope))) throw new Error("The person at the desktop declined this.");
    return t.run(args);
  }
  // What goes to Claude / MCP clients.
  const schemas = () => TOOLS.map((t) => ({ name: t.name, title: t.title, description: t.description, input_schema: t.input_schema, write: typeof t.write === "function" ? true : !!t.write, openWorld: !!t.openWorld }));
  const forClaude = () => TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }));

  window.AgentTools = { TOOLS, run, schemas, forClaude, approve, allowed };
})();
