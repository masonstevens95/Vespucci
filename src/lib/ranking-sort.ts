/**
 * Rankings sort and filter helpers.
 *
 * All functions are pure. No null, no exceptions, every if has an else.
 */

import type { CountryEconomyStats } from "./types";

export type RankingSortMode = "rank" | "country" | "player" | "population" | "income";

export interface RankingEntry {
  readonly tag: string;
  readonly name: string;
  readonly players: readonly string[];
  readonly color: string;
  readonly stats: CountryEconomyStats;
}

/** Check if a country is a great power (rank 1-8). */
export const isGreatPower = (score: number): boolean =>
  score >= 1 && score <= 8;

/** Build a set of scores that appear more than once (tied ranks). */
export const findTiedScores = (entries: readonly RankingEntry[]): ReadonlySet<number> => {
  const counts: Record<number, number> = {};
  for (const e of entries) {
    if (e.stats.score > 0) {
      counts[e.stats.score] = (counts[e.stats.score] ?? 0) + 1;
    }
  }
  return new Set(
    Object.entries(counts)
      .filter(([, count]) => count > 1)
      .map(([score]) => Number(score)),
  );
};

/** Sort ranking entries by the chosen mode. */
export const sortRankings = (
  entries: readonly RankingEntry[],
  mode: RankingSortMode,
): readonly RankingEntry[] => {
  const sorted = [...entries];
  sorted.sort((a, b) => {
    if (mode === "rank") {
      // Countries with rank 0 (no rank) go to bottom
      const aRank = a.stats.score > 0 ? a.stats.score : 9999;
      const bRank = b.stats.score > 0 ? b.stats.score : 9999;
      const diff = aRank - bRank;
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    } else if (mode === "country") {
      return a.name.localeCompare(b.name);
    } else if (mode === "player") {
      const aPlayer = a.players.length > 0 ? a.players[0] : "\uffff";
      const bPlayer = b.players.length > 0 ? b.players[0] : "\uffff";
      const diff = aPlayer.localeCompare(bPlayer);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    } else if (mode === "population") {
      return b.stats.population - a.stats.population;
    } else if (mode === "income") {
      return b.stats.monthlyIncome - a.stats.monthlyIncome;
    } else {
      return 0;
    }
  });
  return sorted;
};

/** Filter rankings to players only. */
export const filterPlayersOnly = (
  entries: readonly RankingEntry[],
  playersOnly: boolean,
): readonly RankingEntry[] =>
  playersOnly
    ? entries.filter((e) => e.players.length > 0)
    : entries;

/** Build ranking entries from parsed save data. */
export const buildRankingEntries = (
  countryStats: Readonly<Record<string, CountryEconomyStats>>,
  countryNames: Readonly<Record<string, string>>,
  tagToPlayers: Readonly<Record<string, string[]>>,
  countryColors: Readonly<Record<string, readonly [number, number, number]>>,
): readonly RankingEntry[] =>
  Object.entries(countryStats)
    .filter(([, s]) => s.population > 0)
    .map(([tag, stats]) => ({
      tag,
      name: countryNames[tag] ?? tag,
      players: tagToPlayers[tag] ?? [],
      color: countryColors[tag]
        ? `rgb(${countryColors[tag][0]},${countryColors[tag][1]},${countryColors[tag][2]})`
        : "#666",
      stats,
    }));
