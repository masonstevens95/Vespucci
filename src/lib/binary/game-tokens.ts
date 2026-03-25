/**
 * Cached token IDs for fields used by the binary parser.
 *
 * Combines game-level tokens (from eu5-tokens.json via tokenId()) with
 * engine-level tokens (hardcoded, below 0x0100) that aren't in the mapping file.
 */

import { tokenId } from "./token-names";

export const T = {
  metadata:      tokenId("metadata"),
  compatibility: tokenId("compatibility"),
  locations:     tokenId("locations"),
  countries:     tokenId("countries"),
  tags:          tokenId("tags"),
  database:      tokenId("database"),
  flag:          tokenId("flag"),
  capital:       tokenId("capital"),
  owner:         tokenId("owner"),
  ioManager:     tokenId("international_organization_manager"),
  type:          tokenId("type"),
  leader:        tokenId("leader"),
  allMembers:    tokenId("all_members"),
  loc:           tokenId("loc"),
  diplomacyMgr:  tokenId("diplomacy_manager"),
  libertyDesire: tokenId("liberty_desire"),
  playedCountry: tokenId("played_country"),
  name:          tokenId("name"),
  country:       tokenId("country"),
  subjectTax:    tokenId("last_months_subject_tax"),
  mapColor:      tokenId("map_color"),
  integrationOwner: tokenId("integration_owner"),
  warManager:   tokenId("war_manager"),
  calledAlly:   tokenId("called_ally"),
  reason:       tokenId("reason"),

  // Engine tokens (below 0x0270c) — not in the game token mapping file
  COLOR:         0x0056,  // "color" field
  RGB:           0x0243,  // RGB color marker: 0x0243 { U32 U32 U32 }
  TYPE_ENGINE:   0x00e1,  // "type" field in IO entries
  NAME_ENGINE:   0x001b,  // "name" field in played_country
} as const;
