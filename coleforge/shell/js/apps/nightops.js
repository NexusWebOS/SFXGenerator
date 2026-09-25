"use strict";

// NightOps: your NightCode Net, Supabase, GitHub and Netlify in one window. OPS at the NightCode-DOS
// prompt opens it on the website's desktop; ColeForge.exe has it too. GitHub and Netlify go through the
// site's /api/ops function (web/nightcode/netlify/functions/ops.mjs), which holds the tokens and only
// answers the NightCode Net sysop.
(function () {
  const { h } = CF;
  const SITE = "https://nightcode.coletechsystems.com/";
  const hostedDesk = () => !!window.NIGHTCODE_HOSTED;
  const opsUrl = () => (hostedDesk() ? new URL("../api/ops", location.href).href : new URL("api/ops", (CF.store.get("cf.nightcodeNet.config", null)?.siteUrl) || SITE).href);
  const ago = (t) => {
    if (!t) return "never";
    const s = (Date.now() - new Date(t).getTime()) / 1000;
    if (s < 60) return "just now"; if (s < 3600) return `${Math.floor(s / 60)} min ago`; if (s < 86400) return `${Math.floor(s / 3600)} h ago`; return `${Math.floor(s / 86400)} d ago`;
  };
  const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  // Links: a new browser tab on the web (GitHub and Netlify can't be framed), NightBrowser in ColeForge.exe.
  const openLink = (url) => (CF.host?.webview ? CF.open("nightbrowser", { url }) : window.open(url, "_blank", "noopener"));

  function nightApi() {
    const cfg = window.NIGHTCODE_CONFIG?.supabaseUrl ? window.NIGHTCODE_CONFIG : CF.store.get("cf.nightcodeNet.config", null);
    if (!cfg?.supabaseUrl || !cfg?.supabaseAnonKey || !window.NightCodeAPI) return null;
    try { return NightCodeAPI.create({ url: cfg.supabaseUrl, anonKey: cfg.supabaseAnonKey, redirectTo: cfg.siteUrl || SITE }); } catch { return null; }
  }

  CF.register({
    id: "nightops", name: "NightOps", icon: "network", single: true,
    desc: "NightOps: your NightCode Net, Supabase project, GitHub repositories and Netlify sites.",
    window: { w: 900, h: 600 },
    open(win) {
      const api = nightApi();
      const tabBar = h("div", { class: "tabs" });
      const page = h("div", { class: "nops pad" });
      const status = h("div", { class: "nops-status" });
      win.body.append(h("div", { class: "nops-wrap" }, tabBar, page, status));
      const TABS = [["home", "Overview"], ["github", "GitHub"], ["netlify", "Netlify"]];
      let tab = "home";
      const say = (t) => { status.textContent = t; };

      async function ops(action, extra = {}) {
        if (!api?.session) throw new Error("Sign in to NightCode Net first (NightCode-DOS, or the NightCode Net program).");
        const token = await api.accessToken();
        let r;
        try { r = await fetch(opsUrl(), { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(Object.assign({ action }, extra)) }); }
        catch (e) { throw new Error(`Can't reach NightOps (${e.message}).`); }
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || `NightOps said ${r.status}.`);
        return data.data;
      }
      const busy = (msg) => page.replaceChildren(h("p", { class: "muted" }, msg));
      const fail = (e) => page.replaceChildren(h("div", { class: "nops-err" }, h("b", {}, "NightOps: "), e.message));
      const btn = (label, fn, title) => { const b = h("button", { class: "btn", title: title || "" }, label); b.addEventListener("click", fn); return b; };

      function show(t) {
        tab = t;
        tabBar.replaceChildren(...TABS.map(([id, label]) => { const d = h("div", { class: "clickable" + (id === t ? " on" : "") }, label); d.addEventListener("click", () => show(id)); return d; }));
        ({ home, github, netlify }[t])().catch(fail);
      }

      /* ---------- overview ---------- */
      async function home() {
        busy("Checking…");
        const prof = CF.store.get("nightcode.profile", null);
        const rows = [];
        const row = (k, v) => rows.push(h("tr", {}, h("th", {}, k), h("td", {}, v)));
        row("NightCode Net", api?.session ? `${prof?.username || api.user?.email || "signed in"}${prof?.role === "sysop" ? " (sysop)" : ""}` : "not signed in");
        const cfg = window.NIGHTCODE_CONFIG || CF.store.get("cf.nightcodeNet.config", {}) || {};
        row("Supabase", cfg.supabaseUrl || "not configured");
        if (api) {
          try { await api.health(); row("Supabase status", "online"); } catch (e) { row("Supabase status", `offline (${e.message})`); }
          if (api.session) {
            try { const s = await api.stats(); row("Members", `${s.members} members, ${s.online} online, ${s.posts} posts on the board`); } catch (e) { row("Members", `can't read (${e.message}): run the second migration`); }
          }
        }
        const cloud = window.NIGHTCODE_HOSTED?.cloud;
        if (cloud) {
          row("Cloud desktop", cloud.enabled ? `${cloud.keys} items, ${kb(cloud.bytes)}, saved ${cloud.lastSync ? ago(cloud.lastSync) : "not yet"}${cloud.lastError ? ` — ${cloud.lastError}` : ""}` : "off (guest)");
        } else row("Cloud desktop", "on the website's desktop (WIN at the NightCode-DOS prompt)");
        let st = null;
        try { st = await ops("status"); } catch (e) { row("NightOps server", e.message); }
        if (st) {
          row("GitHub", `${st.github.owner.join(", ")}${st.github.token ? " (token set: private repos too)" : " (public repos only: set GITHUB_TOKEN)"}`);
          row("Netlify", st.netlify.token ? "connected" : "set NETLIFY_API_TOKEN on the Netlify site");
        }
        page.replaceChildren(h("h3", {}, "NightCode control"), h("table", { class: "nops-kv" }, ...rows),
          h("div", { class: "nops-bar" },
            cloud?.enabled ? btn("Save desktop to cloud now", async () => { say("Saving…"); await window.NIGHTCODE_HOSTED.sync(); say("Saved."); show("home"); }) : null,
            btn("Open Supabase dashboard", () => openLink(`https://supabase.com/dashboard/project/${(cfg.supabaseUrl || "").replace(/^https:\/\/|\.supabase\.co.*$/g, "")}`)),
            btn("Open NightCode Net", () => CF.open("nightcode-net"))));
      }

      /* ---------- GitHub ---------- */
      let repos = null;
      async function github() {
        busy("Loading repositories…");
        repos = repos || await ops("github.repos");
        const list = h("tbody", {}, ...repos.map((r) => {
          const tr = h("tr", { class: "clickable" }, h("td", {}, h("b", {}, r.name), r.private ? h("span", { class: "nops-tag" }, "private") : null, r.archived ? h("span", { class: "nops-tag" }, "archived") : null),
            h("td", { class: "muted" }, r.description || ""), h("td", {}, r.language || ""), h("td", {}, ago(r.pushed_at)));
          tr.addEventListener("click", () => repoView(r, "").catch(fail));
          return tr;
        }));
        page.replaceChildren(h("div", { class: "nops-bar" }, h("b", {}, `${repos.length} repositories`), btn("Refresh", () => { repos = null; show("github"); })),
          h("table", { class: "nops-table" }, h("thead", {}, h("tr", {}, h("th", {}, "Repository"), h("th", {}, "About"), h("th", {}, "Language"), h("th", {}, "Pushed"))), list));
      }
      async function repoView(r, path) {
        busy(`Opening ${r.full_name}/${path}…`);
        const [content, commits] = await Promise.all([ops("github.contents", { repo: r.full_name, path }), path ? Promise.resolve(null) : ops("github.commits", { repo: r.full_name }).catch(() => [])]);
        const crumbs = h("div", { class: "nops-bar" }, btn("◀ Repositories", () => show("github")), h("b", {}, r.full_name));
        const parts = path ? path.split("/") : [];
        crumbs.append(h("span", { class: "clickable nops-crumb", onclick: () => repoView(r, "").catch(fail) }, "/"));
        parts.forEach((p, i) => crumbs.append(h("span", { class: "clickable nops-crumb", onclick: () => repoView(r, parts.slice(0, i + 1).join("/")).catch(fail) }, p + (i < parts.length - 1 ? "/" : ""))));
        crumbs.append(btn("Open on GitHub", () => openLink(`${r.html_url}${path ? `/tree/${r.default_branch}/${path}` : ""}`)));
        const body = [];
        if (content.type === "dir") {
          const items = content.items.slice().sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
          body.push(h("table", { class: "nops-table" }, h("tbody", {}, ...items.map((it) => {
            const tr = h("tr", { class: "clickable" }, h("td", {}, (it.type === "dir" ? "📁 " : "📄 ") + it.name), h("td", { class: "muted" }, it.type === "file" ? kb(it.size) : ""));
            tr.addEventListener("click", () => repoView(r, it.path).catch(fail));
            return tr;
          }))));
        } else {
          let view;
          if (!content.content) view = h("p", { class: "muted" }, `${content.name} is ${kb(content.size)}: too big to show here.`);
          else {
            const bin = atob(content.content.replace(/\n/g, ""));
            const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
            if (/\.(png|jpe?g|gif|webp|ico|bmp)$/i.test(content.name)) view = h("img", { class: "nops-img", src: URL.createObjectURL(new Blob([bytes])), alt: content.name });
            else if (bytes.slice(0, 8000).includes(0)) view = h("p", { class: "muted" }, `${content.name} is a binary file (${kb(content.size)}).`);
            else view = h("pre", { class: "nops-code" }, new TextDecoder().decode(bytes));
          }
          body.push(view);
        }
        if (commits?.length) body.push(h("h4", {}, "Latest commits"), h("table", { class: "nops-table" }, h("tbody", {}, ...commits.map((c) => {
          const tr = h("tr", { class: "clickable", title: c.message }, h("td", { class: "mono" }, c.sha.slice(0, 7)), h("td", {}, c.message.split("\n")[0]), h("td", {}, c.author || ""), h("td", {}, ago(c.date)));
          tr.addEventListener("click", () => openLink(c.html_url));
          return tr;
        }))));
        page.replaceChildren(crumbs, ...body);
      }

      /* ---------- Netlify ---------- */
      async function netlify() {
        busy("Loading Netlify sites…");
        const sites = await ops("netlify.sites");
        const cards = sites.map((s) => {
          const c = h("div", { class: "nops-card" },
            h("div", {}, h("b", {}, s.name), h("span", { class: "nops-tag " + (s.state === "ready" ? "ok" : s.state === "error" ? "bad" : "") }, s.state || "?")),
            h("div", { class: "muted" }, s.custom_domain || s.url), h("div", { class: "muted" }, `published ${ago(s.published_at)}${s.repo ? ` · ${s.repo.replace(/^https:\/\/github\.com\//, "")}${s.branch ? "@" + s.branch : ""}` : ""}`),
            h("div", { class: "nops-bar" }, btn("Deploys", () => deploys(s).catch(fail)), btn("Open", () => openLink(s.custom_domain ? `https://${s.custom_domain}` : s.url)), btn("Admin", () => openLink(s.admin_url))));
          return c;
        });
        page.replaceChildren(h("div", { class: "nops-bar" }, h("b", {}, `${sites.length} sites`), btn("Refresh", () => show("netlify"))), h("div", { class: "nops-cards" }, ...cards));
      }
      async function deploys(s) {
        busy(`Loading deploys of ${s.name}…`);
        const list = await ops("netlify.deploys", { site_id: s.id });
        const rebuild = btn("Trigger deploy", async () => {
          const r = await CF.dialog({ title: "NightOps", icon: "question", message: `Start a new build and deploy of ${s.name}?`, buttons: ["Deploy", "Cancel"] });
          if (r.button !== "Deploy") return;
          try { await ops("netlify.build", { site_id: s.id }); say(`Build started for ${s.name}.`); setTimeout(() => deploys(s).catch(fail), 3000); } catch (e) { fail(e); }
        });
        page.replaceChildren(h("div", { class: "nops-bar" }, btn("◀ Sites", () => show("netlify")), h("b", {}, s.name), rebuild, btn("Refresh", () => deploys(s).catch(fail))),
          h("table", { class: "nops-table" }, h("thead", {}, h("tr", {}, ["State", "Context", "Branch", "Commit / title", "Created", "Time"].map((x) => h("th", {}, x)))),
            h("tbody", {}, ...list.map((d) => h("tr", { title: d.error_message || "" },
              h("td", {}, h("span", { class: "nops-tag " + (d.state === "ready" ? "ok" : d.state === "error" ? "bad" : "") }, d.state)), h("td", {}, d.context || ""), h("td", {}, d.branch || ""),
              h("td", {}, d.title || (d.commit_ref || "").slice(0, 7) || ""), h("td", {}, ago(d.created_at)), h("td", {}, d.deploy_time ? `${d.deploy_time}s` : ""))))));
      }

      win.on("args", (a) => a?.tab && show(a.tab));
      show(tab);
    },
  });
})();
