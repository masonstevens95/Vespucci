/**
 * Building manager section parser.
 *
 * Reads building_manager.database — a flat numeric-indexed dictionary of all
 * buildings in the game.  Each entry carries a type string, level, monthly
 * profit, upkeep, and owner (country ID).
 *
 * Output is aggregated per-country: Record<tag, BuildingSummary[]> where each
 * BuildingSummary groups all buildings of the same type for that country.
 * totalOutput is computed as (profit + upkeep) / local_market_price when
 * both a building→good mapping and a market price are available.
 */

import { TokenReader } from "../token-reader";
import { BinaryToken, isValueToken, valuePayloadSize } from "../tokens";
import { tokenId } from "../token-names";
import { isFixed5, readFixed5 } from "./fixed5";
import type { BuildingSummary, CountryBuildings } from "../../types";

// ---------------------------------------------------------------------------
// Token IDs
// ---------------------------------------------------------------------------

const BUILDING_MANAGER_TOK = tokenId("building_manager") ?? -1;
const DATABASE_TOK          = tokenId("database")         ?? -1;
const BUILDING_TYPE_TOK     = 0x00e1; // unnamed token — value is building type string
const LEVEL_TOK             = tokenId("level")                   ?? -1;
const EMPLOYED_TOK          = tokenId("employed")                ?? -1;
const UPKEEP_TOK            = tokenId("upkeep")                  ?? -1;
const LOCATION_TOK          = tokenId("location")                ?? -1;
const OWNER_TOK             = tokenId("owner")                   ?? -1;
const PROFIT_TOK            = tokenId("last_months_profit")      ?? -1;
const EMP_REQ_TOK           = tokenId("employment_requirement")  ?? -1;
const EMP_REQ_STATUS_TOK    = tokenId("employment_requirement_status") ?? -1;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// (BuildingSummary and CountryBuildings are defined in ../../types)

// ---------------------------------------------------------------------------
// Section finder helpers
// ---------------------------------------------------------------------------

/** Find the building_manager section offset inside the main binary data. */
const findBuildingManagerOffset = (
  data: Uint8Array,
  view: DataView,
): number => {
  const lo = BUILDING_MANAGER_TOK & 0xff;
  const hi = (BUILDING_MANAGER_TOK >> 8) & 0xff;
  let best = -1;
  let bestSz = 0;
  for (let i = 0; i <= data.length - 6; i++) {
    if (
      data[i] === lo && data[i + 1] === hi &&
      data[i + 2] === 0x01 && data[i + 3] === 0x00 &&
      data[i + 4] === 0x03 && data[i + 5] === 0x00
    ) {
      const end = skipBlockAt(data, view, i + 6);
      const sz = end - (i + 6);
      if (sz > bestSz) { bestSz = sz; best = i; }
    }
  }
  return best;
};

/** Skip a { ... } block starting at pos (which should be just after the OPEN token). */
const skipBlockAt = (data: Uint8Array, view: DataView, pos: number): number => {
  let depth = 1;
  let p = pos;
  while (p < data.length - 1 && depth > 0) {
    const t = view.getUint16(p, true);
    if (t === BinaryToken.CLOSE) { depth--; p += 2; }
    else if (t === BinaryToken.OPEN) { depth++; p += 2; }
    else { p += rawTokSize(view, p); }
  }
  return p;
};

const rawTokSize = (view: DataView, pos: number): number => {
  const t = view.getUint16(pos, true);
  if (t === BinaryToken.CLOSE || t === BinaryToken.OPEN || t === BinaryToken.EQUAL) { return 2; }
  if (t === BinaryToken.U32 || t === BinaryToken.I32 || t === BinaryToken.F32) { return 6; }
  if (t === BinaryToken.BOOL) { return 3; }
  if (t === BinaryToken.F64 || t === BinaryToken.U64 || t === BinaryToken.I64) { return 10; }
  if (t === BinaryToken.QUOTED || t === BinaryToken.UNQUOTED) { return 4 + view.getUint16(pos + 2, true); }
  const LOOKUP_U8 = 0x0d40, LOOKUP_U16 = 0x0d3e, LOOKUP_U24 = 0x0d41;
  if (t === LOOKUP_U8) { return 3; }
  if (t === LOOKUP_U16) { return 4; }
  if (t === LOOKUP_U24) { return 5; }
  if (isFixed5(t)) {
    const sz = t >= 0x0d48 && t <= 0x0d4e ? t - 0x0d48 + 1 : t - 0x0d4f + 1;
    return 2 + sz;
  }
  return 2;
};

// ---------------------------------------------------------------------------
// Building entry reader
// ---------------------------------------------------------------------------

interface RawBuilding {
  type: string;
  level: number;
  upkeep: number;
  profit: number;
  ownerId: number;
  locationId: number;
}

const emptyBuilding = (): RawBuilding => ({ type: "", level: 0, upkeep: 0, profit: 0, ownerId: -1, locationId: -1 });

/** Read one building entry.  Cursor must be just after the opening { . */
const readBuildingEntry = (r: TokenReader, data: Uint8Array): RawBuilding => {
  const b = emptyBuilding();

  while (!r.done) {
    const tok = r.peekToken();

    if (tok === BinaryToken.CLOSE) { r.readToken(); break; }

    if (tok === BinaryToken.OPEN) {
      r.readToken();
      r.skipBlock();
    } else if (tok === BinaryToken.EQUAL) {
      r.readToken();
    } else if (isValueToken(tok)) {
      // Bare value (maintenance type string) — read it, then skip the following = { block }
      r.readToken();
      r.skipValuePayload(tok);
      if (r.peekToken() === BinaryToken.EQUAL) {
        r.readToken(); // =
        if (r.peekToken() === BinaryToken.OPEN) {
          r.readToken(); // {
          r.skipBlock();
        } else {
          r.skipValue();
        }
      } else { /* bare value with no following block */ }
    } else {
      // Field name token
      r.readToken();
      if (tok === BUILDING_TYPE_TOK) {
        r.expectEqual();
        b.type = r.readStringValue() ?? "";
      } else if (tok === LEVEL_TOK) {
        r.expectEqual();
        const vt = r.readToken();
        if (isFixed5(vt)) {
          b.level = readFixed5(data, r.pos, vt) / 100;
          r.pos += valuePayloadSize(vt, data, r.pos);
        } else { r.skipValuePayload(vt); }
      } else if (tok === OWNER_TOK) {
        r.expectEqual();
        const ot = r.readToken();
        if (ot === BinaryToken.U32) { b.ownerId = r.readU32(); }
        else if (ot === BinaryToken.I32) { b.ownerId = r.readI32(); }
        else { r.skipValuePayload(ot); }
      } else if (tok === PROFIT_TOK) {
        r.expectEqual();
        const pt = r.readToken();
        if (isFixed5(pt)) {
          b.profit = readFixed5(data, r.pos, pt);
          r.pos += valuePayloadSize(pt, data, r.pos);
        } else { r.skipValuePayload(pt); }
      } else if (tok === UPKEEP_TOK) {
        r.expectEqual();
        const ut = r.readToken();
        if (isFixed5(ut)) {
          b.upkeep = readFixed5(data, r.pos, ut);
          r.pos += valuePayloadSize(ut, data, r.pos);
        } else { r.skipValuePayload(ut); }
      } else if (tok === LOCATION_TOK) {
        r.expectEqual();
        const lt = r.readToken();
        if (lt === BinaryToken.I32) { b.locationId = r.readI32(); }
        else if (lt === BinaryToken.U32) { b.locationId = r.readU32(); }
        else { r.skipValuePayload(lt); }
      } else if (
        tok === EMPLOYED_TOK ||
        tok === EMP_REQ_TOK || tok === EMP_REQ_STATUS_TOK
      ) {
        r.expectEqual();
        r.skipValue();
      } else if (r.peekToken() === BinaryToken.EQUAL) {
        r.readToken(); // =
        r.skipValue();
      } else { /* bare field token with no value — skip */ }
    }
  }

  return b;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read building_manager from the binary data stream.
 * Returns per-country aggregated building summaries.
 *
 * @param locationMarketPrices  locationId → (goodName → price) — from locations + market_manager
 * @param buildingToGood        building type → good name
 */
export const readBuildingManager = (
  r: TokenReader,
  data: Uint8Array,
  countryTags: Readonly<Record<number, string>>,
  locationMarketPrices: Readonly<Record<number, Readonly<Record<string, number>>>>,
  buildingToGood: Readonly<Record<string, string>>,
): CountryBuildings => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const bmOff = findBuildingManagerOffset(data, view);
  if (bmOff < 0) { return {}; }

  const bmContentStart = bmOff + 6;
  const bmEnd = skipBlockAt(data, view, bmContentStart);

  const lo = DATABASE_TOK & 0xff;
  const hi = (DATABASE_TOK >> 8) & 0xff;
  let dbStart = -1;
  for (let i = bmContentStart; i < bmEnd - 5; i++) {
    if (
      data[i] === lo && data[i + 1] === hi &&
      data[i + 2] === 0x01 && data[i + 3] === 0x00 &&
      data[i + 4] === 0x03 && data[i + 5] === 0x00
    ) { dbStart = i + 6; break; }
  }
  if (dbStart < 0) { return {}; }
  const dbEnd = skipBlockAt(data, view, dbStart);

  // Accumulate: tag → type → aggregated stats
  const acc: Record<string, Record<string, {
    count: number;
    totalLevel: number;
    totalProfit: number;
    totalUpkeep: number;
    totalOutput: number;
  }>> = {};

  r.pos = dbStart;
  while (r.pos < dbEnd && !r.done) {
    const tok = r.peekToken();
    if (tok === BinaryToken.CLOSE) { r.readToken(); break; }

    if (tok === BinaryToken.U32 || tok === BinaryToken.I32) {
      r.readToken(); // consume type token
      if (tok === BinaryToken.U32) { r.readU32(); } else { r.readI32(); }
      r.expectEqual();
      if (!r.expectOpen()) { r.skipValue(); continue; }

      const b = readBuildingEntry(r, data);

      if (b.type !== "" && b.ownerId >= 0) {
        const tag = countryTags[b.ownerId] ?? "";
        if (tag !== "") {
          if (acc[tag] === undefined) { acc[tag] = {}; }
          if (acc[tag][b.type] === undefined) {
            acc[tag][b.type] = { count: 0, totalLevel: 0, totalProfit: 0, totalUpkeep: 0, totalOutput: 0 };
          }
          const entry = acc[tag][b.type];
          entry.count++;
          entry.totalLevel += b.level;
          entry.totalProfit += b.profit;
          entry.totalUpkeep += b.upkeep;

          // Compute goods output for this building if we have price data
          const good = buildingToGood[b.type] ?? "";
          if (good !== "") {
            const prices = locationMarketPrices[b.locationId];
            const price = prices !== undefined ? (prices[good] ?? 0) : 0;
            if (price > 0) {
              entry.totalOutput += (b.profit + b.upkeep) / price;
            } else { /* no price for this good in this market */ }
          } else { /* building type not mapped to a good */ }
        } else { /* unknown country — skip */ }
      } else { /* incomplete entry — skip */ }
    } else {
      r.readToken();
      if (r.peekToken() === BinaryToken.EQUAL) { r.readToken(); r.skipValue(); }
    }
  }

  // Convert accumulator to final shape
  const result: Record<string, readonly BuildingSummary[]> = {};
  for (const [tag, types] of Object.entries(acc)) {
    result[tag] = Object.entries(types)
      .map(([type, s]) => ({
        type,
        count: s.count,
        totalLevel: s.totalLevel,
        totalProfit: s.totalProfit,
        totalUpkeep: s.totalUpkeep,
        totalOutput: s.totalOutput,
      }))
      .sort((a, b) => b.totalProfit - a.totalProfit);
  }
  return result;
};
