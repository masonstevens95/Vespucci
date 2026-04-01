import { readFileSync, openSync, writeSync, closeSync } from "fs";
import { unzipSync } from "fflate";
import { TokenReader } from "./src/lib/binary/token-reader";
import { BinaryToken, isValueToken, valuePayloadSize } from "./src/lib/binary/tokens";
import { parseStringLookup } from "./src/lib/binary/string-lookup";
import { tokenName, tokenId } from "./src/lib/binary/token-names";
import { isFixed5, readFixed5 } from "./src/lib/binary/sections/fixed5";

const raw = readFileSync("SP_BOH_1612_11_24_2c8a4a72-6275-405f-b85d-211f83651cba (2).eu5");
const rawData = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
let pkOff = 0;
for (let i = 0; i < rawData.length - 1; i++) {
  if (rawData[i] === 0x50 && rawData[i + 1] === 0x4b) { pkOff = i; break; }
}
const zip = unzipSync(rawData.subarray(pkOff));
const data = zip["gamestate"];
const dynStrings = parseStringLookup(zip["string_lookup"] ?? new Uint8Array(0));
const r = new TokenReader(data, dynStrings);

const TARGET = tokenId("subunit_manager")!;

r.pos = 0;
let depth = 0;
let secStart = -1, secEnd = -1;
while (!r.done) {
  const ft = r.readToken();
  if (ft === BinaryToken.CLOSE) { depth--; continue; }
  else if (ft === BinaryToken.OPEN) { depth++; continue; }
  else if (ft === BinaryToken.EQUAL) { continue; }
  else if (isValueToken(ft)) { r.skipValuePayload(ft); continue; }
  if (depth === 0 && ft === TARGET && r.peekToken() === BinaryToken.EQUAL) {
    r.readToken(); r.readToken();
    secStart = r.pos;
    r.skipBlock();
    secEnd = r.pos;
    break;
  }
}

process.stderr.write("subunit_manager: " + ((secEnd - secStart) / 1024).toFixed(0) + " KB\n");

const r2 = new TokenReader(data, dynStrings);
r2.pos = secStart;

const buf: string[] = [];
let d = 1;
const flush = () => { if (buf.length) { writeSync(fd, buf.join("\n") + "\n"); buf.length = 0; } };
const w = (s: string) => { buf.push(s); if (buf.length >= 10000) flush(); };

const fd = openSync("melted/subunit_manager.txt", "w");
writeSync(fd, "subunit_manager =\n{\n");

const ENGINE: Record<number, string> = {
  0xdc: "key", 0xe1: "type", 0xdb: "id", 0x8f: "negate",
  0xd0: "scope_type", 0x6b: "index", 0x1b: "name",
  0x2f: "war_score", 0x33: "side", 0x73: "history",
};

const readVal = (): string => {
  const vt = r2.readToken();
  if (vt === BinaryToken.I32) return String(r2.readI32());
  if (vt === BinaryToken.U32) return String(r2.readU32());
  if (vt === BinaryToken.F32) return String(r2.readF32());
  if (vt === BinaryToken.BOOL) return r2.readBool() ? "yes" : "no";
  if (vt === BinaryToken.QUOTED) { const len = r2.view.getUint16(r2.pos, true); r2.pos += 2; const s = new TextDecoder().decode(data.subarray(r2.pos, r2.pos + len)); r2.pos += len; return '"' + s + '"'; }
  if (vt === BinaryToken.UNQUOTED) { const len = r2.view.getUint16(r2.pos, true); r2.pos += 2; const s = new TextDecoder().decode(data.subarray(r2.pos, r2.pos + len)); r2.pos += len; return s; }
  if (isFixed5(vt)) { const size = valuePayloadSize(vt, data, r2.pos); const val = readFixed5(data, r2.pos, vt); r2.pos += size; return String(val); }
  if (vt === BinaryToken.LOOKUP_U8) return '"' + r2.readLookupU8() + '"';
  if (vt === BinaryToken.LOOKUP_U16) return '"' + r2.readLookupU16() + '"';
  if (vt === BinaryToken.LOOKUP_U24) return '"' + r2.readLookupU24() + '"';
  return ENGINE[vt] ?? tokenName(vt) ?? "unknown_0x" + vt.toString(16);
};

const indent = () => "\t".repeat(Math.max(0, d));

while (r2.pos < secEnd && !r2.done && d > 0) {
  const ft = r2.readToken();
  if (ft === BinaryToken.CLOSE) { d--; w(("\t").repeat(Math.max(0, d)) + "}"); continue; }
  if (ft === BinaryToken.OPEN) { w(indent() + "{"); d++; continue; }
  if (ft === BinaryToken.EQUAL) continue;
  if (ft === BinaryToken.I32) { w(indent() + r2.readI32()); continue; }
  if (ft === BinaryToken.U32) { w(indent() + r2.readU32()); continue; }
  if (ft === BinaryToken.F32) { w(indent() + r2.readF32()); continue; }
  if (ft === BinaryToken.BOOL) { w(indent() + (r2.readBool() ? "yes" : "no")); continue; }
  if (ft === BinaryToken.QUOTED) { const len = r2.view.getUint16(r2.pos, true); r2.pos += 2; w(indent() + '"' + new TextDecoder().decode(data.subarray(r2.pos, r2.pos + len)) + '"'); r2.pos += len; continue; }
  if (ft === BinaryToken.UNQUOTED) { const len = r2.view.getUint16(r2.pos, true); r2.pos += 2; w(indent() + new TextDecoder().decode(data.subarray(r2.pos, r2.pos + len))); r2.pos += len; continue; }
  if (isFixed5(ft)) { const size = valuePayloadSize(ft, data, r2.pos); w(indent() + readFixed5(data, r2.pos, ft)); r2.pos += size; continue; }
  if (ft === BinaryToken.LOOKUP_U8) { w(indent() + '"' + r2.readLookupU8() + '"'); continue; }
  if (ft === BinaryToken.LOOKUP_U16) { w(indent() + '"' + r2.readLookupU16() + '"'); continue; }
  if (ft === BinaryToken.LOOKUP_U24) { w(indent() + '"' + r2.readLookupU24() + '"'); continue; }

  const name = ENGINE[ft] ?? tokenName(ft) ?? "unknown_0x" + ft.toString(16);
  if (!r2.done && r2.peekToken() === BinaryToken.EQUAL) {
    r2.readToken();
    if (!r2.done && r2.peekToken() === BinaryToken.OPEN) { w(indent() + name + " ="); }
    else { w(indent() + name + " = " + readVal()); }
  } else {
    w(indent() + name);
  }
}
w("}");
flush();
closeSync(fd);
process.stderr.write("Done → melted/subunit_manager.txt\n");
