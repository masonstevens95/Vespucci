import { TokenReader } from "../token-reader";
import { BinaryToken } from "../tokens";
import { T } from "../game-tokens";

/** Read location ownership from the main locations section. */
export function readLocationOwnership(
  r: TokenReader,
  countryTags: Record<number, string>,
  locationOwners: Record<number, string>,
): void {
  let depth = 1;
  while (!r.done && depth > 0) {
    const tok = r.readToken();
    if (tok === BinaryToken.CLOSE) { depth--; continue; }
    if (tok === BinaryToken.OPEN) { depth++; continue; }
    if (tok === BinaryToken.EQUAL) continue;

    if (tok === T.locations) {
      r.expectEqual();
      r.expectOpen();
      readLocationEntries(r, countryTags, locationOwners);
      return;
    } else if (r.peekToken() === BinaryToken.EQUAL) {
      r.readToken();
      r.skipValue();
    }
  }
}

/** Read numeric-keyed location entries. */
export function readLocationEntries(
  r: TokenReader,
  countryTags: Record<number, string>,
  locationOwners: Record<number, string>,
): void {
  while (!r.done) {
    const tok = r.peekToken();
    if (tok === BinaryToken.CLOSE) { r.readToken(); return; }

    if (tok === BinaryToken.I32 || tok === BinaryToken.U32) {
      r.readToken();
      const locId = tok === BinaryToken.I32 ? r.readI32() : r.readU32();
      r.expectEqual();
      r.expectOpen();
      readLocationEntry(r, locId, countryTags, locationOwners);
    } else {
      r.readToken();
      if (r.peekToken() === BinaryToken.EQUAL) {
        r.readToken();
        r.skipValue();
      }
    }
  }
}

/** Read owner from a single location entry, then skip the rest. */
export function readLocationEntry(
  r: TokenReader,
  locId: number,
  countryTags: Record<number, string>,
  locationOwners: Record<number, string>,
): void {
  if (r.peekToken() === T.owner) {
    r.readToken();
    r.expectEqual();
    const ownerId = r.readIntValue();
    if (ownerId !== null && countryTags[ownerId]) {
      locationOwners[locId] = countryTags[ownerId];
    }
  }
  r.skipBlock();
}
