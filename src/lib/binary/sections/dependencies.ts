/**
 * Extract subject relationships from dependency entries.
 *
 * The diplomacy section contains `dependency = { first=overlord second=subject
 * subject_type=vassal/fiefdom/... }` entries that are the authoritative source
 * for current overlord-subject relationships.
 */

import { TokenReader } from "../token-reader";
import { BinaryToken, isValueToken } from "../tokens";
import { tokenId } from "../token-names";

const DEP_TOK = tokenId("dependency");
const FIRST_TOK = tokenId("first");
const SECOND_TOK = tokenId("second");
const SUBJECT_TYPE_TOK = 0x2ffa; // subject_type

/** The save flags the field with this literal string inside named_targets. */
const SUBJECT_TYPE_FLAG = "subject_type";

/** True when a token introduces a string value. */
const isStringToken = (tok: number): boolean =>
  tok === BinaryToken.QUOTED ||
  tok === BinaryToken.UNQUOTED ||
  tok === BinaryToken.LOOKUP_U8 ||
  tok === BinaryToken.LOOKUP_U16 ||
  tok === BinaryToken.LOOKUP_U24;

/** Check whether a tag starts with an uppercase letter. */
const isValidSubjectTag = (tag: string): boolean =>
  /^[A-Z]/.test(tag);

/** Check whether parsed dependency fields represent a valid relationship. */
const isValidDependency = (
  first: number,
  second: number,
  subType: string,
): boolean =>
  first !== -1 && second !== -1 && subType !== "";

/**
 * Build a reverse mapping from tag to its canonical (first-seen) country ID.
 * When multiple IDs map to the same tag, the canonical ID is the one in
 * countries > tags. Dependency entries referencing non-canonical IDs are stale.
 */
const buildCanonicalIds = (
  countryTags: Record<number, string>,
): ReadonlyMap<string, number> => {
  const canonical = new Map<string, number>();
  for (const [idStr, tag] of Object.entries(countryTags)) {
    if (!canonical.has(tag)) {
      canonical.set(tag, parseInt(idStr));
    } else {
      /* duplicate tag — keep the first (canonical) ID */
    }
  }
  return canonical;
};

/** Check whether both IDs in a dependency match their canonical country IDs. */
const isCanonicalDependency = (
  first: number,
  second: number,
  firstTag: string,
  secondTag: string,
  canonicalIds: ReadonlyMap<string, number>,
): boolean => {
  const canonFirst = canonicalIds.get(firstTag) ?? -1;
  const canonSecond = canonicalIds.get(secondTag) ?? -1;
  return first === canonFirst && second === canonSecond;
};

/** Add a subject tag under an overlord tag, creating the Set if needed. */
const addDependencySubject = (
  overlordSubjects: Record<string, Set<string>>,
  overlordTag: string,
  subjectTag: string,
): void => {
  if (!overlordSubjects[overlordTag]) {
    overlordSubjects[overlordTag] = new Set();
  } else {
    /* set already exists */
  }
  overlordSubjects[overlordTag].add(subjectTag);
};

/**
 * Scan binary data for `dependency = { first=overlord second=subject subject_type=... }`
 * patterns using byte-level search for reliability.
 */
export const findDependencies = (
  data: Uint8Array,
  dynStrings: string[],
  countryTags: Record<number, string>,
  overlordSubjects: Record<string, Set<string>>,
): void => {
  if (DEP_TOK === undefined || FIRST_TOK === undefined || SECOND_TOK === undefined) {
    return;
  } else {
    /* tokens resolved — proceed */
  }

  const r = new TokenReader(data, dynStrings);
  const canonicalIds = buildCanonicalIds(countryTags);
  const depLo = DEP_TOK & 0xff;
  const depHi = (DEP_TOK >> 8) & 0xff;

  for (let i = 0; i <= data.length - 30; i++) {
    // Match: dependency = {
    if (data[i] !== depLo || data[i + 1] !== depHi ||
        data[i + 2] !== 0x01 || data[i + 3] !== 0x00 ||
        data[i + 4] !== 0x03 || data[i + 5] !== 0x00) {
      continue;
    } else {
      /* matched dependency header */
    }

    r.pos = i + 6;
    const startPos = r.pos;
    r.skipBlock();
    const endPos = r.pos;

    // Re-scan for first, second, subject_type
    r.pos = startPos;
    let first = -1;
    let second = -1;
    let subType = "";
    let sawSubjectTypeFlag = false;
    let depth = 1;

    while (r.pos < endPos && depth > 0) {
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
      } else {
        /* key token — check which field */
      }

      if (depth === 1 && tok === FIRST_TOK) {
        r.expectEqual();
        first = r.readIntValue() ?? -1;
      } else if (depth === 1 && tok === SECOND_TOK) {
        r.expectEqual();
        second = r.readIntValue() ?? -1;
      } else if (tok === SUBJECT_TYPE_TOK && r.peekToken() === BinaryToken.EQUAL) {
        // Flat shape: subject_type = "vassal" as a direct key.
        r.readToken();
        subType = r.readStringValue() ?? "";
      } else if (r.peekToken() === BinaryToken.EQUAL) {
        r.readToken(); // consume =
        const next = r.peekToken();
        if (next === BinaryToken.OPEN) {
          // Descend rather than skip. subject_type sits several blocks deep
          // inside named_targets, so skipping sub-blocks wholesale steps
          // straight over it. Dependency blocks are small, so walking every
          // token inside one is cheap.
          continue;
        } else if (isStringToken(next)) {
          // The save marks the field with a "subject_type" string and gives
          // the type name as a later string in the same nest:
          //   named_targets = { { flag = "subject_type" ... = "fiefdom" } }
          const str = r.readStringValue() ?? "";
          if (str === SUBJECT_TYPE_FLAG) {
            sawSubjectTypeFlag = true;
          } else if (sawSubjectTypeFlag && str !== "") {
            subType = str;
          } else {
            /* unrelated string */
          }
        } else {
          r.skipValue();
        }
      } else {
        /* unrecognised key at nested depth — skip */
      }
    }

    r.pos = endPos;

    if (isValidDependency(first, second, subType)) {
      const overlordTag = countryTags[first] ?? "";
      const subjectTag = countryTags[second] ?? "";
      if (overlordTag !== "" && subjectTag !== "" &&
          overlordTag !== subjectTag && isValidSubjectTag(subjectTag) &&
          isCanonicalDependency(first, second, overlordTag, subjectTag, canonicalIds)) {
        addDependencySubject(overlordSubjects, overlordTag, subjectTag);
      } else {
        /* tags missing, same country, or stale (non-canonical ID) — skip */
      }
    } else {
      /* incomplete dependency entry — skip */
    }
  }
};
