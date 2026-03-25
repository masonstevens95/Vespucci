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

// ---------------------------------------------------------------------------
// Internal readers
// ---------------------------------------------------------------------------

/** Walk the locations array inside compatibility, recording index -> name. */
const readLocationNameList = (
  r: TokenReader,
  locationNames: Record<number, string>,
): void => {
  let idx = 0;
  while (!r.done && r.peekToken() !== BinaryToken.CLOSE) {
    const name = r.readStringValue() ?? "";
    if (name !== "") {
      locationNames[idx] = name;
    } else {
      /* non-string or empty — skip index */
    }
    idx++;
  }
  if (!r.done) {
    r.readToken(); // consume closing }
  } else {
    /* stream ended before closing brace */
  }
};

/** Scan the compatibility block for a `locations` sub-block. */
const readCompatibilityLocations = (
  r: TokenReader,
  locationNames: Record<number, string>,
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
      readLocationNameList(r, locationNames);
    } else {
      skipUnknownField(r);
    }
  }
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Read location names from metadata > compatibility > locations. */
export const readMetadataLocations = (
  r: TokenReader,
  locationNames: Record<number, string>,
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

    if (tok === T.compatibility) {
      r.expectEqual();
      r.expectOpen();
      readCompatibilityLocations(r, locationNames);
    } else {
      skipUnknownField(r);
    }
  }
};
