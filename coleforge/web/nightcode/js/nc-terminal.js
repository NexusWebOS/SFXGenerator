"use strict";

// NightCode-DOS: the text-mode terminal of NightCode Net. It boots like an MS-DOS PC (BIOS POST,
// CONFIG.SYS, AUTOEXEC.BAT), logs you in to NightCode Net and gives you a command shell with a
// message board, WHO, FINGER, profiles and a code-rain screen.
//   NightTerminal.mount(element, { api, config, host: "web" | "coleforge", onExit, launch, skipBoot })
// launch(target, arg) starts the graphical side: "desktop" (WIN), "web" (WEB url), "ops" (OPS).
// Shared by nightcode.coletechsystems.com and ColeForge.exe (shell/js/nightcode-net/).
(function (root) {
  const VERSION = "6.66";
  const BOARDS = ["main", "hack", "games", "music", "coleforge"];
  // 5-row block font for the banner.
  const FONT = {
    N: ["█   █", "██  █", "█ █ █", "█  ██", "█   █"], I: ["███", " █ ", " █ ", " █ ", "███"], G: [" ████", "█    ", "█  ██", "█   █", " ███ "],
    H: ["█   █", "█   █", "█████", "█   █", "█   █"], T: ["█████", "  █  ", "  █  ", "  █  ", "  █  "], C: [" ████", "█    ", "█    ", "█    ", " ████"],
    O: [" ███ ", "█   █", "█   █", "█   █", " ███ "], D: ["████ ", "█   █", "█   █", "█   █", "████ "], E: ["█████", "█    ", "████ ", "█    ", "█████"], " ": ["  ", "  ", "  ", "  ", "  "],
  };
  const banner = (word) => [0, 1, 2, 3, 4].map((r) => [...word].map((c) => (FONT[c] || FONT[" "])[r]).join(" "));
  const SKULL = [
    "        ▄▄████████▄▄        ",
    "      ████████████████      ",
    "     ████▀▀██████▀▀████     ",
    "     ███  ◢◣ ██ ◢◣  ███     ",
    "     ████▄▄██▀▀██▄▄████     ",
    "      ▀████▄ ▀▀ ▄████▀      ",
    "   ▄▄   ██▀██▀▀██▀██   ▄▄   ",
    "    ▀██▄▄ ▀▀▀▀▀▀▀▀ ▄▄██▀    ",
    "       ▀▀██▄▄▄▄▄▄██▀▀       ",
  ];
  const FILES = {
    "README.TXT": [
      "NIGHTCODE NET",
      "=============",
      "A bulletin board for the NightCode crew, run by ColeTech Systems.",
      "",
      "Sign in with the same account on the web (nightcode.coletechsystems.com)",
      "and in ColeForge.exe (Start > Programs > NightCode Net).",
      "",
      "Type HELP for the commands.",
    ],
    "RULES.TXT": [
      "HOUSE RULES",
      "===========",
      "1. Be decent. No harassment, hate or threats.",
      "2. No illegal content, no doxxing, no malware.",
      "3. Hack the planet, not each other.",
      "The sysop deletes posts that break these.",
    ],
    "COLEFORGE.TXT": [
      "COLEFORGE EDITION",
      "=================",
      "Windows - ColeForge Edition is the NightCode desktop: WinNight, NightAmp,",
      "NightBrowser, ForgeChat and more. Its NightCode Net program is this",
      "terminal, signed in with the same account.",
    ],
  };
  const HELP = [
    ["HELP", "this list"], ["CLS", "clear the screen"], ["DIR", "list files"], ["TYPE file", "show a file (TYPE README.TXT)"],
    ["BOARD [name]", "read a message board (BOARDS lists them)"], ["POST [text]", "post to the board you're reading"], ["DEL id", "delete your post"],
    ["WHO", "who's online"], ["FINGER user", "look someone up"], ["WHOAMI", "your account"], ["PROFILE", "show or edit your profile"],
    ["PASSWD", "change your password"], ["COLOR [scheme]", "night, green, amber, white"], ["MATRIX", "code rain (any key stops it)"],
    ["WIN", "start the NightCode desktop"], ["WEB [address]", "open NightBrowser"], ["OPS", "NightOps: Supabase, GitHub, Netlify"],
    ["VER / DATE / TIME", "system info"], ["ECHO text", "print text"], ["LOGOUT", "sign out"], ["REBOOT", "restart the machine"],
  ];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pad = (s, n) => String(s).padEnd(n).slice(0, n);
  const ago = (t) => {
    if (!t) return "never";
    const s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };
  const stamp = (t) => { const d = new Date(t); return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${String(d.getFullYear()).slice(2)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

  function mount(el, { api = null, config = {}, host = "web", onExit = null, fast = false, launch = null, skipBoot = false } = {}) {
    el.classList.add("nt");
    el.innerHTML = "";
    const scr = document.createElement("div"); scr.className = "nt-screen";
    const out = document.createElement("div"); out.className = "nt-out";
    const line = document.createElement("div"); line.className = "nt-line";
    const promptEl = document.createElement("span"); promptEl.className = "nt-prompt";
    const typed = document.createElement("span"); typed.className = "nt-typed";
    const cursor = document.createElement("span"); cursor.className = "nt-cursor"; cursor.textContent = "_";
    const input = document.createElement("input");
    Object.assign(input, { className: "nt-input", autocomplete: "off", spellcheck: false, autocapitalize: "off" });
    input.setAttribute("aria-label", "Terminal input");
    line.append(promptEl, typed, cursor);
    scr.append(out, line);
    el.append(scr, input);
    const rain = document.createElement("canvas"); rain.className = "nt-rain"; rain.hidden = true;
    el.append(rain);

    let alive = true, mask = false, pending = null, skip = false, busy = false, board = "main", heartbeat = null;
    const cmdHistory = [];
    let hIdx = 0;
    const storeGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
    const storeSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* blocked */ } };
    setColor(storeGet("nightcode.color", "night"));

    /* ---------- output ---------- */
    function print(text = "", cls = "") {
      for (const t of String(text).split("\n")) {
        const d = document.createElement("div");
        d.className = "nt-row" + (cls ? " " + cls : "");
        d.textContent = t || "\u00a0";
        out.append(d);
      }
      while (out.childElementCount > 1500) out.firstElementChild.remove();
      scrollDown();
    }
    function scrollDown() { scr.scrollTop = scr.scrollHeight; }
    async function slow(text, cls = "", ms = 12) {
      if (skip || fast) return print(text, cls);
      const d = document.createElement("div"); d.className = "nt-row" + (cls ? " " + cls : ""); out.append(d);
      for (let i = 0; i < text.length; i++) {
        if (skip) { d.textContent = text; break; }
        d.textContent = text.slice(0, i + 1);
        if (i % 3 === 0) { scrollDown(); await sleep(ms); }
      }
      if (!text) d.textContent = "\u00a0";
      scrollDown();
    }
    const wait = (ms) => (skip || fast ? Promise.resolve() : sleep(ms));
    function cls() { out.innerHTML = ""; }

    /* ---------- input ---------- */
    function setPrompt(p) { promptEl.textContent = p; }
    function render() { typed.textContent = mask ? "*".repeat(input.value.length) : input.value; scrollDown(); }
    function ask(prompt, opts = {}) {
      return new Promise((resolve, reject) => {
        mask = !!opts.mask;
        setPrompt(prompt);
        input.value = opts.value || "";
        line.hidden = false;
        render();
        pending = { resolve, reject, prompt, opts };
        focus();
      });
    }
    function focus() { try { input.focus({ preventScroll: true }); } catch { /* not attached */ } }
    input.addEventListener("input", render);
    input.addEventListener("keydown", (e) => {
      if (!rain.hidden) { e.preventDefault(); stopRain(); return; }
      if (!pending) { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") skip = true; e.preventDefault(); return; }
      if (e.key === "Enter") {
        e.preventDefault();
        const v = input.value;
        const p = pending; pending = null;
        print(p.prompt + (mask ? "*".repeat(v.length) : v), "nt-echo");
        if (!mask && v.trim() && p.opts.history !== false) { cmdHistory.push(v); hIdx = cmdHistory.length; }
        input.value = ""; typed.textContent = ""; mask = false;
        line.hidden = true;
        p.resolve(v);
      } else if (e.key === "c" && e.ctrlKey) {
        e.preventDefault();
        const p = pending; pending = null;
        print(p.prompt + input.value + "^C", "nt-echo");
        input.value = ""; typed.textContent = ""; mask = false; line.hidden = true;
        p.reject(Object.assign(new Error("cancelled"), { cancelled: true }));
      } else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !mask && pending.opts.history !== false) {
        e.preventDefault();
        hIdx = Math.max(0, Math.min(cmdHistory.length, hIdx + (e.key === "ArrowUp" ? -1 : 1)));
        input.value = cmdHistory[hIdx] || "";
        render();
      } else if (e.key === "Tab" && pending.opts.commands) {
        e.preventDefault();
        const v = input.value.toUpperCase();
        const hit = pending.opts.commands.filter((c) => c.startsWith(v));
        if (hit.length === 1) { input.value = hit[0] + " "; render(); }
        else if (hit.length > 1 && v) { print(pending.prompt + input.value, "nt-echo"); print(hit.join("  "), "nt-dim"); }
      } else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); cls(); }
    });
    el.addEventListener("pointerup", () => { if (!pending) skip = true; if (!getSelection().toString()) focus(); });
    line.hidden = true;
    focus();

    /* ---------- colours & code rain ---------- */
    function setColor(name) {
      const ok = ["night", "green", "amber", "white"].includes(name) ? name : "night";
      el.dataset.color = ok;
      storeSet("nightcode.color", ok);
      return ok;
    }
    let rainRaf = 0, rainDone = null;
    function startRain() {
      return new Promise((resolve) => {
        rain.hidden = false;
        const c = rain.getContext("2d");
        const W = rain.width = el.clientWidth, H = rain.height = el.clientHeight, fs = 16, cols = Math.ceil(W / fs);
        const drops = Array.from({ length: cols }, () => Math.random() * -40);
        const glyphs = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789NIGHTCODE$#@%&";
        const color = getComputedStyle(el).getPropertyValue("--nt-fg").trim() || "#31d7e8";
        c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
        let last = 0;
        const step = (t) => {
          rainRaf = requestAnimationFrame(step);
          if (t - last < 45) return;
          last = t;
          c.fillStyle = "rgba(0,0,0,0.08)"; c.fillRect(0, 0, W, H);
          c.font = `${fs}px "Share Tech Mono", monospace`;
          drops.forEach((y, i) => {
            const ch = glyphs[Math.floor(Math.random() * glyphs.length)];
            c.fillStyle = Math.random() < 0.05 ? "#ffffff" : color;
            c.fillText(ch, i * fs, y * fs);
            drops[i] = y * fs > H && Math.random() > 0.975 ? 0 : y + 1;
          });
        };
        rainRaf = requestAnimationFrame(step);
        rainDone = resolve;
        focus();
      });
    }
    function stopRain() { cancelAnimationFrame(rainRaf); rain.hidden = true; rainDone?.(); rainDone = null; }

    /* ---------- boot ---------- */
    const hostName = (() => { try { return new URL(config.supabaseUrl || "").host || "not configured"; } catch { return "not configured"; } })();
    async function boot() {
      skip = false;
      cls();
      line.hidden = true;
      await slow("NightCode BIOS v4.20  (C) 1987-2026 ColeTech Systems", "nt-hi");
      await slow("NC-486DX4 CPU at 100 MHz, NCVGA 2.0 BIOS");
      await wait(150);
      const mem = document.createElement("div"); mem.className = "nt-row"; out.append(mem);
      for (let k = 0; k <= 65536; k += 2048) { mem.textContent = `Memory Test: ${String(k + 640).padStart(6)}K`; if (!skip && !fast) await sleep(8); }
      mem.textContent = "Memory Test:  66176K OK";
      await slow("Detecting IDE drives ... C: NIGHTCODE 540MB   D: NETLINK");
      await slow("Press DEL to enter SETUP, ESC to skip memory test", "nt-dim");
      await wait(300);
      print("");
      await slow(`Starting NightCode-DOS ${VERSION}...`);
      await wait(250);
      print("");
      await slow("HIMEM is testing extended memory...done.", "nt-dim");
      await slow("C:\\>LH C:\\DOS\\SMARTDRV.EXE /X", "nt-dim");
      await slow(`C:\\>LH C:\\NET\\NETLINK.COM /HOST:${hostName}`, "nt-dim");
      let online = false;
      if (api) {
        try { await api.health(); online = true; } catch (e) { print(`NETLINK: ${e.message}`, "nt-err"); }
      }
      print(api ? (online ? `NETLINK: CONNECTED TO ${hostName.toUpperCase()}` : "NETLINK: OFFLINE (the board needs the net)") : "NETLINK: NOT CONFIGURED (set the Supabase URL and anon key)", online ? "nt-ok" : "nt-warn");
      await wait(200);
      print("");
      for (const r of SKULL) print(r, "nt-skull");
      for (const r of banner("NIGHTCODE")) print(r, "nt-banner");
      print(`                 N E T   //   D O S   ${VERSION}`, "nt-hi");
      print("");
      skip = false;
      return online;
    }

    /* ---------- login ---------- */
    const hash = typeof location !== "undefined" ? location.hash : "";
    async function login() {
      // Links from Supabase emails (activate, reset password).
      const link = api && hash && /access_token|error/.test(hash) ? api.fromUrl(hash) : null;
      if (link && host === "web") try { root.history.replaceState(null, "", location.pathname + location.search); } catch { /* ignore */ }
      if (link?.error) print(`LINK ERROR: ${link.error}`, "nt-err");
      if (link?.type === "recovery") {
        print("PASSWORD RESET", "nt-hi");
        await newPassword();
      } else if (link?.type === "signup" || link?.type === "email") print("ACCOUNT ACTIVATED. WELCOME TO NIGHTCODE NET.", "nt-ok");
      if (api?.session) {
        try { const p = await api.profile(); if (p) return p; } catch (e) { if (e.status !== 401) print(`NETLINK: ${e.message}`, "nt-warn"); }
      }
      print("NIGHTCODE NET // SECURE TERMINAL", "nt-hi");
      print(`Type your username, or NEW to make an account,${host === "web" ? " GITHUB to sign in with GitHub," : ""} RESET if you forgot your password, GUEST to look around.`, "nt-dim");
      print("");
      for (;;) {
        let who;
        try { who = (await ask("login: ", { history: false })).trim(); } catch (e) { if (e.restart) throw e; continue; }
        if (!who) continue;
        const up = who.toUpperCase();
        if (up === "GUEST") return null;
        if (up === "NEW" || up === "REGISTER") { const p = await register(); if (p) return p; continue; }
        if (up === "RESET") { await reset(); continue; }
        if (up === "GITHUB") {
          if (!api) { print("NETLINK is not configured.", "nt-err"); continue; }
          if (host !== "web") { print("GitHub sign-in happens on nightcode.coletechsystems.com. Sign in there once, then use your username here.", "nt-warn"); continue; }
          print("Handing you to GitHub...", "nt-dim");
          location.href = api.oauthUrl("github", config.siteUrl || location.origin + "/");
          await new Promise(() => {});
        }
        if (up === "HELP") { print("Usernames and email addresses both work. NEW makes an account, GITHUB signs in with GitHub, RESET mails a reset link, GUEST skips sign-in.", "nt-dim"); continue; }
        if (!api) { print("NETLINK is not configured. Type GUEST.", "nt-err"); continue; }
        let pw;
        try { pw = await ask("password: ", { mask: true, history: false }); } catch (e) { if (e.restart) throw e; continue; }
        print("Authenticating...", "nt-dim");
        try {
          await api.signIn(who, pw);
          const p = await api.profile();
          print("ACCESS GRANTED", "nt-ok");
          return p || { username: who };
        } catch (e) { print(e.status === 400 && /invalid/i.test(e.message) ? "ACCESS DENIED: wrong username or password." : e.message.toUpperCase().startsWith("ACCESS") ? e.message : `ACCESS DENIED: ${e.message}`, "nt-err"); }
      }
    }
    async function register() {
      if (!api) { print("NETLINK is not configured.", "nt-err"); return null; }
      print("NEW ACCOUNT  (Ctrl+C cancels)", "nt-hi");
      try {
        let username;
        for (;;) {
          username = (await ask("username (3-16 letters, numbers, _): ", { history: false })).trim();
          if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) { print("Usernames are 3-16 letters, numbers or underscores.", "nt-err"); continue; }
          try { if (!(await api.usernameAvailable(username))) { print("That username is taken.", "nt-err"); continue; } }
          catch (e) { print(`Couldn't check the name (${e.message}). Carrying on.`, "nt-warn"); }
          break;
        }
        let email;
        for (;;) {
          email = (await ask("email: ", { history: false })).trim();
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) break;
          print("That doesn't look like an email address.", "nt-err");
        }
        let pw;
        for (;;) {
          pw = await ask("password (8+ characters): ", { mask: true, history: false });
          if (pw.length < 8) { print("Use at least 8 characters.", "nt-err"); continue; }
          const again = await ask("password again: ", { mask: true, history: false });
          if (again !== pw) { print("The passwords don't match.", "nt-err"); continue; }
          break;
        }
        print("Creating account...", "nt-dim");
        const r = await api.signUp({ email, password: pw, username });
        if (r.confirm) {
          print(`ACCOUNT CREATED. An activation link is on its way to ${email}.`, "nt-ok");
          print("Open it, then log in here with your username.", "nt-dim");
          return null;
        }
        print(`ACCOUNT CREATED. WELCOME, ${username.toUpperCase()}.`, "nt-ok");
        return (await api.profile()) || { username };
      } catch (e) {
        if (e.restart) throw e;
        if (!e.cancelled) print(`Couldn't create the account: ${e.message}`, "nt-err");
        return null;
      }
    }
    async function reset() {
      if (!api) { print("NETLINK is not configured.", "nt-err"); return; }
      try {
        const email = (await ask("email for the reset link: ", { history: false })).trim();
        if (!email) return;
        await api.recover(email);
        print("If that address has an account, a reset link is on its way.", "nt-ok");
      } catch (e) { if (e.restart) throw e; if (!e.cancelled) print(`RESET FAILED: ${e.message}`, "nt-err"); }
    }
    async function newPassword() {
      for (;;) {
        try {
          const pw = await ask("new password (8+ characters): ", { mask: true, history: false });
          if (pw.length < 8) { print("Use at least 8 characters.", "nt-err"); continue; }
          if ((await ask("again: ", { mask: true, history: false })) !== pw) { print("The passwords don't match.", "nt-err"); continue; }
          await api.updatePassword(pw);
          print("PASSWORD CHANGED.", "nt-ok");
          return true;
        } catch (e) { if (e.restart) throw e; if (e.cancelled) return false; print(`Couldn't change it: ${e.message}`, "nt-err"); }
      }
    }

    /* ---------- the shell ---------- */
    let me = null;
    const COMMANDS = ["WIN", "WEB", "OPS", "HELP", "CLS", "DIR", "TYPE", "BOARD", "BOARDS", "POST", "DEL", "WHO", "FINGER", "WHOAMI", "PROFILE", "PASSWD", "COLOR", "MATRIX", "VER", "DATE", "TIME", "ECHO", "LOGOUT", "LOGIN", "REBOOT", "EXIT"];
    // Restarting from inside a command: let the command finish first.
    const later = (fn) => { setTimeout(fn, 0); };
    const needNet = () => { if (!me) { print("Sign in first: type LOGIN.", "nt-err"); return false; } return true; };
    async function run(cmdline) {
      const [cmd0, ...rest] = cmdline.trim().split(/\s+/);
      const cmd = (cmd0 || "").toUpperCase(), arg = rest.join(" ");
      switch (cmd) {
        case "": return;
        case "HELP": case "?":
          print("NIGHTCODE-DOS COMMANDS", "nt-hi");
          HELP.forEach(([c, d]) => print(`  ${pad(c, 18)} ${d}`));
          if (host === "coleforge") print(`  ${pad("EXIT", 18)} close NightCode Net`);
          return;
        case "CLS": return cls();
        case "VER": return print(`NightCode-DOS Version ${VERSION}  [NightCode Net, ${host === "coleforge" ? "ColeForge.exe" : "web"}]`);
        case "DATE": return print(`Current date is ${new Date().toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "2-digit", day: "2-digit" })}`);
        case "TIME": return print(`Current time is ${new Date().toLocaleTimeString()}`);
        case "ECHO": return print(arg);
        case "DIR":
          print(" Volume in drive C is NIGHTCODE", "nt-dim");
          print(" Directory of C:\\NIGHTCODE", "nt-dim");
          print("");
          Object.entries(FILES).forEach(([n, lines]) => { const [b, x] = n.split("."); print(`${pad(b, 9)}${pad(x, 4)} ${String(lines.join("\r\n").length).padStart(8)}  09-24-26  12:00a`); });
          print(`${pad("BOARD", 9)}${pad("", 4)}    <DIR>   09-24-26  12:00a`);
          print(`        ${Object.keys(FILES).length} file(s)`, "nt-dim");
          return;
        case "TYPE": {
          const f = FILES[arg.toUpperCase()];
          if (!f) return print("File not found", "nt-err");
          return f.forEach((l) => print(l));
        }
        case "COLOR":
          if (!arg) return print(`Colour scheme: ${el.dataset.color}. Try COLOR NIGHT, GREEN, AMBER or WHITE.`);
          return print(`Colour scheme: ${setColor(arg.toLowerCase())}`);
        case "MATRIX": return startRain();
        case "REBOOT": return later(() => restart());
        case "LOGIN":
          if (me) return print(`Already signed in as ${me.username}. LOGOUT first.`);
          return later(() => restart(true));
        case "LOGOUT":
          if (!me) return print("You're not signed in.");
          await api.signOut(); me = null; stopHeartbeat();
          try { localStorage.removeItem("nightcode.profile"); } catch { /* blocked */ }
          print("SIGNED OFF. NO CARRIER", "nt-warn");
          return later(() => restart(true));
        case "EXIT":
          if (host === "coleforge" && onExit) { onExit(); return; }
          return print("Close the tab to leave. LOGOUT signs you out.", "nt-dim");
        case "WHOAMI": {
          if (!needNet()) return;
          const u = api.user || {};
          print(`${me.username}${me.role === "sysop" ? " [SYSOP]" : ""}`, "nt-hi");
          print(`  name     ${me.display_name || me.username}`);
          if (u.email) print(`  email    ${u.email}`);
          print(`  joined   ${me.created_at ? stamp(me.created_at) : "?"}`);
          return;
        }
        case "PROFILE": {
          if (!needNet()) return;
          const sub = (rest[0] || "").toUpperCase();
          if (sub === "NAME" || sub === "BIO") {
            const val = rest.slice(1).join(" ").trim();
            if (!val && sub === "NAME") return print("PROFILE NAME your name", "nt-dim");
            me = Object.assign(me, await api.updateProfile(sub === "NAME" ? { display_name: val.slice(0, 40) } : { bio: val.slice(0, 280) }));
            return print("PROFILE UPDATED.", "nt-ok");
          }
          print(`${me.username}  ${me.display_name && me.display_name !== me.username ? "(" + me.display_name + ")" : ""}`, "nt-hi");
          print(`  bio      ${me.bio || "(none)"}`);
          print("PROFILE NAME text / PROFILE BIO text change them.", "nt-dim");
          return;
        }
        case "WHO": {
          if (!needNet()) return;
          const list = await api.who();
          print(`${list.length} ON THE LINE`, "nt-hi");
          list.forEach((u) => print(`  ${pad(u.username, 18)} ${pad(u.role === "sysop" ? "SYSOP" : "", 6)} ${ago(u.last_seen)}`));
          return;
        }
        case "FINGER": {
          if (!needNet()) return;
          if (!arg) return print("FINGER username", "nt-dim");
          const u = await api.finger(arg);
          if (!u) return print(`finger: ${arg}: no such user.`, "nt-err");
          print(`Login: ${u.username}${u.role === "sysop" ? "  [SYSOP]" : ""}      Name: ${u.display_name || u.username}`, "nt-hi");
          print(`Joined ${stamp(u.created_at)}. Last seen ${ago(u.last_seen)}.`);
          print(`Plan: ${u.bio || "No plan."}`);
          return;
        }
        case "BOARDS":
          print("BOARDS", "nt-hi");
          BOARDS.forEach((b) => print(`  ${b}${b === board ? "  <" : ""}`));
          print("BOARD name opens one; any name made of letters, numbers or _ works.", "nt-dim");
          return;
        case "BOARD": {
          if (!needNet()) return;
          if (arg) {
            const b = arg.toLowerCase();
            if (!/^[a-z0-9_]{1,16}$/.test(b)) return print("Board names are 1-16 letters, numbers or _.", "nt-err");
            board = b;
          }
          const posts = await api.posts(board, 15);
          print(`== BOARD: ${board.toUpperCase()} ==  (newest last, POST to write)`, "nt-hi");
          if (!posts.length) print("  (empty: be the first to POST)", "nt-dim");
          posts.reverse().forEach((p) => {
            print(`#${p.id}  ${p.username}  ${stamp(p.created_at)}`, "nt-meta");
            print(`  ${p.body}`);
          });
          return;
        }
        case "POST": {
          if (!needNet()) return;
          let body = arg;
          if (!body) {
            print(`Posting to ${board}. End with a line holding only a dot (.). Ctrl+C cancels.`, "nt-dim");
            const lines = [];
            for (;;) { const l = await ask("> ", { history: false }); if (l.trim() === ".") break; lines.push(l); }
            body = lines.join("\n").trim();
          }
          if (!body) return print("Nothing to post.", "nt-dim");
          if (body.length > 1000) return print("Posts are up to 1000 characters.", "nt-err");
          const p = await api.post(board, body);
          return print(`POSTED #${p?.id ?? "?"} TO ${board.toUpperCase()}.`, "nt-ok");
        }
        case "DEL": {
          if (!needNet()) return;
          const id = parseInt(arg.replace("#", ""), 10);
          if (!id) return print("DEL post-number", "nt-dim");
          const gone = await api.deletePost(id);
          return print(gone?.length ? `DELETED #${id}.` : `#${id} isn't yours to delete (or doesn't exist).`, gone?.length ? "nt-ok" : "nt-err");
        }
        case "PASSWD": if (!needNet()) return; await newPassword(); return;
        case "WIN": case "WINDOWS": case "DESKTOP": case "START":
          if (!launch) return print("The desktop isn't available here.", "nt-err");
          print("Starting NightCode Windows...", "nt-hi");
          return launch("desktop");
        case "WEB": case "BROWSE": case "BROWSER": {
          if (!launch) return print("NightBrowser isn't available here.", "nt-err");
          let u = arg.trim();
          const looksLikeHost = /^[^\s/]+\.[^\s]+$/.test(u);
          if (u && !/^[a-z]+:\/\//i.test(u)) u = looksLikeHost ? "https://" + u : "https://duckduckgo.com/?q=" + encodeURIComponent(u);
          print(`Starting NightBrowser${u ? ` at ${u}` : ""}...`, "nt-hi");
          return launch("web", u);
        }
        case "OPS":
          if (!launch) return print("NightOps isn't available here.", "nt-err");
          if (!needNet()) return;
          print("Starting NightOps...", "nt-hi");
          return launch("ops");
        default:
          print("Bad command or file name", "nt-err");
      }
    }

    function startHeartbeat() {
      stopHeartbeat();
      const beat = () => api?.touch().catch(() => {});
      beat();
      heartbeat = setInterval(beat, 60000);
    }
    function stopHeartbeat() { if (heartbeat) clearInterval(heartbeat); heartbeat = null; }

    let generation = 0;
    async function restart(skipBoot) {
      const gen = ++generation;
      if (pending) { const p = pending; pending = null; p.reject(Object.assign(new Error("restart"), { cancelled: true, restart: true })); }
      if (!skipBoot) await boot(); else print("");
      if (gen !== generation || !alive) return;
      try { me = await login(); } catch (e) { if (e.restart) return; me = null; }
      if (gen !== generation || !alive) return;
      if (me) {
        storeSet("nightcode.profile", { username: me.username, display_name: me.display_name, role: me.role });
        startHeartbeat();
        print("");
        print(`Welcome to NightCode Net, ${me.display_name || me.username}.`, "nt-hi");
        try {
          const [who, posts] = await Promise.all([api.who(), api.posts("main", 1)]);
          print(`${who.length} on the line. Newest on MAIN: ${posts[0] ? `#${posts[0].id} by ${posts[0].username}, ${ago(posts[0].created_at)}` : "nothing yet"}.`, "nt-dim");
        } catch { /* heartbeat will tell */ }
      } else print("GUEST MODE: DIR, TYPE, MATRIX and HELP work. LOGIN to join the board.", "nt-warn");
      print(launch ? "Type WIN for the NightCode desktop, WEB to browse, HELP for commands." : "Type HELP for commands.", "nt-dim");
      print("");
      for (;;) {
        if (gen !== generation || !alive) return;
        const drive = me ? `N:\\${me.username.toUpperCase()}>` : "C:\\NIGHTCODE>";
        let cmd;
        try { cmd = await ask(drive, { commands: COMMANDS }); } catch (e) { if (e.restart) return; continue; }
        if (busy) continue;
        busy = true;
        try { await run(cmd); }
        catch (e) {
          if (e.restart) return;
          if (!e.cancelled) print(e.status === 401 ? "SESSION EXPIRED: type LOGIN." : `ERROR: ${e.message}`, "nt-err");
          if (e.status === 401) me = null;
        } finally { busy = false; }
      }
    }

    api?.onChange?.((s) => { if (!s && me) { me = null; stopHeartbeat(); } });
    restart(skipBoot);
    return {
      el, print, run, restart,
      destroy() { alive = false; generation++; stopHeartbeat(); stopRain(); if (pending) { const p = pending; pending = null; p.reject(Object.assign(new Error("closed"), { cancelled: true, restart: true })); } el.innerHTML = ""; },
      get user() { return me; },
    };
  }

  const NightTerminal = { mount, VERSION, banner };
  if (typeof module === "object" && module.exports) module.exports = NightTerminal;
  root.NightTerminal = NightTerminal;
})(typeof window !== "undefined" ? window : globalThis);
