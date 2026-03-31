/**
 * Targeted binary parser for EU5 save files.
 *
 * Extracts only the data needed for map generation directly from the
 * binary gamestate, skipping ~90% of the file. Uses ~50MB RAM instead
 * of ~500MB for the text melting approach.
 *
 * Written in FP style: const bindings, arrow functions, no exceptions,
 * no null, every if has an else.
 */

import { unzipSync } from "fflate";
import { TokenReader } from "./token-reader";
import { parseStringLookup } from "./string-lookup";
import { T } from "./game-tokens";
import { findSection, findAllMatches, findOwnershipLocations } from "./section-finder";
import { readMetadataLocations } from "./sections/metadata";
import { readCountries } from "./sections/countries";
import { readLocationOwnership } from "./sections/locations";
import { readDiplomacy } from "./sections/diplomacy";
import { readPlayedCountry } from "./sections/players";
import { findDependencies } from "./sections/dependencies";
import { readCountryEconomies } from "./sections/economy";
import { BinaryToken } from "./tokens";
import { buildDisplayName } from "../country-names";
import type { ParsedSave, RGB } from "../types";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Sentinel value returned when a numeric lookup has no entry. */
const NO_CAPITAL = -1;

/** Returns a fresh empty ParsedSave (no shared mutable state). */
const emptyParsedSave = (): ParsedSave => ({
  countryLocations: {},
  tagToPlayers: {},
  countryColors: {},
  overlordSubjects: {},
  countryNames: {},
  countryStats: {},
});

/**
 * Scan raw file bytes for the PK (ZIP) magic number.
 * Returns the byte offset, or -1 if not found.
 */
const findZipOffset = (fileData: Uint8Array): number => {
  for (let i = 0; i < fileData.length - 1; i++) {
    if (fileData[i] === 0x50 && fileData[i + 1] === 0x4b) {
      return i;
    } else {
      // not a match — keep scanning
    }
  }
  return -1;
};

/**
 * Resolve subjects via capital ownership.
 * For each subject ID, if its capital is owned by a different tag,
 * that owner becomes the overlord.
 */
const resolveCapitalOwnershipSubjects = (
  subjectIds: ReadonlySet<number>,
  countryTags: Readonly<Record<number, string>>,
  countryCapitals: Readonly<Record<number, number>>,
  locationOwners: Readonly<Record<number, string>>,
  overlordSubjects: Record<string, Set<string>>,
): void => {
  for (const subId of subjectIds) {
    const subTag = countryTags[subId];
    if (!subTag) {
      // no tag for this subject id — skip
    } else {
      const capLoc = countryCapitals[subId] ?? NO_CAPITAL;
      if (capLoc === NO_CAPITAL) {
        // no capital registered — skip
      } else {
        const capOwner = locationOwners[capLoc];
        if (capOwner && capOwner !== subTag) {
          if (!overlordSubjects[capOwner]) {
            overlordSubjects[capOwner] = new Set();
          } else {
            // set already exists
          }
          overlordSubjects[capOwner].add(subTag);
        } else {
          // capital unowned or self-owned — not a subject relationship
        }
      }
    }
  }
};

/**
 * Build countryLocations map from locationOwners + locationNames.
 */
const buildCountryLocations = (
  locationOwners: Readonly<Record<number, string>>,
  locationNames: Readonly<Record<number, string>>,
): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  for (const [locIdStr, tag] of Object.entries(locationOwners)) {
    const name = locationNames[parseInt(locIdStr)] ?? `loc_${locIdStr}`;
    if (!result[tag]) {
      result[tag] = [];
    } else {
      // array already exists
    }
    result[tag].push(name);
  }
  return result;
};

// ---------------------------------------------------------------------------
// Core parsers
// ---------------------------------------------------------------------------

const parseGamestate = (data: Uint8Array, dynStrings: string[]): ParsedSave => {
  const r = new TokenReader(data, dynStrings);

  const locationNames: Record<number, string> = {};
  const countryTags: Record<number, string> = {};
  const locationOwners: Record<number, string> = {};
  const countryColors: Record<string, RGB> = {};
  const countryCapitals: Record<number, number> = {};
  const overlordCandidates = new Set<string>();
  const overlordSubjects: Record<string, Set<string>> = {};
  const subjectIds = new Set<number>();
  const tagToPlayers: Record<string, string[]> = {};

  // Locate and parse each section by scanning for byte patterns.
  const metaOff = findSection(data, T.metadata, r);
  if (metaOff >= 0) {
    r.pos = metaOff + 6;
    readMetadataLocations(r, locationNames);
  } else {
    // metadata section not found — location names will be empty
  }

  const countriesOff = findSection(data, T.countries, r);
  const countryNames: Record<string, string> = {};
  let economies: Record<string, import("./sections/economy").CountryEconomy> = {};
  if (countriesOff >= 0) {
    r.pos = countriesOff + 6;
    readCountries(r, countryTags, countryColors, countryCapitals, overlordCandidates);

    // Second pass on database for country names
    r.pos = countriesOff + 6;
    let d = 1;
    while (!r.done && d > 0) {
      const tok = r.readToken();
      if (tok === BinaryToken.CLOSE) { d--; continue; }
      else if (tok === BinaryToken.OPEN) { d++; continue; }
      else if (tok === BinaryToken.EQUAL) { continue; }
      else if (tok === T.database) {
        r.expectEqual();
        r.expectOpen();
        economies = readCountryEconomies(r, data, countryTags);
        for (const [tag, eco] of Object.entries(economies)) {
          const displayName = buildDisplayName(tag, eco.countryName, eco.level, eco.govType);
          if (displayName !== tag) {
            countryNames[tag] = displayName;
          }
        }
        break;
      } else if (r.peekToken() === BinaryToken.EQUAL) {
        r.readToken();
        r.skipValue();
      } else {
        /* other token */
      }
    }
  } else {
    // countries section not found — tags/colors/capitals will be empty
  }

  // (integration_owner removed — too many false positives from partial conquest)

  const locOff = findOwnershipLocations(data, T.locations, T.owner, r);
  if (locOff >= 0) {
    r.pos = locOff + 6;
    readLocationOwnership(r, countryTags, locationOwners);
  } else {
    // ownership locations not found — locationOwners will be empty
  }

  // Dependencies: authoritative overlord-subject relationships
  // stored as dependency = { first=overlord second=subject subject_type=... }
  findDependencies(data, dynStrings, countryTags, overlordSubjects);

  const dipOff = findSection(data, T.diplomacyMgr, r);
  if (dipOff >= 0) {
    r.pos = dipOff + 6;
    readDiplomacy(r, subjectIds);
  } else {
    // diplomacy section not found — subjectIds will be empty
  }

  for (const off of findAllMatches(data, T.playedCountry)) {
    r.pos = off + 6;
    readPlayedCountry(r, countryTags, tagToPlayers);
  }

  resolveCapitalOwnershipSubjects(subjectIds, countryTags, countryCapitals, locationOwners, overlordSubjects);

  const countryLocations = buildCountryLocations(locationOwners, locationNames);

  // Build countryStats from economies
  const countryStats: Record<string, import("../types").CountryEconomyStats> = {};
  for (const [tag, eco] of Object.entries(economies)) {
    countryStats[tag] = {
      gold: eco.gold,
      monthlyIncome: eco.monthlyIncome,
      monthlyTradeValue: eco.monthlyTradeValue,
      population: eco.population,
      maxManpower: eco.maxManpower,
      maxSailors: eco.maxSailors,
      expectedArmySize: eco.expectedArmySize,
      expectedNavySize: eco.expectedNavySize,
      courtLanguage: eco.courtLanguage,
      govType: eco.govType,
    };
  }

  return { countryLocations, tagToPlayers, countryColors, overlordSubjects, countryNames, countryStats };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a binary .eu5 save directly into a ParsedSave.
 * Expects the raw file bytes (including the SAV header + ZIP).
 * Returns an empty ParsedSave on any structural failure (no exceptions).
 */
export const parseBinarySave = (fileData: Uint8Array): ParsedSave => {
  const pkOffset = findZipOffset(fileData);
  if (pkOffset === -1) {
    return emptyParsedSave();
  } else {
    // found ZIP data — proceed
  }

  const files = unzipSync(fileData.subarray(pkOffset));
  const gamestate = files["gamestate"];
  const stringLookup = files["string_lookup"];

  if (!gamestate) {
    return emptyParsedSave();
  } else {
    // gamestate present
  }

  if (!stringLookup) {
    return emptyParsedSave();
  } else {
    // string_lookup present
  }

  const dynStrings = parseStringLookup(stringLookup);
  return parseGamestate(gamestate, dynStrings);
};
