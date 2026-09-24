"use strict";

// Zandronum launcher and master-server protocol: building queries and parsing replies.
// Written from Zandronum's own networking code (src/sv_master.cpp, src/browser.cpp,
// src/networkshared.h, src/sv_main.h, src/gamemode_enums.h); see NOTICE.md for the license.
// Pure functions over Buffers, so it can be unit-tested without a network.

const huffman = require("./huffman.js");

const PORTS = { SERVER: 10666, CLIENT: 10667, MASTER: 15300, BROADCAST: 15101 };
const MASTER_HOST = "master.zandronum.com";

const LAUNCHER_SERVER_CHALLENGE = 199;
const LAUNCHER_MASTER_CHALLENGE = 5660028;
const MASTER_SERVER_VERSION = 2;
const REPLY = { CHALLENGE: 5660023, IGNORING: 5660024, BANNED: 5660025, SEGMENTED: 5660032 };
const MSC = { BEGINSERVERLIST: 0, SERVER: 1, ENDSERVERLIST: 2, IPISBANNED: 3, REQUESTIGNORED: 4, WRONGVERSION: 5, BEGINSERVERLISTPART: 6, ENDSERVERLISTPART: 7, SERVERBLOCK: 8 };

const SQF = {
  NAME: 0x1, URL: 0x2, EMAIL: 0x4, MAPNAME: 0x8, MAXCLIENTS: 0x10, MAXPLAYERS: 0x20, PWADS: 0x40, GAMETYPE: 0x80,
  GAMENAME: 0x100, IWAD: 0x200, FORCEPASSWORD: 0x400, FORCEJOINPASSWORD: 0x800, GAMESKILL: 0x1000, BOTSKILL: 0x2000,
  DMFLAGS: 0x4000, LIMITS: 0x10000, TEAMDAMAGE: 0x20000, TEAMSCORES: 0x40000, NUMPLAYERS: 0x80000, PLAYERDATA: 0x100000,
  TEAMINFO_NUMBER: 0x200000, TEAMINFO_NAME: 0x400000, TEAMINFO_COLOR: 0x800000, TEAMINFO_SCORE: 0x1000000,
  TESTING_SERVER: 0x2000000, DATA_MD5SUM: 0x4000000, ALL_DMFLAGS: 0x8000000, SECURITY_SETTINGS: 0x10000000,
  OPTIONAL_WADS: 0x20000000, DEH: 0x40000000, EXTENDED_INFO: 0x80000000,
};
const SQF2 = { PWAD_HASHES: 0x1, COUNTRY: 0x2, GAMEMODE_NAME: 0x4, GAMEMODE_SHORTNAME: 0x8, VOICECHAT: 0x10 };

// What the Forge Game Browser asks every server for.
const QUERY_FLAGS = (SQF.NAME | SQF.URL | SQF.MAPNAME | SQF.MAXCLIENTS | SQF.MAXPLAYERS | SQF.PWADS | SQF.GAMETYPE | SQF.GAMENAME | SQF.IWAD |
  SQF.FORCEPASSWORD | SQF.FORCEJOINPASSWORD | SQF.GAMESKILL | SQF.BOTSKILL | SQF.LIMITS | SQF.NUMPLAYERS | SQF.PLAYERDATA |
  SQF.TEAMINFO_NUMBER | SQF.TEAMINFO_NAME | SQF.TEAMINFO_SCORE | SQF.TESTING_SERVER | SQF.OPTIONAL_WADS | SQF.DEH | SQF.EXTENDED_INFO) >>> 0;
const QUERY_FLAGS2 = SQF2.COUNTRY | SQF2.GAMEMODE_NAME | SQF2.GAMEMODE_SHORTNAME | SQF2.VOICECHAT;

// GAMEMODE_e, in order. Team modes also send a team byte per player.
const GAMEMODES = [
  ["cooperative", "Cooperative", "COOP"], ["survival", "Survival", "SURV"], ["invasion", "Invasion", "INV"],
  ["deathmatch", "Deathmatch", "DM"], ["teamplay", "Team Deathmatch", "TDM"], ["duel", "Duel", "DUEL"],
  ["terminator", "Terminator", "TERM"], ["lastmanstanding", "Last Man Standing", "LMS"], ["teamlms", "Team LMS", "TLMS"],
  ["possession", "Possession", "POSS"], ["teampossession", "Team Possession", "TPOSS"], ["teamgame", "Team Game", "TEAM"],
  ["ctf", "Capture the Flag", "CTF"], ["oneflagctf", "One Flag CTF", "1FCTF"], ["skulltag", "Skulltag", "ST"], ["domination", "Domination", "DOM"],
];
const TEAM_MODES = new Set([4, 8, 10, 11, 12, 13, 14, 15]);
const SKILLS = ["I'm too young to die", "Hey, not too rough", "Hurt me plenty", "Ultra-Violence", "Nightmare!"];

/* ---------------- byte streams (little-endian, like Doom's) ---------------- */
class Reader {
  constructor(buf) { this.buf = buf; this.pos = 0; }
  need(n) { if (this.pos + n > this.buf.length) throw new RangeError("packet ended early"); }
  byte() { this.need(1); return this.buf[this.pos++]; }
  short() { this.need(2); const v = this.buf.readInt16LE(this.pos); this.pos += 2; return v; }
  ushort() { this.need(2); const v = this.buf.readUInt16LE(this.pos); this.pos += 2; return v; }
  long() { this.need(4); const v = this.buf.readUInt32LE(this.pos); this.pos += 4; return v; }
  float() { this.need(4); const v = this.buf.readFloatLE(this.pos); this.pos += 4; return v; }
  bytes(n) { this.need(n); const v = this.buf.subarray(this.pos, this.pos + n); this.pos += n; return v; }
  string() {
    const end = this.buf.indexOf(0, this.pos);
    if (end < 0) throw new RangeError("unterminated string");
    const s = this.buf.toString("latin1", this.pos, end); this.pos = end + 1; return s;
  }
  get left() { return this.buf.length - this.pos; }
}

class Writer {
  constructor() { this.parts = []; }
  byte(v) { this.parts.push(Buffer.from([v & 255])); return this; }
  short(v) { const b = Buffer.alloc(2); b.writeInt16LE(v); this.parts.push(b); return this; }
  ushort(v) { const b = Buffer.alloc(2); b.writeUInt16LE(v); this.parts.push(b); return this; }
  long(v) { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0); this.parts.push(b); return this; }
  float(v) { const b = Buffer.alloc(4); b.writeFloatLE(v); this.parts.push(b); return this; }
  string(s) { this.parts.push(Buffer.from(String(s), "latin1"), Buffer.from([0])); return this; }
  raw(b) { this.parts.push(Buffer.from(b)); return this; }
  done() { return Buffer.concat(this.parts); }
}

// Doom text colour escapes: \c followed by a letter or [Name]. Strip them for display.
const stripColors = (s) => s.replace(/\x1c(\[[^\]]*\]|.)/g, "").replace(/[\x00-\x1f]/g, "");

/* ---------------- queries ---------------- */
function serverQuery(time = Date.now() >>> 0, flags = QUERY_FLAGS, flags2 = QUERY_FLAGS2) {
  const w = new Writer().long(LAUNCHER_SERVER_CHALLENGE).long(flags).long(time);
  if (flags & SQF.EXTENDED_INFO) w.long(flags2);
  w.byte(2); // ask for a segmented reply so big player lists fit
  return huffman.encode(w.done());
}

const masterQuery = () => huffman.encode(new Writer().long(LAUNCHER_MASTER_CHALLENGE).ushort(MASTER_SERVER_VERSION).done());

/* ---------------- server replies ---------------- */
// Returns { kind: "info", time, info } | { kind: "segment", ... } | { kind: "ignoring"|"banned", time }.
function parseServerPacket(packet) {
  const r = new Reader(huffman.decode(packet));
  const head = r.long();
  if (head === REPLY.CHALLENGE) return { kind: "info", ...parseInfoBody(r) };
  if (head === REPLY.SEGMENTED) {
    const index = r.byte(), count = r.byte(), offset = r.ushort(), size = r.ushort(), total = r.ushort();
    return { kind: "segment", index, count, offset, size, total, data: Buffer.from(r.bytes(Math.min(size, r.left))) };
  }
  if (head === REPLY.IGNORING) return { kind: "ignoring", time: r.long() };
  if (head === REPLY.BANNED) return { kind: "banned", time: r.long() };
  throw new Error("not a Zandronum launcher reply");
}

// Collects SERVER_LAUNCHER_CHALLENGE_SEGMENTED pieces; returns { time, info } once complete.
class Segments {
  constructor() { this.parts = new Map(); this.count = 0; this.total = 0; }
  add(seg) {
    this.count = seg.count; this.total = seg.total;
    this.parts.set(seg.index, seg);
    if (this.parts.size < this.count) return null;
    const body = Buffer.alloc(this.total);
    for (const p of this.parts.values()) p.data.copy(body, p.offset, 0, Math.min(p.data.length, this.total - p.offset));
    return parseInfoBody(new Reader(body));
  }
}

// The body shared by plain and segmented replies: time, version, flags, then each field in bit order.
function parseInfoBody(r) {
  const time = r.long(), version = r.string(), flags = r.long();
  const s = { version, flags, players: [], pwads: [], teams: [] };
  if (flags & SQF.NAME) s.name = stripColors(r.string());
  if (flags & SQF.URL) s.url = r.string();
  if (flags & SQF.EMAIL) s.email = r.string();
  if (flags & SQF.MAPNAME) s.map = r.string();
  if (flags & SQF.MAXCLIENTS) s.maxClients = r.byte();
  if (flags & SQF.MAXPLAYERS) s.maxPlayers = r.byte();
  if (flags & SQF.PWADS) for (let n = r.byte(); n > 0; n--) s.pwads.push({ name: r.string(), optional: false });
  if (flags & SQF.GAMETYPE) { s.gameMode = r.byte(); s.instagib = !!r.byte(); s.buckshot = !!r.byte(); }
  if (flags & SQF.GAMENAME) s.game = r.string();
  if (flags & SQF.IWAD) s.iwad = r.string();
  if (flags & SQF.FORCEPASSWORD) s.password = !!r.byte();
  if (flags & SQF.FORCEJOINPASSWORD) s.joinPassword = !!r.byte();
  if (flags & SQF.GAMESKILL) s.skill = r.byte();
  if (flags & SQF.BOTSKILL) s.botSkill = r.byte();
  if (flags & SQF.DMFLAGS) s.dmflags = [r.long(), r.long(), r.long()];
  if (flags & SQF.LIMITS) {
    s.limits = { frag: r.short(), time: r.short() };
    if (s.limits.time) s.limits.timeLeft = r.short();
    s.limits.duel = r.short(); s.limits.point = r.short(); s.limits.win = r.short();
  }
  if (flags & SQF.TEAMDAMAGE) s.teamDamage = r.float();
  if (flags & SQF.TEAMSCORES) s.teamScores = [r.short(), r.short()];
  if (flags & SQF.NUMPLAYERS) s.numPlayers = r.byte();
  if (flags & SQF.PLAYERDATA) {
    const teams = TEAM_MODES.has(s.gameMode);
    for (let i = 0; i < (s.numPlayers || 0); i++) {
      const p = { name: stripColors(r.string()), score: r.short(), ping: r.short(), spectator: !!r.byte(), bot: !!r.byte() };
      if (teams) { const t = r.byte(); p.team = t === 255 ? null : t; }
      p.minutes = r.byte();
      s.players.push(p);
    }
  }
  let numTeams = 2;
  if (flags & SQF.TEAMINFO_NUMBER) numTeams = Math.min(4, Math.max(2, r.byte()));
  if (flags & (SQF.TEAMINFO_NAME | SQF.TEAMINFO_COLOR | SQF.TEAMINFO_SCORE)) for (let i = 0; i < numTeams; i++) s.teams.push({});
  if (flags & SQF.TEAMINFO_NAME) s.teams.forEach(t => { t.name = stripColors(r.string()); });
  if (flags & SQF.TEAMINFO_COLOR) s.teams.forEach(t => { t.color = "#" + (r.long() & 0xffffff).toString(16).padStart(6, "0"); });
  if (flags & SQF.TEAMINFO_SCORE) s.teams.forEach(t => { t.score = r.short(); });
  if (flags & SQF.TESTING_SERVER) { s.testing = !!r.byte(); s.testingBinary = r.string(); }
  if (flags & SQF.DATA_MD5SUM) r.string();
  if (flags & SQF.ALL_DMFLAGS) { const all = []; for (let n = r.byte(); n > 0; n--) all.push(r.long()); s.allDmflags = all; }
  if (flags & SQF.SECURITY_SETTINGS) s.enforcesMasterBans = !!r.byte();
  if (flags & SQF.OPTIONAL_WADS) for (let n = r.byte(); n > 0; n--) { const i = r.byte(); if (s.pwads[i]) s.pwads[i].optional = true; }
  if (flags & SQF.DEH) { s.deh = []; for (let n = r.byte(); n > 0; n--) s.deh.push(r.string()); }
  if (flags & SQF.EXTENDED_INFO) {
    const flags2 = r.long();
    if (flags2 & SQF2.PWAD_HASHES) for (let i = 0, n = r.byte(); i < n; i++) { const h = r.string(); if (s.pwads[i]) s.pwads[i].md5 = h; }
    if (flags2 & SQF2.COUNTRY) s.country = r.bytes(3).toString("latin1");
    if (flags2 & SQF2.GAMEMODE_NAME) s.modeName = r.string();
    if (flags2 & SQF2.GAMEMODE_SHORTNAME) s.modeShort = r.string();
    if (flags2 & SQF2.VOICECHAT) s.voiceChat = r.byte();
  }
  const mode = GAMEMODES[s.gameMode];
  if (!s.modeName && mode) s.modeName = mode[1];
  if (!s.modeShort && mode) s.modeShort = mode[2];
  if (s.skill != null) s.skillName = SKILLS[s.skill] || `Skill ${s.skill + 1}`;
  if (s.numPlayers == null) s.numPlayers = s.players.length;
  s.humans = s.players.filter(p => !p.bot && !p.spectator).length;
  s.bots = s.players.filter(p => p.bot).length;
  s.spectators = s.players.filter(p => p.spectator).length;
  return { time, info: s };
}

/* ---------------- master server replies ---------------- */
// Returns { status: "ok", packet, last, servers: [{host, port}] } or { status: "banned"|"ignored"|"wrongversion" }.
function parseMasterPacket(packet) {
  const r = new Reader(huffman.decode(packet));
  const cmd = r.long();
  if (cmd === MSC.IPISBANNED) return { status: "banned" };
  if (cmd === MSC.REQUESTIGNORED) return { status: "ignored" };
  if (cmd === MSC.WRONGVERSION) return { status: "wrongversion" };
  if (cmd !== MSC.BEGINSERVERLISTPART) throw new Error("unexpected master server reply " + cmd);
  const packetNum = r.byte(), servers = [];
  const ip = () => { const b = r.bytes(4); return `${b[0]}.${b[1]}.${b[2]}.${b[3]}`; };
  for (;;) {
    const c = r.byte();
    if (c === MSC.SERVER) { const host = ip(); servers.push({ host, port: r.ushort() }); }
    else if (c === MSC.SERVERBLOCK) {
      for (let ports = r.byte(); ports; ports = r.byte()) { const host = ip(); for (let i = 0; i < ports; i++) servers.push({ host, port: r.ushort() }); }
    }
    else if (c === MSC.ENDSERVERLISTPART) return { status: "ok", packet: packetNum, last: false, servers };
    else if (c === MSC.ENDSERVERLIST) return { status: "ok", packet: packetNum, last: true, servers };
    else throw new Error("unknown master list command " + c);
  }
}

module.exports = {
  PORTS, MASTER_HOST, SQF, SQF2, REPLY, MSC, GAMEMODES, TEAM_MODES, QUERY_FLAGS, QUERY_FLAGS2,
  LAUNCHER_SERVER_CHALLENGE, LAUNCHER_MASTER_CHALLENGE, MASTER_SERVER_VERSION,
  Reader, Writer, Segments, stripColors, serverQuery, masterQuery, parseServerPacket, parseInfoBody, parseMasterPacket,
};
