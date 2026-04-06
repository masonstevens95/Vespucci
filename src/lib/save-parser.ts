/**
 * Text-mode EU5 save file parser.
 *
 * Parses melted (plaintext) save files into structured data.
 * All extracted helpers are pure functions with immutable variables.
 * No null, no exceptions, every if has an else.
 */

import type { ParsedSave, RGB } from "./types";

// =============================================================================
// Line-level pure helpers
// =============================================================================

/** Clean a raw location name: strip quotes, braces, and whitespace. */
export const cleanLocationName = (raw: string): string =>
  raw.replace(/"/g, "").replace(/}/g, "").trim();

/** Split a whitespace-separated string into non-empty tokens. */
export const splitTokens = (s: string): readonly string[] =>
  s.split(/\s+/).filter(Boolean);

/** Extract the text after the first `{` in a string. */
export const afterBrace = (s: string): string =>
  s.includes("{") ? s.split("{")[1]?.trim() ?? "" : "";

/** Extract the text before the first `}` in a string. */
export const beforeBrace = (s: string): string =>
  s.includes("}") ? s.split("}")[0].trim() : s;

/** Match a "key=value" pattern and return [key, value], or undefined. */
export const matchKeyValue = (s: string): readonly [string, string] | undefined => {
  const m = s.match(/^(\d+)=(\w+)$/);
  return m ? [m[1], m[2]] as const : undefined;
};

/** Match a "key={" pattern and return the key, or undefined. */
export const matchBlockStart = (s: string): string | undefined => {
  const m = s.match(/^(\d+)=\{/);
  return m ? m[1] : undefined;
};

/** Match "owner=N" and return N, or undefined. */
export const matchOwner = (s: string): number | undefined => {
  const m = s.match(/^owner=(\d+)/);
  return m ? parseInt(m[1]) : undefined;
};

/** Parse "R G B" from a whitespace-separated string into an RGB tuple, or undefined. */
export const parseRgbLine = (s: string): RGB | undefined => {
  const parts = s.trim().split(/\s+/);
  if (parts.length < 3) return undefined;
  const r = parseInt(parts[0]), g = parseInt(parts[1]), b = parseInt(parts[2]);
  return !isNaN(r) && !isNaN(g) && !isNaN(b)
    ? [r, g, b]
    : undefined;
};

// =============================================================================
// Section finders
// =============================================================================

/** Find the line index of a section by its exact trimmed content. */
export const findSectionLine = (
  lines: readonly string[],
  marker: string,
  startFrom: number = 0,
): number =>
  lines.findIndex((l, i) => i >= startFrom && l.trim() === marker);

/** Find the end of a top-level section (next unindented line with `={`). */
export const findSectionEnd = (
  lines: readonly string[],
  startIdx: number,
): number => {
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (!lines[i].startsWith("\t") && lines[i].trim() && lines[i].trim().endsWith("={")) {
      return i;
    } else {
      /* continue scanning */
    }
  }
  return lines.length;
};

// =============================================================================
// Step 1: Location names
// =============================================================================

/** Extract location names from metadata locations block (first 100 lines). */
export const parseLocationNames = (lines: readonly string[]): Record<number, string> => {
  const limit = Math.min(lines.length, 50000);
  for (let i = 0; i < limit; i++) {
    const stripped = lines[i].trim();
    if (stripped.includes("locations={") && i < 100) {
      return extractLocationNamesFrom(lines, i, stripped);
    } else {
      /* not the locations line, continue */
    }
  }
  return {};
};

const extractLocationNamesFrom = (
  lines: readonly string[],
  startLine: number,
  firstLine: string,
): Record<number, string> => {
  const rawNames: string[] = [];
  const after = afterBrace(firstLine);
  if (after) rawNames.push(...splitTokens(after));

  for (let j = startLine + 1; j < lines.length; j++) {
    const s = lines[j].trim();
    if (s.includes("}")) {
      const before = beforeBrace(s);
      if (before) rawNames.push(...splitTokens(before));
      break;
    } else {
      rawNames.push(...splitTokens(s));
    }
  }

  return indexCleanNames(rawNames);
};

const indexCleanNames = (rawNames: readonly string[]): Record<number, string> =>
  Object.fromEntries(
    rawNames
      .map(cleanLocationName)
      .filter((name) => name.length > 0)
      .map((name, idx) => [idx, name]),
  );

// =============================================================================
// Step 2: Country tags
// =============================================================================

/** Extract country tags (numeric ID -> tag string). */
export const parseCountryTags = (lines: readonly string[]): Record<number, string> => {
  const countriesIdx = findSectionLine(lines, "countries={");
  return countriesIdx >= 0
    ? extractTagsBlock(lines, countriesIdx)
    : {};
};

const extractTagsBlock = (
  lines: readonly string[],
  countriesIdx: number,
): Record<number, string> => {
  for (let i = countriesIdx; i < lines.length; i++) {
    if (lines[i].trim() === "tags={") {
      return parseTagEntries(lines, i + 1);
    } else {
      /* continue searching for tags block */
    }
  }
  return {};
};

const parseTagEntries = (
  lines: readonly string[],
  startIdx: number,
): Record<number, string> => {
  const tags: Record<number, string> = {};
  for (let j = startIdx; j < lines.length; j++) {
    const s = lines[j].trim();
    if (s === "}") break;
    const kv = matchKeyValue(s);
    if (kv) {
      tags[parseInt(kv[0])] = kv[1];
    } else {
      /* non-matching line, skip */
    }
  }
  return tags;
};

// =============================================================================
// Step 3: Location ownership
// =============================================================================

/** Extract location -> owner tag mapping. */
export const parseLocationOwnership = (
  lines: readonly string[],
  countryTags: Record<number, string>,
): Record<number, string> => {
  const locSectionIdx = findLocationSection(lines);
  return locSectionIdx >= 0
    ? extractOwnership(lines, locSectionIdx, countryTags)
    : {};
};

const findLocationSection = (lines: readonly string[]): number => {
  for (let i = 1000; i < lines.length; i++) {
    if (lines[i].trimEnd() === "locations={") return i;
  }
  return -1;
};

const extractOwnership = (
  lines: readonly string[],
  sectionIdx: number,
  countryTags: Record<number, string>,
): Record<number, string> => {
  const owners: Record<number, string> = {};
  let foundInner = false;
  let currentLocId = -1;

  for (let i = sectionIdx + 1; i < lines.length; i++) {
    const stripped = lines[i].trim();
    if (!foundInner && stripped === "locations={") {
      foundInner = true;
      continue;
    } else if (!foundInner) {
      continue;
    } else {
      /* inside inner block */
    }

    const locId = matchBlockStart(stripped);
    if (locId !== undefined) {
      currentLocId = parseInt(locId);
      continue;
    } else {
      /* not a block start */
    }

    const ownerId = matchOwner(stripped);
    if (ownerId !== undefined && currentLocId >= 0) {
      const tag = countryTags[ownerId];
      if (tag) {
        owners[currentLocId] = tag;
      } else {
        /* unknown owner ID */
      }
      currentLocId = -1;
      continue;
    } else {
      /* not an owner line */
    }

    if (lines[i].startsWith("\t}") && !lines[i].startsWith("\t\t")) break;
  }
  return owners;
};

// =============================================================================
// Step 4: Country colors
// =============================================================================

/** Extract country colors (flag -> RGB). */
export const parseCountryColors = (lines: readonly string[]): Record<string, RGB> => {
  const colors: Record<string, RGB> = {};
  let inDb = false;
  let currentFlag = "";

  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].trim();
    if (stripped === "database={" && !inDb) {
      inDb = true;
      continue;
    } else if (!inDb) {
      continue;
    } else {
      /* inside database */
    }

    const flagMatch = stripped.match(/^flag=(\w+)$/);
    if (flagMatch) {
      currentFlag = flagMatch[1];
    } else {
      /* not a flag line */
    }

    if (stripped === "color=rgb {" && currentFlag && i + 1 < lines.length) {
      const rgb = parseRgbLine(lines[i + 1]);
      if (rgb) {
        colors[currentFlag] = rgb;
      } else {
        /* invalid RGB line */
      }
    } else {
      /* not a color line */
    }
  }
  return colors;
};

// =============================================================================
// Step 5a: Country capitals
// =============================================================================

/** Extract country capitals (country_id -> capital_location_id). */
export const parseCountryCapitals = (lines: readonly string[]): Record<number, number> => {
  const countriesIdx = findSectionLine(lines, "countries={");
  return countriesIdx >= 0
    ? extractCapitals(lines, countriesIdx)
    : {};
};

const extractCapitals = (
  lines: readonly string[],
  startIdx: number,
): Record<number, number> => {
  const capitals: Record<number, number> = {};
  let currentId = -1;

  for (let i = startIdx; i < lines.length; i++) {
    const stripped = lines[i].trim();
    const idMatch = stripped.match(/^(\d+)=\{$/);
    if (idMatch && lines[i].startsWith("\t\t")) {
      currentId = parseInt(idMatch[1]);
    } else {
      /* not an ID line */
    }

    const capMatch = stripped.match(/^capital=(\d+)$/);
    if (capMatch && currentId >= 0) {
      capitals[currentId] = parseInt(capMatch[1]);
    } else {
      /* not a capital line */
    }
  }
  return capitals;
};

// =============================================================================
// Step 5: Subject relationships
// =============================================================================

/** Extract overlord -> subject relationships via IO + capital ownership. */
export const parseSubjects = (
  lines: readonly string[],
  countryTags: Record<number, string>,
  locationOwners: Record<number, string>,
  countryCapitals: Record<number, number>,
): Record<string, Set<string>> => {
  const overlordSubjects: Record<string, Set<string>> = {};

  // Source 1: IO type=loc entries
  parseIOSubjects(lines, countryTags, overlordSubjects);

  const alreadyMatched = collectMatchedSubjects(overlordSubjects);

  // Source 2: Capital ownership
  parseCapitalOwnershipSubjects(
    lines, countryTags, locationOwners, countryCapitals, alreadyMatched, overlordSubjects,
  );

  return overlordSubjects;
};

/** Collect all subjects already matched (for deduplication). */
export const collectMatchedSubjects = (
  overlordSubjects: Record<string, Set<string>>,
): ReadonlySet<string> =>
  new Set(Object.values(overlordSubjects).flatMap((s) => [...s]));

/** Add a subject to the overlord map. */
const addSubject = (
  map: Record<string, Set<string>>,
  overlord: string,
  subject: string,
): void => {
  if (!map[overlord]) map[overlord] = new Set();
  map[overlord].add(subject);
};

const parseIOSubjects = (
  lines: readonly string[],
  countryTags: Record<number, string>,
  overlordSubjects: Record<string, Set<string>>,
): void => {
  const ioStartIdx = findSectionLine(lines, "international_organization_manager={");
  if (ioStartIdx < 0) return;

  const ioEndIdx = findSectionEnd(lines, ioStartIdx);
  let currentType = "";
  let currentLeader = -1;
  let currentMembers: readonly number[] = [];
  let inEntry = false;

  for (let i = ioStartIdx; i < ioEndIdx; i++) {
    const stripped = lines[i].trim();

    if (stripped.match(/^(\d+)=\{$/) && !inEntry) {
      inEntry = true;
      currentType = "";
      currentLeader = -1;
      currentMembers = [];
      continue;
    } else if (!inEntry) {
      continue;
    } else {
      /* inside IO entry */
    }

    const typeMatch = stripped.match(/^type=(\w+)$/);
    if (typeMatch) currentType = typeMatch[1];

    const leaderMatch = stripped.match(/^leader=(\d+)$/);
    if (leaderMatch) currentLeader = parseInt(leaderMatch[1]);

    if (stripped.startsWith("all_members={") && i + 1 < ioEndIdx) {
      const nl = lines[i + 1].trim();
      currentMembers = nl !== "}"
        ? nl.split(/\s+/).filter((x) => /^\d+$/.test(x)).map(Number)
        : [];
    } else {
      /* not members line */
    }

    if (stripped === "}" && lines[i].startsWith("\t\t}")) {
      if (currentType === "loc" && currentLeader >= 0 && countryTags[currentLeader]) {
        const leaderTag = countryTags[currentLeader];
        for (const mid of currentMembers) {
          if (mid !== currentLeader && countryTags[mid]) {
            addSubject(overlordSubjects, leaderTag, countryTags[mid]);
          } else {
            /* leader or unknown member */
          }
        }
      } else {
        /* not a lordship IO */
      }
      inEntry = false;
    } else {
      /* not end of entry */
    }
  }
};

const parseCapitalOwnershipSubjects = (
  lines: readonly string[],
  countryTags: Record<number, string>,
  locationOwners: Record<number, string>,
  countryCapitals: Record<number, number>,
  alreadyMatched: ReadonlySet<string>,
  overlordSubjects: Record<string, Set<string>>,
): void => {
  const dmStartIdx = findSectionLine(lines, "diplomacy_manager={");
  if (dmStartIdx < 0) return;

  const dmEndIdx = findSectionEnd(lines, dmStartIdx);
  let curCountry = -1;
  let hasLiberty = false;

  const flush = (): void => {
    if (curCountry < 0 || !hasLiberty) return;
    const subTag = countryTags[curCountry];
    if (!subTag || alreadyMatched.has(subTag)) return;

    const capLoc = countryCapitals[curCountry];
    if (capLoc === undefined) return;

    const capOwnerTag = locationOwners[capLoc];
    if (capOwnerTag && capOwnerTag !== subTag) {
      addSubject(overlordSubjects, capOwnerTag, subTag);
    } else {
      /* capital self-owned or unowned */
    }
  };

  for (let i = dmStartIdx; i < dmEndIdx; i++) {
    const line = lines[i];
    const stripped = line.trim();
    if (line.startsWith("\t") && !line.startsWith("\t\t")) {
      const m = stripped.match(/^(\d+)=\{$/);
      if (m) {
        flush();
        curCountry = parseInt(m[1]);
        hasLiberty = false;
      } else {
        /* non-entry line */
      }
    } else {
      /* deeper indent */
    }
    if (stripped.startsWith("liberty_desire=")) {
      hasLiberty = true;
    } else {
      /* not liberty_desire */
    }
  }
  flush();
};

// =============================================================================
// Step 6: Player countries
// =============================================================================

/** Extract player name -> country tag mapping. */
export const parsePlayerCountries = (
  lines: readonly string[],
  countryTags: Record<number, string>,
): Record<string, string> => {
  const players: Record<string, string> = {};
  let inBlock = false;
  let curName = "";
  let curCountry = -1;

  for (const line of lines) {
    const stripped = line.trim();
    if (stripped === "played_country={") {
      inBlock = true;
      curName = "";
      curCountry = -1;
      continue;
    } else if (!inBlock) {
      continue;
    } else {
      /* inside played_country block */
    }

    const nm = stripped.match(/^name="(.+?)"$/);
    if (nm) curName = nm[1];

    const cm = stripped.match(/^country=(\d+)$/);
    if (cm) curCountry = parseInt(cm[1]);

    if (stripped === "}" && !line.startsWith("\t\t")) {
      if (curName && curCountry >= 0 && countryTags[curCountry]) {
        players[curName] = countryTags[curCountry];
      } else {
        /* incomplete entry */
      }
      inBlock = false;
    } else {
      /* not end of block */
    }
  }
  return players;
};

// =============================================================================
// Build helpers
// =============================================================================

/** Build country -> location names map from ownership + name index. */
export const buildCountryLocations = (
  locationOwners: Record<number, string>,
  locationNames: Record<number, string>,
): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  for (const [locIdStr, tag] of Object.entries(locationOwners)) {
    const locId = parseInt(locIdStr);
    const name = locationNames[locId] ?? `loc_${locId}`;
    result[tag] = [...(result[tag] ?? []), name];
  }
  return result;
};

/** Build tag -> player names map from player -> tag map. */
export const buildTagToPlayers = (
  playerCountries: Record<string, string>,
): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  for (const [name, tag] of Object.entries(playerCountries)) {
    result[tag] = [...(result[tag] ?? []), name];
  }
  return result;
};

// =============================================================================
// Orchestrator
// =============================================================================

/** Parse a melted (text-mode) EU5 save into structured data. */
export const parseMeltedSave = (text: string): ParsedSave => {
  const lines = text.split("\n");

  const locationNames = parseLocationNames(lines);
  const countryTags = parseCountryTags(lines);
  const locationOwners = parseLocationOwnership(lines, countryTags);
  const countryColors = parseCountryColors(lines);
  const countryCapitals = parseCountryCapitals(lines);
  const overlordSubjects = parseSubjects(lines, countryTags, locationOwners, countryCapitals);
  const playerCountries = parsePlayerCountries(lines, countryTags);

  const countryLocations = buildCountryLocations(locationOwners, locationNames);
  const tagToPlayers = buildTagToPlayers(playerCountries);

  return { countryLocations, tagToPlayers, countryColors, overlordSubjects, countryNames: {}, countryStats: {}, wars: [], pastWars: [], warReparations: [], annulledTreaties: [], royalMarriages: [], activeCBs: [], trade: { producedGoods: {}, marketNames: {}, marketOwners: {}, markets: [] } };
};
