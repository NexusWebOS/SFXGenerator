"use strict";

// Huffman codec for Zandronum's network packets (launcher, master server and LAN broadcasts).
// A JavaScript port of Zandronum's src/huffman/ (huffman.cpp, huffcodec.cpp, bitwriter.cpp):
//   Copyright 2009 Timothy Landers <code.vortexcortex@gmail.com>, MIT License (see NOTICE.md).
// Same fixed tree, same "reversed bytes" and "no expansion" compatibility settings.

// Tree description: for each branch, a byte whose bit 0/1 says the left/right child is a leaf;
// leaves are followed by their byte value, branches are read depth-first (left subtree first).
const TREE = Uint8Array.from([
  0, 0, 0, 1, 128, 0, 0, 0, 3, 38, 34, 2, 1, 80, 3, 110, 144, 67, 0, 2, 1, 74, 3, 243,
  142, 37, 2, 3, 124, 58, 182, 0, 0, 1, 36, 0, 3, 221, 131, 3, 245, 163, 1, 35, 3, 113, 85, 0,
  1, 41, 1, 77, 3, 199, 130, 0, 1, 206, 3, 185, 153, 3, 70, 118, 0, 3, 3, 5, 0, 0, 1, 24,
  0, 2, 3, 198, 190, 63, 2, 3, 139, 186, 75, 0, 1, 44, 2, 3, 240, 218, 56, 3, 40, 39, 0, 0,
  2, 2, 3, 244, 247, 81, 65, 0, 3, 9, 125, 3, 68, 60, 0, 0, 1, 25, 3, 191, 138, 3, 86, 17,
  0, 1, 23, 3, 220, 178, 2, 3, 165, 194, 14, 1, 0, 2, 2, 0, 0, 2, 1, 208, 3, 150, 157, 181,
  1, 222, 2, 3, 216, 230, 211, 0, 2, 2, 3, 252, 141, 10, 42, 0, 2, 3, 134, 135, 104, 1, 103, 3,
  187, 225, 95, 32, 0, 0, 0, 0, 0, 0, 1, 57, 1, 61, 3, 183, 237, 0, 0, 3, 233, 234, 3, 246,
  203, 2, 3, 250, 147, 79, 1, 129, 0, 1, 7, 3, 143, 136, 1, 20, 3, 179, 148, 0, 0, 0, 3, 28,
  106, 3, 101, 87, 1, 66, 0, 3, 180, 219, 3, 227, 241, 0, 1, 26, 1, 251, 3, 229, 214, 3, 54, 69,
  0, 0, 0, 0, 0, 3, 231, 212, 3, 156, 176, 3, 93, 83, 0, 3, 96, 253, 3, 30, 13, 0, 0, 2,
  3, 175, 254, 94, 3, 159, 27, 2, 1, 8, 3, 204, 226, 78, 0, 0, 0, 3, 107, 88, 1, 31, 3, 137,
  169, 2, 2, 3, 215, 145, 6, 4, 1, 127, 0, 1, 99, 3, 209, 217, 0, 3, 213, 238, 3, 177, 170, 1,
  132, 0, 0, 0, 2, 3, 22, 12, 114, 2, 2, 3, 158, 197, 97, 45, 0, 1, 46, 1, 112, 3, 174, 249,
  0, 3, 224, 102, 2, 3, 171, 151, 193, 0, 0, 0, 3, 15, 16, 3, 2, 168, 1, 49, 3, 91, 146, 0,
  1, 48, 3, 173, 29, 0, 3, 19, 126, 3, 92, 242, 0, 0, 0, 0, 0, 0, 3, 205, 192, 2, 3, 235,
  149, 255, 2, 3, 223, 184, 248, 0, 0, 3, 108, 236, 3, 111, 90, 2, 3, 117, 115, 71, 0, 0, 3, 11,
  50, 0, 3, 188, 119, 1, 122, 3, 167, 162, 1, 160, 1, 133, 3, 123, 21, 0, 0, 2, 1, 59, 2, 3,
  155, 154, 98, 43, 0, 3, 76, 51, 2, 3, 201, 116, 72, 2, 0, 2, 3, 109, 100, 121, 2, 3, 195, 232,
  18, 1, 0, 2, 0, 1, 164, 2, 3, 120, 189, 73, 0, 1, 196, 3, 239, 210, 3, 64, 62, 89, 0, 0,
  1, 33, 2, 3, 228, 161, 55, 2, 3, 84, 152, 47, 0, 0, 2, 3, 207, 172, 140, 3, 82, 166, 0, 3,
  53, 105, 1, 52, 3, 202, 200,]);

// Bit-reversal lookup: the old Skulltag codec wrote each byte's bits backwards.
const REVERSE = new Uint8Array(256);
for (let i = 0; i < 256; i++) { let r = 0; for (let b = 0; b < 8; b++) if (i & (1 << b)) r |= 0x80 >> b; REVERSE[i] = r; }

// Branch nodes are [left, right] arrays; leaves are plain byte values.
const CODES = new Array(256); // byte -> array of bits (0/1), root first
const ROOT = (() => {
  let index = 0;
  const build = (path) => {
    if (index >= TREE.length) throw new Error("huffman: tree data truncated");
    const desc = TREE[index++], node = [null, null];
    for (let i = 0; i < 2; i++) {
      const bits = path.concat(i);
      if (desc & (1 << i)) { const v = TREE[index++]; node[i] = v; CODES[v] = bits; }
      else node[i] = build(bits);
    }
    return node;
  };
  const root = build([]);
  for (let v = 0; v < 256; v++) if (!CODES[v]) throw new Error("huffman: tree has no code for byte " + v);
  return root;
})();

/** Huffman-encode a packet. Falls back to 0xFF + raw bytes when coding wouldn't shrink it. */
function encode(input) {
  const bits = [];
  for (const byte of input) { const code = CODES[byte]; for (let i = 0; i < code.length; i++) bits.push(code[i]); }
  const body = Math.ceil(bits.length / 8);
  if (body + 1 > input.length + 1) return Buffer.concat([Buffer.from([0xff]), Buffer.from(input)]);
  const out = Buffer.alloc(body + 1);
  out[0] = (8 - (bits.length & 7)) & 7; // padding bits in the last byte
  for (let i = 0; i < bits.length; i++) if (bits[i]) out[1 + (i >> 3)] |= 0x80 >> (i & 7);
  for (let i = 1; i < out.length; i++) out[i] = REVERSE[out[i]];
  return out;
}

/** Decode a Huffman-encoded packet (or an 0xFF-prefixed raw one). */
function decode(input) {
  if (!input.length) return Buffer.alloc(0);
  if (input[0] === 0xff) return Buffer.from(input.subarray(1));
  const out = [];
  let available = ((input.length - 1) << 3) - input[0], node = ROOT;
  for (let i = 1; i < input.length && available > 0; i++) {
    const byte = REVERSE[input[i]];
    for (let b = 7; b >= 0 && available > 0; b--, available--) {
      node = node[(byte >> b) & 1];
      if (typeof node === "number") { out.push(node); node = ROOT; }
    }
  }
  return Buffer.from(out);
}

module.exports = { encode, decode };
