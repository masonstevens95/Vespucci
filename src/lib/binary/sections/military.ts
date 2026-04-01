/**
 * Military stats reader — force limits, manpower, sailors, maintenance.
 *
 * Note: actual army/navy sizes and traditions are nested inside sub-blocks
 * (units, army, navy) and require deeper parsing. Currently we read
 * the top-level aggregate fields available at depth 1 of each country entry.
 *
 * All functions are pure arrow expressions with immutable variables.
 * No null, no exceptions, every if has an else.
 */

import { tokenId } from "../token-names";
import { readFixed5AtOffset } from "./fixed5";

// =============================================================================
// Types
// =============================================================================

export interface MilitaryStats {
  readonly maxManpower: number;
  readonly maxSailors: number;
  readonly monthlyManpower: number;
  readonly monthlySailors: number;
  readonly armyMaintenance: number;
  readonly navyMaintenance: number;
  readonly expectedArmySize: number;
  readonly expectedNavySize: number;
}

// =============================================================================
// Token IDs
// =============================================================================

export const MILITARY_TOKENS = {
  MAX_MANPOWER: tokenId("max_manpower") ?? -1,
  MAX_SAILORS: tokenId("max_sailors") ?? -1,
  MONTHLY_MANPOWER: tokenId("monthly_manpower") ?? -1,
  MONTHLY_SAILORS: tokenId("monthly_sailors") ?? -1,
  ARMY_MAINT: tokenId("last_months_army_maintenance") ?? -1,
  NAVY_MAINT: tokenId("last_months_navy_maintenance") ?? -1,
  EXPECTED_ARMY: tokenId("expected_army_size") ?? -1,
  EXPECTED_NAVY: tokenId("expected_navy_size") ?? -1,
} as const;

// =============================================================================
// Defaults
// =============================================================================

export const emptyMilitaryStats = (): MilitaryStats => ({
  maxManpower: 0, maxSailors: 0, monthlyManpower: 0, monthlySailors: 0,
  armyMaintenance: 0, navyMaintenance: 0,
  expectedArmySize: 0, expectedNavySize: 0,
});

// =============================================================================
// Offsets
// =============================================================================

export interface MilitaryOffsets {
  readonly maxMpOffset: number;
  readonly maxSailOffset: number;
  readonly monthlyMpOffset: number;
  readonly monthlySailOffset: number;
  readonly armyMaintOffset: number;
  readonly navyMaintOffset: number;
  readonly expArmyOffset: number;
  readonly expNavyOffset: number;
}

export const emptyMilitaryOffsets = (): MilitaryOffsets => ({
  maxMpOffset: -1, maxSailOffset: -1, monthlyMpOffset: -1, monthlySailOffset: -1,
  armyMaintOffset: -1, navyMaintOffset: -1,
  expArmyOffset: -1, expNavyOffset: -1,
});

// =============================================================================
// Reader
// =============================================================================

/** Read military stats from discovered field offsets. */
export const readMilitaryAtOffsets = (
  r: { pos: number; readToken: () => number; expectEqual: () => boolean },
  data: Uint8Array,
  offsets: MilitaryOffsets,
): MilitaryStats => ({
  maxManpower: readFixed5AtOffset(r, data, offsets.maxMpOffset),
  maxSailors: readFixed5AtOffset(r, data, offsets.maxSailOffset),
  monthlyManpower: readFixed5AtOffset(r, data, offsets.monthlyMpOffset),
  monthlySailors: readFixed5AtOffset(r, data, offsets.monthlySailOffset),
  armyMaintenance: readFixed5AtOffset(r, data, offsets.armyMaintOffset),
  navyMaintenance: readFixed5AtOffset(r, data, offsets.navyMaintOffset),
  expectedArmySize: readFixed5AtOffset(r, data, offsets.expArmyOffset),
  expectedNavySize: readFixed5AtOffset(r, data, offsets.expNavyOffset),
});
