/**
 * check-location-coverage.mjs
 *
 * Measures how well a save's location names line up with the canonical path
 * IDs in public/eu-v-locations.svg, using the SAME normalization the renderer
 * uses (lowercase). Run this first when a save renders a mostly-empty map.
 *
 * This lives in scripts/ rather than diagnostics/ on purpose: diagnostics/ is
 * gitignored, so anything placed there is invisible to clones and CI.
 *
 *   node scripts/check-location-coverage.mjs <save.eu5>
 *
 * Expected shape for a healthy save (measured on MP_SCO_1453, 2026-09-12):
 *   asset ids matched          22710 / 22711
 *   unmatched asset ids            1  (Kingman_Reef, uninhabited atoll)
 *   save names with no shape    ~5863  (lakes, sea zones, wastelands)
 */
import { readFileSync } from "fs";
import { unzipSync } from "fflate";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const tokenMap = require("../src/lib/eu5-tokens.json");
const nameToId = {};
for (const [k, v] of Object.entries(tokenMap)) nameToId[v] = parseInt(k);

const EQUAL = 0x0001, OPEN = 0x0003, CLOSE = 0x0004;
const U32 = 0x0014, I32 = 0x000c, F32 = 0x000d, BOOL = 0x000e;
const QUOTED = 0x000f, UNQUOTED = 0x0017;
const F64 = 0x0167, U64 = 0x029c, I64 = 0x0317;
const LOOKUP_U8 = 0x0d40, LOOKUP_U16 = 0x0d3e, LOOKUP_U24 = 0x0d41;

const isFixed5 = (t) => (t >= 0x0d48 && t <= 0x0d4e) || (t >= 0x0d4f && t <= 0x0d55);
const fixed5Sz = (t) => (t >= 0x0d4f ? t - 0x0d4f + 1 : t - 0x0d48 + 1);
const isLookup = (t) => t === LOOKUP_U8 || t === LOOKUP_U16 || t === LOOKUP_U24;

const tokSize = (view, pos) => {
  const t = view.getUint16(pos, true);
  if (t === CLOSE || t === OPEN || t === EQUAL) return 2;
  if (t === U32 || t === I32 || t === F32) return 6;
  if (t === BOOL) return 3;
  if (t === F64 || t === U64 || t === I64) return 10;
  if (t === QUOTED || t === UNQUOTED) return 4 + view.getUint16(pos + 2, true);
  if (isLookup(t)) return 2 + (t === LOOKUP_U8 ? 1 : t === LOOKUP_U16 ? 2 : 3);
  if (isFixed5(t)) return 2 + fixed5Sz(t);
  return 2;
};

const skipBlock = (view, data, pos) => {
  let d = 1;
  while (pos < data.length - 1 && d > 0) {
    const t = view.getUint16(pos, true);
    if (t === CLOSE) { d--; pos += 2; }
    else if (t === OPEN) { d++; pos += 2; }
    else pos += tokSize(view, pos);
  }
  return pos;
};

const readString = (view, data, pos, dyn) => {
  const t = view.getUint16(pos, true);
  if (t === LOOKUP_U8) return { s: dyn[data[pos + 2]] ?? "", sz: 3 };
  if (t === LOOKUP_U16) return { s: dyn[view.getUint16(pos + 2, true)] ?? "", sz: 4 };
  if (t === LOOKUP_U24)
    return { s: dyn[view.getUint16(pos + 2, true) | (data[pos + 4] << 16)] ?? "", sz: 5 };
  if (t === QUOTED || t === UNQUOTED) {
    const l = view.getUint16(pos + 2, true);
    return { s: new TextDecoder().decode(data.subarray(pos + 4, pos + 4 + l)), sz: 4 + l };
  }
  return null;
};

const findSection = (data, view, tokId) => {
  const lo = tokId & 0xff, hi = (tokId >> 8) & 0xff;
  let best = -1, bestSz = 0;
  for (let i = 0; i <= data.length - 6; i++) {
    if (data[i] === lo && data[i + 1] === hi && data[i + 2] === 0x01 &&
        data[i + 3] === 0x00 && data[i + 4] === 0x03 && data[i + 5] === 0x00) {
      const sz = skipBlock(view, data, i + 6) - (i + 6);
      if (sz > bestSz) { bestSz = sz; best = i; }
    }
  }
  return best;
};

/** Read metadata > compatibility > locations as an ordered name list. */
const readSaveLocationNames = (data, view, dyn) => {
  const metaOff = findSection(data, view, nameToId["metadata"]);
  if (metaOff < 0) return [];

  const COMPAT = nameToId["compatibility"], LOCS = nameToId["locations"];
  const names = [];

  let pos = metaOff + 6, depth = 1, compatPos = -1;
  while (pos < data.length - 1 && depth > 0) {
    const t = view.getUint16(pos, true);
    if (t === CLOSE) { depth--; pos += 2; continue; }
    if (t === OPEN) { depth++; pos += 2; continue; }
    if (t === EQUAL) { pos += 2; continue; }
    if (t === COMPAT) { compatPos = pos; break; }
    pos += tokSize(view, pos);
    if (view.getUint16(pos, true) === EQUAL) {
      pos += 2;
      if (view.getUint16(pos, true) === OPEN) pos = skipBlock(view, data, pos + 2);
      else pos += tokSize(view, pos);
    }
  }
  if (compatPos < 0) return names;

  let p = compatPos + 2;
  if (view.getUint16(p, true) === EQUAL) p += 2;
  if (view.getUint16(p, true) === OPEN) p += 2;
  let d = 1;
  while (p < data.length - 1 && d > 0) {
    const t = view.getUint16(p, true);
    if (t === CLOSE) { d--; p += 2; continue; }
    if (t === OPEN) { d++; p += 2; continue; }
    if (t === EQUAL) { p += 2; continue; }
    if (t === LOCS) {
      let q = p + 2;
      if (view.getUint16(q, true) === EQUAL) q += 2;
      if (view.getUint16(q, true) === OPEN) q += 2;
      while (q < data.length - 1 && view.getUint16(q, true) !== CLOSE) {
        const r = readString(view, data, q, dyn);
        if (r !== null) { names.push(r.s); q += r.sz; }
        else q += tokSize(view, q);
      }
      break;
    }
    p += tokSize(view, p);
    if (view.getUint16(p, true) === EQUAL) {
      p += 2;
      if (view.getUint16(p, true) === OPEN) p = skipBlock(view, data, p + 2);
      else p += tokSize(view, p);
    }
  }
  return names;
};

// ---------------------------------------------------------------------------

const savePath = process.argv[2];
if (savePath === undefined) {
  console.error("usage: node scripts/check-location-coverage.mjs <save.eu5>");
  process.exit(1);
}

const raw = readFileSync(savePath);
const bytes = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
let pkOff = -1;
for (let i = 0; i < bytes.length - 1; i++) {
  if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b) { pkOff = i; break; }
}
if (pkOff < 0) {
  console.error(`[check-location-coverage] no ZIP header in ${savePath} — not a binary save?`);
  process.exit(1);
}

const files = unzipSync(bytes.subarray(pkOff));
const gsKey = Object.keys(files).find((k) => k === "gamestate" || k.endsWith("/gamestate"));
const slKey = Object.keys(files).find((k) => k === "string_lookup" || k.endsWith("/string_lookup"));
const data = files[gsKey];
const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
const slData = files[slKey];
const slView = new DataView(slData.buffer, slData.byteOffset, slData.byteLength);

const dec = new TextDecoder("utf-8");
const dyn = [];
let slPos = 5;
while (slPos + 2 <= slData.length) {
  const len = slView.getUint16(slPos, true);
  slPos += 2;
  if (len === 0 || len > 50000 || slPos + len > slData.length) break;
  dyn.push(dec.decode(slData.subarray(slPos, slPos + len)));
  slPos += len;
}

const saveNames = readSaveLocationNames(data, view, dyn);
const assetIds = JSON.parse(readFileSync("src/lib/location-ids.json", "utf8"));

const saveLower = new Set(saveNames.map((s) => s.toLowerCase()));
const assetLower = new Set(assetIds.map((s) => s.toLowerCase()));

const matched = assetIds.filter((id) => saveLower.has(id.toLowerCase()));
const orphanIds = assetIds.filter((id) => !saveLower.has(id.toLowerCase()));
const shapeless = [...saveLower].filter((n) => !assetLower.has(n));

const pct = ((matched.length / assetIds.length) * 100).toFixed(2);

console.log(`[check-location-coverage] ${savePath}`);
console.log(`  save location names        ${saveNames.length} (${saveLower.size} unique)`);
console.log(`  asset path ids             ${assetIds.length}`);
console.log(`  asset ids matched          ${matched.length} (${pct}%)`);
console.log(`  unmatched asset ids        ${orphanIds.length}`);
if (orphanIds.length > 0) console.log(`    ${orphanIds.slice(0, 25).join(", ")}`);
console.log(`  save names with no shape   ${shapeless.length} (expected: lakes/seas/wastelands)`);
console.log(`    ${shapeless.slice(0, 8).join(", ")}...`);

if (matched.length < assetIds.length * 0.95) {
  console.error(
    `\n  FAIL: only ${pct}% of asset ids matched. Name alignment is broken — ` +
      `the map will render mostly empty.`,
  );
  process.exit(1);
} else {
  console.log(`\n  OK: name alignment healthy.`);
}
