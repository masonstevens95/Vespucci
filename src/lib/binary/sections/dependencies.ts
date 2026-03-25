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
      } else if (depth === 1 && tok === SUBJECT_TYPE_TOK) {
        r.expectEqual();
        subType = r.readStringValue() ?? "";
      } else if (r.peekToken() === BinaryToken.EQUAL) {
        r.readToken();
        r.skipValue();
      } else {
        /* unrecognised key at nested depth — skip */
      }
    }

    r.pos = endPos;

    if (isValidDependency(first, second, subType)) {
      const overlordTag = countryTags[first] ?? "";
      const subjectTag = countryTags[second] ?? "";
      if (overlordTag !== "" && subjectTag !== "" &&
          overlordTag !== subjectTag && isValidSubjectTag(subjectTag)) {
        addDependencySubject(overlordSubjects, overlordTag, subjectTag);
      } else {
        /* tags missing or same country — skip */
      }
    } else {
      /* incomplete dependency entry — skip */
    }
  }
};
