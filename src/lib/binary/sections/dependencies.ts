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

/**
 * Scan binary data for `dependency = { first=overlord second=subject subject_type=... }`
 * patterns using byte-level search for reliability.
 */
export function findDependencies(
  data: Uint8Array,
  dynStrings: string[],
  countryTags: Record<number, string>,
  overlordSubjects: Record<string, Set<string>>,
): void {
  if (DEP_TOK === undefined || FIRST_TOK === undefined || SECOND_TOK === undefined) return;

  const r = new TokenReader(data, dynStrings);
  const depLo = DEP_TOK & 0xff, depHi = (DEP_TOK >> 8) & 0xff;

  for (let i = 0; i <= data.length - 30; i++) {
    // Match: dependency = {
    if (data[i] !== depLo || data[i + 1] !== depHi ||
        data[i + 2] !== 0x01 || data[i + 3] !== 0x00 ||
        data[i + 4] !== 0x03 || data[i + 5] !== 0x00) continue;

    r.pos = i + 6;
    const startPos = r.pos;
    r.skipBlock();
    const endPos = r.pos;

    // Re-scan for first, second, subject_type
    r.pos = startPos;
    let first: number | null = null;
    let second: number | null = null;
    let subType: string | null = null;
    let depth = 1;

    while (r.pos < endPos && depth > 0) {
      const tok = r.readToken();
      if (tok === BinaryToken.CLOSE) { depth--; continue; }
      if (tok === BinaryToken.OPEN) { depth++; continue; }
      if (tok === BinaryToken.EQUAL) continue;
      if (isValueToken(tok)) { r.skipValuePayload(tok); continue; }

      if (depth === 1 && tok === FIRST_TOK) {
        r.expectEqual();
        first = r.readIntValue();
      } else if (depth === 1 && tok === SECOND_TOK) {
        r.expectEqual();
        second = r.readIntValue();
      } else if (depth === 1 && tok === SUBJECT_TYPE_TOK) {
        r.expectEqual();
        subType = r.readStringValue();
      } else if (r.peekToken() === BinaryToken.EQUAL) {
        r.readToken();
        r.skipValue();
      }
    }

    r.pos = endPos;

    if (first !== null && second !== null && subType) {
      const overlordTag = countryTags[first];
      const subjectTag = countryTags[second];
      if (overlordTag && subjectTag && overlordTag !== subjectTag && /^[A-Z]/.test(subjectTag)) {
        if (!overlordSubjects[overlordTag]) overlordSubjects[overlordTag] = new Set();
        overlordSubjects[overlordTag].add(subjectTag);
      }
    }
  }
}
