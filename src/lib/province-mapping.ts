/**
 * Province mapping utilities.
 *
 * Maps EU5 location names to MapChart province IDs and resolves
 * majority ownership when provinces contain multiple locations.
 *
 * All functions are pure, use immutable variables, and never throw.
 */

// =============================================================================
// Pure helper functions
// =============================================================================

/** Lowercase a location name for case-insensitive matching. */
export const normalizeLocation = (loc: string): string => loc.toLowerCase();

/** Build a reverse mapping: eu5_location (lowercase) → MapChart province name. */
export const buildLocationToProvince = (
  provinceMapping: Record<string, string[]>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(provinceMapping).flatMap(([province, locations]) =>
      locations.map((loc) => [normalizeLocation(loc), province]),
    ),
  );

/** Look up the province for a location, returning undefined if not mapped. */
export const lookupProvince = (
  loc: string,
  locToProvince: Record<string, string>,
): string | undefined => locToProvince[normalizeLocation(loc)];

/** Tally one vote for a (province, tag) pair in a vote map. */
export const addVote = (
  votes: ReadonlyMap<string, ReadonlyMap<string, number>>,
  province: string,
  tag: string,
): Map<string, Map<string, number>> => {
  const newVotes = new Map(
    [...votes].map(([k, v]) => [k, new Map(v)]),
  );
  const provinceVotes = newVotes.get(province) ?? new Map<string, number>();
  provinceVotes.set(tag, (provinceVotes.get(tag) ?? 0) + 1);
  newVotes.set(province, provinceVotes);
  return newVotes;
};

/** Build a province → {tag: count} vote map from country locations. */
export const buildProvinceVotes = (
  countryLocations: Record<string, string[]>,
  locToProvince: Record<string, string>,
): ReadonlyMap<string, ReadonlyMap<string, number>> => {
  let votes: Map<string, Map<string, number>> = new Map();

  for (const [tag, locs] of Object.entries(countryLocations)) {
    for (const loc of locs) {
      const province = lookupProvince(loc, locToProvince);
      if (province !== undefined) {
        votes = addVote(votes, province, tag);
      } else {
        /* unmapped location — skip */
      }
    }
  }

  return votes;
};

/** Find the tag with the most votes in a vote map. */
export const majorityOwner = (votes: ReadonlyMap<string, number>): string =>
  [...votes.entries()].reduce(
    (best, [tag, count]) => (count > best.count ? { tag, count } : best),
    { tag: "", count: -1 },
  ).tag;

/** Group provinces by their majority owner. */
export const groupByOwner = (
  provinceVotes: ReadonlyMap<string, ReadonlyMap<string, number>>,
): Record<string, string[]> => {
  const result: Record<string, string[]> = {};

  for (const [province, votes] of provinceVotes) {
    const winner = majorityOwner(votes);
    if (winner !== "") {
      result[winner] = [...(result[winner] ?? []), province];
    } else {
      /* no votes — skip */
    }
  }

  return result;
};

// =============================================================================
// Main function
// =============================================================================

/**
 * Convert per-country EU5 location lists to MapChart province lists.
 * Resolves conflicts via majority owner.
 */
export const mapToProvinces = (
  countryLocations: Record<string, string[]>,
  locToProvince: Record<string, string>,
): Record<string, string[]> =>
  groupByOwner(buildProvinceVotes(countryLocations, locToProvince));
