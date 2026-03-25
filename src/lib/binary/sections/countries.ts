import { TokenReader } from "../token-reader";
import { BinaryToken, isValueToken } from "../tokens";
import { T } from "../game-tokens";
import type { RGB } from "../../types";

/** Read countries > tags + database. */
export function readCountries(
  r: TokenReader,
  countryTags: Record<number, string>,
  countryColors: Record<string, RGB>,
  countryCapitals: Record<number, number>,
  overlordCandidates: Set<string>,
): void {
  let depth = 1;
  while (!r.done && depth > 0) {
    const tok = r.readToken();
    if (tok === BinaryToken.CLOSE) { depth--; continue; }
    if (tok === BinaryToken.OPEN) { depth++; continue; }
    if (tok === BinaryToken.EQUAL) continue;

    if (tok === T.tags) {
      r.expectEqual();
      r.expectOpen();
      readCountryTags(r, countryTags);
    } else if (tok === T.database) {
      r.expectEqual();
      r.expectOpen();
      readCountryDatabase(r, countryColors, countryCapitals, overlordCandidates);
    } else if (r.peekToken() === BinaryToken.EQUAL) {
      r.readToken();
      r.skipValue();
    }
  }
}

/** Read ID=TAG entries from the tags block. */
export function readCountryTags(
  r: TokenReader,
  countryTags: Record<number, string>,
): void {
  while (!r.done) {
    const tok = r.peekToken();
    if (tok === BinaryToken.CLOSE) { r.readToken(); return; }

    if (tok === BinaryToken.I32 || tok === BinaryToken.U32) {
      r.readToken();
      const id = tok === BinaryToken.I32 ? r.readI32() : r.readU32();
      r.expectEqual();
      const tag = r.readStringValue();
      if (tag) countryTags[id] = tag;
    } else {
      r.readToken();
      if (r.peekToken() === BinaryToken.EQUAL) {
        r.readToken();
        r.skipValue();
      }
    }
  }
}

/** Read country entries from database. */
export function readCountryDatabase(
  r: TokenReader,
  countryColors: Record<string, RGB>,
  countryCapitals: Record<number, number>,
  overlordCandidates: Set<string>,
): void {
  while (!r.done) {
    const tok = r.peekToken();
    if (tok === BinaryToken.CLOSE) { r.readToken(); return; }

    if (tok === BinaryToken.I32 || tok === BinaryToken.U32) {
      r.readToken();
      const countryId = tok === BinaryToken.I32 ? r.readI32() : r.readU32();
      r.expectEqual();
      if (r.expectOpen()) {
        readCountryEntry(r, countryId, countryColors, countryCapitals, overlordCandidates);
      } else {
        // Not a block entry (e.g., "234881085 = none") — skip the value
        r.skipValue();
      }
    } else {
      r.readToken();
      if (r.peekToken() === BinaryToken.EQUAL) {
        r.readToken();
        r.skipValue();
      }
    }
  }
}

/**
 * Read a single country entry for flag, color, capital, subject_tax.
 *
 * Uses a two-pass approach: first scans field offsets using skipBlock's
 * reliable depth tracking, then reads values at those offsets. This
 * avoids alignment issues from complex nested token patterns.
 */
export function readCountryEntry(
  r: TokenReader,
  countryId: number,
  countryColors: Record<string, RGB>,
  countryCapitals: Record<number, number>,
  overlordCandidates: Set<string>,
): void {
  // Pass 1: scan depth-1 field names, recording offsets for fields we need
  const startPos = r.pos;
  let flagOffset = -1;
  let colorOffset = -1;
  let capitalOffset = -1;
  let subjectTaxOffset = -1;

  r.skipBlock();
  const endPos = r.pos;

  // Re-scan using reliable isValueToken-aware depth walking
  r.pos = startPos;
  let depth = 1;
  while (r.pos < endPos && depth > 0) {
    const fieldPos = r.pos;
    const tok = r.readToken();
    if (tok === BinaryToken.CLOSE) { depth--; continue; }
    if (tok === BinaryToken.OPEN) { depth++; continue; }
    if (tok === BinaryToken.EQUAL) continue;
    if (isValueToken(tok)) { r.skipValuePayload(tok); continue; }

    if (depth === 1 && r.peekToken() === BinaryToken.EQUAL) {
      if (tok === T.flag) flagOffset = fieldPos;
      else if (tok === T.COLOR || tok === T.mapColor) colorOffset = fieldPos;
      else if (tok === T.capital) capitalOffset = fieldPos;
      else if (tok === T.subjectTax) subjectTaxOffset = fieldPos;
      r.readToken(); // =
      r.skipValue();
    }
  }

  // Pass 2: read values at discovered offsets
  let currentFlag: string | null = null;

  if (flagOffset >= 0) {
    r.pos = flagOffset;
    r.readToken(); r.expectEqual();
    currentFlag = r.readStringValue();
  }

  if (colorOffset >= 0 && currentFlag) {
    r.pos = colorOffset;
    r.readToken(); r.expectEqual();
    const marker = r.readToken();
    if (marker === T.RGB && r.peekToken() === BinaryToken.OPEN) {
      r.readToken(); // {
      const rv = r.readIntValue();
      const gv = r.readIntValue();
      const bv = r.readIntValue();
      if (rv !== null && gv !== null && bv !== null) {
        countryColors[currentFlag] = [rv, gv, bv];
      }
    }
  }

  if (capitalOffset >= 0) {
    r.pos = capitalOffset;
    r.readToken(); r.expectEqual();
    const cap = r.readIntValue();
    if (cap !== null) countryCapitals[countryId] = cap;
  }

  if (subjectTaxOffset >= 0 && currentFlag) {
    r.pos = subjectTaxOffset;
    r.readToken(); r.expectEqual();
    const val = r.readFloatValue();
    if (val !== null && val > 0) overlordCandidates.add(currentFlag);
  }

  r.pos = endPos;
}
