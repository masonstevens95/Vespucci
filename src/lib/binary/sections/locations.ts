import { TokenReader } from "../token-reader";
import { BinaryToken } from "../tokens";
import { T } from "../game-tokens";

/** Read location ownership from the main locations section. */
export function readLocationOwnership(
  r: TokenReader,
  countryTags: Record<number, string>,
  locationOwners: Record<number, string>,
  integrationPairs?: Map<string, number>,
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
      readLocationEntries(r, countryTags, locationOwners, integrationPairs);
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
  integrationPairs?: Map<string, number>,
): void {
  while (!r.done) {
    const tok = r.peekToken();
    if (tok === BinaryToken.CLOSE) { r.readToken(); return; }

    if (tok === BinaryToken.I32 || tok === BinaryToken.U32) {
      r.readToken();
      const locId = tok === BinaryToken.I32 ? r.readI32() : r.readU32();
      r.expectEqual();
      r.expectOpen();
      readLocationEntry(r, locId, countryTags, locationOwners, integrationPairs);
    } else {
      r.readToken();
      if (r.peekToken() === BinaryToken.EQUAL) {
        r.readToken();
        r.skipValue();
      }
    }
  }
}

/**
 * Read owner and integration_owner from a location entry, then skip the rest.
 *
 * integration_owner tracks which country is integrating this location.
 * When integration_owner != owner, the owner is a subject/fiefdom of integration_owner.
 */
export function readLocationEntry(
  r: TokenReader,
  locId: number,
  countryTags: Record<number, string>,
  locationOwners: Record<number, string>,
  integrationPairs?: Map<string, number>,
): void {
  // Read owner (always first field)
  let ownerId: number | null = null;
  if (r.peekToken() === T.owner) {
    r.readToken();
    r.expectEqual();
    ownerId = r.readIntValue();
    if (ownerId !== null && countryTags[ownerId]) {
      locationOwners[locId] = countryTags[ownerId];
    }
  }

  // Skip the rest but scan for integration_owner if requested
  if (integrationPairs && ownerId !== null && T.integrationOwner !== undefined) {
    const startPos = r.pos;
    r.skipBlock();
    const endPos = r.pos;

    // Byte-level search for: integration_owner_token(2) = (2) U32_type(2) value(4)
    // This avoids alignment issues from the token walker
    const ioLo = T.integrationOwner & 0xff;
    const ioHi = (T.integrationOwner >> 8) & 0xff;
    const data = r.rawData;
    const view = r.rawView;

    for (let i = startPos; i <= endPos - 10; i++) {
      if (data[i] === ioLo && data[i + 1] === ioHi &&
          data[i + 2] === 0x01 && data[i + 3] === 0x00 &&  // =
          data[i + 4] === 0x14 && data[i + 5] === 0x00) {  // U32
        const intOwner = view.getUint32(i + 6, true);
        if (intOwner !== ownerId) {
          const key = `${intOwner}:${ownerId}`;
          integrationPairs.set(key, (integrationPairs.get(key) ?? 0) + 1);
        }
      }
    }
    r.pos = endPos;
  } else {
    r.skipBlock();
  }
}
