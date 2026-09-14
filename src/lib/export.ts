/**
 * High-level MapChart config export from parsed save data.
 *
 * All extracted helpers are pure functions with immutable variables.
 * No null, no exceptions, every if has an else.
 */

import type { ExportOptions, MapExport, ParsedSave, RGB } from "./types";
import { lightenColor } from "./colors";
import { parseMeltedSave } from "./save-parser";
import { generateMapChartConfig } from "./mapchart-config";
import { buildOwnership } from "./border-rule";
import { resolveLocationId, UNRESOLVED } from "./location-resolve";
import { extractTag } from "./legend-sort";

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

/**
 * Map every subject tag to the ROOT overlord whose colour its locations
 * should carry, flattening chains (A -> B -> C means C carries A's colour).
 *
 * `overlordSubjects` holds flat pairs written by four independent sources
 * (dependencies, io-manager, war-subjects, and the capital-owner pass), none
 * of which guarantees acyclicity — so the walk is bounded. A cycle resolves
 * each member to a deterministic member of the cycle rather than looping,
 * because hanging here would stop the app loading a save at all.
 *
 * This is a paint-time relationship only. No location changes groups.
 */
export const buildSubjectOverlords = (
  overlordSubjects: Readonly<Record<string, ReadonlySet<string>>>,
): Record<string, string> => {
  // Direct subject -> overlord. Sorted so a tag claimed by two overlords
  // resolves the same way on every run.
  const direct: Record<string, string> = {};
  for (const overlordTag of Object.keys(overlordSubjects).sort()) {
    for (const subjectTag of overlordSubjects[overlordTag]) {
      if (direct[subjectTag] === undefined && subjectTag !== overlordTag) {
        direct[subjectTag] = overlordTag;
      } else {
        /* already claimed, or self-reference — keep the first */
      }
    }
  }

  const rootOf = (tag: string): string => {
    const seen = new Set<string>([tag]);
    let current = tag;
    while (direct[current] !== undefined && !seen.has(direct[current])) {
      current = direct[current];
      seen.add(current);
    }
    return current;
  };

  const result: Record<string, string> = {};
  for (const subjectTag of Object.keys(direct)) {
    const root = rootOf(subjectTag);
    if (root !== subjectTag) {
      result[subjectTag] = root;
    } else {
      // Only reachable inside a cycle, where the walk returns to its start.
      result[subjectTag] = direct[subjectTag];
    }
  }
  return result;
};

/**
 * Collect the path ids belonging to the player countries.
 *
 * Read off the finished groups rather than re-resolving the location names:
 * these are the ids that will actually be painted, already filtered by
 * playersOnly and already stripped of names with no shape on the map. Every id
 * here is therefore measurable in the rendered document.
 *
 * A vassal overlay is labelled "<overlord> - subjects", so extracting its tag
 * yields the overlord — which is what includes a player's subject territory in
 * the frame instead of leaving it hanging off the edge.
 *
 * Empty when the save has no players, which is what makes the view fall back
 * to the whole map.
 */
export const collectPlayerPaths = (
  groups: Readonly<Record<string, { label: string; paths: string[] }>>,
  tagToPlayers: Readonly<Record<string, readonly string[]>>,
): string[] => {
  const playerTags = new Set(Object.keys(tagToPlayers));
  if (playerTags.size === 0) {
    return [];
  } else {
    /* players present — collect their groups below */
  }

  const paths: string[] = [];
  for (const group of Object.values(groups)) {
    if (playerTags.has(extractTag(group.label))) {
      paths.push(...group.paths);
    } else {
      /* not a player's territory — not part of the frame */
    }
  }
  return paths;
};

/**
 * Canonical path ids for the locations nobody can live in.
 *
 * Resolved here rather than at paint time so every save-name-to-path-id
 * conversion stays in one module and the view layer works purely in id space.
 *
 * Names with no shape on the land map fall out exactly as owned names do.
 * That is most of them: sea zones and lakes are unowned and unpopulated too,
 * so they classify as uninhabitable upstream and arrive here alongside the
 * real wastelands — 7,680 names on both sample saves, of which 1,895 have a
 * shape.
 */
export const collectWastelandPaths = (
  uninhabitable: readonly string[],
  locationIndex?: Record<string, string>,
): readonly string[] => {
  const paths: string[] = [];
  for (const name of uninhabitable) {
    const id = resolveLocationId(name, locationIndex);
    if (id === UNRESOLVED) {
      /* no shape on the land map — nothing to paint */
    } else {
      paths.push(id);
    }
  }
  return paths;
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
  options: ExportOptions = {},
): MapExport => {
  const parsed = resolveParsedSave(saveOrText);
  const { tagToPlayers, countryColors, overlordSubjects } = parsed;
  const allCountryLocations = parsed.countryLocations;

  const baseLabels = buildAllTagLabels(
    Object.keys(allCountryLocations),
    tagToPlayers,
  );

  const hasPlayers = Object.keys(tagToPlayers).length > 0;
  const shouldFilterPlayers = options.playersOnly === true && hasPlayers;

  // Overlays are built before filtering so a player overlord's subject
  // locations are represented by a TAG_vassals key rather than dropped.
  const vassalOverlays = shouldFilterPlayers
    ? buildVassalOverlays(tagToPlayers, overlordSubjects, allCountryLocations, countryColors)
    : { locations: {}, labels: {}, colors: {} };

  // Collect all vassal subject tags whose locations are now under overlay keys
  const vassalSubjectTags = shouldFilterPlayers
    ? new Set(
        Object.keys(tagToPlayers).flatMap((overlordTag) =>
          [...(overlordSubjects[overlordTag] ?? [])],
        ),
      )
    : new Set<string>();

  // Remove subject tag locations (they're represented by overlay keys now)
  // then merge overlay locations into the resolution pool
  const baseLocations = Object.fromEntries(
    Object.entries(allCountryLocations).filter(([tag]) => !vassalSubjectTags.has(tag)),
  );
  const locationsToResolve = { ...baseLocations, ...vassalOverlays.locations };

  const finalLabels = { ...baseLabels, ...vassalOverlays.labels };
  const finalColors = { ...countryColors, ...vassalOverlays.colors };

  // Filter resolved results if playersOnly
  const allowedTags = shouldFilterPlayers
    ? new Set([
        ...Object.keys(tagToPlayers),
        ...Object.keys(vassalOverlays.locations),
      ])
    : undefined;

  const config = generateMapChartConfig(locationsToResolve, finalColors, {
    ...options,
    tagLabels: finalLabels,
    allowedTags,
  });

  const rootOverlords = buildSubjectOverlords(overlordSubjects);

  // Additive: group membership above is untouched in both modes. These only
  // tell the view layer how to paint, how to frame what the config holds, and
  // where country borders fall.
  return {
    config,
    subjectOverlords: rootOverlords,
    playerPaths: collectPlayerPaths(config.groups, tagToPlayers),
    // Built from every country, not from the config above: the config is
    // filtered by playersOnly, so reading ownership from it would hide every
    // player-versus-AI border in the default mode. Built unconditionally, too:
    // borders gate on playerTags of their own accord, and the wasteland
    // enclosure test needs to know who owns what even in a playerless save.
    borderOwnership: buildOwnership(
      allCountryLocations, tagToPlayers, rootOverlords, options.locationIndex,
    ),
    wastelandPaths: collectWastelandPaths(
      parsed.uninhabitableLocations, options.locationIndex,
    ),
  };
};
