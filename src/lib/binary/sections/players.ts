import { TokenReader } from "../token-reader";
import { BinaryToken, isValueToken } from "../tokens";
import { T } from "../game-tokens";

/** Add a player name to a tag's player list, deduplicating. */
const addPlayer = (
  tagToPlayers: Record<string, string[]>,
  tag: string,
  name: string,
): void => {
  if (!tagToPlayers[tag]) {
    tagToPlayers[tag] = [];
  } else {
    /* array already exists */
  }
  if (!tagToPlayers[tag].includes(name)) {
    tagToPlayers[tag].push(name);
  } else {
    /* player already listed — skip duplicate */
  }
};

/** Read a played_country block for player name + country ID. */
export const readPlayedCountry = (
  r: TokenReader,
  countryTags: Record<number, string>,
  tagToPlayers: Record<string, string[]>,
): void => {
  let playerName = "";
  let countryId = -1;
  let depth = 1;

  while (!r.done && depth > 0) {
    const tok = r.readToken();
    if (tok === BinaryToken.CLOSE) {
      depth--;
      continue;
    } else if (tok === BinaryToken.OPEN) {
      depth++;
      continue;
    } else if (tok === BinaryToken.EQUAL) {
      continue;
    } else if (isValueToken(tok)) {
      r.skipValuePayload(tok);
      continue;
    } else if (depth !== 1) {
      continue;
    } else {
      /* top-level key token — handle below */
    }

    if (tok === T.name || tok === T.NAME_ENGINE) {
      r.expectEqual();
      playerName = r.readStringValue() ?? "";
    } else if (tok === T.country) {
      r.expectEqual();
      countryId = r.readIntValue() ?? -1;
    } else if (r.peekToken() === BinaryToken.EQUAL) {
      r.readToken();
      r.skipValue();
    } else {
      /* standalone key with no value — already consumed */
    }
  }

  const tag = countryTags[countryId] ?? "";
  if (playerName !== "" && countryId !== -1 && tag !== "") {
    addPlayer(tagToPlayers, tag, playerName);
  } else {
    /* incomplete player data — skip registration */
  }
};
