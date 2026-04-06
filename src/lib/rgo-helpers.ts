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
