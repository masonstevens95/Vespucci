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
import {
  findSection,
  findAllMatches,
  findOwnershipLocations,
} from "./section-finder";
import { readMetadataLocations } from "./sections/metadata";
import { readCountries } from "./sections/countries";
import { readLocationOwnership } from "./sections/locations";
import { readDiplomacy } from "./sections/diplomacy";
import { readPlayedCountry } from "./sections/players";
import { findDependencies } from "./sections/dependencies";
import { readCountryDatabase } from "./sections/country-stats";
import { readWars } from "./sections/wars";
import {
  readPastWarsFromDiplomacy,
  readDiplomacyAgreements,
} from "./sections/past-wars";
import { readTradeData } from "./sections/trade";
import type { CountryData } from "./sections/country-stats";
import { readCountryForces } from "./sections/units";
import { BinaryToken } from "./tokens";
import { buildDisplayName } from "../country-names";
import type { ParsedSave, RGB, RgoData } from "../types";

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
  locationRgos: {},
  wars: [],
  pastWars: [],
  warReparations: [],
  annulledTreaties: [],
  royalMarriages: [],
  activeCBs: [],
  trade: { producedGoods: {}, marketNames: {}, marketOwners: {}, markets: [] },
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
  overlordSubjects: Record<string, Set<string>>
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
  locationNames: Readonly<Record<number, string>>
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
    console.error(
      "[parseGamestate] 'metadata' section not found — location names will be empty"
    );
  }

  const countriesOff = findSection(data, T.countries, r);
  const countryNames: Record<string, string> = {};
  let countryDb: Record<string, CountryData> = {};
  if (countriesOff >= 0) {
    r.pos = countriesOff + 6;
    readCountries(
      r,
      countryTags,
      countryColors,
      countryCapitals,
      overlordCandidates
    );

    // Second pass on database for country stats + names
    r.pos = countriesOff + 6;
    let d = 1;
    while (!r.done && d > 0) {
      const tok = r.readToken();
      if (tok === BinaryToken.CLOSE) {
        d--;
        continue;
      } else if (tok === BinaryToken.OPEN) {
        d++;
        continue;
      } else if (tok === BinaryToken.EQUAL) {
        continue;
      } else if (tok === T.database) {
        r.expectEqual();
        r.expectOpen();
        countryDb = readCountryDatabase(r, data, countryTags);
        for (const [tag, cd] of Object.entries(countryDb)) {
          const displayName = buildDisplayName(
            tag,
            cd.identity.countryName,
            cd.identity.level,
            cd.identity.govType
          );
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
    console.error(
      "[parseGamestate] 'countries' section not found — tags/colors/capitals will be empty"
    );
  }

  // (integration_owner removed — too many false positives from partial conquest)

  const locationRgos: Record<number, RgoData> = {};

  const locOff = findOwnershipLocations(data, T.locations, T.owner, r);
  if (locOff >= 0) {
    r.pos = locOff + 6;
    readLocationOwnership(r, data, countryTags, locationOwners, locationRgos);
  } else {
    console.error(
      "[parseGamestate] ownership 'locations' section not found — locationOwners will be empty"
    );
  }

  // Dependencies: authoritative overlord-subject relationships
  // stored as dependency = { first=overlord second=subject subject_type=... }
  findDependencies(data, dynStrings, countryTags, overlordSubjects);

  const dipOff = findSection(data, T.diplomacyMgr, r);
  if (dipOff >= 0) {
    r.pos = dipOff + 6;
    readDiplomacy(r, subjectIds);
  } else {
    console.error(
      "[parseGamestate] 'diplomacy_manager' section not found — subjectIds will be empty"
    );
  }

  // Read past wars and agreements from diplomacy relations
  const rawPastWars =
    dipOff >= 0 ? readPastWarsFromDiplomacy(data, dynStrings, dipOff + 6) : [];
  const rawAgreements =
    dipOff >= 0
      ? readDiplomacyAgreements(data, dynStrings, dipOff + 6)
      : {
          reparations: [],
          annulledTreaties: [],
          royalMarriages: [],
          activeCBs: [],
        };

  for (const off of findAllMatches(data, T.playedCountry)) {
    r.pos = off + 6;
    readPlayedCountry(r, countryTags, tagToPlayers);
  }

  resolveCapitalOwnershipSubjects(
    subjectIds,
    countryTags,
    countryCapitals,
    locationOwners,
    overlordSubjects
  );

  const countryLocations = buildCountryLocations(locationOwners, locationNames);

  // Read actual forces from unit_manager + subunit_manager
  const forces = readCountryForces(data, dynStrings, countryTags);

  // Build countryStats from country database + forces
  const countryStats: Record<string, import("../types").CountryEconomyStats> =
    {};
  for (const [tag, cd] of Object.entries(countryDb)) {
    const f = forces[tag];
    countryStats[tag] = {
      gold: cd.economy.gold,
      stability: cd.economy.stability,
      prestige: cd.economy.prestige,
      monthlyIncome: cd.economy.monthlyIncome,
      monthlyTradeValue: cd.economy.monthlyTradeValue,
      population: cd.economy.population,
      infantry: f?.infantry ?? 0,
      cavalry: f?.cavalry ?? 0,
      artillery: f?.artillery ?? 0,
      infantryStr: f?.infantryStr ?? 0,
      cavalryStr: f?.cavalryStr ?? 0,
      artilleryStr: f?.artilleryStr ?? 0,
      levyInfantry: f?.levyInfantry ?? 0,
      levyCavalry: f?.levyCavalry ?? 0,
      levyInfantryStr: f?.levyInfantryStr ?? 0,
      levyCavalryStr: f?.levyCavalryStr ?? 0,
      heavyShips: f?.heavyShips ?? 0,
      lightShips: f?.lightShips ?? 0,
      galleys: f?.galleys ?? 0,
      transports: f?.transports ?? 0,
      armyFrontage: f?.armyFrontage ?? 0,
      navyFrontage: f?.navyFrontage ?? 0,
      maxManpower: cd.military.maxManpower,
      maxSailors: cd.military.maxSailors,
      monthlyManpower: cd.military.monthlyManpower,
      monthlySailors: cd.military.monthlySailors,
      armyMaintenance: cd.military.armyMaintenance,
      navyMaintenance: cd.military.navyMaintenance,
      expectedArmySize: cd.military.expectedArmySize,
      expectedNavySize: cd.military.expectedNavySize,
      legitimacy: cd.economy.legitimacy,
      inflation: cd.economy.inflation,
      estates: cd.estates,
      stabilityInvestment: cd.politics.stabilityInvestment,
      republicanTradition:
        cd.identity.govRepublicanTradition !== 0
          ? cd.identity.govRepublicanTradition
          : cd.politics.republicanTradition,
      hordeUnity:
        cd.identity.govHordeUnity !== 0
          ? cd.identity.govHordeUnity
          : cd.politics.hordeUnity,
      devotion:
        cd.identity.govDevotion !== 0
          ? cd.identity.govDevotion
          : cd.politics.devotion,
      tribalCohesion:
        cd.identity.govTribalCohesion !== 0
          ? cd.identity.govTribalCohesion
          : cd.politics.tribalCohesion,
      governmentPower:
        cd.economy.governmentPower !== 0
          ? cd.economy.governmentPower
          : cd.politics.governmentPower,
      karma: cd.economy.karma,
      religiousInfluence: cd.economy.religiousInfluence,
      purity: cd.economy.purity,
      righteousness: cd.economy.righteousness,
      diplomaticCapacity: cd.politics.diplomaticCapacity,
      diplomaticReputation: cd.politics.diplomaticReputation,
      warExhaustion:
        cd.economy.warExhaustion !== 0
          ? cd.economy.warExhaustion
          : cd.politics.warExhaustion,
      powerProjection: cd.politics.powerProjection,
      libertyDesire: cd.politics.libertyDesire,
      greatPowerScore: cd.politics.greatPowerScore,
      numAllies: cd.politics.numAllies,
      armyTradition:
        cd.economy.armyTradition !== 0
          ? cd.economy.armyTradition
          : cd.politics.armyTradition,
      navyTradition:
        cd.economy.navyTradition !== 0
          ? cd.economy.navyTradition
          : cd.politics.navyTradition,
      militaryTactics: cd.politics.militaryTactics,
      monthlyGoldIncome: cd.politics.monthlyGoldIncome,
      monthlyGoldExpense: cd.politics.monthlyGoldExpense,
      monthlyPrestige: cd.politics.monthlyPrestige,
      prestigeDecay: cd.politics.prestigeDecay,
      totalDevelopment: cd.politics.totalDevelopment,
      numProvinces: cd.politics.numProvinces,
      institutions: cd.identity.institutions,
      societalValues: cd.identity.societalValues,
      courtLanguage: cd.identity.courtLanguage,
      govType: cd.identity.govType,
      primaryCulture: cd.identity.primaryCulture,
      religion: cd.identity.religion,
      score: cd.identity.score,
    };
  }

  // Read wars
  const rawWars = readWars(data, dynStrings);
  const wars: import("../types").WarData[] = rawWars.map((w) => ({
    attackerTag: countryTags[w.attackerId] ?? `id:${w.attackerId}`,
    defenderTag: countryTags[w.defenderId] ?? `id:${w.defenderId}`,
    casusBelli: w.casusBelli,
    targetProvince: w.targetProvince,
    startDate: w.startDate,
    endDate: w.endDate,
    isEnded: w.isEnded,
    isCivilWar: w.isCivilWar,
    isRevolt: w.isRevolt,
    attackerScore: w.attackerScore,
    defenderScore: w.defenderScore,
    warDirectionQuarter: w.warDirectionQuarter,
    warDirectionYear: w.warDirectionYear,
    stalledYears: w.stalledYears,
    participants: w.participants.map((p) => ({
      tag: countryTags[p.country] ?? `id:${p.country}`,
      side: p.side,
      reason: p.reason,
    })),
    battles: w.battles.map((b) => ({
      location: b.location,
      date: b.date,
      attackerWon: b.attackerWon,
      attackerLosses: b.attackerLosses,
      defenderLosses: b.defenderLosses,
      attackerTotal: b.attackerTotal,
      defenderTotal: b.defenderTotal,
      attackerCountryTag:
        countryTags[b.attackerCountry] ?? `id:${b.attackerCountry}`,
      defenderCountryTag:
        countryTags[b.defenderCountry] ?? `id:${b.defenderCountry}`,
      battleWarScore: b.battleWarScore,
      attackerTroopBreakdown: b.attackerTroopBreakdown,
      defenderTroopBreakdown: b.defenderTroopBreakdown,
      attackerLossBreakdown: b.attackerLossBreakdown,
      defenderLossBreakdown: b.defenderLossBreakdown,
      attackerCommander: b.attackerCommander,
      defenderCommander: b.defenderCommander,
      attackerPrisoners: b.attackerPrisoners,
      defenderPrisoners: b.defenderPrisoners,
      attackerWarExhaustion: b.attackerWarExhaustion,
      defenderWarExhaustion: b.defenderWarExhaustion,
    })),
    occupiedLocations: w.occupiedLocations.map((ol) => ({
      location: ol.location,
      controllerTag: countryTags[ol.controller] ?? `id:${ol.controller}`,
    })),
  }));

  // Read trade data and resolve market names from center_location
  // The market center is typically one location after the capital city (capital=N, center=N+1)
  const rawTrade = readTradeData(data, dynStrings);
  const marketNames: Record<number, string> = {};
  for (const m of rawTrade.markets) {
    const capitalName = locationNames[m.centerLocation - 1] ?? "";
    const centerName = locationNames[m.centerLocation] ?? "";
    const name = capitalName !== "" ? capitalName : centerName;
    if (name !== "") {
      marketNames[m.id] = name
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }
  const marketOwners: Record<number, string> = {};
  for (const m of rawTrade.markets) {
    // Try the center location itself, then one before (capital city pattern)
    const owner =
      locationOwners[m.centerLocation] ??
      locationOwners[m.centerLocation - 1] ??
      "";
    if (owner !== "") {
      marketOwners[m.id] = owner;
    }
  }
  const trade = { ...rawTrade, marketNames, marketOwners };

  const pastWars: import("../types").PastWarData[] = rawPastWars.map((pw) => ({
    countryATag: countryTags[pw.countryA] ?? `id:${pw.countryA}`,
    countryBTag: countryTags[pw.countryB] ?? `id:${pw.countryB}`,
    lastWarDate: pw.lastWarDate,
    warScore: pw.warScore,
  }));

  const warReparations: import("../types").WarReparationData[] =
    rawAgreements.reparations.map((r) => ({
      winnerTag: countryTags[r.winner] ?? `id:${r.winner}`,
      loserTag: countryTags[r.loser] ?? `id:${r.loser}`,
      startDate: r.startDate,
      expirationDate: r.expirationDate,
    }));
  const annulledTreaties: import("../types").AnnulledTreatyData[] =
    rawAgreements.annulledTreaties.map((a) => ({
      enforcerTag: countryTags[a.enforcer] ?? `id:${a.enforcer}`,
      targetTag: countryTags[a.target] ?? `id:${a.target}`,
      startDate: a.startDate,
      expirationDate: a.expirationDate,
    }));
  const royalMarriages: import("../types").RoyalMarriageData[] =
    rawAgreements.royalMarriages.map((rm) => ({
      countryATag: countryTags[rm.countryA] ?? `id:${rm.countryA}`,
      countryBTag: countryTags[rm.countryB] ?? `id:${rm.countryB}`,
      startDate: rm.startDate,
    }));
  const activeCBs: import("../types").ActiveCBData[] =
    rawAgreements.activeCBs.map((cb) => ({
      holderTag: countryTags[cb.holder] ?? `id:${cb.holder}`,
      targetTag: countryTags[cb.target] ?? `id:${cb.target}`,
      startDate: cb.startDate,
    }));

  return {
    countryLocations,
    tagToPlayers,
    countryColors,
    overlordSubjects,
    countryNames,
    countryStats,
    locationRgos,
    wars,
    pastWars,
    warReparations,
    annulledTreaties,
    royalMarriages,
    activeCBs,
    trade,
  };
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
    console.error(
      "[parseBinarySave] ZIP magic bytes (PK) not found — is this a binary .eu5 save?"
    );
    return emptyParsedSave();
  } else {
    // found ZIP data — proceed
  }

  const files = unzipSync(fileData.subarray(pkOffset));
  const gamestate = files["gamestate"];
  const stringLookup = files["string_lookup"];

  if (!gamestate) {
    console.error("[parseBinarySave] 'gamestate' entry missing from save ZIP");
    return emptyParsedSave();
  } else {
    // gamestate present
  }

  if (!stringLookup) {
    console.error(
      "[parseBinarySave] 'string_lookup' entry missing from save ZIP"
    );
    return emptyParsedSave();
  } else {
    // string_lookup present
  }

  const dynStrings = parseStringLookup(stringLookup);
  return parseGamestate(gamestate, dynStrings);
};
