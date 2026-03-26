/**
 * High-level MapChart config export from parsed save data.
 *
 * All extracted helpers are pure functions with immutable variables.
 * No null, no exceptions, every if has an else.
 */

import type { ExportOptions, MapChartConfig, ParsedSave, RGB } from "./types";
import { lightenColor } from "./colors";
import { parseMeltedSave } from "./save-parser";
import { buildLocationToProvince } from "./province-mapping";
import { generateMapChartConfig } from "./mapchart-config";

// =============================================================================
// Pure helper functions
// =============================================================================

/** Build a display label for a country tag. Player tags get "TAG - Name1, Name2". */
export const buildTagLabel = (
  tag: string,
  tagToPlayers: Record<string, string[]>,
): string =>
  tagToPlayers[tag]
    ? `${tag} - ${tagToPlayers[tag].join(", ")}`
    : tag;

/** Build all tag labels for a set of country tags. */
export const buildAllTagLabels = (
  tags: readonly string[],
  tagToPlayers: Record<string, string[]>,
): Record<string, string> =>
  Object.fromEntries(tags.map((tag) => [tag, buildTagLabel(tag, tagToPlayers)]));

/** Filter country locations to only include player-owned countries. */
export const filterToPlayers = (
  countryLocations: Record<string, string[]>,
  tagToPlayers: Record<string, string[]>,
): Record<string, string[]> => {
  const playerTags = new Set(Object.keys(tagToPlayers));
  return playerTags.size > 0
    ? Object.fromEntries(
        Object.entries(countryLocations).filter(([tag]) => playerTags.has(tag)),
      )
    : countryLocations;
};

/** Collect all locations owned by a set of vassal tags. */
export const collectVassalLocations = (
  vassalTags: ReadonlySet<string>,
  allCountryLocations: Record<string, string[]>,
): readonly string[] =>
  [...vassalTags].flatMap((vtag) => allCountryLocations[vtag] ?? []);

/** Build vassal overlay entries for all player overlords. */
export const buildVassalOverlays = (
  tagToPlayers: Record<string, string[]>,
  overlordSubjects: Record<string, Set<string>>,
  allCountryLocations: Record<string, string[]>,
  countryColors: Record<string, RGB>,
): {
  readonly locations: Record<string, string[]>;
  readonly labels: Record<string, string>;
  readonly colors: Record<string, RGB>;
} => {
  const locations: Record<string, string[]> = {};
  const labels: Record<string, string> = {};
  const colors: Record<string, RGB> = {};

  for (const overlordTag of Object.keys(tagToPlayers)) {
    const vassalTags = overlordSubjects[overlordTag];
    if (vassalTags && vassalTags.size > 0) {
      const vassalLocs = collectVassalLocations(vassalTags, allCountryLocations);
      if (vassalLocs.length > 0) {
        const vassalKey = `${overlordTag}_vassals`;
        locations[vassalKey] = [...vassalLocs];
        labels[vassalKey] = `${overlordTag} - subjects`;
        if (countryColors[overlordTag]) {
          colors[vassalKey] = lightenColor(countryColors[overlordTag], 1 / 3);
        } else {
          /* overlord has no color — vassal overlay gets no color either */
        }
      } else {
        /* no vassal locations — skip overlay */
      }
    } else {
      /* no vassals — skip */
    }
  }

  return { locations, labels, colors };
};

/** Resolve a ParsedSave from either a ParsedSave or raw text string. */
export const resolveParsedSave = (saveOrText: ParsedSave | string): ParsedSave =>
  typeof saveOrText === "string"
    ? parseMeltedSave(saveOrText)
    : saveOrText;

// =============================================================================
// Main export function
// =============================================================================

/**
 * Generate a MapChart config from parsed save data or raw text.
 *
 * Accepts either a ParsedSave object (from binary or text parser)
 * or a raw melted text string (for backward compatibility).
 */
export const exportMapChartConfig = (
  saveOrText: ParsedSave | string,
  provinceMapping: Record<string, string[]>,
  options: ExportOptions = {},
): MapChartConfig => {
  const parsed = resolveParsedSave(saveOrText);
  const { tagToPlayers, countryColors, overlordSubjects } = parsed;
  const allCountryLocations = parsed.countryLocations;

  const locToProvince = buildLocationToProvince(provinceMapping);

  const baseLabels = buildAllTagLabels(
    Object.keys(allCountryLocations),
    tagToPlayers,
  );

  const hasPlayers = Object.keys(tagToPlayers).length > 0;
  const shouldFilterPlayers = options.playersOnly === true && hasPlayers;

  const filteredLocations = shouldFilterPlayers
    ? filterToPlayers(allCountryLocations, tagToPlayers)
    : allCountryLocations;

  const vassalOverlays = shouldFilterPlayers
    ? buildVassalOverlays(tagToPlayers, overlordSubjects, allCountryLocations, countryColors)
    : { locations: {}, labels: {}, colors: {} };

  const finalLocations = { ...filteredLocations, ...vassalOverlays.locations };
  const finalLabels = { ...baseLabels, ...vassalOverlays.labels };
  const finalColors = { ...countryColors, ...vassalOverlays.colors };

  return generateMapChartConfig(finalLocations, finalColors, locToProvince, {
    ...options,
    tagLabels: finalLabels,
  });
};
