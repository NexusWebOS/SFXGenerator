"use strict";

// Zandronum protocol tests: Huffman round trips, then real UDP round trips against the mock
// server/master/LAN beacon.   node coleforge/server/zandronum/test/zandronum.test.js

const assert = require("assert");
const crypto = require("crypto");
const huffman = require("../huffman.js");
const Z = require("../protocol.js");
const client = require("../client.js");
const mock = require("./mock-zandronum.js");

async function main() {
  // Huffman: random and text-like payloads survive a round trip; incompressible data falls back to 0xFF + raw.
  for (let i = 0; i < 500; i++) {
    const b = i % 2 ? crypto.randomBytes(i) : Buffer.from("MAP01\0doom2.wad\0".repeat(i % 40));
    assert.deepStrictEqual(huffman.decode(huffman.encode(b)), b);
  }
  const noise = crypto.randomBytes(200);
  assert.strictEqual(huffman.encode(noise)[0] <= 0xff, true);
  assert.ok(huffman.encode(Buffer.from("\0".repeat(64))).length < 64, "zeros compress");
  console.log("huffman ok");

  // Query packet layout.
  const q = new Z.Reader(huffman.decode(Z.serverQuery(1234)));
  assert.strictEqual(q.long(), Z.LAUNCHER_SERVER_CHALLENGE);
  assert.strictEqual(q.long(), Z.QUERY_FLAGS);
  assert.strictEqual(q.long(), 1234);
  assert.strictEqual(q.long(), Z.QUERY_FLAGS2);
  assert.strictEqual(q.byte(), 2);
  console.log("query packet ok");

  // Plain (unsegmented) reply parses every field, including team data and colour-code stripping.
  const ctf = mock.DEMO[3];
  const parsed = Z.parseServerPacket(mock.reply(ctf, Z.QUERY_FLAGS, Z.QUERY_FLAGS2, 77, false)[0]);
  assert.strictEqual(parsed.kind, "info");
  assert.strictEqual(parsed.time, 77);
  assert.strictEqual(parsed.info.name, "CTF Classic Flags");
  assert.strictEqual(parsed.info.modeShort, "CTF");
  assert.strictEqual(parsed.info.password, true);
  assert.deepStrictEqual(parsed.info.players.map(p => p.team), [1, 0]);
  assert.deepStrictEqual(parsed.info.teams.map(t => t.name), ["Blue", "Red"]);
  assert.strictEqual(parsed.info.country, "GBR");
  console.log("reply parse ok");

  // UDP: master list (two parts, block + single entries), then segmented server replies.
  const servers = [];
  for (const s of mock.DEMO) servers.push(await mock.startServer(s));
  const listed = servers.map(s => ({ host: "127.0.0.1", port: s.port }));
  const master = await mock.startMaster(listed);
  const m = await client.queryMaster({ host: "127.0.0.1", port: master.port, timeout: 2000 });
  assert.strictEqual(m.status, "ok");
  assert.deepStrictEqual(m.servers.map(s => s.port).sort(), listed.map(s => s.port).sort());
  console.log("master ok:", m.servers.length, "servers");

  const results = await client.queryServers([...m.servers, { host: "127.0.0.1", port: 9 }], { timeout: 1500 });
  const ok = results.filter(r => r.status === "ok");
  assert.strictEqual(ok.length, mock.DEMO.length);
  assert.strictEqual(results.find(r => r.port === 9).status, "timeout");
  const frag = ok.find(r => r.info.map === "MAP01" && r.info.players.length === 4);
  assert.strictEqual(frag.info.name, "[CF] ColeForge Frag Night DM");
  assert.deepStrictEqual(frag.info.pwads.map(p => p.name), ["zandronum-cf.pk3", "cfmaps.wad"]);
  assert.strictEqual(frag.info.bots, 1);
  assert.strictEqual(frag.info.limits.timeLeft, 9);
  assert.ok(frag.ping >= 0);
  console.log("server queries ok:", ok.map(r => `${r.info.name} (${r.info.numPlayers}/${r.info.maxClients})`).join(" | "));

  // LAN: the listener picks up a broadcast from the server's own port.
  const lan2 = client.lanListener({ port: 25101 });
  const beacon = mock.startBeacon(servers[0], mock.DEMO[0], 25101);
  await new Promise(r => setTimeout(r, 400));
  const seen = lan2.list();
  assert.strictEqual(seen.length, 1);
  assert.strictEqual(seen[0].port, servers[0].port);
  assert.strictEqual(seen[0].info.players.length, 4);
  console.log("LAN broadcast ok:", seen[0].address);
  beacon.close(); lan2.close(); master.close(); servers.forEach(s => s.close());

  assert.deepStrictEqual(client.parseAddress("10.0.0.5"), { host: "10.0.0.5", port: 10666 });
  assert.deepStrictEqual(client.parseAddress("doom.example.com:10700"), { host: "doom.example.com", port: 10700 });
  assert.strictEqual(client.parseAddress("bad host:1"), null);
  assert.strictEqual(client.parseAddress("1.2.3.4:70000"), null);
  console.log("all zandronum tests passed");
}

main().catch((e) => { console.error(e); process.exit(1); });
