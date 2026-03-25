/**
 * Targeted binary parser for EU5 save files.
 *
 * Extracts only the data needed for map generation directly from the
 * binary gamestate, skipping ~90% of the file. Uses ~50MB RAM instead
 * of ~500MB for the text melting approach.
 */

import { unzipSync } from "fflate";
import { TokenReader } from "./token-reader";
import { parseStringLookup } from "./string-lookup";
import { T } from "./game-tokens";
import { findSection, findAllMatches, findOwnershipLocations } from "./section-finder";
import { readMetadataLocations } from "./sections/metadata";
import { readCountries } from "./sections/countries";
import { readLocationOwnership } from "./sections/locations";
import { readIOManager } from "./sections/io-manager";
import { readDiplomacy } from "./sections/diplomacy";
import { readPlayedCountry } from "./sections/players";
import type { ParsedSave, RGB } from "../types";

/**
 * Parse a binary .eu5 save directly into a ParsedSave.
 * Expects the raw file bytes (including the SAV header + ZIP).
 */
export function parseBinarySave(fileData: Uint8Array): ParsedSave {
  let pkOffset = -1;
  for (let i = 0; i < fileData.length - 1; i++) {
    if (fileData[i] === 0x50 && fileData[i + 1] === 0x4b) {
      pkOffset = i;
      break;
    }
  }
  if (pkOffset === -1) throw new Error("No ZIP data found in save file");

  const files = unzipSync(fileData.subarray(pkOffset));
  const gamestate = files["gamestate"];
  const stringLookup = files["string_lookup"];
  if (!gamestate) throw new Error("No gamestate in save ZIP");
  if (!stringLookup) throw new Error("No string_lookup in save ZIP");

  const dynStrings = parseStringLookup(stringLookup);
  return parseGamestate(gamestate, dynStrings);
}

function parseGamestate(data: Uint8Array, dynStrings: string[]): ParsedSave {
  const r = new TokenReader(data, dynStrings);

  const locationNames: Record<number, string> = {};
  const countryTags: Record<number, string> = {};
  const locationOwners: Record<number, string> = {};
  const countryColors: Record<string, RGB> = {};
  const countryCapitals: Record<number, number> = {};
  const overlordCandidates = new Set<string>();
  const overlordSubjects: Record<string, Set<string>> = {};
  const ioMatched = new Set<string>();
  const subjectIds = new Set<number>();
  const tagToPlayers: Record<string, string[]> = {};

  // Locate and parse each section by scanning for byte patterns.
  const metaOff = findSection(data, T.metadata, r);
  if (metaOff >= 0) { r.pos = metaOff + 6; readMetadataLocations(r, locationNames); }

  const countriesOff = findSection(data, T.countries, r);
  if (countriesOff >= 0) { r.pos = countriesOff + 6; readCountries(r, countryTags, countryColors, countryCapitals, overlordCandidates); }

  // integrationPairs: "overlordId:subjectId" -> count of locations being integrated
  const integrationPairs = new Map<string, number>();

  const locOff = findOwnershipLocations(data, T.locations, T.owner, r);
  if (locOff >= 0) { r.pos = locOff + 6; readLocationOwnership(r, countryTags, locationOwners, integrationPairs); }

  const ioOff = findSection(data, T.ioManager, r);
  if (ioOff >= 0) { r.pos = ioOff + 6; readIOManager(r, countryTags, overlordSubjects, ioMatched); }

  const dipOff = findSection(data, T.diplomacyMgr, r);
  if (dipOff >= 0) { r.pos = dipOff + 6; readDiplomacy(r, subjectIds); }

  for (const off of findAllMatches(data, T.playedCountry)) {
    r.pos = off + 6;
    readPlayedCountry(r, countryTags, tagToPlayers);
  }

  // Resolve subjects via capital ownership
  for (const subId of subjectIds) {
    const subTag = countryTags[subId];
    if (!subTag || ioMatched.has(subTag)) continue;
    const capLoc = countryCapitals[subId];
    if (capLoc === undefined) continue;
    const capOwner = locationOwners[capLoc];
    if (capOwner && capOwner !== subTag) {
      if (!overlordSubjects[capOwner]) overlordSubjects[capOwner] = new Set();
      overlordSubjects[capOwner].add(subTag);
    }
  }

  // Add subjects from integration_owner (fiefdoms tracked per-location).
  // Only count a country as a subject if ≥50% of its locations are
  // being integrated by the overlord — low ratios indicate partial
  // conquest, not vassalage.
  const tagToId = new Map<string, number>();
  for (const [id, tag] of Object.entries(countryTags)) {
    tagToId.set(tag, parseInt(id as string));
  }

  // Count total locations per owner country
  const ownerLocCounts = new Map<number, number>();
  for (const ownerTag of Object.values(locationOwners)) {
    const oid = tagToId.get(ownerTag);
    if (oid !== undefined) ownerLocCounts.set(oid, (ownerLocCounts.get(oid) ?? 0) + 1);
  }

  for (const [key, intCount] of integrationPairs) {
    const sep = key.indexOf(":");
    const overlordId = parseInt(key.slice(0, sep));
    const subId = parseInt(key.slice(sep + 1));
    const overlordTag = countryTags[overlordId];
    const subTag = countryTags[subId];
    if (!overlordTag || !subTag) continue;

    const totalLocs = ownerLocCounts.get(subId) ?? 0;
    if (totalLocs === 0) continue;

    if (intCount / totalLocs >= 0.5) {
      if (!overlordSubjects[overlordTag]) overlordSubjects[overlordTag] = new Set();
      overlordSubjects[overlordTag].add(subTag);
    }
  }

  // Build countryLocations from locationOwners + locationNames
  const countryLocations: Record<string, string[]> = {};
  for (const [locIdStr, tag] of Object.entries(locationOwners)) {
    const name = locationNames[parseInt(locIdStr)] ?? `loc_${locIdStr}`;
    if (!countryLocations[tag]) countryLocations[tag] = [];
    countryLocations[tag].push(name);
  }

  return { countryLocations, tagToPlayers, countryColors, overlordSubjects };
}
