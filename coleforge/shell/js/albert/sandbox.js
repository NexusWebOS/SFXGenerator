"use strict";

// Albert's scratchpad: runs JavaScript he writes (maths, data crunching, text wrangling) where it can't
// touch anything. The code runs in a Web Worker inside a sandboxed iframe: an opaque origin (no
// cookies, storage or ColeForge APIs), a CSP with no network at all, and a hard time limit - the
// worker is terminated and the iframe removed when it's done or out of time.
//
//   const r = await AlbertSandbox.run("return 6 * 7", { inputs: { csv: "..." }, timeout: 8000 });
//   // → { ok: true, result: "42", output: ["...console.log lines..."], ms: 3 }
(function () {
  const FRAME = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; worker-src blob:">
<script>
onmessage = (e) => {
  const { id, code, inputs, timeout } = e.data || {};
  const reply = (m) => parent.postMessage(Object.assign({ albertSandbox: id }, m), "*");
  const src = ${JSON.stringify(workerSource.toString())};
  // Albert's code becomes the body of an async function in the worker's own script (no eval needed).
  const url = URL.createObjectURL(new Blob(["(" + src + ")();\\nasync function __albert(inputs, console) {\\n" + code + "\\n}\\n//# sourceURL=albert-scratch.js"], { type: "text/javascript" }));
  const w = new Worker(url);
  const t0 = performance.now();
  const timer = setTimeout(() => { w.terminate(); reply({ ok: false, error: "Timed out after " + timeout + " ms (the code was stopped).", output: [] }); }, timeout);
  w.onmessage = (m) => { clearTimeout(timer); w.terminate(); reply(Object.assign({ ms: Math.round(performance.now() - t0) }, m.data)); };
  w.onerror = (err) => { err.preventDefault(); clearTimeout(timer); w.terminate(); reply({ ok: false, error: err.message || "The code failed to run.", output: [] }); };
  w.postMessage({ inputs });
};
</` + `script>`;

  // Runs inside the worker. Stringified into the frame above, so it can't close over anything here.
  function workerSource() {
    for (const k of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "indexedDB", "caches"]) {
      try { Object.defineProperty(self, k, { value: undefined, configurable: false }); } catch { /* CSP blocks them anyway */ }
    }
    const out = [];
    const show = (v) => {
      if (typeof v === "string") return v;
      try { return JSON.stringify(v, (k, x) => (typeof x === "bigint" ? x.toString() + "n" : x instanceof Map ? Object.fromEntries(x) : x instanceof Set ? [...x] : x), 2) ?? String(v); } catch { return String(v); }
    };
    const log = (...a) => { if (out.length < 500) out.push(a.map(show).join(" ").slice(0, 4000)); };
    const console = { log, info: log, warn: log, error: log, debug: log, table: log };
    self.onmessage = async (e) => {
      try {
        const result = await self.__albert(e.data.inputs || {}, console);
        postMessage({ ok: true, result: result === undefined ? undefined : show(result).slice(0, 20000), output: out });
      } catch (err) {
        postMessage({ ok: false, error: String(err && err.stack || err).slice(0, 4000), output: out });
      }
    };
  }

  let seq = 0;
  function run(code, { inputs = {}, timeout = 8000 } = {}) {
    return new Promise((resolve) => {
      const id = `s${Date.now()}-${++seq}`;
      const frame = document.createElement("iframe");
      frame.setAttribute("sandbox", "allow-scripts");
      frame.style.display = "none";
      frame.srcdoc = FRAME;
      let done = false;
      const finish = (r) => { if (done) return; done = true; removeEventListener("message", onMsg); clearTimeout(guard); frame.remove(); resolve(r); };
      const onMsg = (e) => { if (e.source === frame.contentWindow && e.data && e.data.albertSandbox === id) { const { albertSandbox, ...r } = e.data; finish(r); } };
      const guard = setTimeout(() => finish({ ok: false, error: "The scratchpad didn't answer.", output: [] }), timeout + 3000);
      addEventListener("message", onMsg);
      frame.onload = () => frame.contentWindow.postMessage({ id, code: String(code), inputs, timeout }, "*");
      document.body.append(frame);
    });
  }

  window.AlbertSandbox = { run };
})();
