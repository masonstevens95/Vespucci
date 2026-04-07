/**
 * Pure helpers for per-country RGO production rollup.
 *
 * All functions are pure arrow expressions.
 * No null, no exceptions, every if has an else.
 */

import type { RgoData, RgoProductionEntry } from "./types";

/**
 * Build a per-country production map from raw location data.
 *
 * @param locationRgos  locId → RgoData (from binary parser)
 * @param locationOwners  locId → country tag (from binary parser)
 * @returns tag → { good → { totalSize, totalEmployment, locationCount } }
 */
export const buildCountryProduction = (
  locationRgos: Readonly<Record<number, RgoData>>,
  locationOwners: Readonly<Record<number, string>>,
): Record<string, Record<string, RgoProductionEntry>> => {
  const result: Record<string, Record<string, RgoProductionEntry>> = {};

  for (const [locIdStr, rgo] of Object.entries(locationRgos)) {
    const locId = parseInt(locIdStr, 10);
    const tag = locationOwners[locId] ?? "";

    if (tag === "") {
      /* unowned or unknown location — skip */
    } else {
      if (!result[tag]) {
        result[tag] = {};
      } else {
        /* country record already initialised */
      }

      const existing = result[tag][rgo.good];
      if (existing) {
        result[tag][rgo.good] = {
          totalSize: existing.totalSize + rgo.size,
          totalEmployment: existing.totalEmployment + rgo.employment,
          locationCount: existing.locationCount + 1,
        };
      } else {
        result[tag][rgo.good] = {
          totalSize: rgo.size,
          totalEmployment: rgo.employment,
          locationCount: 1,
        };
      }
    }
  }

  return result;
};

/**
 * Return the top goods for a country sorted by totalSize descending,
 * capped at `limit` entries.
 */
export const topGoodsForCountry = (
  production: Readonly<Record<string, RgoProductionEntry>>,
  limit: number,
): readonly { readonly good: string; readonly entry: RgoProductionEntry }[] =>
  Object.entries(production)
    .map(([good, entry]) => ({ good, entry }))
    .sort((a, b) => b.entry.totalSize - a.entry.totalSize)
    .slice(0, limit);

/**
 * Build a global leaderboard: for every good, rank all countries by totalSize
 * descending (rank 1 = highest producer).
 *
 * Returns: good → { tag → 1-based rank }
 */
export const buildGoodsRankings = (
  countryProduction: Readonly<Record<string, Readonly<Record<string, RgoProductionEntry>>>>,
): Record<string, Record<string, number>> => {
  const rankings: Record<string, Record<string, number>> = {};

  // Collect all (good, tag, totalSize) triples
  const byGood: Record<string, { tag: string; totalSize: number }[]> = {};
  for (const [tag, goods] of Object.entries(countryProduction)) {
    for (const [good, entry] of Object.entries(goods)) {
      if (!byGood[good]) {
        byGood[good] = [];
      } else {
        /* already initialised */
      }
      byGood[good].push({ tag, totalSize: entry.totalSize });
    }
  }

  // Sort each good's list descending and assign ranks
  for (const [good, entries] of Object.entries(byGood)) {
    const sorted = [...entries].sort((a, b) => b.totalSize - a.totalSize);
    const rankMap: Record<string, number> = {};
    for (let i = 0; i < sorted.length; i++) {
      rankMap[sorted[i].tag] = i + 1;
    }
    rankings[good] = rankMap;
  }

  return rankings;
};

/**
 * Return the top producing countries for a given good, sorted by
 * totalSize descending, capped at `limit` entries.
 */
export const topProducersForGood = (
  good: string,
  countryProduction: Readonly<Record<string, Readonly<Record<string, RgoProductionEntry>>>>,
  limit: number,
): readonly { readonly tag: string; readonly totalSize: number; readonly locationCount: number }[] =>
  Object.entries(countryProduction)
    .filter(([, goods]) => goods[good] !== undefined)
    .map(([tag, goods]) => ({
      tag,
      totalSize: goods[good].totalSize,
      locationCount: goods[good].locationCount,
    }))
    .sort((a, b) => b.totalSize - a.totalSize)
    .slice(0, limit);
