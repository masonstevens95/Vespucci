/**
 * Country info helpers for the detail modal.
 *
 * All functions are pure with immutable variables.
 * No null, no exceptions, every if has an else.
 */

import type { ParsedSave, RGB, CountryEconomyStats } from "./types";
import { rgbToHex } from "./colors";

// =============================================================================
// Types
// =============================================================================

export interface CountryStats {
  readonly gold: number;
  readonly monthlyIncome: number;
  readonly monthlyTradeValue: number;
  readonly population: number;
  readonly maxManpower: number;
  readonly maxSailors: number;
  readonly expectedArmySize: number;
  readonly expectedNavySize: number;
  readonly courtLanguage: string;
  readonly govType: string;
}

export interface CountryInfo {
  readonly tag: string;
  readonly displayName: string;
  readonly players: readonly string[];
  readonly color: string;
  readonly provinceCount: number;
  readonly overlord: string;
  readonly subjects: readonly string[];
  readonly stats: CountryStats;
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
  gold: 0, monthlyIncome: 0, monthlyTradeValue: 0, population: 0,
  maxManpower: 0, maxSailors: 0, expectedArmySize: 0, expectedNavySize: 0,
  courtLanguage: "", govType: "",
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

  return {
    tag,
    displayName,
    players,
    color,
    provinceCount,
    overlord,
    subjects,
    stats,
  };
};

/** Resolve a display label for a tag (name or tag if no name). */
export const resolveDisplayName = (
  tag: string,
  countryNames: Readonly<Record<string, string>>,
): string =>
  countryNames[tag] ?? tag;
