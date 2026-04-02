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
import { tokenId } from "../token-names";
import { readFixed5AtOffset } from "./fixed5";

// Politics / territory / extra tokens (depth-1 scalar fields)
const POLITICS_TOKENS = {
  DIPLOMATIC_REPUTATION: tokenId("diplomatic_reputation") ?? -1,
  WAR_EXHAUSTION: tokenId("war_exhaustion") ?? -1,
  POWER_PROJECTION: tokenId("power_projection") ?? -1,
  TOTAL_DEVELOPMENT: tokenId("total_development") ?? -1,
  NUM_PROVINCES: tokenId("num_provinces") ?? -1,
  LIBERTY_DESIRE: tokenId("liberty_desire") ?? -1,
  STABILITY_INVESTMENT: tokenId("stability_investment") ?? -1,
  LEGITIMACY: tokenId("legitimacy") ?? -1,
  LEGITIMACY_PCT: tokenId("legitimacy_percentage") ?? -1,
  GREAT_POWER_SCORE: tokenId("great_power_score") ?? -1,
  NUM_OF_ALLIES: tokenId("num_of_allies") ?? -1,
  ARMY_TRADITION: tokenId("army_tradition") ?? -1,
  NAVY_TRADITION: tokenId("navy_tradition") ?? -1,
  MONTHLY_GOLD_INCOME: tokenId("monthly_gold_income") ?? -1,
  MONTHLY_GOLD_EXPENSE: tokenId("monthly_gold_expense") ?? -1,
  MONTHLY_PRESTIGE: tokenId("monthly_prestige") ?? -1,
  PRESTIGE_DECAY: tokenId("prestige_decay") ?? -1,
} as const;

export interface PoliticsStats {
  readonly diplomaticReputation: number;
  readonly warExhaustion: number;
  readonly powerProjection: number;
  readonly totalDevelopment: number;
  readonly numProvinces: number;
  readonly libertyDesire: number;
  readonly stabilityInvestment: number;
  readonly legitimacy: number;
  readonly greatPowerScore: number;
  readonly numAllies: number;
  readonly armyTradition: number;
  readonly navyTradition: number;
  readonly monthlyGoldIncome: number;
  readonly monthlyGoldExpense: number;
  readonly monthlyPrestige: number;
  readonly prestigeDecay: number;
}

export const emptyPoliticsStats = (): PoliticsStats => ({
  diplomaticReputation: 0, warExhaustion: 0, powerProjection: 0,
  totalDevelopment: 0, numProvinces: 0, libertyDesire: 0, stabilityInvestment: 0, legitimacy: 0,
  greatPowerScore: 0, numAllies: 0, armyTradition: 0, navyTradition: 0,
  monthlyGoldIncome: 0, monthlyGoldExpense: 0, monthlyPrestige: 0, prestigeDecay: 0,
});

// =============================================================================
// Types
// =============================================================================

export interface CountryData {
  readonly identity: CountryIdentity;
  readonly economy: EconomyStats;
  readonly military: MilitaryStats;
  readonly politics: PoliticsStats;
}

// =============================================================================
// Defaults
// =============================================================================

export const emptyCountryData = (): CountryData => ({
  identity: emptyIdentity(),
  economy: emptyEconomyStats(),
  military: emptyMilitaryStats(),
  politics: emptyPoliticsStats(),
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
      let cultureOffset = -1;
      let religionOffset = -1;
      let scoreOffset = -1;
      let gpRankOffset = -1;

      // Economy offsets
      let currencyOffset = -1;
      let incomeOffset = -1;
      let tradeOffset = -1;
      let taxOffset = -1;
      let popOffset = -1;

      // Politics offsets
      let dipRepOffset = -1;
      let warExhOffset = -1;
      let pwrProjOffset = -1;
      let totalDevOffset = -1;
      let numProvOffset = -1;
      let libDesOffset = -1;
      let stabInvOffset = -1;
      let legitimacyOffset = -1;
      let gpScoreOffset = -1;
      let numAlliesOffset = -1;
      let armyTradOffset = -1;
      let navyTradOffset = -1;
      let goldIncOffset = -1;
      let goldExpOffset = -1;
      let mPrestigeOffset = -1;
      let prestDecayOffset = -1;

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
          else if (ft === IDENTITY_FIELDS.PRIMARY_CULTURE) { cultureOffset = fp; }
          else if (ft === IDENTITY_FIELDS.RELIGION) { religionOffset = fp; }
          else if (ft === IDENTITY_FIELDS.SCORE) { scoreOffset = fp; }
          else if (ft === IDENTITY_FIELDS.GREAT_POWER_RANK) { gpRankOffset = fp; }
          // Economy fields
          else if (ft === ECONOMY_TOKENS.CURRENCY_DATA) { currencyOffset = fp; }
          else if (ft === ECONOMY_TOKENS.EST_MONTHLY_INCOME) { incomeOffset = fp; }
          else if (ft === ECONOMY_TOKENS.MONTHLY_TRADE_VALUE) { tradeOffset = fp; }
          else if (ft === ECONOMY_TOKENS.LAST_MONTHS_TAX) { taxOffset = fp; }
          else if (ft === ECONOMY_TOKENS.LAST_MONTHS_POP) { popOffset = fp; }
          // Politics fields
          else if (ft === POLITICS_TOKENS.DIPLOMATIC_REPUTATION) { dipRepOffset = fp; }
          else if (ft === POLITICS_TOKENS.WAR_EXHAUSTION) { warExhOffset = fp; }
          else if (ft === POLITICS_TOKENS.POWER_PROJECTION) { pwrProjOffset = fp; }
          else if (ft === POLITICS_TOKENS.TOTAL_DEVELOPMENT) { totalDevOffset = fp; }
          else if (ft === POLITICS_TOKENS.NUM_PROVINCES) { numProvOffset = fp; }
          else if (ft === POLITICS_TOKENS.LIBERTY_DESIRE) { libDesOffset = fp; }
          else if (ft === POLITICS_TOKENS.STABILITY_INVESTMENT) { stabInvOffset = fp; }
          else if (ft === POLITICS_TOKENS.LEGITIMACY_PCT) { legitimacyOffset = fp; }
          else if (ft === POLITICS_TOKENS.LEGITIMACY && legitimacyOffset < 0) { legitimacyOffset = fp; }
          else if (ft === POLITICS_TOKENS.GREAT_POWER_SCORE) { gpScoreOffset = fp; }
          else if (ft === POLITICS_TOKENS.NUM_OF_ALLIES) { numAlliesOffset = fp; }
          else if (ft === POLITICS_TOKENS.ARMY_TRADITION) { armyTradOffset = fp; }
          else if (ft === POLITICS_TOKENS.NAVY_TRADITION) { navyTradOffset = fp; }
          else if (ft === POLITICS_TOKENS.MONTHLY_GOLD_INCOME) { goldIncOffset = fp; }
          else if (ft === POLITICS_TOKENS.MONTHLY_GOLD_EXPENSE) { goldExpOffset = fp; }
          else if (ft === POLITICS_TOKENS.MONTHLY_PRESTIGE) { mPrestigeOffset = fp; }
          else if (ft === POLITICS_TOKENS.PRESTIGE_DECAY) { prestDecayOffset = fp; }
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
        nameOffset, levelOffset, govOffset, courtLangOffset, cultureOffset, religionOffset, scoreOffset, gpRankOffset,
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

      const politics: PoliticsStats = {
        diplomaticReputation: readFixed5AtOffset(r, data, dipRepOffset),
        warExhaustion: readFixed5AtOffset(r, data, warExhOffset),
        powerProjection: readFixed5AtOffset(r, data, pwrProjOffset),
        totalDevelopment: readFixed5AtOffset(r, data, totalDevOffset),
        numProvinces: readFixed5AtOffset(r, data, numProvOffset),
        libertyDesire: readFixed5AtOffset(r, data, libDesOffset),
        stabilityInvestment: readFixed5AtOffset(r, data, stabInvOffset),
        legitimacy: readFixed5AtOffset(r, data, legitimacyOffset),
        greatPowerScore: readFixed5AtOffset(r, data, gpScoreOffset),
        numAllies: readFixed5AtOffset(r, data, numAlliesOffset),
        armyTradition: readFixed5AtOffset(r, data, armyTradOffset),
        navyTradition: readFixed5AtOffset(r, data, navyTradOffset),
        monthlyGoldIncome: readFixed5AtOffset(r, data, goldIncOffset),
        monthlyGoldExpense: readFixed5AtOffset(r, data, goldExpOffset),
        monthlyPrestige: readFixed5AtOffset(r, data, mPrestigeOffset),
        prestigeDecay: readFixed5AtOffset(r, data, prestDecayOffset),
      };

      result[tag] = { identity, economy, military, politics };
      r.pos = entryEnd;
    } else {
      r.readToken();
      if (r.peekToken() === BinaryToken.EQUAL) { r.readToken(); r.skipValue(); }
    }
  }

  return result;
};
