import { TokenReader } from "../token-reader";
import { BinaryToken } from "../tokens";
import { T } from "../game-tokens";

/** Read diplomacy manager for liberty_desire (subject identification). */
export const readDiplomacy = (
  r: TokenReader,
  subjectIds: Set<number>,
): void => {
  while (!r.done) {
    const tok = r.peekToken();
    if (tok === BinaryToken.CLOSE) {
      r.readToken();
      return;
    } else {
      /* not closing — process entry */
    }

    if (tok === BinaryToken.I32 || tok === BinaryToken.U32) {
      r.readToken();
      const countryId = tok === BinaryToken.I32 ? r.readI32() : r.readU32();
      r.expectEqual();
      r.expectOpen();
      if (readDiplomacyEntry(r)) {
        subjectIds.add(countryId);
      } else {
        /* entry has no liberty_desire — skip */
      }
    } else {
      r.readToken();
      if (r.peekToken() === BinaryToken.EQUAL) {
        r.readToken();
        r.skipValue();
      } else {
        /* standalone token with no value — already consumed */
      }
    }
  }
};

/** Read a single diplomacy entry, return true if it has liberty_desire. */
export const readDiplomacyEntry = (r: TokenReader): boolean => {
  let hasLiberty = false;
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
    } else {
      /* key or value token — handle below */
    }

    if (tok === T.libertyDesire && depth === 1) {
      hasLiberty = true;
      r.expectEqual();
      r.skipValue();
    } else if (depth === 1 && r.peekToken() === BinaryToken.EQUAL) {
      r.readToken();
      r.skipValue();
    } else {
      /* nested or non-key token — already consumed */
    }
  }
  return hasLiberty;
};
