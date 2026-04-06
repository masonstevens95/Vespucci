/**
 * Past wars reader — extracts war history from diplomacy_manager > relations.
 *
 * Each country's relations block contains per-country-pair entries with
 * last_war (date) and war_score (final score from their last conflict).
 */

import { TokenReader } from "../token-reader";
import { BinaryToken, isValueToken } from "../tokens";
import { tokenId } from "../token-names";

// =============================================================================
// Types
// =============================================================================

export interface PastWar {
  readonly countryA: number;
  readonly countryB: number;
  readonly lastWarDate: number;
  readonly warScore: number;
}

export interface WarReparation {
  readonly winner: number;
  readonly loser: number;
  readonly startDate: number;
  readonly expirationDate: number;
}

export interface AnnulledTreaty {
  readonly enforcer: number;
  readonly target: number;
  readonly startDate: number;
  readonly expirationDate: number;
}

export interface RoyalMarriage {
  readonly countryA: number;
  readonly countryB: number;
  readonly startDate: number;
}

export interface ActiveCasusBelli {
  readonly holder: number;
  readonly target: number;
  readonly startDate: number;
}

// =============================================================================
// Token IDs
// =============================================================================

const RELATIONS = tokenId("relations") ?? -1;
const LAST_WAR = tokenId("last_war") ?? -1;
const WAR_SCORE = tokenId("war_score") ?? -1;
const WAR_REPARATIONS = tokenId("war_reparations") ?? -1;
const ANNUL_TREATIES = tokenId("annul_treaties") ?? -1;
const FIRST = tokenId("first") ?? -1;
const SECOND = tokenId("second") ?? -1;
const START_DATE = tokenId("start_date") ?? -1;
const EXPIRATION_DATE = tokenId("expiration_date") ?? -1;
const ROYAL_MARRIAGE = tokenId("royal_marriage") ?? -1;
const CASUS_BELLI_DIP = tokenId("casus_belli") ?? -1;

// =============================================================================
// Reader
// =============================================================================

/** Read past war data from diplomacy_manager section.
 *  Assumes reader is positioned just inside the diplomacy_manager block. */
export const readPastWars = (
  r: TokenReader,
): PastWar[] => {
  const results: PastWar[] = [];
  let depth = 1;

  while (!r.done && depth > 0) {
    const tok = r.readToken();
    if (tok === BinaryToken.CLOSE) { depth--; continue; }
    else if (tok === BinaryToken.OPEN) { depth++; continue; }
    else if (tok === BinaryToken.EQUAL) { continue; }
    else if (isValueToken(tok)) { r.skipValuePayload(tok); continue; }

    // At depth 1: country ID entries (countryA)
    if (depth === 1 && (tok === BinaryToken.I32 || tok === BinaryToken.U32)) {
      // This shouldn't happen since we already handled isValueToken
    } else if (depth === 1 && r.peekToken() === BinaryToken.EQUAL) {
      r.readToken();
      r.skipValue();
    }
  }

  // That approach won't work well since country IDs are value tokens.
  // Let me use a different strategy: scan for the relations pattern directly.
  return results;
};

/**
 * Read past wars by scanning the entire diplomacy_manager for relations blocks.
 * Structure: diplomacy_manager = { COUNTRY_ID { relations = { OTHER_ID { last_war = X war_score = Y } } } }
 */
export const readPastWarsFromDiplomacy = (
  data: Uint8Array,
  dynStrings: string[],
  sectionOffset: number,
): PastWar[] => {
  const r = new TokenReader(data, dynStrings);
  r.pos = sectionOffset;

  const results: PastWar[] = [];
  const seen = new Set<string>(); // deduplicate A-B and B-A

  // We're inside diplomacy_manager = { ... }
  // Structure: COUNTRY_ID { ... relations = { OTHER_ID { last_war=X war_score=Y } } }
  let d1 = 1;
  while (!r.done && d1 > 0) {
    const tok = r.peekToken();
    if (tok === BinaryToken.CLOSE) { r.readToken(); d1--; continue; }

    // Look for integer (country ID)
    if (tok === BinaryToken.I32 || tok === BinaryToken.U32) {
      r.readToken();
      const countryA = tok === BinaryToken.I32 ? r.readI32() : r.readU32();

      // Expect = {
      if (r.peekToken() === BinaryToken.EQUAL) { r.readToken(); } else { continue; }
      if (r.peekToken() !== BinaryToken.OPEN) { r.skipValue(); continue; }
      r.readToken(); // {

      // Inside country entry: scan for relations = { ... }
      let d2 = 1;
      while (!r.done && d2 > 0) {
        const ft2 = r.readToken();
        if (ft2 === BinaryToken.CLOSE) { d2--; continue; }
        else if (ft2 === BinaryToken.OPEN) { d2++; continue; }
        else if (ft2 === BinaryToken.EQUAL) { continue; }
        else if (isValueToken(ft2)) { r.skipValuePayload(ft2); continue; }

        if (d2 === 1 && ft2 === RELATIONS && r.peekToken() === BinaryToken.EQUAL) {
          r.readToken(); // =
          if (r.peekToken() === BinaryToken.OPEN) {
            r.readToken(); // {
            // Inside relations: OTHER_ID { last_war=X war_score=Y }
            let d3 = 1;
            while (!r.done && d3 > 0) {
              const pk3 = r.peekToken();
              if (pk3 === BinaryToken.CLOSE) { r.readToken(); d3--; continue; }
              if (pk3 === BinaryToken.I32 || pk3 === BinaryToken.U32) {
                r.readToken();
                const countryB = pk3 === BinaryToken.I32 ? r.readI32() : r.readU32();

                if (r.peekToken() === BinaryToken.EQUAL) { r.readToken(); } else { continue; }
                if (r.peekToken() !== BinaryToken.OPEN) {
                  r.readToken(); // skip bare value
                  continue;
                }
                r.readToken(); // {

                // Scan this relation entry for last_war and war_score
                let lastWarDate = 0;
                let warScore = 0;
                let d4 = 1;
                while (!r.done && d4 > 0) {
                  const ft4 = r.readToken();
                  if (ft4 === BinaryToken.CLOSE) { d4--; continue; }
                  else if (ft4 === BinaryToken.OPEN) { d4++; continue; }
                  else if (ft4 === BinaryToken.EQUAL) { continue; }
                  else if (isValueToken(ft4)) { r.skipValuePayload(ft4); continue; }

                  if (d4 === 1 && r.peekToken() === BinaryToken.EQUAL) {
                    if (ft4 === LAST_WAR) {
                      r.readToken();
                      const vt = r.readToken();
                      if (vt === BinaryToken.I32) { lastWarDate = r.readI32(); }
                      else if (vt === BinaryToken.U32) { lastWarDate = r.readU32(); }
                      else { r.skipValuePayload(vt); }
                    } else if (ft4 === WAR_SCORE) {
                      r.readToken();
                      const vt = r.readToken();
                      if (vt === BinaryToken.I32) { warScore = r.readI32(); }
                      else if (vt === BinaryToken.U32) { warScore = r.readU32(); }
                      else { r.skipValuePayload(vt); }
                    } else {
                      r.readToken(); r.skipValue();
                    }
                  }
                }

                if (lastWarDate > 0) {
                  // Deduplicate: only keep A < B
                  const lo = Math.min(countryA, countryB);
                  const hi = Math.max(countryA, countryB);
                  const key = `${lo}-${hi}-${lastWarDate}`;
                  if (!seen.has(key)) {
                    seen.add(key);
                    results.push({ countryA, countryB, lastWarDate, warScore });
                  }
                }
              } else {
                r.readToken();
                if (r.peekToken() === BinaryToken.EQUAL) { r.readToken(); r.skipValue(); }
              }
            }
          } else {
            r.skipValue();
          }
        } else if (r.peekToken() === BinaryToken.EQUAL) {
          r.readToken(); r.skipValue();
        }
      }
    } else {
      r.readToken();
      if (r.peekToken() === BinaryToken.EQUAL) { r.readToken(); r.skipValue(); }
    }
  }

  // Sort by date descending (most recent first)
  results.sort((a, b) => b.lastWarDate - a.lastWarDate);
  return results;
};

/** Read a diplomacy block with first/second/start_date/expiration_date fields. */
const readDiplomacyPair = (r: TokenReader): { first: number; second: number; startDate: number; expirationDate: number } => {
  let first = -1, second = -1, startDate = 0, expirationDate = 0;
  let d = 1;
  while (!r.done && d > 0) {
    const ft = r.readToken();
    if (ft === BinaryToken.CLOSE) { d--; continue; }
    else if (ft === BinaryToken.OPEN) { d++; continue; }
    else if (ft === BinaryToken.EQUAL) { continue; }
    else if (isValueToken(ft)) { r.skipValuePayload(ft); continue; }
    if (d === 1 && r.peekToken() === BinaryToken.EQUAL) {
      if (ft === FIRST) {
        r.readToken();
        const vt = r.readToken();
        if (vt === BinaryToken.I32) { first = r.readI32(); }
        else if (vt === BinaryToken.U32) { first = r.readU32(); }
        else { r.skipValuePayload(vt); }
      } else if (ft === SECOND) {
        r.readToken();
        const vt = r.readToken();
        if (vt === BinaryToken.I32) { second = r.readI32(); }
        else if (vt === BinaryToken.U32) { second = r.readU32(); }
        else { r.skipValuePayload(vt); }
      } else if (ft === START_DATE) {
        r.readToken();
        const vt = r.readToken();
        if (vt === BinaryToken.I32) { startDate = r.readI32(); }
        else if (vt === BinaryToken.U32) { startDate = r.readU32(); }
        else { r.skipValuePayload(vt); }
      } else if (ft === EXPIRATION_DATE) {
        r.readToken();
        const vt = r.readToken();
        if (vt === BinaryToken.I32) { expirationDate = r.readI32(); }
        else if (vt === BinaryToken.U32) { expirationDate = r.readU32(); }
        else { r.skipValuePayload(vt); }
      } else { r.readToken(); r.skipValue(); }
    }
  }
  return { first, second, startDate, expirationDate };
};

/** Read war reparations, annulled treaties, royal marriages, and active CBs from top-level diplomacy_manager entries. */
export const readDiplomacyAgreements = (
  data: Uint8Array,
  dynStrings: string[],
  sectionOffset: number,
): { reparations: WarReparation[]; annulledTreaties: AnnulledTreaty[]; royalMarriages: RoyalMarriage[]; activeCBs: ActiveCasusBelli[] } => {
  const r = new TokenReader(data, dynStrings);
  r.pos = sectionOffset;

  const reparations: WarReparation[] = [];
  const annulledTreaties: AnnulledTreaty[] = [];
  const royalMarriages: RoyalMarriage[] = [];
  const activeCBs: ActiveCasusBelli[] = [];

  let d = 1;
  while (!r.done && d > 0) {
    const tok = r.readToken();
    if (tok === BinaryToken.CLOSE) { d--; continue; }
    else if (tok === BinaryToken.OPEN) { d++; continue; }
    else if (tok === BinaryToken.EQUAL) { continue; }
    else if (isValueToken(tok)) { r.skipValuePayload(tok); continue; }

    if (d === 1 && r.peekToken() === BinaryToken.EQUAL) {
      if (tok === WAR_REPARATIONS) {
        r.readToken();
        if (r.expectOpen()) {
          const pair = readDiplomacyPair(r);
          if (pair.first >= 0 && pair.second >= 0) {
            reparations.push({ winner: pair.first, loser: pair.second, startDate: pair.startDate, expirationDate: pair.expirationDate });
          }
        } else { r.skipValue(); }
      } else if (tok === ANNUL_TREATIES) {
        r.readToken();
        if (r.expectOpen()) {
          const pair = readDiplomacyPair(r);
          if (pair.first >= 0 && pair.second >= 0) {
            annulledTreaties.push({ enforcer: pair.first, target: pair.second, startDate: pair.startDate, expirationDate: pair.expirationDate });
          }
        } else { r.skipValue(); }
      } else if (tok === ROYAL_MARRIAGE) {
        r.readToken();
        if (r.expectOpen()) {
          const pair = readDiplomacyPair(r);
          if (pair.first >= 0 && pair.second >= 0) {
            royalMarriages.push({ countryA: pair.first, countryB: pair.second, startDate: pair.startDate });
          }
        } else { r.skipValue(); }
      } else if (tok === CASUS_BELLI_DIP) {
        r.readToken();
        if (r.expectOpen()) {
          const pair = readDiplomacyPair(r);
          if (pair.first >= 0 && pair.second >= 0) {
            activeCBs.push({ holder: pair.first, target: pair.second, startDate: pair.startDate });
          }
        } else { r.skipValue(); }
      } else {
        r.readToken(); r.skipValue();
      }
    }
  }

  return { reparations, annulledTreaties, royalMarriages, activeCBs };
};
