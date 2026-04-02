/**
 * Market/trade reader — global production and per-market goods data.
 *
 * All functions are pure arrow expressions with immutable variables.
 * No null, no exceptions, every if has an else.
 */

import { TokenReader } from "../token-reader";
import { BinaryToken, isValueToken, valuePayloadSize } from "../tokens";
import { tokenId } from "../token-names";
import { isFixed5, readFixed5 } from "./fixed5";

// =============================================================================
// Types
// =============================================================================

export interface MarketGood {
  readonly name: string;
  readonly price: number;
  readonly supply: number;
  readonly demand: number;
  readonly surplus: number;
  readonly stockpile: number;
  readonly totalProduction: number;
}

export interface Market {
  readonly id: number;
  readonly centerLocation: number;
  readonly dialect: string;
  readonly population: number;
  readonly price: number;
  readonly food: number;
  readonly capacity: number;
  readonly goods: readonly MarketGood[];
}

export interface TradeData {
  readonly producedGoods: Readonly<Record<string, number>>;
  readonly markets: readonly Market[];
}

// =============================================================================
// Token IDs
// =============================================================================

const MARKET_MGR = tokenId("market_manager") ?? -1;
const PRODUCED_GOODS = tokenId("produced_goods") ?? -1;
const DATABASE = tokenId("database") ?? -1;
const GOODS = tokenId("goods") ?? -1;
const PRICE = tokenId("price") ?? -1;
const SUPPLY = tokenId("supply") ?? -1;
const DEMAND = tokenId("demand") ?? -1;
const SURPLUS = tokenId("surplus") ?? -1;
const STOCKPILE = tokenId("stockpile") ?? -1;
const TOTAL_PRODUCTION = 0x8d; // engine token
const POPULATION = tokenId("population") ?? -1;
const FOOD = tokenId("food") ?? -1;
const CAPACITY = tokenId("capacity") ?? -1;
const CENTER_LOCATION = 0x32; // engine token for center_location
const DIALECT = tokenId("dialect") ?? -1;

// =============================================================================
// Helpers
// =============================================================================

const readFixed5Val = (r: TokenReader, data: Uint8Array): number => {
  const vt = r.readToken();
  if (isFixed5(vt)) {
    const size = valuePayloadSize(vt, data, r.pos);
    const val = readFixed5(data, r.pos, vt);
    r.pos += size;
    return val;
  } else if (vt === BinaryToken.I32) { return r.readI32(); }
  else if (vt === BinaryToken.U32) { return r.readU32(); }
  else if (vt === BinaryToken.F32) { return r.readF32(); }
  else { r.skipValuePayload(vt); return 0; }
};

// =============================================================================
// Readers
// =============================================================================

/** Read produced_goods = { LOOKUP = FIXED5 LOOKUP = FIXED5 ... }
 *  Format: each good is a LOOKUP token (name) followed by = and a FIXED5 value. */
const readProducedGoods = (r: TokenReader, data: Uint8Array): Record<string, number> => {
  const result: Record<string, number> = {};
  let d = 1;
  while (!r.done && d > 0) {
    const ft = r.peekToken();
    if (ft === BinaryToken.CLOSE) { r.readToken(); d--; continue; }
    else if (ft === BinaryToken.OPEN) { r.readToken(); d++; continue; }
    // Try to read as: string = value
    const sv = r.readStringValue();
    if (sv !== null) {
      if (r.peekToken() === BinaryToken.EQUAL) {
        r.readToken(); // =
        const val = readFixed5Val(r, data);
        result[sv] = val;
      } else {
        /* bare string — skip */
      }
    } else {
      // Not a string — skip
      r.readToken();
      if (r.peekToken() === BinaryToken.EQUAL) { r.readToken(); r.skipValue(); }
    }
  }
  return result;
};

/** Read a single good entry inside a market's goods block. */
const readMarketGood = (r: TokenReader, data: Uint8Array, name: string): MarketGood => {
  let price = 0, supply = 0, demand = 0, surplus = 0, stockpile = 0, totalProduction = 0;
  let d = 1;
  while (!r.done && d > 0) {
    const ft = r.readToken();
    if (ft === BinaryToken.CLOSE) { d--; continue; }
    else if (ft === BinaryToken.OPEN) { d++; continue; }
    else if (ft === BinaryToken.EQUAL) { continue; }
    else if (isValueToken(ft)) { r.skipValuePayload(ft); continue; }
    if (d === 1 && r.peekToken() === BinaryToken.EQUAL) {
      if (ft === PRICE) { r.readToken(); price = readFixed5Val(r, data); }
      else if (ft === SUPPLY) { r.readToken(); supply = readFixed5Val(r, data); }
      else if (ft === DEMAND) { r.readToken(); demand = readFixed5Val(r, data); }
      else if (ft === SURPLUS) { r.readToken(); surplus = readFixed5Val(r, data); }
      else if (ft === STOCKPILE) { r.readToken(); stockpile = readFixed5Val(r, data); }
      else if (ft === TOTAL_PRODUCTION) { r.readToken(); totalProduction = readFixed5Val(r, data); }
      else { r.readToken(); r.skipValue(); }
    } else { /* bare */ }
  }
  return { name, price, supply, demand, surplus, stockpile, totalProduction };
};

/** Read goods = { "name" { ... } "name" { ... } } inside a market entry. */
const readMarketGoods = (r: TokenReader, data: Uint8Array): MarketGood[] => {
  const goods: MarketGood[] = [];
  let d = 1;
  let pendingName = "";
  while (!r.done && d > 0) {
    const ft = r.readToken();
    if (ft === BinaryToken.CLOSE) { d--; continue; }
    else if (ft === BinaryToken.OPEN) {
      d++;
      if (d === 2 && pendingName !== "") {
        goods.push(readMarketGood(r, data, pendingName));
        pendingName = "";
        d--; // readMarketGood consumed the close
      }
      continue;
    }
    else if (ft === BinaryToken.EQUAL) { continue; }
    else if (ft === BinaryToken.QUOTED || ft === BinaryToken.UNQUOTED) {
      pendingName = r.readString();
    } else if (ft === BinaryToken.LOOKUP_U8) { pendingName = r.readLookupU8(); }
    else if (ft === BinaryToken.LOOKUP_U16) { pendingName = r.readLookupU16(); }
    else if (ft === BinaryToken.LOOKUP_U24) { pendingName = r.readLookupU24(); }
    else if (isValueToken(ft)) { r.skipValuePayload(ft); }
    else { /* other */ }
  }
  return goods;
};

/** Read a single market entry. */
const readMarketEntry = (r: TokenReader, data: Uint8Array, id: number): Market => {
  let centerLocation = 0, dialect = "", population = 0, price = 0, food = 0, capacity = 0;
  let goods: MarketGood[] = [];
  let d = 1;
  while (!r.done && d > 0) {
    const ft = r.readToken();
    if (ft === BinaryToken.CLOSE) { d--; continue; }
    else if (ft === BinaryToken.OPEN) { d++; continue; }
    else if (ft === BinaryToken.EQUAL) { continue; }
    else if (isValueToken(ft)) { r.skipValuePayload(ft); continue; }
    if (d === 1 && r.peekToken() === BinaryToken.EQUAL) {
      if (ft === CENTER_LOCATION) { r.readToken(); centerLocation = readFixed5Val(r, data); }
      else if (ft === DIALECT) { r.readToken(); const sv = r.readStringValue(); dialect = sv ?? ""; }
      else if (ft === POPULATION) { r.readToken(); population = readFixed5Val(r, data); }
      else if (ft === PRICE) { r.readToken(); price = readFixed5Val(r, data); }
      else if (ft === FOOD) { r.readToken(); food = readFixed5Val(r, data); }
      else if (ft === CAPACITY) { r.readToken(); capacity = readFixed5Val(r, data); }
      else if (ft === GOODS) { r.readToken(); if (r.expectOpen()) { goods = readMarketGoods(r, data); } else { r.skipValue(); } }
      else { r.readToken(); r.skipValue(); }
    } else { /* bare */ }
  }
  return { id, centerLocation, dialect, population, price, food, capacity, goods };
};

// =============================================================================
// Public API
// =============================================================================

/** Read trade data from market_manager. */
export const readTradeData = (
  data: Uint8Array,
  dynStrings: string[],
): TradeData => {
  const r = new TokenReader(data, dynStrings);
  let producedGoods: Record<string, number> = {};
  const markets: Market[] = [];

  // Find market_manager
  r.pos = 0;
  let depth = 0;
  while (!r.done) {
    const ft = r.readToken();
    if (ft === BinaryToken.CLOSE) { depth--; continue; }
    else if (ft === BinaryToken.OPEN) { depth++; continue; }
    else if (ft === BinaryToken.EQUAL) { continue; }
    else if (isValueToken(ft)) { r.skipValuePayload(ft); continue; }
    if (depth === 0 && ft === MARKET_MGR && r.peekToken() === BinaryToken.EQUAL) {
      r.readToken(); r.readToken(); // = {
      let d = 1;
      while (!r.done && d > 0) {
        const ft2 = r.readToken();
        if (ft2 === BinaryToken.CLOSE) { d--; continue; }
        else if (ft2 === BinaryToken.OPEN) { d++; continue; }
        else if (ft2 === BinaryToken.EQUAL) { continue; }
        else if (isValueToken(ft2)) { r.skipValuePayload(ft2); continue; }
        if (d === 1 && r.peekToken() === BinaryToken.EQUAL) {
          if (ft2 === PRODUCED_GOODS) {
            r.readToken();
            if (r.expectOpen()) { producedGoods = readProducedGoods(r, data); }
            else { r.skipValue(); }
          } else if (ft2 === DATABASE) {
            r.readToken();
            if (r.expectOpen()) {
              while (!r.done) {
                const peek = r.peekToken();
                if (peek === BinaryToken.CLOSE) { r.readToken(); break; }
                if (peek === BinaryToken.I32 || peek === BinaryToken.U32) {
                  r.readToken();
                  const id = peek === BinaryToken.I32 ? r.readI32() : r.readU32();
                  if (r.peekToken() === BinaryToken.EQUAL) { r.readToken(); }
                  if (r.peekToken() === BinaryToken.OPEN) {
                    r.readToken();
                    markets.push(readMarketEntry(r, data, id));
                  } else {
                    r.readToken(); // none
                  }
                } else {
                  r.readToken();
                  if (r.peekToken() === BinaryToken.EQUAL) { r.readToken(); r.skipValue(); }
                }
              }
            } else { r.skipValue(); }
          } else {
            r.readToken(); r.skipValue();
          }
        } else { /* bare */ }
      }
      break;
    }
  }

  return { producedGoods, markets };
};
