import { TokenReader } from "../token-reader";
import { BinaryToken, isValueToken, valuePayloadSize } from "../tokens";
import { T } from "../game-tokens";
import { tokenId } from "../token-names";
import { isFixed5, readFixed5 } from "./fixed5";
import { createLogger } from "../../logger";
import type { RgoData } from "../../types";

const log = createLogger("locations");

// ---------------------------------------------------------------------------
// RGO token IDs
// ---------------------------------------------------------------------------

const RGO_TOKEN = tokenId("rgo") ?? -1;
const RAW_MATERIAL = tokenId("raw_material") ?? -1;
const MAX_RAW_MATERIAL_WORKERS = tokenId("max_raw_material_workers") ?? -1;
const RAW_MATERIAL_SIZE = tokenId("raw_material_size") ?? -1;
const EMPLOYMENT_SIZE = tokenId("employment_size") ?? -1;
const LOCAL_MAX_RGO_SIZE = tokenId("local_max_rgo_size") ?? -1;
const GOODS_METHOD = tokenId("goods_method") ?? -1;
const OUTPUT_SCALE = tokenId("output_scale") ?? -1;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** True when a token is structural noise we skip in depth-tracking loops. */
const isStructuralToken = (tok: number): boolean =>
  tok === BinaryToken.CLOSE ||
  tok === BinaryToken.OPEN ||
  tok === BinaryToken.EQUAL;

/** Adjust depth for OPEN / CLOSE tokens; returns updated depth. */
const adjustDepth = (tok: number, depth: number): number =>
  tok === BinaryToken.CLOSE
    ? depth - 1
    : tok === BinaryToken.OPEN
    ? depth + 1
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
  countryTags: Record<number, string>
): string => countryTags[ownerId] ?? "";

/** Read a FIXED5-or-integer value after the type token has been consumed. */
const readNumericPayload = (
  r: TokenReader,
  data: Uint8Array,
  vt: number
): number => {
  if (isFixed5(vt)) {
    const val = readFixed5(data, r.pos, vt);
    r.pos += valuePayloadSize(vt, data, r.pos);
    return val;
  } else if (vt === BinaryToken.I32) {
    return r.readI32();
  } else if (vt === BinaryToken.U32) {
    return r.readU32();
  } else {
    r.skipValuePayload(vt);
    return 0;
  }
};

/** Read the rgo = { ... } sub-block. Cursor must be just after the opening {. */
const readRgoBlock = (r: TokenReader, data: Uint8Array): RgoData => {
  let good = "";
  let size = 0;
  let employment = 0;
  let maxSize = 0;
  let method = "";
  let outputScale = 0;

  let depth = 1;
  while (!r.done && depth > 0) {
    const tok = r.readToken();

    if (tok === BinaryToken.CLOSE) {
      depth--;
    } else if (tok === BinaryToken.OPEN) {
      depth++;
    } else if (tok === BinaryToken.EQUAL) {
      /* structural noise */
    } else if (isValueToken(tok)) {
      r.skipValuePayload(tok);
    } else if (depth === 1) {
      if (tok === RAW_MATERIAL) {
        r.expectEqual();
        good = r.readStringValue() ?? "";
      } else if (tok === RAW_MATERIAL_SIZE) {
        r.expectEqual();
        size = r.readIntValue() ?? 0;
      } else if (tok === EMPLOYMENT_SIZE) {
        r.expectEqual();
        employment = r.readIntValue() ?? 0;
      } else if (tok === LOCAL_MAX_RGO_SIZE) {
        r.expectEqual();
        maxSize = r.readIntValue() ?? 0;
      } else if (tok === GOODS_METHOD) {
        r.expectEqual();
        method = r.readStringValue() ?? "";
      } else if (tok === OUTPUT_SCALE) {
        r.expectEqual();
        const vt = r.readToken();
        outputScale = readNumericPayload(r, data, vt);
      } else {
        skipUnknownField(r);
      }
    } else {
      /* depth > 1 — inside nested sub-block, field token has no meaning here */
    }
  }

  return { good, size, employment, maxSize, method, outputScale };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read owner + rgo from a single location entry block.
 * Cursor must be just after the opening {.
 *
 * raw_material (depth=1) gives the goods name via LOOKUP_U16 → dynStrings.
 * max_raw_material_workers (depth=1 FIXED5) gives worker capacity.
 * floor(max_raw_material_workers / 1000) = RGO levels at this location.
 */
export const readLocationEntry = (
  r: TokenReader,
  data: Uint8Array,
  locId: number,
  countryTags: Record<number, string>,
  locationOwners: Record<number, string>,
  locationRgos: Record<number, RgoData>
): void => {
  let depth = 1;
  let rgoGood = "";
  let rgoWorkers = 0;

  while (!r.done && depth > 0) {
    const tok = r.readToken();

    if (tok === BinaryToken.CLOSE) {
      depth--;
    } else if (tok === BinaryToken.OPEN) {
      depth++;
    } else if (tok === BinaryToken.EQUAL) {
      /* structural noise */
    } else if (isValueToken(tok)) {
      r.skipValuePayload(tok);
    } else if (depth === 1) {
      if (tok === T.owner) {
        r.expectEqual();
        const ownerId = r.readIntValue() ?? -1;
        const tag = resolveOwnerTag(ownerId, countryTags);
        if (tag !== "") {
          locationOwners[locId] = tag;
        } else {
          /* unknown or missing owner */
        }
      } else if (tok === RAW_MATERIAL) {
        r.expectEqual();
        rgoGood = r.readStringValue() ?? "";
      } else if (tok === MAX_RAW_MATERIAL_WORKERS) {
        // max_raw_material_workers = FIXED5; floor(value / 1000) = RGO levels
        r.expectEqual();
        const vt = r.readToken();
        if (isFixed5(vt)) {
          rgoWorkers = readFixed5(data, r.pos, vt);
          r.pos += valuePayloadSize(vt, data, r.pos);
        } else {
          r.skipValuePayload(vt);
        }
      } else if (tok === RGO_TOKEN) {
        // Legacy: rgo = { raw_material = ... } sub-block (older save format)
        r.expectEqual();
        r.expectOpen();
        const rgo = readRgoBlock(r, data);
        if (rgo.good !== "") {
          locationRgos[locId] = rgo;
        } else {
          /* rgo block found but no raw_material */
        }
      } else {
        skipUnknownField(r);
      }
    } else {
      /* depth > 1 — field token inside a nested block we don't care about */
    }
  }

  if (rgoGood !== "") {
    locationRgos[locId] = {
      good: rgoGood,
      size: Math.floor(rgoWorkers / 100),
      employment: 0,
      maxSize: 0,
      method: "",
      outputScale: 0,
    };
  } else {
    /* no raw_material in this location entry */
  }
};

/** Read numeric-keyed location entries. */
export const readLocationEntries = (
  r: TokenReader,
  data: Uint8Array,
  countryTags: Record<number, string>,
  locationOwners: Record<number, string>,
  locationRgos: Record<number, RgoData>
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
      readLocationEntry(
        r,
        data,
        locId,
        countryTags,
        locationOwners,
        locationRgos
      );
    } else {
      r.readToken();
      skipUnknownField(r);
    }
  }
};

/** Read location ownership and RGO data from the main locations section. */
export const readLocationOwnership = (
  r: TokenReader,
  data: Uint8Array,
  countryTags: Record<number, string>,
  locationOwners: Record<number, string>,
  locationRgos: Record<number, RgoData>
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
      readLocationEntries(r, data, countryTags, locationOwners, locationRgos);
      log.info(
        `done — locationOwners:${Object.keys(locationOwners).length} ` +
        `locationRgos:${Object.keys(locationRgos).length}`,
      );
      return;
    } else {
      skipUnknownField(r);
    }
  }
  log.warn("inner 'locations' block not found — no ownership or RGO data read");
};
