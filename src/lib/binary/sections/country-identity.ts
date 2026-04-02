/**
 * Country identity fields: name, level, government type, court language, score.
 *
 * All functions are pure arrow expressions with immutable variables.
 * No null, no exceptions, every if has an else.
 */

import { TokenReader } from "../token-reader";
import { BinaryToken, isValueToken, valuePayloadSize } from "../tokens";
import { tokenId } from "../token-names";
import { isFixed5, readFixed5 } from "./fixed5";

/** Read a numeric value that may be FIXED5, I32, U32, or F32. */
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
// Types
// =============================================================================

/**
 * 16 societal value axes (0-100 scale). Each represents a policy spectrum.
 * Stored inside government > societal_values as FIXED5 (0-10000 = 0-100%).
 * Token IDs are in the unmapped gap — read by position order.
 */
export interface SocietalValues {
  readonly centralization: number;
  readonly innovative: number;
  readonly humanist: number;
  readonly plutocracy: number;
  readonly freeSubjects: number;
  readonly freeTrade: number;
  readonly conciliatory: number;
  readonly quantity: number;
  readonly defensive: number;
  readonly naval: number;
  readonly traditionalEconomy: number;
  readonly communalism: number;
  readonly inward: number;
  readonly liberalism: number;
  readonly jurisprudence: number;
  readonly unsinicized: number;
}

export const emptySocietalValues = (): SocietalValues => ({
  centralization: 0, innovative: 0, humanist: 0, plutocracy: 0,
  freeSubjects: 0, freeTrade: 0, conciliatory: 0, quantity: 0,
  defensive: 0, naval: 0, traditionalEconomy: 0, communalism: 0,
  inward: 0, liberalism: 0, jurisprudence: 0, unsinicized: 0,
});

/** Ordered keys matching the binary storage order of societal value axes. */
const SOCIETAL_KEYS: readonly (keyof SocietalValues)[] = [
  "centralization", "innovative", "humanist", "plutocracy",
  "freeSubjects", "freeTrade", "conciliatory", "quantity",
  "defensive", "naval", "traditionalEconomy", "communalism",
  "inward", "liberalism", "jurisprudence", "unsinicized",
];

export interface CountryIdentity {
  readonly countryName: string;
  readonly level: number;
  readonly govType: string;
  readonly courtLanguage: string;
  readonly primaryCulture: string;
  readonly religion: string;
  readonly score: number;
  readonly institutions: readonly string[];
  readonly societalValues: SocietalValues;
  // Legitimacy values extracted from inside government { ... } block
  readonly govLegitimacy: number;
  readonly govRepublicanTradition: number;
  readonly govHordeUnity: number;
  readonly govDevotion: number;
  readonly govTribalCohesion: number;
}

// =============================================================================
// Token IDs
// =============================================================================

const COUNTRY_NAME = tokenId("country_name") ?? -1;
const LEVEL = tokenId("level") ?? -1;
const GOVERNMENT = tokenId("government") ?? -1;
const TYPE_ENGINE = 0x00e1;
const SOCIETAL_VALUES = tokenId("societal_values") ?? -1;
const SOCIETAL_VALUE = tokenId("societal_value") ?? -1; // singular variant
const SOCIETAL_VALUE_PROGRESS = tokenId("societal_value_progress") ?? -1; // another candidate
const INSTITUTIONS = tokenId("institutions") ?? -1;
const COURT_LANG = tokenId("court_language") ?? -1;
const PRIMARY_CULTURE = tokenId("primary_culture") ?? -1;
const RELIGION = tokenId("religion") ?? -1;
const SCORE = tokenId("score") ?? -1;

// Legitimacy tokens — may live inside government { ... } block
const GOV_LEGITIMACY = tokenId("legitimacy") ?? -1;
const GOV_LEGITIMACY_PCT = tokenId("legitimacy_percentage") ?? -1;
const GOV_REPUBLICAN_TRADITION = tokenId("republican_tradition") ?? -1;
const GOV_HORDE_UNITY = tokenId("horde_unity") ?? -1;
const GOV_DEVOTION = tokenId("devotion") ?? -1;
const GOV_TRIBAL_COHESION = tokenId("tribal_cohesion") ?? -1;
const SCORE_PLACE = tokenId("score_place") ?? -1;
const GREAT_POWER_RANK = tokenId("great_power_rank") ?? -1;

// =============================================================================
// Default
// =============================================================================

export const emptyIdentity = (): CountryIdentity => ({
  countryName: "",
  level: -1,
  govType: "",
  courtLanguage: "",
  primaryCulture: "",
  religion: "",
  score: 0,
  institutions: [],
  societalValues: emptySocietalValues(),
  govLegitimacy: 0,
  govRepublicanTradition: 0,
  govHordeUnity: 0,
  govDevotion: 0,
  govTribalCohesion: 0,
});

// =============================================================================
// Field IDs for offset scanning
// =============================================================================

export const IDENTITY_FIELDS = {
  COUNTRY_NAME,
  LEVEL,
  GOVERNMENT,
  INSTITUTIONS,
  SOCIETAL_VALUES,
  SOCIETAL_VALUE,
  SOCIETAL_VALUE_PROGRESS,
  COURT_LANG,
  PRIMARY_CULTURE,
  RELIGION,
  SCORE,
  GREAT_POWER_RANK,
} as const;

// =============================================================================
// Readers
// =============================================================================

/**
 * Read societal_values block: 16 key-value pairs.
 * Keys are unknown token IDs (in the gap) — we read by position order.
 * Each value is FIXED5 (0-10000), divided by 100 to get 0-100 scale.
 */
export const readSocietalValues = (r: TokenReader, data: Uint8Array): SocietalValues => {
  const vals: number[] = [];
  let depth = 1;
  while (!r.done && depth > 0) {
    const peek = r.peekToken();
    if (peek === BinaryToken.CLOSE) { r.readToken(); depth--; continue; }
    else if (peek === BinaryToken.OPEN) { r.readToken(); depth++; continue; }
    else if (peek === BinaryToken.EQUAL) { r.readToken(); continue; }
    // Try reading as a string key (LOOKUP tokens for the axis names)
    const keyStr = r.readStringValue();
    if (keyStr !== null) {
      // Key consumed. Check for = VALUE
      if (r.peekToken() === BinaryToken.EQUAL) {
        r.readToken(); // =
        const val = readNumericVal(r, data);
        vals.push(val / 100); // 0-10000 → 0-100 scale
      } else {
        /* bare key without = — skip */
      }
    } else if (isValueToken(peek)) {
      // Bare value (not a key) — skip it
      r.readToken();
      r.skipValuePayload(peek);
    } else {
      // Unknown game token used as key — check for = VALUE
      r.readToken();
      if (r.peekToken() === BinaryToken.EQUAL) {
        r.readToken(); // =
        const val = readNumericVal(r, data);
        vals.push(val / 100);
      }
    }
  }
  const sv = emptySocietalValues();
  const result = { ...sv };
  for (let i = 0; i < Math.min(vals.length, SOCIETAL_KEYS.length); i++) {
    (result as Record<string, number>)[SOCIETAL_KEYS[i]] = vals[i];
  }
  return result;
};

/** Read identity fields from discovered offsets. */
export const readIdentityAtOffsets = (
  r: TokenReader,
  data: Uint8Array,
  tag: string,
  offsets: {
    readonly nameOffset: number;
    readonly levelOffset: number;
    readonly govOffset: number;
    readonly institutionsOffset: number;
    readonly societalValuesOffset: number;
    readonly courtLangOffset: number;
    readonly cultureOffset: number;
    readonly religionOffset: number;
    readonly scoreOffset: number;
    readonly gpRankOffset: number;
  },
): CountryIdentity => {
  let identity = emptyIdentity();

  // Country name
  if (offsets.nameOffset >= 0) {
    r.pos = offsets.nameOffset;
    r.readToken(); r.expectEqual();
    if (r.expectOpen()) {
      const nameVal = r.readStringValue() ?? "";
      identity = { ...identity, countryName: nameVal !== "" ? nameVal : tag };
      r.skipBlock();
    } else {
      const nameVal = r.readStringValue() ?? "";
      identity = { ...identity, countryName: nameVal !== "" ? nameVal : tag };
    }
  } else {
    identity = { ...identity, countryName: tag };
  }

  // Level
  if (offsets.levelOffset >= 0) {
    r.pos = offsets.levelOffset;
    r.readToken(); r.expectEqual();
    const lvl = r.readIntValue() ?? -1;
    identity = { ...identity, level: lvl };
  }

  // Institutions: { "name" = yes, "name" = yes, ... }
  // Keys are LOOKUP tokens (string indices) — read them as strings
  if (offsets.institutionsOffset >= 0) {
    r.pos = offsets.institutionsOffset;
    r.readToken(); r.expectEqual();
    if (r.expectOpen()) {
      const inst: string[] = [];
      let id = 1;
      while (!r.done && id > 0) {
        const peek = r.peekToken();
        if (peek === BinaryToken.CLOSE) { r.readToken(); id--; continue; }
        else if (peek === BinaryToken.OPEN) { r.readToken(); id++; continue; }
        else if (peek === BinaryToken.EQUAL) { r.readToken(); continue; }
        // Try reading as a string (handles LOOKUP_U8/U16/U24 and QUOTED/UNQUOTED)
        const name = r.readStringValue();
        if (name !== null) {
          if (r.peekToken() === BinaryToken.EQUAL) {
            r.readToken(); // =
            r.skipValue(); // skip the "yes" value
          }
          if (name !== "") { inst.push(name); }
        } else {
          // Not a string token — skip it
          r.readToken();
          if (isValueToken(peek)) { r.skipValuePayload(peek); }
        }
      }
      identity = { ...identity, institutions: inst };
    }
  }

  // Government type + legitimacy + societal values (all inside government { ... } block)
  if (offsets.govOffset >= 0) {
    r.pos = offsets.govOffset;
    r.readToken(); r.expectEqual();
    if (r.expectOpen()) {
      let gd = 1;
      while (!r.done && gd > 0) {
        const gt = r.readToken();
        if (gt === BinaryToken.CLOSE) { gd--; continue; }
        else if (gt === BinaryToken.OPEN) { gd++; continue; }
        else if (gt === BinaryToken.EQUAL) { continue; }
        else if (isValueToken(gt)) { r.skipValuePayload(gt); continue; }
        else if (r.peekToken() === BinaryToken.EQUAL) {
          // Match legitimacy tokens at ANY depth inside government block
          if (gt === GOV_LEGITIMACY || gt === GOV_LEGITIMACY_PCT) {
            r.readToken();
            identity = { ...identity, govLegitimacy: readNumericVal(r, data) };
          } else if (gt === GOV_REPUBLICAN_TRADITION) {
            r.readToken();
            identity = { ...identity, govRepublicanTradition: readNumericVal(r, data) };
          } else if (gt === GOV_HORDE_UNITY) {
            r.readToken();
            identity = { ...identity, govHordeUnity: readNumericVal(r, data) };
          } else if (gt === GOV_DEVOTION) {
            r.readToken();
            identity = { ...identity, govDevotion: readNumericVal(r, data) };
          } else if (gt === GOV_TRIBAL_COHESION) {
            r.readToken();
            identity = { ...identity, govTribalCohesion: readNumericVal(r, data) };
          } else if (gd === 1 && gt === TYPE_ENGINE) {
            r.readToken();
            const govStr = r.readStringValue() ?? "";
            identity = { ...identity, govType: govStr };
          } else if (gd === 1 && gt === SOCIETAL_VALUES) {
            r.readToken(); // =
            if (r.expectOpen()) {
              identity = { ...identity, societalValues: readSocietalValues(r, data) };
            } else { r.skipValue(); }
          } else {
            r.readToken(); r.skipValue();
          }
        } else {
          /* other */
        }
      }
    }
  }

  // Court language
  if (offsets.courtLangOffset >= 0) {
    r.pos = offsets.courtLangOffset;
    r.readToken(); r.expectEqual();
    const lang = r.readStringValue() ?? "";
    identity = { ...identity, courtLanguage: lang };
  }

  // Primary culture
  if (offsets.cultureOffset >= 0) {
    r.pos = offsets.cultureOffset;
    r.readToken(); r.expectEqual();
    const culture = r.readStringValue() ?? "";
    identity = { ...identity, primaryCulture: culture };
  }

  // Religion
  if (offsets.religionOffset >= 0) {
    r.pos = offsets.religionOffset;
    r.readToken(); r.expectEqual();
    const rel = r.readStringValue() ?? "";
    identity = { ...identity, religion: rel };
  }

  // Score / rank
  if (offsets.gpRankOffset >= 0) {
    r.pos = offsets.gpRankOffset;
    r.readToken(); r.expectEqual();
    const rank = r.readIntValue() ?? 0;
    identity = { ...identity, score: rank };
  } else if (offsets.scoreOffset >= 0) {
    r.pos = offsets.scoreOffset;
    r.readToken(); r.expectEqual();
    if (r.expectOpen()) {
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
          identity = { ...identity, score: rank };
        } else if (r.peekToken() === BinaryToken.EQUAL) {
          r.readToken(); r.skipValue();
        } else {
          /* other */
        }
      }
    }
  }

  return identity;
};
