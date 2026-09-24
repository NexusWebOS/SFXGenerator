"use strict";

// Mock Zandronum server + master server for tests and offline demos. Replies are assembled the
// way Zandronum's SERVER_MASTER_SendServerInfo does it (fields in flag-bit order, optional
// segmenting), so they exercise the same parser real servers do.
//
//   node coleforge/server/zandronum/test/mock-zandronum.js        # 4 servers + master + LAN beacon

const dgram = require("dgram");
const huffman = require("../huffman.js");
const Z = require("../protocol.js");

function infoBody(s, flags, flags2, time) {
  const w = new Z.Writer().long(time).string(s.version || "3.2.1-r230709-1914 on Windows");
  let bits = flags & Z.QUERY_FLAGS | flags & (Z.SQF.EMAIL | Z.SQF.DMFLAGS | Z.SQF.TEAMDAMAGE | Z.SQF.ALL_DMFLAGS | Z.SQF.SECURITY_SETTINGS | Z.SQF.DATA_MD5SUM);
  const teams = Z.TEAM_MODES.has(s.gameMode);
  if (!teams) bits &= ~(Z.SQF.TEAMSCORES | Z.SQF.TEAMINFO_NUMBER | Z.SQF.TEAMINFO_NAME | Z.SQF.TEAMINFO_COLOR | Z.SQF.TEAMINFO_SCORE);
  if (bits & Z.SQF.PLAYERDATA) bits |= Z.SQF.NUMPLAYERS;
  if (!(s.optional || []).length) bits &= ~Z.SQF.OPTIONAL_WADS;
  if (!(s.deh || []).length) bits &= ~Z.SQF.DEH;
  const bits2 = bits & Z.SQF.EXTENDED_INFO ? flags2 & (Z.SQF2.COUNTRY | Z.SQF2.GAMEMODE_NAME | Z.SQF2.GAMEMODE_SHORTNAME | Z.SQF2.PWAD_HASHES | Z.SQF2.VOICECHAT) : 0;
  if (!bits2) bits &= ~Z.SQF.EXTENDED_INFO;
  w.long(bits >>> 0);
  const F = Z.SQF, mode = Z.GAMEMODES[s.gameMode];
  if (bits & F.NAME) w.string(s.name);
  if (bits & F.URL) w.string(s.url || "");
  if (bits & F.EMAIL) w.string("");
  if (bits & F.MAPNAME) w.string(s.map);
  if (bits & F.MAXCLIENTS) w.byte(s.maxClients);
  if (bits & F.MAXPLAYERS) w.byte(s.maxPlayers);
  if (bits & F.PWADS) { w.byte(s.pwads.length); s.pwads.forEach(p => w.string(p)); }
  if (bits & F.GAMETYPE) w.byte(s.gameMode).byte(s.instagib ? 1 : 0).byte(0);
  if (bits & F.GAMENAME) w.string("DOOM II");
  if (bits & F.IWAD) w.string(s.iwad);
  if (bits & F.FORCEPASSWORD) w.byte(s.password ? 1 : 0);
  if (bits & F.FORCEJOINPASSWORD) w.byte(0);
  if (bits & F.GAMESKILL) w.byte(s.skill ?? 3);
  if (bits & F.BOTSKILL) w.byte(2);
  if (bits & F.DMFLAGS) w.long(0).long(0).long(0);
  if (bits & F.LIMITS) { w.short(s.fraglimit || 0).short(s.timelimit || 0); if (s.timelimit) w.short(s.timeleft || 0); w.short(0).short(0).short(0); }
  if (bits & F.TEAMDAMAGE) w.float(0);
  if (bits & F.TEAMSCORES) w.short(0).short(0);
  if (bits & F.NUMPLAYERS) w.byte(s.players.length);
  if (bits & F.PLAYERDATA) for (const p of s.players) {
    w.string(p.name).short(p.score).short(p.ping).byte(p.spectator ? 1 : 0).byte(p.bot ? 1 : 0);
    if (teams) w.byte(p.team ?? 255);
    w.byte(p.minutes || 0);
  }
  const teamList = [["Blue", 0x0000ff, 12], ["Red", 0xff0000, 9]];
  if (bits & F.TEAMINFO_NUMBER) w.byte(2);
  if (bits & F.TEAMINFO_NAME) teamList.forEach(t => w.string(t[0]));
  if (bits & F.TEAMINFO_COLOR) teamList.forEach(t => w.long(t[1]));
  if (bits & F.TEAMINFO_SCORE) teamList.forEach(t => w.short(t[2]));
  if (bits & F.TESTING_SERVER) w.byte(0).string("");
  if (bits & F.DATA_MD5SUM) w.string("");
  if (bits & F.ALL_DMFLAGS) { w.byte(6); for (let i = 0; i < 6; i++) w.long(0); }
  if (bits & F.SECURITY_SETTINGS) w.byte(1);
  if (bits & F.OPTIONAL_WADS) { w.byte(s.optional.length); s.optional.forEach(i => w.byte(i)); }
  if (bits & F.DEH) { w.byte(s.deh.length); s.deh.forEach(d => w.string(d)); }
  if (bits & F.EXTENDED_INFO) {
    w.long(bits2);
    if (bits2 & Z.SQF2.PWAD_HASHES) { w.byte(s.pwads.length); s.pwads.forEach(() => w.string("d41d8cd98f00b204e9800998ecf8427e")); }
    if (bits2 & Z.SQF2.COUNTRY) w.raw(Buffer.from(s.country || "USA", "latin1"));
    if (bits2 & Z.SQF2.GAMEMODE_NAME) w.string(mode[1]);
    if (bits2 & Z.SQF2.GAMEMODE_SHORTNAME) w.string(mode[2]);
    if (bits2 & Z.SQF2.VOICECHAT) w.byte(0);
  }
  return w.done();
}

function reply(s, flags, flags2, time, segmented, segmentSize = 96) {
  const body = infoBody(s, flags, flags2, time);
  if (!segmented) return [huffman.encode(Buffer.concat([new Z.Writer().long(Z.REPLY.CHALLENGE).done(), body]))];
  const count = Math.ceil(body.length / segmentSize), out = [];
  for (let i = 0, off = 0; off < body.length; i++, off += segmentSize) {
    const part = body.subarray(off, off + segmentSize);
    out.push(huffman.encode(new Z.Writer().long(Z.REPLY.SEGMENTED).byte(i).byte(count).ushort(off).ushort(part.length).ushort(body.length).raw(part).done()));
  }
  return out;
}

/** Start a mock game server on `port`; resolves to { port, close }. */
function startServer(s, port = 0) {
  return new Promise((ok) => {
    const sock = dgram.createSocket("udp4");
    sock.on("message", (msg, rinfo) => {
      const r = new Z.Reader(huffman.decode(msg));
      if (r.left < 4 || r.long() !== Z.LAUNCHER_SERVER_CHALLENGE) return;
      const flags = r.long(), time = r.long(), flags2 = flags & Z.SQF.EXTENDED_INFO ? r.long() : 0;
      const segmented = r.left > 0 && r.byte() === 2;
      // Send segments in reverse to prove the reassembly doesn't depend on arrival order.
      for (const p of reply(s, flags, flags2, time, segmented).reverse()) sock.send(p, rinfo.port, rinfo.address);
    });
    sock.bind(port, "127.0.0.1", () => ok({ port: sock.address().port, sock, close: () => sock.close() }));
  });
}

/** Start a mock master server that lists `servers` ({host, port}) across two packets. */
function startMaster(servers, port = 0) {
  return new Promise((ok) => {
    const sock = dgram.createSocket("udp4");
    sock.on("message", (msg, rinfo) => {
      const r = new Z.Reader(huffman.decode(msg));
      if (r.long() !== Z.LAUNCHER_MASTER_CHALLENGE) return;
      if (r.ushort() !== Z.MASTER_SERVER_VERSION) return sock.send(huffman.encode(new Z.Writer().long(Z.MSC.WRONGVERSION).done()), rinfo.port, rinfo.address);
      const half = Math.ceil(servers.length / 2), parts = [servers.slice(0, half), servers.slice(half)];
      parts.forEach((list, i) => {
        const w = new Z.Writer().long(Z.MSC.BEGINSERVERLISTPART).byte(i);
        // First part as a SERVERBLOCK (ports grouped per IP), second as single MSC_SERVER entries.
        if (i === 0) {
          const byIp = new Map();
          list.forEach(s => byIp.set(s.host, [...(byIp.get(s.host) || []), s.port]));
          w.byte(Z.MSC.SERVERBLOCK);
          for (const [ip, ports] of byIp) { w.byte(ports.length); ip.split(".").forEach(o => w.byte(+o)); ports.forEach(p => w.ushort(p)); }
          w.byte(0);
        } else list.forEach(s => { w.byte(Z.MSC.SERVER); s.host.split(".").forEach(o => w.byte(+o)); w.ushort(s.port); });
        w.byte(i === parts.length - 1 ? Z.MSC.ENDSERVERLIST : Z.MSC.ENDSERVERLISTPART);
        sock.send(huffman.encode(w.done()), rinfo.port, rinfo.address);
      });
    });
    sock.bind(port, "127.0.0.1", () => ok({ port: sock.address().port, close: () => sock.close() }));
  });
}

/** Broadcast a server's info like sv_broadcast does (to 127.0.0.1 here, from the server's own socket). */
function startBeacon(server, s, target = Z.PORTS.BROADCAST, host = "127.0.0.1") {
  const send = () => { for (const p of reply(s, Z.QUERY_FLAGS | Z.SQF.ALL_DMFLAGS, 0x1f, 0, false)) server.sock.send(p, target, host); };
  send();
  const t = setInterval(send, 1000);
  return { close: () => clearInterval(t) };
}

const DEMO = [
  { name: "\x1cG[CF] ColeForge Frag Night \x1c-DM", map: "MAP01", iwad: "doom2.wad", pwads: ["zandronum-cf.pk3", "cfmaps.wad"], gameMode: 3, maxClients: 16, maxPlayers: 16, fraglimit: 30, timelimit: 15, timeleft: 9, country: "USA", url: "http://coleforge.local/wads",
    players: [{ name: "\x1cDSgtDoomguy", score: 17, ping: 31, minutes: 12 }, { name: "QuakeLord", score: 11, ping: 58, minutes: 9 }, { name: "NovaByte", score: 8, ping: 44, minutes: 7 }, { name: "Crash", score: 5, ping: 0, bot: true }] },
  { name: "Duel Arena 24/7", map: "MAP07", iwad: "doom2.wad", pwads: [], gameMode: 5, maxClients: 8, maxPlayers: 2, fraglimit: 20, country: "DEU",
    players: [{ name: "Rampage", score: 9, ping: 92, minutes: 4 }, { name: "Blitz", score: 7, ping: 101, minutes: 4 }, { name: "Watcher", score: 0, ping: 120, spectator: true }] },
  { name: "Freedoom Co-op Marathon", map: "MAP13", iwad: "freedoom2.wad", pwads: [], gameMode: 0, maxClients: 12, maxPlayers: 12, skill: 2, country: "CAN",
    players: [{ name: "PixelPam", score: 212, ping: 64, minutes: 41 }] },
  { name: "\x1cICTF\x1c- Classic Flags", map: "CTF05", iwad: "doom2.wad", pwads: ["ctfmaps.wad"], gameMode: 12, maxClients: 16, maxPlayers: 16, password: true, country: "GBR",
    players: [{ name: "RedLeader", score: 3, ping: 80, team: 1 }, { name: "BlueFalcon", score: 5, ping: 77, team: 0 }] },
  { name: "Empty Test Server", map: "MAP01", iwad: "doom2.wad", pwads: [], gameMode: 3, maxClients: 8, maxPlayers: 8, country: "XUN", players: [] },
];

module.exports = { infoBody, reply, startServer, startMaster, startBeacon, DEMO };

if (require.main === module) (async () => {
  const servers = [];
  for (const s of DEMO) servers.push(await startServer(s, 10666 + servers.length));
  const master = await startMaster(servers.slice(1).map(s => ({ host: "127.0.0.1", port: s.port })), 15300);
  startBeacon(servers[0], DEMO[0]);
  console.log(`Mock Zandronum: ${servers.length} servers on 127.0.0.1:${servers.map(s => s.port).join(",")}; master on 127.0.0.1:${master.port}; LAN beacon from :${servers[0].port}`);
  console.log("Point the LAN server at the mock master with: ZANDRONUM_MASTER=127.0.0.1:15300");
})();
