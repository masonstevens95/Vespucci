/**
 * Country database orchestrator — two-pass scan per country entry,
 * delegates to identity, economy, and military readers.
 *
 * All functions are pure arrow expressions with immutable variables.
 * No null, no exceptions, every if has an else.
 */

import { TokenReader } from "../token-reader";
import { BinaryToken, isValueToken } from "../tokens";
import { IDENTITY_FIELDS, readIdentityAtOffsets, emptyIdentity } from "./country-identity";
import type { CountryIdentity } from "./country-identity";
import { ECONOMY_TOKENS, readEconomyAtOffsets, emptyEconomyStats } from "./economy";
import type { EconomyStats, EconomyOffsets } from "./economy";
import { MILITARY_TOKENS, readMilitaryAtOffsets, emptyMilitaryStats } from "./military";
import type { MilitaryStats, MilitaryOffsets } from "./military";

// =============================================================================
// Types
// =============================================================================

export interface CountryData {
  readonly identity: CountryIdentity;
  readonly economy: EconomyStats;
  readonly military: MilitaryStats;
}

// =============================================================================
// Defaults
// =============================================================================

export const emptyCountryData = (): CountryData => ({
  identity: emptyIdentity(),
  economy: emptyEconomyStats(),
  military: emptyMilitaryStats(),
});

// =============================================================================
// Main reader
// =============================================================================

/**
 * Read all country data from the database section.
 * Single two-pass scan per country: find offsets, then read values.
 */
export const readCountryDatabase = (
  r: TokenReader,
  data: Uint8Array,
  countryTags: Readonly<Record<number, string>>,
): Record<string, CountryData> => {
  const result: Record<string, CountryData> = {};

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

      // Pass 1: find field offsets
      const entryStart = r.pos;
      r.skipBlock();
      const entryEnd = r.pos;

      r.pos = entryStart;
      let depth = 1;

      // Identity offsets
      let nameOffset = -1;
      let levelOffset = -1;
      let govOffset = -1;
      let courtLangOffset = -1;
      let scoreOffset = -1;
      let gpRankOffset = -1;

      // Economy offsets
      let currencyOffset = -1;
      let incomeOffset = -1;
      let tradeOffset = -1;
      let taxOffset = -1;
      let popOffset = -1;

      // Military offsets
      let maxMpOffset = -1;
      let maxSailOffset = -1;
      let monthlyMpOffset = -1;
      let monthlySailOffset = -1;
      let armyMaintOffset = -1;
      let navyMaintOffset = -1;
      let expArmyOffset = -1;
      let expNavyOffset = -1;

      while (r.pos < entryEnd && depth > 0) {
        const fp = r.pos;
        const ft = r.readToken();
        if (ft === BinaryToken.CLOSE) { depth--; continue; }
        else if (ft === BinaryToken.OPEN) { depth++; continue; }
        else if (ft === BinaryToken.EQUAL) { continue; }
        else if (isValueToken(ft)) { r.skipValuePayload(ft); continue; }
        else { /* field name */ }

        if (depth === 1 && r.peekToken() === BinaryToken.EQUAL) {
          // Identity fields
          if (ft === IDENTITY_FIELDS.COUNTRY_NAME) { nameOffset = fp; }
          else if (ft === IDENTITY_FIELDS.LEVEL) { levelOffset = fp; }
          else if (ft === IDENTITY_FIELDS.GOVERNMENT) { govOffset = fp; }
          else if (ft === IDENTITY_FIELDS.COURT_LANG) { courtLangOffset = fp; }
          else if (ft === IDENTITY_FIELDS.SCORE) { scoreOffset = fp; }
          else if (ft === IDENTITY_FIELDS.GREAT_POWER_RANK) { gpRankOffset = fp; }
          // Economy fields
          else if (ft === ECONOMY_TOKENS.CURRENCY_DATA) { currencyOffset = fp; }
          else if (ft === ECONOMY_TOKENS.EST_MONTHLY_INCOME) { incomeOffset = fp; }
          else if (ft === ECONOMY_TOKENS.MONTHLY_TRADE_VALUE) { tradeOffset = fp; }
          else if (ft === ECONOMY_TOKENS.LAST_MONTHS_TAX) { taxOffset = fp; }
          else if (ft === ECONOMY_TOKENS.LAST_MONTHS_POP) { popOffset = fp; }
          // Military fields
          else if (ft === MILITARY_TOKENS.MAX_MANPOWER) { maxMpOffset = fp; }
          else if (ft === MILITARY_TOKENS.MAX_SAILORS) { maxSailOffset = fp; }
          else if (ft === MILITARY_TOKENS.MONTHLY_MANPOWER) { monthlyMpOffset = fp; }
          else if (ft === MILITARY_TOKENS.MONTHLY_SAILORS) { monthlySailOffset = fp; }
          else if (ft === MILITARY_TOKENS.ARMY_MAINT) { armyMaintOffset = fp; }
          else if (ft === MILITARY_TOKENS.NAVY_MAINT) { navyMaintOffset = fp; }
          else if (ft === MILITARY_TOKENS.EXPECTED_ARMY) { expArmyOffset = fp; }
          else if (ft === MILITARY_TOKENS.EXPECTED_NAVY) { expNavyOffset = fp; }
          else { /* other field */ }
          r.readToken();
          r.skipValue();
        }
      }

      // Pass 2: read values using domain-specific readers
      const identity = readIdentityAtOffsets(r, tag, {
        nameOffset, levelOffset, govOffset, courtLangOffset, scoreOffset, gpRankOffset,
      });

      const econOffsets: EconomyOffsets = {
        currencyOffset, incomeOffset, tradeOffset, taxOffset, popOffset,
      };
      const economy = readEconomyAtOffsets(r, data, econOffsets);

      const milOffsets: MilitaryOffsets = {
        maxMpOffset, maxSailOffset, monthlyMpOffset, monthlySailOffset,
        armyMaintOffset, navyMaintOffset, expArmyOffset, expNavyOffset,
      };
      const military = readMilitaryAtOffsets(r, data, milOffsets);

      result[tag] = { identity, economy, military };
      r.pos = entryEnd;
    } else {
      r.readToken();
      if (r.peekToken() === BinaryToken.EQUAL) { r.readToken(); r.skipValue(); }
    }
  }

  return result;
};
