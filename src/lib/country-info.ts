/**
 * Country info helpers for the detail modal.
 *
 * All functions are pure with immutable variables.
 * No null, no exceptions, every if has an else.
 */

import type { ParsedSave, RGB, CountryEconomyStats, RgoProductionEntry } from "./types";
import { rgbToHex } from "./colors";

// =============================================================================
// Types
// =============================================================================

export type CountryStats = CountryEconomyStats;

export interface CountryInfo {
  readonly tag: string;
  readonly displayName: string;
  readonly players: readonly string[];
  readonly color: string;
  readonly provinceCount: number;
  readonly overlord: string;
  readonly subjects: readonly string[];
  readonly stats: CountryStats;
  readonly production: Readonly<Record<string, RgoProductionEntry>>;
}

// =============================================================================
// Pure helpers
// =============================================================================

/** Format a country_name string for display (replace underscores, title case). */
export const formatCountryName = (raw: string): string =>
  raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Find the overlord tag for a given country, or empty string. */
export const findOverlord = (
  tag: string,
  overlordSubjects: Readonly<Record<string, Set<string>>>,
): string => {
  for (const [overlord, subjects] of Object.entries(overlordSubjects)) {
    if (subjects.has(tag)) {
      return overlord;
    }
  }
  return "";
};

/** Get the subject tags for a country. */
export const getSubjects = (
  tag: string,
  overlordSubjects: Readonly<Record<string, Set<string>>>,
): readonly string[] =>
  overlordSubjects[tag]
    ? [...overlordSubjects[tag]]
    : [];

const EMPTY_STATS: CountryStats = {
  gold: 0, stability: 0, prestige: 0, monthlyIncome: 0, monthlyTradeValue: 0, population: 0,
  infantry: 0, cavalry: 0, artillery: 0,
  infantryStr: 0, cavalryStr: 0, artilleryStr: 0,
  levyInfantry: 0, levyCavalry: 0,
  levyInfantryStr: 0, levyCavalryStr: 0,
  heavyShips: 0, lightShips: 0, galleys: 0, transports: 0,
  armyFrontage: 0, navyFrontage: 0,
  maxManpower: 0, maxSailors: 0, monthlyManpower: 0, monthlySailors: 0,
  armyMaintenance: 0, navyMaintenance: 0,
  expectedArmySize: 0, expectedNavySize: 0,
  inflation: 0, stabilityInvestment: 0, legitimacy: 0,
  republicanTradition: 0, hordeUnity: 0, devotion: 0, tribalCohesion: 0,
  governmentPower: 0, karma: 0, religiousInfluence: 0, purity: 0, righteousness: 0,
  diplomaticCapacity: 0,
  diplomaticReputation: 0, warExhaustion: 0, powerProjection: 0, libertyDesire: 0,
  greatPowerScore: 0, numAllies: 0, militaryTactics: 0,
  armyTradition: 0, navyTradition: 0,
  monthlyGoldIncome: 0, monthlyGoldExpense: 0, monthlyPrestige: 0, prestigeDecay: 0,
  totalDevelopment: 0, numProvinces: 0,
  institutions: [],
  societalValues: { centralization: 0, innovative: 0, humanist: 0, plutocracy: 0, freeSubjects: 0, freeTrade: 0, conciliatory: 0, quantity: 0, defensive: 0, naval: 0, traditionalEconomy: 0, communalism: 0, inward: 0, liberalism: 0, jurisprudence: 0, unsinicized: 0 },
  courtLanguage: "", govType: "", primaryCulture: "", religion: "", score: 0,
  estates: [],
};

/** Build a CountryInfo from parsed save data for a given tag. */
export const buildCountryInfo = (
  tag: string,
  parsed: ParsedSave,
  provinceCount: number,
): CountryInfo => {
  const displayName = parsed.countryNames[tag] ?? tag;
  const players = parsed.tagToPlayers[tag] ?? [];
  const rgb: RGB = parsed.countryColors[tag] ?? [128, 128, 128];
  const color = rgbToHex(rgb[0], rgb[1], rgb[2]);
  const overlord = findOverlord(tag, parsed.overlordSubjects);
  const subjects = getSubjects(tag, parsed.overlordSubjects);
  const stats: CountryStats = parsed.countryStats[tag] ?? EMPTY_STATS;
  const production: Readonly<Record<string, RgoProductionEntry>> =
    parsed.countryProduction[tag] ?? {};

  return {
    tag,
    displayName,
    players,
    color,
    provinceCount,
    overlord,
    subjects,
    stats,
    production,
  };
};

/** Resolve a display label for a tag (name or tag if no name). */
export const resolveDisplayName = (
  tag: string,
  countryNames: Readonly<Record<string, string>>,
): string =>
  countryNames[tag] ?? tag;
