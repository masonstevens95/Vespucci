/**
 * Estates reader — parses the estates block from a country's database entry.
 *
 * Handles both keyed (active_estate = { ... }) and anonymous ({ ... }) entries.
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

export interface EstateData {
  readonly type: string;
  readonly power: number;
  readonly powerFraction: number;
  readonly satisfaction: number;
  readonly targetSatisfaction: number;
  readonly numPrivileges: number;
  readonly maxPrivileges: number;
}

// =============================================================================
// Token IDs
// =============================================================================

const ACTIVE_ESTATE = tokenId("active_estate") ?? -1;
const ESTATE_TYPE = tokenId("estate_type") ?? -1;
const ESTATE_POWER = tokenId("estate_power") ?? -1;
const ESTATE_POWER_FRACTION = tokenId("estate_power_fraction") ?? -1;
const ESTATE_SATISFACTION = tokenId("estate_satisfaction") ?? -1;
const ESTATE_TARGET_SATISFACTION = tokenId("estate_target_satisfaction") ?? -1;
const NUM_ESTATE_PRIVILEGES = tokenId("num_estate_privileges") ?? -1;
const NUM_POSSIBLE_ESTATE_PRIVILEGES = tokenId("num_possible_estate_privileges") ?? -1;

// =============================================================================
// Helpers
// =============================================================================

const readNumericVal = (r: TokenReader, data: Uint8Array): number => {
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
// Entry reader
// =============================================================================

/**
 * Read a single estate entry block.
 * Called with r.pos just after the opening { has been consumed.
 * Reads until the matching closing }.
 */
const readEstateEntry = (r: TokenReader, data: Uint8Array): EstateData => {
  let type = "";
  let power = 0;
  let powerFraction = 0;
  let satisfaction = 0;
  let targetSatisfaction = 0;
  let numPrivileges = 0;
  let maxPrivileges = 0;
  let depth = 1;

  while (!r.done && depth > 0) {
    const tok = r.readToken();
    if (tok === BinaryToken.CLOSE) { depth--; continue; }
    else if (tok === BinaryToken.OPEN) { depth++; continue; }
    else if (tok === BinaryToken.EQUAL) { continue; }
    else if (isValueToken(tok)) { r.skipValuePayload(tok); continue; }
    else {
      // Field name token
      if (depth === 1 && r.peekToken() === BinaryToken.EQUAL) {
        r.readToken(); // consume =
        if (tok === ESTATE_TYPE) {
          const sv = r.readStringValue();
          type = sv !== null ? sv : type;
        } else if (tok === ESTATE_POWER) {
          power = readNumericVal(r, data);
        } else if (tok === ESTATE_POWER_FRACTION) {
          powerFraction = readNumericVal(r, data);
        } else if (tok === ESTATE_SATISFACTION) {
          satisfaction = readNumericVal(r, data);
        } else if (tok === ESTATE_TARGET_SATISFACTION) {
          targetSatisfaction = readNumericVal(r, data);
        } else if (tok === NUM_ESTATE_PRIVILEGES) {
          const iv = r.readIntValue();
          numPrivileges = iv !== null ? iv : numPrivileges;
        } else if (tok === NUM_POSSIBLE_ESTATE_PRIVILEGES) {
          const iv = r.readIntValue();
          maxPrivileges = iv !== null ? iv : maxPrivileges;
        } else {
          r.skipValue();
        }
      } else if (r.peekToken() === BinaryToken.EQUAL) {
        r.readToken(); // consume =
        r.skipValue();
      } else {
        // bare token — no payload
      }
    }
  }

  return { type, power, powerFraction, satisfaction, targetSatisfaction, numPrivileges, maxPrivileges };
};

// =============================================================================
// Block reader
// =============================================================================

/**
 * Read the estates block: estates = { ... }
 * Called with r.pos just after the opening { of the estates block has been consumed.
 *
 * Handles three structural variants:
 *   - anonymous: { { estate_type = ... } }
 *   - active_estate keyed: { active_estate = { estate_type = ... } }
 *   - integer keyed: { 0 = { estate_type = ... } }
 */
export const readEstates = (r: TokenReader, data: Uint8Array): readonly EstateData[] => {
  const result: EstateData[] = [];

  while (!r.done) {
    const tok = r.peekToken();

    if (tok === BinaryToken.CLOSE) {
      r.readToken(); // consume closing } of estates block
      break;
    } else if (tok === BinaryToken.OPEN) {
      r.readToken(); // consume {
      result.push(readEstateEntry(r, data));
    } else if (tok === BinaryToken.EQUAL) {
      r.readToken(); // consume stray =
    } else if (isValueToken(tok)) {
      r.readToken();
      r.skipValuePayload(tok);
    } else {
      r.readToken(); // consume key token (named or integer)
      if (r.peekToken() === BinaryToken.EQUAL) {
        r.readToken(); // consume =
        if (r.peekToken() === BinaryToken.OPEN) {
          r.readToken(); // consume {
          result.push(readEstateEntry(r, data));
        } else {
          r.skipValue();
        }
      } else {
        // bare key with no value — skip
      }
    }
  }

  return result;
};

export const ESTATES_TOKEN = tokenId("estates") ?? -1;
export const ACTIVE_ESTATE_TOKEN = ACTIVE_ESTATE;
