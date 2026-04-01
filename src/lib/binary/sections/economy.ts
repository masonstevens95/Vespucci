/**
 * Economy stats reader — currency data, income, trade, tax, population.
 *
 * All functions are pure arrow expressions with immutable variables.
 * No null, no exceptions, every if has an else.
 */

import { TokenReader } from "../token-reader";
import { BinaryToken, isValueToken, valuePayloadSize } from "../tokens";
import { tokenId } from "../token-names";
import { isFixed5, readFixed5, readFixed5AtOffset } from "./fixed5";

// =============================================================================
// Types
// =============================================================================

export interface EconomyStats {
  readonly gold: number;
  readonly manpower: number;
  readonly sailors: number;
  readonly stability: number;
  readonly prestige: number;
  readonly monthlyIncome: number;
  readonly monthlyTradeValue: number;
  readonly monthlyTaxIncome: number;
  readonly population: number;
}

// =============================================================================
// Token IDs
// =============================================================================

export const ECONOMY_TOKENS = {
  CURRENCY_DATA: tokenId("currency_data") ?? -1,
  GOLD: tokenId("gold") ?? -1,
  MANPOWER: tokenId("manpower") ?? -1,
  SAILORS: tokenId("sailors") ?? -1,
  STABILITY: tokenId("stability") ?? -1,
  PRESTIGE: tokenId("prestige") ?? -1,
  EST_MONTHLY_INCOME: tokenId("estimated_monthly_income") ?? -1,
  MONTHLY_TRADE_VALUE: tokenId("monthly_trade_value") ?? -1,
  LAST_MONTHS_TAX: tokenId("last_months_tax_income") ?? -1,
  LAST_MONTHS_POP: tokenId("last_months_population") ?? -1,
} as const;

// =============================================================================
// Defaults
// =============================================================================

export const emptyEconomyStats = (): EconomyStats => ({
  gold: 0, manpower: 0, sailors: 0, stability: 0, prestige: 0,
  monthlyIncome: 0, monthlyTradeValue: 0, monthlyTaxIncome: 0, population: 0,
});

// =============================================================================
// Offsets
// =============================================================================

export interface EconomyOffsets {
  readonly currencyOffset: number;
  readonly incomeOffset: number;
  readonly tradeOffset: number;
  readonly taxOffset: number;
  readonly popOffset: number;
}

export const emptyEconomyOffsets = (): EconomyOffsets => ({
  currencyOffset: -1, incomeOffset: -1, tradeOffset: -1, taxOffset: -1, popOffset: -1,
});

// =============================================================================
// Currency data reader
// =============================================================================

/**
 * Read currency_data block contents.
 * Structure: field = FIXED5_value (no braces around individual values).
 */
export const readCurrencyData = (
  r: TokenReader,
  data: Uint8Array,
): Pick<EconomyStats, "gold" | "manpower" | "sailors" | "stability" | "prestige"> => {
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
    else if (isValueToken(tok)) {
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

        if (fieldTok === ECONOMY_TOKENS.GOLD) { gold = val; }
        else if (fieldTok === ECONOMY_TOKENS.MANPOWER) { manpower = val; }
        else if (fieldTok === ECONOMY_TOKENS.SAILORS) { sailors = val; }
        else if (fieldTok === ECONOMY_TOKENS.STABILITY) { stability = val; }
        else if (fieldTok === ECONOMY_TOKENS.PRESTIGE) { prestige = val; }
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
// Reader
// =============================================================================

/** Read economy stats from discovered field offsets. */
export const readEconomyAtOffsets = (
  r: TokenReader,
  data: Uint8Array,
  offsets: EconomyOffsets,
): EconomyStats => {
  let econ = emptyEconomyStats();

  if (offsets.currencyOffset >= 0) {
    r.pos = offsets.currencyOffset;
    r.readToken(); r.expectEqual(); r.expectOpen();
    const currencies = readCurrencyData(r, data);
    econ = { ...econ, ...currencies };
  }

  return {
    ...econ,
    monthlyIncome: readFixed5AtOffset(r, data, offsets.incomeOffset),
    monthlyTradeValue: readFixed5AtOffset(r, data, offsets.tradeOffset),
    monthlyTaxIncome: readFixed5AtOffset(r, data, offsets.taxOffset),
    population: readFixed5AtOffset(r, data, offsets.popOffset),
  };
};

// Re-export for backward compatibility
export { readFixed5 } from "./fixed5";
