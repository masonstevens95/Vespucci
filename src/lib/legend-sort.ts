/**
 * Legend sorting helpers.
 *
 * Sorts legend entries alphabetically or by location count,
 * keeping subject entries immediately after their overlord.
 *
 * All functions are pure. No null, no exceptions, every if has an else.
 */

import type { MapChartGroup } from "./types";

export type LegendSortMode = "alpha" | "locations" | "total";

export interface LegendEntry {
  readonly hex: string;
  readonly group: MapChartGroup;
}

/** Extract the tag from a label like "TAG - Player" or "TAG - subjects". */
export const extractTag = (label: string): string =>
  label.includes(" - ") ? label.split(" - ")[0] : label;

/** Check whether a legend entry is a subject overlay (label ends with " - subjects"). */
export const isSubjectEntry = (label: string): boolean =>
  label.endsWith(" - subjects");

/** Get the overlord tag for a subject entry, or empty string if not a subject. */
export const subjectOverlordTag = (label: string): string =>
  isSubjectEntry(label) ? extractTag(label) : "";

/**
 * Sort legend entries with subjects grouped after their overlord.
 *
 * 1. Separate entries into overlords/independents and subject overlays
 * 2. Sort overlords/independents by the chosen mode
 * 3. Insert each subject overlay immediately after its overlord
 */
export const sortLegendEntries = (
  entries: readonly LegendEntry[],
  mode: LegendSortMode,
): readonly LegendEntry[] => {
  // Separate subjects from non-subjects
  const subjects = new Map<string, LegendEntry>();
  const nonSubjects: LegendEntry[] = [];

  for (const entry of entries) {
    const overlordTag = subjectOverlordTag(entry.group.label);
    if (overlordTag !== "") {
      subjects.set(overlordTag, entry);
    } else {
      nonSubjects.push(entry);
    }
  }

  // Build total location counts (direct + subject) for "total" sort
  const totalCount = (entry: LegendEntry): number => {
    const tag = extractTag(entry.group.label);
    const sub = subjects.get(tag);
    return entry.group.paths.length + (sub !== undefined ? sub.group.paths.length : 0);
  };

  // Sort non-subjects
  const sorted = [...nonSubjects].sort((a, b) => {
    if (mode === "locations") {
      const diff = b.group.paths.length - a.group.paths.length;
      return diff !== 0 ? diff : a.group.label.localeCompare(b.group.label);
    } else if (mode === "total") {
      const diff = totalCount(b) - totalCount(a);
      return diff !== 0 ? diff : a.group.label.localeCompare(b.group.label);
    } else {
      return a.group.label.localeCompare(b.group.label);
    }
  });

  // Interleave: insert subject after its overlord
  const result: LegendEntry[] = [];
  for (const entry of sorted) {
    result.push(entry);
    const tag = extractTag(entry.group.label);
    const sub = subjects.get(tag);
    if (sub !== undefined) {
      result.push(sub);
    } else {
      /* no subject overlay for this country */
    }
  }

  // Append any orphaned subjects (overlord not in the list)
  for (const [overlordTag, sub] of subjects) {
    const alreadyAdded = sorted.some((e) => extractTag(e.group.label) === overlordTag);
    if (!alreadyAdded) {
      result.push(sub);
    } else {
      /* already inserted after overlord */
    }
  }

  return result;
};
