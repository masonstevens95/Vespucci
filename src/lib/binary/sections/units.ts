/**
 * Unit and subunit manager readers — actual army/navy regiment counts and strength.
 *
 * Scans unit_manager to determine which units are armies vs navies (is_army flag),
 * then scans subunit_manager to sum regiment/ship counts and strength per country.
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

/** Per-category force counts, strength, and frontage per country. */
export interface CountryForces {
  // Regulars — count + strength
  readonly infantry: number;
  readonly cavalry: number;
  readonly artillery: number;
  readonly infantryStr: number;
  readonly cavalryStr: number;
  readonly artilleryStr: number;
  // Levies — count + strength
  readonly levyInfantry: number;
  readonly levyCavalry: number;
  readonly levyInfantryStr: number;
  readonly levyCavalryStr: number;
  // Navy — count
  readonly heavyShips: number;
  readonly lightShips: number;
  readonly galleys: number;
  readonly transports: number;
  // Frontage (from unit_manager) — combat width, accounts for unit type sizes
  readonly armyFrontage: number;
  readonly navyFrontage: number;
}

// =============================================================================
// Unit type classification
// =============================================================================

type ForceCategory = keyof CountryForces;

/** Classify a subunit type string into a force category.
 *  Type names use a_ prefix for army, n_ prefix for navy.
 *  Levy units have "_levy" in the name. */
const classifyType = (type: string): ForceCategory => {
  // Navy types
  if (type.startsWith("n_")) {
    if (/carrack|galleon|war_galleon|atakebune|hulk/i.test(type)) { return "heavyShips"; }
    else if (/galley|galleass|galiot/i.test(type)) { return "galleys"; }
    else if (/cog|flute|fishing|dhow|canoe|transport/i.test(type)) { return "transports"; }
    else { return "lightShips"; } // brig, caravel, pinnace, barque, etc.
  }

  const isLevy = /_levy/i.test(type);

  // Army types
  if (/cannon|falconet|houfnice|helepolis|bombard|mortar|culverin/i.test(type)) { return "artillery"; }
  else if (/supply|convoy|baggage|camp_follower|discovery/i.test(type)) { return isLevy ? "levyInfantry" : "infantry"; }
  else if (/cavalry|lancer|knight|horsem|cavalier|pistoleer|hussar|cuirassier|dragoon|steppe_horde|retainer|elephant|armored_horse|maurician/i.test(type)) { return isLevy ? "levyCavalry" : "cavalry"; }
  else { return isLevy ? "levyInfantry" : "infantry"; }
};

// =============================================================================
// Token IDs
// =============================================================================

const UNIT_MGR = tokenId("unit_manager") ?? -1;
const SUBUNIT_MGR = tokenId("subunit_manager") ?? -1;
const DATABASE = tokenId("database") ?? -1;
const OWNER = tokenId("owner") ?? -1;
const STRENGTH = tokenId("strength") ?? -1;
const TYPE = 0xe1; // "type" / definition reference field
const IS_ARMY = tokenId("is_army") ?? -1;
const COUNTRY = tokenId("country") ?? -1;
const FRONTAGE = tokenId("frontage") ?? -1;

// =============================================================================
// Subunit manager reader
// =============================================================================

const EMPTY_FORCES: CountryForces = {
  infantry: 0, cavalry: 0, artillery: 0,
  infantryStr: 0, cavalryStr: 0, artilleryStr: 0,
  levyInfantry: 0, levyCavalry: 0,
  levyInfantryStr: 0, levyCavalryStr: 0,
  heavyShips: 0, lightShips: 0, galleys: 0, transports: 0,
  armyFrontage: 0, navyFrontage: 0,
};

/** Map a count category to its strength counterpart. */
const strKey = (cat: ForceCategory): ForceCategory | null => {
  if (cat === "infantry") { return "infantryStr"; }
  else if (cat === "cavalry") { return "cavalryStr"; }
  else if (cat === "artillery") { return "artilleryStr"; }
  else if (cat === "levyInfantry") { return "levyInfantryStr"; }
  else if (cat === "levyCavalry") { return "levyCavalryStr"; }
  else { return null; } // navy categories don't have separate strength
};

/** Read subunit_manager > database, classify each subunit by type, accumulate per owner. */
const readSubunits = (
  r: TokenReader,
  data: Uint8Array,
  countryTags: Readonly<Record<number, string>>,
): Record<string, CountryForces> => {
  const result: Record<string, Record<keyof CountryForces, number>> = {};

  let d = 1;
  while (!r.done && d > 0) {
    const ft = r.readToken();
    if (ft === BinaryToken.CLOSE) { d--; continue; }
    else if (ft === BinaryToken.OPEN) { d++; continue; }
    else if (ft === BinaryToken.EQUAL) { continue; }
    else if (isValueToken(ft)) { r.skipValuePayload(ft); continue; }

    if (d === 1 && ft === DATABASE && r.peekToken() === BinaryToken.EQUAL) {
      r.readToken(); r.expectOpen();

      while (!r.done) {
        const peek = r.peekToken();
        if (peek === BinaryToken.CLOSE) { r.readToken(); break; }
        if (peek === BinaryToken.I32 || peek === BinaryToken.U32) {
          r.readToken();
          peek === BinaryToken.I32 ? r.readI32() : r.readU32();
          r.expectEqual();
          if (!r.expectOpen()) { r.skipValue(); continue; }

          let owner = -1;
          let typeStr = "";
          let strength = 0;
          let ed = 1;
          while (!r.done && ed > 0) {
            const eft = r.readToken();
            if (eft === BinaryToken.CLOSE) { ed--; continue; }
            else if (eft === BinaryToken.OPEN) { ed++; continue; }
            else if (eft === BinaryToken.EQUAL) { continue; }
            else if (isValueToken(eft)) { r.skipValuePayload(eft); continue; }

            if (ed === 1 && r.peekToken() === BinaryToken.EQUAL) {
              if (eft === OWNER) {
                r.readToken();
                const ct = r.readToken();
                if (ct === BinaryToken.I32) { owner = r.readI32(); }
                else if (ct === BinaryToken.U32) { owner = r.readU32(); }
                else { r.skipValuePayload(ct); }
              } else if (eft === TYPE) {
                r.readToken();
                const sv = r.readStringValue();
                if (sv !== null) { typeStr = sv; }
                else { r.skipValue(); }
              } else if (eft === STRENGTH) {
                r.readToken();
                const vt = r.readToken();
                if (isFixed5(vt)) {
                  const size = valuePayloadSize(vt, data, r.pos);
                  strength = readFixed5(data, r.pos, vt);
                  r.pos += size;
                } else if (vt === BinaryToken.F32) {
                  strength = r.readF32();
                } else {
                  r.skipValuePayload(vt);
                }
              } else {
                r.readToken(); r.skipValue();
              }
            } else {
              /* other */
            }
          }

          if (owner >= 0 && typeStr !== "") {
            const tag = countryTags[owner] ?? "";
            if (tag !== "") {
              const category = classifyType(typeStr);
              const entry = result[tag] ?? { ...EMPTY_FORCES };
              entry[category] = (entry[category] ?? 0) + 1;
              const sk = strKey(category);
              if (sk !== null) {
                entry[sk] = (entry[sk] ?? 0) + strength;
              } else {
                /* navy — no separate strength tracking */
              }
              result[tag] = entry;
            } else {
              /* unknown owner */
            }
          } else {
            /* missing owner or type */
          }
        } else {
          r.readToken();
          if (r.peekToken() === BinaryToken.EQUAL) { r.readToken(); r.skipValue(); }
          else { /* other */ }
        }
      }
      break;
    } else if (r.peekToken() === BinaryToken.EQUAL) {
      r.readToken(); r.skipValue();
    } else {
      /* other */
    }
  }

  const forces: Record<string, CountryForces> = {};
  for (const [tag, counts] of Object.entries(result)) {
    forces[tag] = { ...counts } as CountryForces;
  }
  return forces;
};

// =============================================================================
// Unit manager reader — frontage per country
// =============================================================================

/** Read unit_manager > database, sum frontage per country split by army/navy. */
const readUnitFrontage = (
  r: TokenReader,
  data: Uint8Array,
  countryTags: Readonly<Record<number, string>>,
): Record<string, { army: number; navy: number }> => {
  const result: Record<string, { army: number; navy: number }> = {};

  let d = 1;
  while (!r.done && d > 0) {
    const ft = r.readToken();
    if (ft === BinaryToken.CLOSE) { d--; continue; }
    else if (ft === BinaryToken.OPEN) { d++; continue; }
    else if (ft === BinaryToken.EQUAL) { continue; }
    else if (isValueToken(ft)) { r.skipValuePayload(ft); continue; }

    if (d === 1 && ft === DATABASE && r.peekToken() === BinaryToken.EQUAL) {
      r.readToken(); r.expectOpen();

      while (!r.done) {
        const peek = r.peekToken();
        if (peek === BinaryToken.CLOSE) { r.readToken(); break; }
        if (peek === BinaryToken.I32 || peek === BinaryToken.U32) {
          r.readToken();
          peek === BinaryToken.I32 ? r.readI32() : r.readU32();
          r.expectEqual();
          if (!r.expectOpen()) { r.skipValue(); continue; }

          let country = -1;
          let frontage = 0;
          let isArmy = false; // absent = navy
          let ed = 1;
          while (!r.done && ed > 0) {
            const eft = r.readToken();
            if (eft === BinaryToken.CLOSE) { ed--; continue; }
            else if (eft === BinaryToken.OPEN) { ed++; continue; }
            else if (eft === BinaryToken.EQUAL) { continue; }
            else if (isValueToken(eft)) { r.skipValuePayload(eft); continue; }

            if (ed === 1 && r.peekToken() === BinaryToken.EQUAL) {
              if (eft === COUNTRY) {
                r.readToken();
                const ct = r.readToken();
                if (ct === BinaryToken.I32) { country = r.readI32(); }
                else if (ct === BinaryToken.U32) { country = r.readU32(); }
                else { r.skipValuePayload(ct); }
              } else if (eft === FRONTAGE) {
                r.readToken();
                const vt = r.readToken();
                if (vt === BinaryToken.I32) { frontage = r.readI32(); }
                else if (vt === BinaryToken.U32) { frontage = r.readU32(); }
                else if (isFixed5(vt)) {
                  const size = valuePayloadSize(vt, data, r.pos);
                  frontage = readFixed5(data, r.pos, vt);
                  r.pos += size;
                } else { r.skipValuePayload(vt); }
              } else if (eft === IS_ARMY) {
                isArmy = true;
                r.readToken(); r.skipValue();
              } else {
                r.readToken(); r.skipValue();
              }
            } else {
              /* other */
            }
          }

          if (country >= 0 && frontage > 0) {
            const tag = countryTags[country] ?? "";
            if (tag !== "") {
              const entry = result[tag] ?? { army: 0, navy: 0 };
              if (isArmy) {
                result[tag] = { ...entry, army: entry.army + frontage };
              } else {
                result[tag] = { ...entry, navy: entry.navy + frontage };
              }
            } else {
              /* unknown country */
            }
          } else {
            /* no country or zero frontage */
          }
        } else {
          r.readToken();
          if (r.peekToken() === BinaryToken.EQUAL) { r.readToken(); r.skipValue(); }
          else { /* other */ }
        }
      }
      break;
    } else if (r.peekToken() === BinaryToken.EQUAL) {
      r.readToken(); r.skipValue();
    } else {
      /* other */
    }
  }

  return result;
};

// =============================================================================
// Top-level section finder
// =============================================================================

/** Scan for a top-level section token. Returns true if found (reader positioned after {). */
const findTopLevel = (r: TokenReader, target: number): boolean => {
  r.pos = 0;
  let depth = 0;
  while (!r.done) {
    const ft = r.readToken();
    if (ft === BinaryToken.CLOSE) { depth--; continue; }
    else if (ft === BinaryToken.OPEN) { depth++; continue; }
    else if (ft === BinaryToken.EQUAL) { continue; }
    else if (isValueToken(ft)) { r.skipValuePayload(ft); continue; }
    if (depth === 0 && ft === target && r.peekToken() === BinaryToken.EQUAL) {
      r.readToken();
      return r.expectOpen();
    } else {
      /* other */
    }
  }
  return false;
};

// =============================================================================
// Public API
// =============================================================================

/** Scan unit_manager (frontage) and subunit_manager (regiment counts + strength)
 *  to build per-country force breakdowns. */
export const readCountryForces = (
  data: Uint8Array,
  dynStrings: string[],
  countryTags: Readonly<Record<number, string>>,
): Record<string, CountryForces> => {
  // Pass 1: unit_manager — sum frontage per country
  const r1 = new TokenReader(data, dynStrings);
  let frontageMap: Record<string, { army: number; navy: number }> = {};
  if (findTopLevel(r1, UNIT_MGR)) {
    frontageMap = readUnitFrontage(r1, data, countryTags);
  }

  // Pass 2: subunit_manager — regiment/ship counts + strength
  const r2 = new TokenReader(data, dynStrings);
  let subunitForces: Record<string, CountryForces> = {};
  if (findTopLevel(r2, SUBUNIT_MGR)) {
    subunitForces = readSubunits(r2, data, countryTags);
  }

  // Merge frontage into forces
  const allTags = new Set([...Object.keys(frontageMap), ...Object.keys(subunitForces)]);
  const result: Record<string, CountryForces> = {};
  for (const tag of allTags) {
    const sub = subunitForces[tag] ?? { ...EMPTY_FORCES };
    const fr = frontageMap[tag] ?? { army: 0, navy: 0 };
    result[tag] = { ...sub, armyFrontage: fr.army, navyFrontage: fr.navy };
  }
  return result;
};
