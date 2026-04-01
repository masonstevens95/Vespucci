/**
 * Country identity fields: name, level, government type, court language, score.
 *
 * All functions are pure arrow expressions with immutable variables.
 * No null, no exceptions, every if has an else.
 */

import { TokenReader } from "../token-reader";
import { BinaryToken, isValueToken } from "../tokens";
import { tokenId } from "../token-names";

// =============================================================================
// Types
// =============================================================================

export interface CountryIdentity {
  readonly countryName: string;
  readonly level: number;
  readonly govType: string;
  readonly courtLanguage: string;
  readonly score: number;
}

// =============================================================================
// Token IDs
// =============================================================================

const COUNTRY_NAME = tokenId("country_name") ?? -1;
const LEVEL = tokenId("level") ?? -1;
const GOVERNMENT = tokenId("government") ?? -1;
const TYPE_ENGINE = 0x00e1;
const COURT_LANG = tokenId("court_language") ?? -1;
const SCORE = tokenId("score") ?? -1;
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
  score: 0,
});

// =============================================================================
// Field IDs for offset scanning
// =============================================================================

export const IDENTITY_FIELDS = {
  COUNTRY_NAME,
  LEVEL,
  GOVERNMENT,
  COURT_LANG,
  SCORE,
  GREAT_POWER_RANK,
} as const;

// =============================================================================
// Readers
// =============================================================================

/** Read identity fields from discovered offsets. */
export const readIdentityAtOffsets = (
  r: TokenReader,
  tag: string,
  offsets: {
    readonly nameOffset: number;
    readonly levelOffset: number;
    readonly govOffset: number;
    readonly courtLangOffset: number;
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

  // Government type
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
        else if (gd === 1 && gt === TYPE_ENGINE && r.peekToken() === BinaryToken.EQUAL) {
          r.readToken();
          const govStr = r.readStringValue() ?? "";
          identity = { ...identity, govType: govStr };
        } else if (r.peekToken() === BinaryToken.EQUAL) {
          r.readToken(); r.skipValue();
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
