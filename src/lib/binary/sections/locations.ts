import { TokenReader } from "../token-reader";
import { BinaryToken } from "../tokens";
import { T } from "../game-tokens";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** True when a token is structural noise we skip in depth-tracking loops. */
const isStructuralToken = (tok: number): boolean =>
  tok === BinaryToken.CLOSE || tok === BinaryToken.OPEN || tok === BinaryToken.EQUAL;

/** Adjust depth for OPEN / CLOSE tokens; returns updated depth. */
const adjustDepth = (tok: number, depth: number): number =>
  tok === BinaryToken.CLOSE ? depth - 1
    : tok === BinaryToken.OPEN ? depth + 1
    : depth;

/** Skip an unknown key=value pair when the next token is EQUAL. */
const skipUnknownField = (r: TokenReader): void => {
  if (r.peekToken() === BinaryToken.EQUAL) {
    r.readToken(); // consume =
    r.skipValue();
  } else {
    /* bare token reference — nothing to skip */
  }
};

/** True when a token represents a numeric integer type. */
const isIntegerToken = (tok: number): boolean =>
  tok === BinaryToken.I32 || tok === BinaryToken.U32;

/** Read the integer payload matching the token type. */
const readIntPayload = (r: TokenReader, tok: number): number =>
  tok === BinaryToken.I32 ? r.readI32() : r.readU32();

/** Resolve an owner ID to a country tag, returning "" when unresolvable. */
const resolveOwnerTag = (
  ownerId: number,
  countryTags: Record<number, string>,
): string => countryTags[ownerId] ?? "";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Read owner from a single location entry, then skip the rest. */
export const readLocationEntry = (
  r: TokenReader,
  locId: number,
  countryTags: Record<number, string>,
  locationOwners: Record<number, string>,
): void => {
  if (r.peekToken() === T.owner) {
    r.readToken();
    r.expectEqual();
    const ownerId = r.readIntValue() ?? -1;
    const tag = resolveOwnerTag(ownerId, countryTags);
    if (tag !== "") {
      locationOwners[locId] = tag;
    } else {
      /* unknown or missing owner — skip */
    }
  } else {
    /* entry does not lead with owner — skip entire block */
  }
  r.skipBlock();
};

/** Read numeric-keyed location entries. */
export const readLocationEntries = (
  r: TokenReader,
  countryTags: Record<number, string>,
  locationOwners: Record<number, string>,
): void => {
  while (!r.done) {
    const tok = r.peekToken();

    if (tok === BinaryToken.CLOSE) {
      r.readToken();
      return;
    } else {
      /* not end of block — continue processing */
    }

    if (isIntegerToken(tok)) {
      r.readToken();
      const locId = readIntPayload(r, tok);
      r.expectEqual();
      r.expectOpen();
      readLocationEntry(r, locId, countryTags, locationOwners);
    } else {
      r.readToken();
      skipUnknownField(r);
    }
  }
};

/** Read location ownership from the main locations section. */
export const readLocationOwnership = (
  r: TokenReader,
  countryTags: Record<number, string>,
  locationOwners: Record<number, string>,
): void => {
  let depth = 1;
  while (!r.done && depth > 0) {
    const tok = r.readToken();

    if (isStructuralToken(tok)) {
      depth = adjustDepth(tok, depth);
      continue;
    } else {
      /* field token — inspect below */
    }

    if (tok === T.locations) {
      r.expectEqual();
      r.expectOpen();
      readLocationEntries(r, countryTags, locationOwners);
      return;
    } else {
      skipUnknownField(r);
    }
  }
};
