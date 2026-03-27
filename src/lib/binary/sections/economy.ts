/**
 * Extract economy data from country database entries.
 *
 * Reads currency_data (gold, manpower, sailors, stability, prestige)
 * and other economy fields from each country entry.
 *
 * All functions are pure arrow expressions with immutable variables.
 * No null, no exceptions, every if has an else.
 */

import { TokenReader } from "../token-reader";
import { BinaryToken, isValueToken, valuePayloadSize } from "../tokens";
import { tokenId } from "../token-names";

// =============================================================================
// Types
// =============================================================================

export interface CountryEconomy {
  readonly gold: number;
  readonly manpower: number;
  readonly sailors: number;
  readonly stability: number;
  readonly prestige: number;
  readonly countryName: string;
  readonly score: number;
}

// =============================================================================
// Pure helpers
// =============================================================================

/** Token IDs for fields we extract. */
const CURRENCY_DATA = tokenId("currency_data") ?? -1;
const GOLD = tokenId("gold") ?? -1;
const MANPOWER = tokenId("manpower") ?? -1;
const SAILORS = tokenId("sailors") ?? -1;
const STABILITY = tokenId("stability") ?? -1;
const PRESTIGE = tokenId("prestige") ?? -1;
const COUNTRY_NAME = tokenId("country_name") ?? -1;
const SCORE = tokenId("score") ?? -1;
const SCORE_PLACE = tokenId("score_place") ?? -1;
const GREAT_POWER_RANK = tokenId("great_power_rank") ?? -1;

/** FIXED5 value token range. */
const isFixed5 = (tok: number): boolean =>
  (tok >= 0x0d48 && tok <= 0x0d4e) || (tok >= 0x0d4f && tok <= 0x0d55);

/** Read a FIXED5 value from the data buffer and advance position. */
export const readFixed5 = (
  data: Uint8Array,
  pos: number,
  tok: number,
): number => {
  const size = tok >= 0x0d48 && tok <= 0x0d4e
    ? tok - 0x0d48 + 1
    : tok - 0x0d4f + 1;
  let val = 0;
  for (let i = 0; i < size; i++) {
    val |= data[pos + i] << (i * 8);
  }
  return val / 1000;
};

/** Default empty economy. */
export const emptyEconomy = (): CountryEconomy => ({
  gold: 0,
  manpower: 0,
  sailors: 0,
  stability: 0,
  prestige: 0,
  countryName: "",
  score: 0,
});

// =============================================================================
// Currency data reader
// =============================================================================

/**
 * Read currency_data block contents.
 * Structure: field = FIXED5_value (no braces around individual values).
 */
const readCurrencyData = (
  r: TokenReader,
  data: Uint8Array,
): Pick<CountryEconomy, "gold" | "manpower" | "sailors" | "stability" | "prestige"> => {
  let gold = 0;
  let manpower = 0;
  let sailors = 0;
  let stability = 0;
  let prestige = 0;

  let depth = 1;
  while (!r.done && depth > 0) {
    const tok = r.readToken();
    if (tok === BinaryToken.CLOSE) { depth--; continue; }
    else if (tok === BinaryToken.OPEN) { depth++; continue; }
    else if (tok === BinaryToken.EQUAL) { continue; }
    else if (isValueToken(tok) && depth === 1) {
      r.skipValuePayload(tok);
      continue;
    } else if (isValueToken(tok)) {
      r.skipValuePayload(tok);
      continue;
    } else {
      /* field name token */
    }

    if (depth === 1 && r.peekToken() === BinaryToken.EQUAL) {
      const fieldTok = tok;
      r.readToken(); // =
      const valTok = r.peekToken();
      if (isFixed5(valTok)) {
        r.readToken();
        const size = valuePayloadSize(valTok, data, r.pos);
        const val = readFixed5(data, r.pos, valTok);
        r.pos += size;

        if (fieldTok === GOLD) { gold = val; }
        else if (fieldTok === MANPOWER) { manpower = val; }
        else if (fieldTok === SAILORS) { sailors = val; }
        else if (fieldTok === STABILITY) { stability = val; }
        else if (fieldTok === PRESTIGE) { prestige = val; }
        else { /* other currency field — skip */ }
      } else {
        r.skipValue();
      }
    } else {
      /* not a field assignment at depth 1 */
    }
  }

  return { gold, manpower, sailors, stability, prestige };
};

// =============================================================================
// Country economy reader
// =============================================================================

/**
 * Read economy data for all countries from the database section.
 * Call this after readCountries has populated countryTags.
 */
export const readCountryEconomies = (
  r: TokenReader,
  data: Uint8Array,
  countryTags: Readonly<Record<number, string>>,
): Record<string, CountryEconomy> => {
  const result: Record<string, CountryEconomy> = {};

  while (!r.done) {
    const tok = r.peekToken();
    if (tok === BinaryToken.CLOSE) { r.readToken(); return result; }

    if (tok === BinaryToken.I32 || tok === BinaryToken.U32) {
      r.readToken();
      const id = tok === BinaryToken.I32 ? r.readI32() : r.readU32();
      r.expectEqual();
      if (!r.expectOpen()) { r.skipValue(); continue; }

      const tag = countryTags[id] ?? "";
      if (tag === "") { r.skipBlock(); continue; }

      // Two-pass: find field offsets
      const entryStart = r.pos;
      r.skipBlock();
      const entryEnd = r.pos;

      r.pos = entryStart;
      let depth = 1;
      let currencyOffset = -1;
      let nameOffset = -1;
      let scoreOffset = -1;
      let gpRankOffset = -1;

      while (r.pos < entryEnd && depth > 0) {
        const fp = r.pos;
        const ft = r.readToken();
        if (ft === BinaryToken.CLOSE) { depth--; continue; }
        else if (ft === BinaryToken.OPEN) { depth++; continue; }
        else if (ft === BinaryToken.EQUAL) { continue; }
        else if (isValueToken(ft)) { r.skipValuePayload(ft); continue; }
        else {
          /* field name */
        }

        if (depth === 1 && r.peekToken() === BinaryToken.EQUAL) {
          if (ft === CURRENCY_DATA) { currencyOffset = fp; }
          else if (ft === COUNTRY_NAME) { nameOffset = fp; }
          else if (ft === SCORE) { scoreOffset = fp; }
          else if (ft === GREAT_POWER_RANK) { gpRankOffset = fp; }
          else { /* other field */ }
          r.readToken();
          r.skipValue();
        }
      }

      // Pass 2: read values
      let economy = emptyEconomy();

      if (currencyOffset >= 0) {
        r.pos = currencyOffset;
        r.readToken(); r.expectEqual(); r.expectOpen();
        const currencies = readCurrencyData(r, data);
        economy = { ...economy, ...currencies };
      }

      if (nameOffset >= 0) {
        r.pos = nameOffset;
        r.readToken(); r.expectEqual();
        // country_name is a block: { name_token = "value" ... }
        if (r.expectOpen()) {
          // First string value is the name
          const nameVal = r.readStringValue() ?? "";
          economy = { ...economy, countryName: nameVal !== "" ? nameVal : tag };
          r.skipBlock();
        } else {
          const nameVal = r.readStringValue() ?? "";
          economy = { ...economy, countryName: nameVal !== "" ? nameVal : tag };
        }
      } else {
        economy = { ...economy, countryName: tag };
      }

      if (gpRankOffset >= 0) {
        r.pos = gpRankOffset;
        r.readToken(); r.expectEqual();
        const rank = r.readIntValue() ?? 0;
        economy = { ...economy, score: rank };
      } else if (scoreOffset >= 0) {
        r.pos = scoreOffset;
        r.readToken(); r.expectEqual();
        if (r.expectOpen()) {
          // score block — look for score_place
          let sd = 1;
          while (!r.done && sd > 0) {
            const st = r.readToken();
            if (st === BinaryToken.CLOSE) { sd--; continue; }
            else if (st === BinaryToken.OPEN) { sd++; continue; }
            else if (st === BinaryToken.EQUAL) { continue; }
            else if (isValueToken(st)) { r.skipValuePayload(st); continue; }
            else if (sd === 1 && st === SCORE_PLACE && r.peekToken() === BinaryToken.EQUAL) {
              r.readToken();
              const rank = r.readIntValue() ?? 0;
              economy = { ...economy, score: rank };
            } else if (r.peekToken() === BinaryToken.EQUAL) {
              r.readToken(); r.skipValue();
            } else {
              /* other */
            }
          }
        }
      }

      result[tag] = economy;
      r.pos = entryEnd;
    } else {
      r.readToken();
      if (r.peekToken() === BinaryToken.EQUAL) { r.readToken(); r.skipValue(); }
    }
  }

  return result;
};
