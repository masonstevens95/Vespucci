/**
 * War manager reader — active wars with participants, scores, and battles.
 *
 * All functions are pure arrow expressions with immutable variables.
 * No null, no exceptions, every if has an else.
 */

import { TokenReader } from "../token-reader";
import { BinaryToken, isValueToken, valuePayloadSize } from "../tokens";
import { tokenId } from "../token-names";
import { isFixed5, readFixed5 } from "./fixed5";

// =============================================================================
// Types
// =============================================================================

export interface WarParticipant {
  readonly country: number;
  readonly side: "attacker" | "defender";
  readonly reason: string;
}

export interface WarBattle {
  readonly location: number;
  readonly date: number;
  readonly attackerWon: boolean;
  readonly attackerLosses: number;
  readonly defenderLosses: number;
  readonly attackerTotal: number;
  readonly defenderTotal: number;
  readonly attackerCountry: number;
  readonly defenderCountry: number;
  readonly battleWarScore: number;
  readonly attackerTroopBreakdown: readonly number[];
  readonly defenderTroopBreakdown: readonly number[];
  readonly attackerLossBreakdown: readonly number[];
  readonly defenderLossBreakdown: readonly number[];
  readonly attackerCommander: number;
  readonly defenderCommander: number;
  readonly attackerPrisoners: number;
  readonly defenderPrisoners: number;
  readonly attackerWarExhaustion: number;
  readonly defenderWarExhaustion: number;
}

export interface OccupiedLocation {
  readonly location: number;
  readonly controller: number;
}

export interface War {
  readonly attackerId: number;
  readonly defenderId: number;
  readonly casusBelli: string;
  readonly targetProvince: number;
  readonly startDate: number;
  readonly endDate: number;
  readonly isEnded: boolean;
  readonly isCivilWar: boolean;
  readonly isRevolt: boolean;
  readonly attackerScore: number;
  readonly defenderScore: number;
  readonly warDirectionQuarter: number;
  readonly warDirectionYear: number;
  readonly stalledYears: number;
  readonly participants: readonly WarParticipant[];
  readonly battles: readonly WarBattle[];
  readonly occupiedLocations: readonly OccupiedLocation[];
}

// =============================================================================
// Token IDs
// =============================================================================

const WAR_MGR = tokenId("war_manager") ?? -1;
const DATABASE = tokenId("database") ?? -1;
const ALL = tokenId("all") ?? -1;
const COUNTRY = tokenId("country") ?? -1;
const SIDE = 0x33; // "side" engine token
const REASON = tokenId("reason") ?? -1;
const ORIGINAL_ATTACKER = tokenId("original_attacker") ?? -1;
const ORIGINAL_ATTACKER_TARGET = tokenId("original_attacker_target") ?? -1;
const CASUS_BELLI = tokenId("casus_belli") ?? -1;
const START_DATE = tokenId("start_date") ?? -1;
const END_DATE = tokenId("end_date") ?? -1;
const PREVIOUS = tokenId("previous") ?? -1;
const ATTACKER_SCORE = tokenId("attacker_score") ?? -1;
const DEFENDER_SCORE = tokenId("defender_score") ?? -1;
const BATTLE = tokenId("battle") ?? -1;
const TAKE_PROVINCE = tokenId("take_province") ?? -1;
const LOCATION = tokenId("location") ?? -1;
const DATE = tokenId("date") ?? -1;
const RESULT = tokenId("result") ?? -1;
const ATTACKER = tokenId("attacker") ?? -1;
const DEFENDER = tokenId("defender") ?? -1;
const LOSSES = tokenId("losses") ?? -1;
const HAS_CIVIL_WAR = tokenId("has_civil_war") ?? -1;
const REVOLT = tokenId("revolt") ?? -1;
const WAR_DIRECTION_QUARTER = tokenId("war_direction_quarter") ?? -1;
const WAR_DIRECTION_YEAR = tokenId("war_direction_year") ?? -1;
const STALLED_YEARS = tokenId("stalled_years") ?? -1;
const TARGET_PROVINCE = tokenId("target_province") ?? -1;
const WHO = tokenId("who") ?? -1;
const TOTAL = tokenId("total") ?? -1;
const WAR_SCORE = tokenId("war_score") ?? -1;
const CHARACTER = tokenId("character") ?? -1;
const IMPRISONED = tokenId("imprisoned") ?? -1;
const WAR_EXHAUSTION_BATTLE = tokenId("war_exhaustion") ?? -1;
const LOCATIONS_TOK = tokenId("locations") ?? -1;
// WAR_ATTACKER_WIN (15296) exists but we use RESULT for the boolean instead

// =============================================================================
// Readers
// =============================================================================

/** Read losses from a battle side: sum all FIXED5 values in the losses block. */
const readBattleLosses = (r: TokenReader, data: Uint8Array): number => {
  let total = 0;
  let d = 1;
  while (!r.done && d > 0) {
    const ft = r.readToken();
    if (ft === BinaryToken.CLOSE) { d--; continue; }
    else if (ft === BinaryToken.OPEN) { d++; continue; }
    else if (ft === BinaryToken.EQUAL) { continue; }
    else if (isFixed5(ft)) {
      const size = valuePayloadSize(ft, data, r.pos);
      total += readFixed5(data, r.pos, ft);
      r.pos += size;
    } else if (isValueToken(ft)) { r.skipValuePayload(ft); continue; }
    else if (r.peekToken() === BinaryToken.EQUAL) { r.readToken(); r.skipValue(); }
    else { /* bare token */ }
  }
  return total;
};

/** Read up to 8 FIXED5/numeric values from a block and return them as an array. */
const readBattleArray = (r: TokenReader, data: Uint8Array): readonly number[] => {
  const values: number[] = [];
  let d = 1;
  while (!r.done && d > 0) {
    const ft = r.readToken();
    if (ft === BinaryToken.CLOSE) { d--; continue; }
    else if (ft === BinaryToken.OPEN) { d++; continue; }
    else if (ft === BinaryToken.EQUAL) { continue; }
    else if (isFixed5(ft)) {
      const size = valuePayloadSize(ft, data, r.pos);
      values.push(readFixed5(data, r.pos, ft));
      r.pos += size;
    } else if (isValueToken(ft)) { r.skipValuePayload(ft); continue; }
    else if (r.peekToken() === BinaryToken.EQUAL) { r.readToken(); r.skipValue(); }
    else { /* bare token */ }
  }
  return values;
};

/** Read a battle block. */
const readBattle = (r: TokenReader, data: Uint8Array): WarBattle => {
  let location = 0, date = 0, attackerWon = true;
  let attackerLosses = 0, defenderLosses = 0;
  let attackerTotal = 0, defenderTotal = 0;
  let attackerCountry = -1, defenderCountry = -1;
  let battleWarScore = 0;
  let attackerTroopBreakdown: readonly number[] = [];
  let defenderTroopBreakdown: readonly number[] = [];
  let attackerLossBreakdown: readonly number[] = [];
  let defenderLossBreakdown: readonly number[] = [];
  let attackerCommander = -1, defenderCommander = -1;
  let attackerPrisoners = 0, defenderPrisoners = 0;
  let attackerWarExhaustion = 0, defenderWarExhaustion = 0;
  let d = 1;
  while (!r.done && d > 0) {
    const ft = r.readToken();
    if (ft === BinaryToken.CLOSE) { d--; continue; }
    else if (ft === BinaryToken.OPEN) { d++; continue; }
    else if (ft === BinaryToken.EQUAL) { continue; }
    else if (isValueToken(ft)) { r.skipValuePayload(ft); continue; }
    if (d === 1 && r.peekToken() === BinaryToken.EQUAL) {
      if (ft === LOCATION) { r.readToken(); const vt = r.readToken(); if (vt === BinaryToken.I32) location = r.readI32(); else if (vt === BinaryToken.U32) location = r.readU32(); else r.skipValuePayload(vt); }
      else if (ft === DATE) { r.readToken(); const vt = r.readToken(); if (vt === BinaryToken.I32) date = r.readI32(); else if (vt === BinaryToken.U32) date = r.readU32(); else r.skipValuePayload(vt); }
      else if (ft === RESULT) { r.readToken(); const vt = r.readToken(); if (vt === BinaryToken.BOOL) attackerWon = r.readBool(); else r.skipValuePayload(vt); }
      else if (ft === ATTACKER) {
        r.readToken();
        if (r.expectOpen()) {
          let ad = 1;
          while (!r.done && ad > 0) {
            const aft = r.readToken();
            if (aft === BinaryToken.CLOSE) { ad--; continue; }
            else if (aft === BinaryToken.OPEN) { ad++; continue; }
            else if (aft === BinaryToken.EQUAL) { continue; }
            else if (isValueToken(aft)) { r.skipValuePayload(aft); continue; }
            if (ad === 1 && r.peekToken() === BinaryToken.EQUAL) {
              if (aft === LOSSES) {
                r.readToken();
                if (r.expectOpen()) {
                  attackerLossBreakdown = readBattleArray(r, data);
                  attackerLosses = attackerLossBreakdown.reduce((s, v) => s + v, 0);
                } else { r.skipValue(); }
              }
              else if (aft === TOTAL) {
                r.readToken();
                if (r.expectOpen()) {
                  attackerTroopBreakdown = readBattleArray(r, data);
                  attackerTotal = attackerTroopBreakdown.reduce((s, v) => s + v, 0);
                } else { r.skipValue(); }
              }
              else if (aft === IMPRISONED) { r.readToken(); if (r.expectOpen()) { attackerPrisoners = readBattleLosses(r, data); } else { r.skipValue(); } }
              else if (aft === CHARACTER) { r.readToken(); const vt = r.readToken(); if (vt === BinaryToken.I32) { attackerCommander = r.readI32(); } else if (vt === BinaryToken.U32) { attackerCommander = r.readU32(); } else { r.skipValuePayload(vt); } }
              else if (aft === WHO) {
                r.readToken();
                if (r.expectOpen()) {
                  let wd2 = 1;
                  while (!r.done && wd2 > 0) {
                    const wft2 = r.readToken();
                    if (wft2 === BinaryToken.CLOSE) { wd2--; continue; }
                    else if (wft2 === BinaryToken.OPEN) { wd2++; continue; }
                    else if (wft2 === BinaryToken.EQUAL) { continue; }
                    else if (isValueToken(wft2)) { r.skipValuePayload(wft2); continue; }
                    if (wd2 === 1 && r.peekToken() === BinaryToken.EQUAL) {
                      if (wft2 === COUNTRY) {
                        r.readToken(); const vt = r.readToken();
                        if (vt === BinaryToken.I32) { attackerCountry = r.readI32(); }
                        else if (vt === BinaryToken.U32) { attackerCountry = r.readU32(); }
                        else { r.skipValuePayload(vt); }
                      } else if (wft2 === WAR_EXHAUSTION_BATTLE) {
                        r.readToken(); const vt = r.readToken();
                        if (isFixed5(vt)) { const sz = valuePayloadSize(vt, data, r.pos); attackerWarExhaustion = readFixed5(data, r.pos, vt); r.pos += sz; }
                        else if (vt === BinaryToken.I32) { attackerWarExhaustion = r.readI32(); }
                        else if (vt === BinaryToken.U32) { attackerWarExhaustion = r.readU32(); }
                        else { r.skipValuePayload(vt); }
                      } else { r.readToken(); r.skipValue(); }
                    } else { /* bare */ }
                  }
                } else { r.skipValue(); }
              }
              else { r.readToken(); r.skipValue(); }
            } else { /* bare */ }
          }
        }
      } else if (ft === DEFENDER) {
        r.readToken();
        if (r.expectOpen()) {
          let dd2 = 1;
          while (!r.done && dd2 > 0) {
            const dft = r.readToken();
            if (dft === BinaryToken.CLOSE) { dd2--; continue; }
            else if (dft === BinaryToken.OPEN) { dd2++; continue; }
            else if (dft === BinaryToken.EQUAL) { continue; }
            else if (isValueToken(dft)) { r.skipValuePayload(dft); continue; }
            if (dd2 === 1 && r.peekToken() === BinaryToken.EQUAL) {
              if (dft === LOSSES) {
                r.readToken();
                if (r.expectOpen()) {
                  defenderLossBreakdown = readBattleArray(r, data);
                  defenderLosses = defenderLossBreakdown.reduce((s, v) => s + v, 0);
                } else { r.skipValue(); }
              }
              else if (dft === TOTAL) {
                r.readToken();
                if (r.expectOpen()) {
                  defenderTroopBreakdown = readBattleArray(r, data);
                  defenderTotal = defenderTroopBreakdown.reduce((s, v) => s + v, 0);
                } else { r.skipValue(); }
              }
              else if (dft === IMPRISONED) { r.readToken(); if (r.expectOpen()) { defenderPrisoners = readBattleLosses(r, data); } else { r.skipValue(); } }
              else if (dft === CHARACTER) { r.readToken(); const vt = r.readToken(); if (vt === BinaryToken.I32) { defenderCommander = r.readI32(); } else if (vt === BinaryToken.U32) { defenderCommander = r.readU32(); } else { r.skipValuePayload(vt); } }
              else if (dft === WHO) {
                r.readToken();
                if (r.expectOpen()) {
                  let wd3 = 1;
                  while (!r.done && wd3 > 0) {
                    const wft3 = r.readToken();
                    if (wft3 === BinaryToken.CLOSE) { wd3--; continue; }
                    else if (wft3 === BinaryToken.OPEN) { wd3++; continue; }
                    else if (wft3 === BinaryToken.EQUAL) { continue; }
                    else if (isValueToken(wft3)) { r.skipValuePayload(wft3); continue; }
                    if (wd3 === 1 && r.peekToken() === BinaryToken.EQUAL) {
                      if (wft3 === COUNTRY) {
                        r.readToken(); const vt = r.readToken();
                        if (vt === BinaryToken.I32) { defenderCountry = r.readI32(); }
                        else if (vt === BinaryToken.U32) { defenderCountry = r.readU32(); }
                        else { r.skipValuePayload(vt); }
                      } else if (wft3 === WAR_EXHAUSTION_BATTLE) {
                        r.readToken(); const vt = r.readToken();
                        if (isFixed5(vt)) { const sz = valuePayloadSize(vt, data, r.pos); defenderWarExhaustion = readFixed5(data, r.pos, vt); r.pos += sz; }
                        else if (vt === BinaryToken.I32) { defenderWarExhaustion = r.readI32(); }
                        else if (vt === BinaryToken.U32) { defenderWarExhaustion = r.readU32(); }
                        else { r.skipValuePayload(vt); }
                      } else { r.readToken(); r.skipValue(); }
                    } else { /* bare */ }
                  }
                } else { r.skipValue(); }
              }
              else { r.readToken(); r.skipValue(); }
            } else { /* bare */ }
          }
        }
      } else if (ft === WAR_SCORE) {
        r.readToken(); const vt = r.readToken();
        if (isFixed5(vt)) { const sz = valuePayloadSize(vt, data, r.pos); battleWarScore = readFixed5(data, r.pos, vt); r.pos += sz; }
        else if (vt === BinaryToken.I32) { battleWarScore = r.readI32(); }
        else if (vt === BinaryToken.U32) { battleWarScore = r.readU32(); }
        else { r.skipValuePayload(vt); }
      } else { r.readToken(); r.skipValue(); }
    } else { /* other */ }
  }
  return {
    location, date, attackerWon, attackerLosses, defenderLosses, attackerTotal, defenderTotal,
    attackerCountry, defenderCountry, battleWarScore,
    attackerTroopBreakdown, defenderTroopBreakdown, attackerLossBreakdown, defenderLossBreakdown,
    attackerCommander, defenderCommander, attackerPrisoners, defenderPrisoners,
    attackerWarExhaustion, defenderWarExhaustion,
  };
};

/** Read participants from the "all" block.
 *  Structure: all = { { country=X history={ request={ side="Attacker" reason="Instigator" } } } { ... } } */
const readParticipants = (r: TokenReader): WarParticipant[] => {
  const participants: WarParticipant[] = [];
  // We're inside the "all" block. Each { ... } is a participant.
  let d = 1;
  while (!r.done && d > 0) {
    const ft = r.readToken();
    if (ft === BinaryToken.CLOSE) { d--; continue; }
    else if (ft === BinaryToken.OPEN) {
      d++;
      if (d === 2) {
        // Entering a participant entry — scan its entire subtree
        let country = -1;
        let side: "attacker" | "defender" = "attacker";
        let reason = "";
        let pd = 1;
        while (!r.done && pd > 0) {
          const pft = r.readToken();
          if (pft === BinaryToken.CLOSE) { pd--; continue; }
          else if (pft === BinaryToken.OPEN) { pd++; continue; }
          else if (pft === BinaryToken.EQUAL) { continue; }
          else if (isValueToken(pft)) { r.skipValuePayload(pft); continue; }
          // Check for fields at any depth inside this participant
          if (r.peekToken() === BinaryToken.EQUAL) {
            if (pft === COUNTRY && pd === 1) {
              r.readToken();
              const vt = r.readToken();
              if (vt === BinaryToken.I32) { country = r.readI32(); }
              else if (vt === BinaryToken.U32) { country = r.readU32(); }
              else { r.skipValuePayload(vt); }
            } else if (pft === SIDE) {
              r.readToken();
              const sv = r.readStringValue();
              if (sv !== null) { side = sv.toLowerCase().startsWith("d") ? "defender" : "attacker"; }
              else { r.skipValue(); }
            } else if (pft === REASON && reason === "") {
              r.readToken();
              const sv = r.readStringValue();
              if (sv !== null) { reason = sv; }
              else { r.skipValue(); }
            } else {
              r.readToken();
              // Don't skipValue for blocks — descend into them to find side/reason
              if (r.peekToken() !== BinaryToken.OPEN) { r.skipValue(); }
              else { /* let the OPEN be consumed by the main loop */ }
            }
          } else { /* bare token */ }
        }
        if (country >= 0) {
          participants.push({ country, side, reason });
        }
        d--; // consumed the close
      }
      continue;
    }
    else if (ft === BinaryToken.EQUAL) { continue; }
    else if (isValueToken(ft)) { r.skipValuePayload(ft); continue; }
    if (r.peekToken() === BinaryToken.EQUAL) { r.readToken(); r.skipValue(); }
    else { /* bare */ }
  }
  return participants;
};

/** Read occupied locations: alternating location_id, controller_country_id pairs. */
const readOccupiedLocations = (r: TokenReader): OccupiedLocation[] => {
  const result: OccupiedLocation[] = [];
  let d = 1;
  while (!r.done && d > 0) {
    const ft = r.peekToken();
    if (ft === BinaryToken.CLOSE) { r.readToken(); d--; continue; }
    else if (ft === BinaryToken.OPEN) { r.readToken(); d++; continue; }
    else if (ft === BinaryToken.I32 || ft === BinaryToken.U32) {
      r.readToken();
      const locId = ft === BinaryToken.I32 ? r.readI32() : r.readU32();
      // Read the controller ID
      const ft2 = r.peekToken();
      if (ft2 === BinaryToken.I32 || ft2 === BinaryToken.U32) {
        r.readToken();
        const ctrlId = ft2 === BinaryToken.I32 ? r.readI32() : r.readU32();
        result.push({ location: locId, controller: ctrlId });
      } else {
        /* unexpected token after location — skip */
      }
    } else {
      r.readToken();
      if (isValueToken(ft)) { r.skipValuePayload(ft); }
      else { /* structural or bare token */ }
    }
  }
  return result;
};

/** Read all active wars from war_manager > database. */
export const readWars = (
  data: Uint8Array,
  dynStrings: string[],
): War[] => {
  const r = new TokenReader(data, dynStrings);
  const wars: War[] = [];

  // Find war_manager
  r.pos = 0;
  let depth = 0;
  while (!r.done) {
    const ft = r.readToken();
    if (ft === BinaryToken.CLOSE) { depth--; continue; }
    else if (ft === BinaryToken.OPEN) { depth++; continue; }
    else if (ft === BinaryToken.EQUAL) { continue; }
    else if (isValueToken(ft)) { r.skipValuePayload(ft); continue; }
    if (depth === 0 && ft === WAR_MGR && r.peekToken() === BinaryToken.EQUAL) {
      r.readToken(); r.readToken(); // = {
      let d = 1;
      while (!r.done && d > 0) {
        const ft2 = r.readToken();
        if (ft2 === BinaryToken.CLOSE) { d--; continue; }
        else if (ft2 === BinaryToken.OPEN) { d++; continue; }
        else if (ft2 === BinaryToken.EQUAL) { continue; }
        else if (isValueToken(ft2)) { r.skipValuePayload(ft2); continue; }
        if (d === 1 && ft2 === DATABASE && r.peekToken() === BinaryToken.EQUAL) {
          r.readToken(); r.readToken(); // = {
          // Read entries: id { ... } or id none
          while (!r.done) {
            const peek = r.peekToken();
            if (peek === BinaryToken.CLOSE) { r.readToken(); break; }
            if (peek === BinaryToken.I32 || peek === BinaryToken.U32) {
              r.readToken();
              peek === BinaryToken.I32 ? r.readI32() : r.readU32();
              // Consume = between id and value
              if (r.peekToken() === BinaryToken.EQUAL) { r.readToken(); }
              // Check if { ... } (active war) or "none" (ended war)
              if (r.peekToken() === BinaryToken.OPEN) {
                r.readToken(); // {
                let attackerId = -1, defenderId = -1, casusBelli = "", targetProvince = -1;
                let startDate = 0, endDate = 0, isEnded = false;
                let isCivilWar = false, isRevolt = false;
                let attackerScore = 0, defenderScore = 0;
                let warDirectionQuarter = 0, warDirectionYear = 0, stalledYears = 0;
                let participants: WarParticipant[] = [];
                const battles: WarBattle[] = [];
                let occupiedLocations: OccupiedLocation[] = [];
                let wd = 1;
                while (!r.done && wd > 0) {
                  const wft = r.readToken();
                  if (wft === BinaryToken.CLOSE) { wd--; continue; }
                  else if (wft === BinaryToken.OPEN) { wd++; continue; }
                  else if (wft === BinaryToken.EQUAL) { continue; }
                  else if (isValueToken(wft)) { r.skipValuePayload(wft); continue; }
                  if (wd === 1 && r.peekToken() === BinaryToken.EQUAL) {
                    if (wft === ALL) { r.readToken(); if (r.expectOpen()) { participants = readParticipants(r); } else { r.skipValue(); } }
                    else if (wft === ORIGINAL_ATTACKER) { r.readToken(); const vt = r.readToken(); if (vt === BinaryToken.I32) attackerId = r.readI32(); else if (vt === BinaryToken.U32) attackerId = r.readU32(); else r.skipValuePayload(vt); }
                    else if (wft === ORIGINAL_ATTACKER_TARGET) { r.readToken(); const vt = r.readToken(); if (vt === BinaryToken.I32) defenderId = r.readI32(); else if (vt === BinaryToken.U32) defenderId = r.readU32(); else r.skipValuePayload(vt); }
                    else if (wft === ATTACKER_SCORE) { r.readToken(); const vt = r.readToken(); if (isFixed5(vt)) { const sz = valuePayloadSize(vt, data, r.pos); attackerScore = readFixed5(data, r.pos, vt); r.pos += sz; } else if (vt === BinaryToken.I32) attackerScore = r.readI32(); else if (vt === BinaryToken.U32) attackerScore = r.readU32(); else r.skipValuePayload(vt); }
                    else if (wft === DEFENDER_SCORE) { r.readToken(); const vt = r.readToken(); if (isFixed5(vt)) { const sz = valuePayloadSize(vt, data, r.pos); defenderScore = readFixed5(data, r.pos, vt); r.pos += sz; } else if (vt === BinaryToken.I32) defenderScore = r.readI32(); else if (vt === BinaryToken.U32) defenderScore = r.readU32(); else r.skipValuePayload(vt); }
                    else if (wft === START_DATE) { r.readToken(); const vt = r.readToken(); if (vt === BinaryToken.I32) startDate = r.readI32(); else if (vt === BinaryToken.U32) startDate = r.readU32(); else r.skipValuePayload(vt); }
                    else if (wft === END_DATE) { r.readToken(); const vt = r.readToken(); if (vt === BinaryToken.I32) endDate = r.readI32(); else if (vt === BinaryToken.U32) endDate = r.readU32(); else r.skipValuePayload(vt); }
                    else if (wft === PREVIOUS) { isEnded = true; r.readToken(); r.skipValue(); }
                    else if (wft === HAS_CIVIL_WAR) { isCivilWar = true; r.readToken(); r.skipValue(); }
                    else if (wft === REVOLT) { isRevolt = true; r.readToken(); r.skipValue(); }
                    else if (wft === WAR_DIRECTION_QUARTER) { r.readToken(); const vt = r.readToken(); if (isFixed5(vt)) { const sz = valuePayloadSize(vt, data, r.pos); warDirectionQuarter = readFixed5(data, r.pos, vt); r.pos += sz; } else if (vt === BinaryToken.I32) warDirectionQuarter = r.readI32(); else if (vt === BinaryToken.U32) warDirectionQuarter = r.readU32(); else r.skipValuePayload(vt); }
                    else if (wft === WAR_DIRECTION_YEAR) { r.readToken(); const vt = r.readToken(); if (isFixed5(vt)) { const sz = valuePayloadSize(vt, data, r.pos); warDirectionYear = readFixed5(data, r.pos, vt); r.pos += sz; } else if (vt === BinaryToken.I32) warDirectionYear = r.readI32(); else if (vt === BinaryToken.U32) warDirectionYear = r.readU32(); else r.skipValuePayload(vt); }
                    else if (wft === STALLED_YEARS) { r.readToken(); const vt = r.readToken(); if (vt === BinaryToken.I32) stalledYears = r.readI32(); else if (vt === BinaryToken.U32) stalledYears = r.readU32(); else r.skipValuePayload(vt); }
                    else if (wft === BATTLE) { r.readToken(); if (r.expectOpen()) { battles.push(readBattle(r, data)); } else { r.skipValue(); } }
                    else if (wft === LOCATIONS_TOK) { r.readToken(); if (r.expectOpen()) { occupiedLocations = readOccupiedLocations(r); } else { r.skipValue(); } }
                    else if (wft === TAKE_PROVINCE) {
                      r.readToken();
                      if (r.expectOpen()) {
                        let tpd = 1;
                        while (!r.done && tpd > 0) {
                          const tft = r.readToken();
                          if (tft === BinaryToken.CLOSE) { tpd--; continue; }
                          else if (tft === BinaryToken.OPEN) { tpd++; continue; }
                          else if (tft === BinaryToken.EQUAL) { continue; }
                          else if (isValueToken(tft)) { r.skipValuePayload(tft); continue; }
                          if (r.peekToken() === BinaryToken.EQUAL) {
                            if (tft === CASUS_BELLI) {
                              r.readToken();
                              const sv = r.readStringValue();
                              if (sv !== null) { casusBelli = sv; }
                              else { r.skipValue(); }
                            } else if (tft === TARGET_PROVINCE) {
                              r.readToken();
                              const vt = r.readToken();
                              if (vt === BinaryToken.I32) { targetProvince = r.readI32(); }
                              else if (vt === BinaryToken.U32) { targetProvince = r.readU32(); }
                              else { r.skipValuePayload(vt); }
                            } else { r.readToken(); r.skipValue(); }
                          }
                          else { /* bare */ }
                        }
                      } else { r.skipValue(); }
                    }
                    else { r.readToken(); r.skipValue(); }
                  } else { /* bare */ }
                }
                if (attackerId >= 0) {
                  wars.push({ attackerId, defenderId, casusBelli, targetProvince, startDate, endDate, isEnded, isCivilWar, isRevolt, attackerScore, defenderScore, warDirectionQuarter, warDirectionYear, stalledYears, participants, battles, occupiedLocations });
                }
              } else {
                // "none" or other bare token — consume it
                r.readToken();
              }
            } else {
              r.readToken();
              if (r.peekToken() === BinaryToken.EQUAL) { r.readToken(); r.skipValue(); }
            }
          }
          break;
        } else if (r.peekToken() === BinaryToken.EQUAL) { r.readToken(); r.skipValue(); }
      }
      break;
    }
  }
  return wars;
};
