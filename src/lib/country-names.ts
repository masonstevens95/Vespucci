/**
 * Country display name resolution.
 *
 * Combines government type, rank level, and tag/country_name to produce
 * display names like "Kingdom of Bohemia" or "Ottoman Empire".
 *
 * Static country names come from country-names-data.ts (localization fallback).
 * Dynamic countries (AAA/ABA/etc.) get names from the save's country_name field.
 *
 * All functions are pure. No null, no exceptions, every if has an else.
 */

import { KNOWN_NAMES } from "./country-names-data";

// =============================================================================
// Rank labels
// =============================================================================

/** Map government level to rank title prefix. */
const RANK_LABELS: Readonly<Record<number, Readonly<Record<string, string>>>> = {
  0: { monarchy: "County of", republic: "Republic of", theocracy: "Bishopric of", tribal: "Tribe of" },
  1: { monarchy: "Duchy of", republic: "Republic of", theocracy: "Bishopric of", tribal: "Chiefdom of" },
  2: { monarchy: "Kingdom of", republic: "Republic of", theocracy: "Kingdom of", tribal: "Kingdom of" },
  3: { monarchy: "Grand Kingdom of", republic: "Grand Republic of", theocracy: "Grand Kingdom of", tribal: "Grand Kingdom of" },
  4: { monarchy: "Empire of", republic: "Imperial Republic of", theocracy: "Holy Empire of", tribal: "Empire of" },
};

/** Get the rank prefix for a government type and level. */
export const rankPrefix = (level: number, govType: string): string => {
  const levelLabels = RANK_LABELS[level] ?? RANK_LABELS[0];
  return levelLabels[govType] ?? levelLabels["monarchy"] ?? "";
};

// =============================================================================
// Known country names (common EU5 tags → proper names)
// =============================================================================

/** Look up a known country name for a tag. */
export const knownName = (tag: string): string =>
  KNOWN_NAMES[tag] ?? "";

// =============================================================================
// Full display name
// =============================================================================

/**
 * Build a full display name like "Kingdom of Bohemia".
 *
 * @param tag         Country tag (e.g., "BOH")
 * @param countryName Raw country_name from save (e.g., "bohemia_province")
 * @param level       Government rank level (0-4, or -1 if unknown)
 * @param govType     Government type (e.g., "monarchy", "republic")
 */
export const buildDisplayName = (
  tag: string,
  countryName: string,
  level: number,
  govType: string,
): string => {
  // Use known name if available, else format country_name, else tag
  const baseName = knownName(tag) !== ""
    ? knownName(tag)
    : countryName !== ""
      ? countryName.replace(/_/g, " ").replace(/\bprovince\b/gi, "").trim().replace(/\b\w/g, c => c.toUpperCase())
      : tag;

  // If level is unknown, just return the base name
  if (level < 0) {
    return baseName;
  }

  const prefix = rankPrefix(level, govType);
  return prefix !== "" ? `${prefix} ${baseName}` : baseName;
};
