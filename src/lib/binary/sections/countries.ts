import { TokenReader } from "../token-reader";
import { BinaryToken, isValueToken } from "../tokens";
import { T } from "../game-tokens";
import type { RGB } from "../../types";

/* ── Pure helpers ─────────────────────────────────────────────────── */

/** True when tok is one of the two color-field tokens (COLOR or mapColor). */
const isColorToken = (tok: number): boolean =>
  tok === T.COLOR || tok === T.mapColor;

/** True when the marker is RGB and the next token opens a block. */
const isRgbBlock = (marker: number, peek: number): boolean =>
  marker === T.RGB && peek === BinaryToken.OPEN;

/** True when tok is an integer-typed token (I32 or U32). */
const isIntToken = (tok: number): boolean =>
  tok === BinaryToken.I32 || tok === BinaryToken.U32;

/** Read the raw integer from the stream based on the token type. */
const readRawInt = (r: TokenReader, tok: number): number =>
  tok === BinaryToken.I32 ? r.readI32() : r.readU32();

/* ── Exported section readers ─────────────────────────────────────── */

/** Read countries > tags + database. */
export const readCountries = (
  r: TokenReader,
  countryTags: Record<number, string>,
  countryColors: Record<string, RGB>,
  countryCapitals: Record<number, number>,
  overlordCandidates: Set<string>,
): void => {
  let depth = 1;
  while (!r.done && depth > 0) {
    const tok = r.readToken();
    if (tok === BinaryToken.CLOSE) { depth--; continue; }
    else if (tok === BinaryToken.OPEN) { depth++; continue; }
    else if (tok === BinaryToken.EQUAL) { continue; }
    else if (tok === T.tags) {
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
    } else {
      /* unrecognized non-field token at top level — skip */
    }
  }
};

/** Read ID=TAG entries from the tags block. */
export const readCountryTags = (
  r: TokenReader,
  countryTags: Record<number, string>,
): void => {
  while (!r.done) {
    const tok = r.peekToken();
    if (tok === BinaryToken.CLOSE) { r.readToken(); return; }

    if (isIntToken(tok)) {
      r.readToken();
      const id = readRawInt(r, tok);
      r.expectEqual();
      const tag = r.readStringValue() ?? "";
      if (tag !== "") {
        countryTags[id] = tag;
      } else {
        /* empty tag value — discard */
      }
    } else {
      r.readToken();
      if (r.peekToken() === BinaryToken.EQUAL) {
        r.readToken();
        r.skipValue();
      } else {
        /* non-field token without = — skip */
      }
    }
  }
};

/** Read country entries from database. */
export const readCountryDatabase = (
  r: TokenReader,
  countryColors: Record<string, RGB>,
  countryCapitals: Record<number, number>,
  overlordCandidates: Set<string>,
): void => {
  while (!r.done) {
    const tok = r.peekToken();
    if (tok === BinaryToken.CLOSE) { r.readToken(); return; }

    if (isIntToken(tok)) {
      r.readToken();
      const countryId = readRawInt(r, tok);
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
      } else {
        /* non-field token without = — skip */
      }
    }
  }
};

/**
 * Read a single country entry for flag, color, capital, subject_tax.
 *
 * Uses a two-pass approach: first scans field offsets using skipBlock's
 * reliable depth tracking, then reads values at those offsets.
 */
export const readCountryEntry = (
  r: TokenReader,
  countryId: number,
  countryColors: Record<string, RGB>,
  countryCapitals: Record<number, number>,
  overlordCandidates: Set<string>,
): void => {
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
    else if (tok === BinaryToken.OPEN) { depth++; continue; }
    else if (tok === BinaryToken.EQUAL) { continue; }
    else if (isValueToken(tok)) { r.skipValuePayload(tok); continue; }
    else if (depth === 1 && r.peekToken() === BinaryToken.EQUAL) {
      if (tok === T.flag) { flagOffset = fieldPos; }
      else if (isColorToken(tok)) { colorOffset = fieldPos; }
      else if (tok === T.capital) { capitalOffset = fieldPos; }
      else if (tok === T.subjectTax) { subjectTaxOffset = fieldPos; }
      else { /* field we don't need — fall through to skip */ }
      r.readToken(); // =
      r.skipValue();
    } else {
      /* non-field token at depth > 1 or without = — skip */
    }
  }

  // Pass 2: read values at discovered offsets
  const currentFlag = flagOffset >= 0
    ? (() => { r.pos = flagOffset; r.readToken(); r.expectEqual(); return r.readStringValue() ?? ""; })()
    : "";

  if (colorOffset >= 0 && currentFlag !== "") {
    r.pos = colorOffset;
    r.readToken(); r.expectEqual();
    const marker = r.readToken();
    if (isRgbBlock(marker, r.peekToken())) {
      r.readToken(); // {
      const rv = r.readIntValue() ?? -1;
      const gv = r.readIntValue() ?? -1;
      const bv = r.readIntValue() ?? -1;
      if (rv >= 0 && gv >= 0 && bv >= 0) {
        countryColors[currentFlag] = [rv, gv, bv];
      } else {
        /* incomplete RGB triple — discard */
      }
    } else {
      /* color field is not an RGB block — skip */
    }
  } else {
    /* no color offset or no flag — skip color */
  }

  if (capitalOffset >= 0) {
    r.pos = capitalOffset;
    r.readToken(); r.expectEqual();
    const cap = r.readIntValue() ?? -1;
    if (cap >= 0) {
      countryCapitals[countryId] = cap;
    } else {
      /* invalid capital value — discard */
    }
  } else {
    /* no capital field found */
  }

  if (subjectTaxOffset >= 0 && currentFlag !== "") {
    r.pos = subjectTaxOffset;
    r.readToken(); r.expectEqual();
    const val = r.readFloatValue() ?? 0;
    if (val > 0) {
      overlordCandidates.add(currentFlag);
    } else {
      /* zero or negative subject tax — not an overlord */
    }
  } else {
    /* no subject_tax field or no flag */
  }

  r.pos = endPos;
};
