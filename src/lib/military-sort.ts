/**
 * Military tab sort and entry helpers.
 *
 * All functions are pure. No null, no exceptions, every if has an else.
 */

import type { CountryEconomyStats } from "./types";

export type MilitarySortMode = "regulars" | "infantry" | "cavalry" | "artillery" | "levies" | "totalNavy" | "heavyShips" | "manpower" | "country";

export interface MilitaryEntry {
  readonly tag: string;
  readonly name: string;
  readonly players: readonly string[];
  readonly color: string;
  readonly stats: CountryEconomyStats;
}

/** Total regular army strength (actual men). */
export const totalRegulars = (s: CountryEconomyStats): number =>
  s.infantryStr + s.cavalryStr + s.artilleryStr;

/** Total levy army strength (actual men). */
export const totalLevies = (s: CountryEconomyStats): number =>
  s.levyInfantryStr + s.levyCavalryStr;

/** Total navy units (heavy + light + galleys + transports). */
export const totalNavy = (s: CountryEconomyStats): number =>
  s.heavyShips + s.lightShips + s.galleys + s.transports;

/** Sort military entries by the chosen mode. */
export const sortMilitary = (
  entries: readonly MilitaryEntry[],
  mode: MilitarySortMode,
): readonly MilitaryEntry[] => {
  const sorted = [...entries];
  const byField = (fn: (s: CountryEconomyStats) => number) => (a: MilitaryEntry, b: MilitaryEntry) => {
    const diff = fn(b.stats) - fn(a.stats);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  };
  if (mode === "regulars") { sorted.sort(byField(totalRegulars)); }
  else if (mode === "infantry") { sorted.sort(byField(s => s.infantryStr)); }
  else if (mode === "cavalry") { sorted.sort(byField(s => s.cavalryStr)); }
  else if (mode === "artillery") { sorted.sort(byField(s => s.artilleryStr)); }
  else if (mode === "levies") { sorted.sort(byField(totalLevies)); }
  else if (mode === "totalNavy") { sorted.sort(byField(totalNavy)); }
  else if (mode === "heavyShips") { sorted.sort(byField(s => s.heavyShips)); }
  else if (mode === "manpower") { sorted.sort(byField(s => s.maxManpower)); }
  else if (mode === "country") { sorted.sort((a, b) => a.name.localeCompare(b.name)); }
  else { /* unknown mode */ }
  return sorted;
};

/** Build military entries from parsed save data. */
export const buildMilitaryEntries = (
  countryStats: Readonly<Record<string, CountryEconomyStats>>,
  countryNames: Readonly<Record<string, string>>,
  tagToPlayers: Readonly<Record<string, string[]>>,
  countryColors: Readonly<Record<string, readonly [number, number, number]>>,
): readonly MilitaryEntry[] =>
  Object.entries(countryStats)
    .filter(([, s]) => totalRegulars(s) > 0 || totalLevies(s) > 0 || totalNavy(s) > 0 || s.maxManpower > 0)
    .map(([tag, stats]) => ({
      tag,
      name: countryNames[tag] ?? tag,
      players: tagToPlayers[tag] ?? [],
      color: countryColors[tag]
        ? `rgb(${countryColors[tag][0]},${countryColors[tag][1]},${countryColors[tag][2]})`
        : "#666",
      stats,
    }));
