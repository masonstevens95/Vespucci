/**
 * MapChart config generation.
 *
 * All extracted helpers are pure functions with immutable variables.
 * No null, no exceptions, every if has an else.
 */

import type { MapChartConfig, MapChartGroup, RGB } from "./types";
import { generateDistinctColors, rgbToHex } from "./colors";
import { resolveCountryLocations } from "./location-resolve";
import { createLogger } from "./logger";

const log = createLogger("mapchart-config");

// =============================================================================
// Config options
// =============================================================================

export interface ConfigOptions {
  readonly title?: string;
  readonly tagLabels?: Record<string, string>;
  readonly allowedTags?: ReadonlySet<string>;
  /** Override the canonical-ID index. Tests inject a small index here. */
  readonly locationIndex?: Record<string, string>;
}

// =============================================================================
// Pure helper functions
// =============================================================================

/** Sort tags alphabetically by their display label. */
export const sortTagsByLabel = (
  tags: readonly string[],
  tagLabels: Record<string, string>,
): readonly string[] =>
  [...tags].sort((a, b) => {
    const labelA = tagLabels[a] ?? a;
    const labelB = tagLabels[b] ?? b;
    return labelA.localeCompare(labelB);
  });

/** Fill in missing colors for tags that don't have one. */
export const fillMissingColors = (
  tags: readonly string[],
  existingColors: Record<string, RGB>,
): Record<string, RGB> => {
  const missingTags = tags.filter((t) => existingColors[t] === undefined);
  return missingTags.length > 0
    ? {
        ...existingColors,
        ...Object.fromEntries(
          missingTags.map((tag, i) => [tag, generateDistinctColors(missingTags.length)[i]]),
        ),
      }
    : { ...existingColors };
};

/** Nudge an RGB color slightly to avoid hex collision. */
export const nudgeColor = (rgb: RGB): RGB => [
  Math.min(255, rgb[0] + 3),
  Math.min(255, rgb[1] + 2),
  rgb[2],
];

/** Resolve a unique hex color for a tag, nudging to avoid collisions. */
export const resolveUniqueHex = (
  rgb: RGB,
  tag: string,
  usedHex: ReadonlyMap<string, string>,
): { hex: string; finalRgb: RGB } => {
  const hex = rgbToHex(...rgb);
  const existing = usedHex.get(hex);
  return existing === undefined || existing === tag
    ? { hex, finalRgb: rgb }
    : resolveUniqueHex(nudgeColor(rgb), tag, usedHex);
};

/** Resolve the display label for a tag. */
export const resolveLabel = (
  tag: string,
  tagLabels: Record<string, string>,
): string =>
  tagLabels[tag] ?? tag;

/** Build map groups from sorted tags, colors, and canonical location IDs. */
export const buildGroups = (
  tags: readonly string[],
  colors: Record<string, RGB>,
  countryPaths: Record<string, string[]>,
  tagLabels: Record<string, string>,
): Record<string, MapChartGroup> => {
  const result: Record<string, MapChartGroup> = {};
  const usedHex = new Map<string, string>();

  for (const tag of tags) {
    const baseRgb: RGB = colors[tag] ?? [128, 128, 128];
    const { hex, finalRgb: _ } = resolveUniqueHex(baseRgb, tag, usedHex);
    usedHex.set(hex, tag);
    result[hex] = {
      label: resolveLabel(tag, tagLabels),
      paths: countryPaths[tag] ?? [],
    };
  }

  return result;
};

/** Default MapChart config values (everything except groups and title). */
export const defaultConfigValues = (): Omit<MapChartConfig, "groups" | "title"> => ({
  hidden: [],
  background: "#ffffff",
  borders: "#000",
  legendFont: "Helvetica",
  legendFontColor: "#000",
  legendBorderColor: "#00000000",
  legendBgColor: "#00000000",
  legendWidth: 150,
  legendBoxShape: "square",
  legendTitleMode: "attached",
  areBordersShown: true,
  defaultColor: "#d1dbdd",
  labelsColor: "#6a0707",
  labelsFont: "Arial",
  strokeWidth: "medium",
  areLabelsShown: false,
  uncoloredScriptColor: "#ffff33",
  zoomLevel: "1.00",
  zoomX: "0.00",
  zoomY: "0.00",
  v6: true,
  mapTitleScale: 1,
  page: "eu-v-locations",
  mapVersion: null,
  legendPosition: "bottom_left",
  legendSize: "medium",
  legendTranslateX: "0.00",
  legendStatus: "show",
  scalingPatterns: true,
  legendRowsSameColor: true,
  legendColumnCount: 1,
});

// =============================================================================
// Main function
// =============================================================================

/** Generate a MapChart-compatible JSON config. */
export const generateMapChartConfig = (
  countryLocations: Record<string, string[]>,
  countryColors: Record<string, RGB>,
  options: ConfigOptions = {},
): MapChartConfig => {
  // Resolve save names (lowercase) to canonical MapChart path IDs (Title_Case).
  // Names with no shape on the land map are dropped here, so group paths only
  // ever contain IDs that will actually be painted.
  const resolution = resolveCountryLocations(countryLocations, options.locationIndex);

  // Countries do not own lakes, sea zones or wastelands, so a non-zero drop
  // count means name alignment has drifted — a game patch, a refreshed asset,
  // or a stale location-ids.json. Report it without throwing (R3).
  if (resolution.droppedCount > 0) {
    log.warn(
      `${resolution.droppedCount} owned location name(s) matched no shape on the map ` +
        `— check name alignment with scripts/check-location-coverage.mjs. ` +
        `Sample: ${resolution.droppedSample.join(", ")}`,
    );
  } else {
    /* every owned location resolved — nothing to report */
  }

  const allCountryPaths = resolution.resolved;
  const countryPaths = options.allowedTags !== undefined
    ? Object.fromEntries(
        Object.entries(allCountryPaths).filter(([tag]) => options.allowedTags!.has(tag)),
      )
    : allCountryPaths;
  const tagLabels = options.tagLabels ?? {};
  const tags = sortTagsByLabel(Object.keys(countryPaths), tagLabels);
  const colors = fillMissingColors(tags, countryColors);
  const groups = buildGroups(tags, colors, countryPaths, tagLabels);

  return {
    groups,
    title: options.title ?? "",
    ...defaultConfigValues(),
  };
};
