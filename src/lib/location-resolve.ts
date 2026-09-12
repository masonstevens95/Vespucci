/**
 * Location name resolution.
 *
 * EU5 saves emit location names in lowercase snake_case ("stockholm"), while
 * MapChart's locations map uses Title_Case path IDs ("Stockholm"). Exact-case
 * matching finds nothing, so every save name is resolved through a
 * lowercase-keyed index into the canonical ID list generated from the asset.
 *
 * 128 canonical IDs carry lowercase particles ("Bar_le_Duc",
 * "Halle_an_der_Saale") that per-segment title-casing cannot reproduce, which
 * is why the IDs are stored rather than derived.
 *
 * Resolving here — at config-build time rather than at render time — means
 * unmatched names never reach MapChartConfig.groups. Every count derived from
 * `paths.length` therefore counts shapes that will actually be painted.
 *
 * All functions are pure, use immutable variables, and never throw.
 */

import locationIds from "./location-ids.json";

/** Sentinel for an unresolvable location name. */
export const UNRESOLVED = "";

/** Lowercase a location name for case-insensitive matching. */
export const normalizeLocation = (loc: string): string => loc.toLowerCase();

/** Build a lowercase → canonical ID index from a canonical ID list. */
export const buildLocationIndex = (
  ids: readonly string[],
): Record<string, string> =>
  Object.fromEntries(ids.map((id) => [normalizeLocation(id), id]));

/** The index for the committed locations asset. */
export const LOCATION_INDEX: Record<string, string> = buildLocationIndex(
  locationIds as readonly string[],
);

/** Resolve one save location name to its canonical path ID, or UNRESOLVED. */
export const resolveLocationId = (
  loc: string,
  index: Record<string, string> = LOCATION_INDEX,
): string => index[normalizeLocation(loc)] ?? UNRESOLVED;

export interface ResolutionResult {
  /** Canonical path IDs per country tag, unresolvable names removed. */
  readonly resolved: Record<string, string[]>;
  /** Count of names that matched no shape on the map. */
  readonly droppedCount: number;
  /** Up to 10 dropped names, for diagnostics. */
  readonly droppedSample: readonly string[];
}

/**
 * Resolve every country's location names to canonical path IDs.
 *
 * Names with no shape on the land map (lakes, sea zones, wastelands, and the
 * `loc_<id>` placeholders the parser substitutes for unnamed locations) are
 * dropped and counted rather than passed through.
 */
export const resolveCountryLocations = (
  countryLocations: Record<string, string[]>,
  index: Record<string, string> = LOCATION_INDEX,
): ResolutionResult => {
  const resolved: Record<string, string[]> = {};
  const dropped: string[] = [];

  for (const [tag, locs] of Object.entries(countryLocations)) {
    const ids: string[] = [];
    for (const loc of locs) {
      const id = resolveLocationId(loc, index);
      if (id !== UNRESOLVED) {
        ids.push(id);
      } else {
        dropped.push(loc);
      }
    }
    resolved[tag] = ids;
  }

  return {
    resolved,
    droppedCount: dropped.length,
    droppedSample: dropped.slice(0, 10),
  };
};
