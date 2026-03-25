/**
 * Extract subject relationships from the war_manager section.
 *
 * When a country joins a war with `reason=Subject` and `called_ally=X`,
 * that country is a subject of X. This catches fiefdoms and vassals
 * that aren't tracked through IO structures or integration_owner.
 */

import { T } from "../game-tokens";

/** Check whether a tag starts with an uppercase letter. */
const isValidSubjectTag = (tag: string): boolean =>
  /^[A-Z]/.test(tag);

/**
 * Decode the dynamic-string index from a lookup token at position i+4.
 * Returns the string index, or -1 if the lookup type is unrecognised.
 */
const decodeLookupIndex = (data: Uint8Array, i: number, lookupType: number): number => {
  if (lookupType === 0x0d3e) {        // LOOKUP_U16
    return data[i + 6] | (data[i + 7] << 8);
  } else if (lookupType === 0x0d41) { // LOOKUP_U24
    return data[i + 6] | (data[i + 7] << 8) | (data[i + 8] << 16);
  } else if (lookupType === 0x0d40) { // LOOKUP_U8
    return data[i + 6];
  } else {
    return -1;
  }
};

/**
 * Scan backward from `start` looking for a `field = U32(value)` pattern.
 * Returns the U32 value, or -1 if not found within `limit` bytes.
 */
const scanBackwardForU32Field = (
  data: Uint8Array,
  view: DataView,
  fieldLo: number,
  fieldHi: number,
  start: number,
  limit: number,
): number => {
  for (let j = start; j >= limit; j--) {
    if (data[j] === fieldLo && data[j + 1] === fieldHi &&
        data[j + 2] === 0x01 && data[j + 3] === 0x00 &&  // =
        data[j + 4] === 0x14 && data[j + 5] === 0x00) {   // U32
      return view.getUint32(j + 6, true);
    } else {
      /* no match at this offset */
    }
  }
  return -1;
};

/**
 * Scan the war_manager section bytes for subject war-participation patterns.
 *
 * Pattern: within each war participant block:
 *   country = U32(subject_id)
 *   ...
 *   called_ally = U32(overlord_id)
 *   reason = LOOKUP("Subject")
 *
 * Uses byte-level scanning for reliability.
 */
export const findWarSubjects = (
  data: Uint8Array,
  sectionStart: number,
  sectionEnd: number,
  dynStrings: string[],
  countryTags: Record<number, string>,
  overlordSubjects: Record<string, Set<string>>,
): void => {
  if (T.calledAlly === undefined || T.reason === undefined) {
    return;
  } else {
    /* tokens resolved — proceed */
  }

  // Track the latest overlord per subject by war join date
  const latestOverlord = new Map<string, { overlord: string; datePos: number }>();

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const calledAllyLo = T.calledAlly & 0xff;
  const calledAllyHi = (T.calledAlly >> 8) & 0xff;
  const reasonLo = T.reason & 0xff;
  const reasonHi = (T.reason >> 8) & 0xff;
  const countryTok = T.country ?? -1;
  const countryLo = countryTok & 0xff;
  const countryHi = (countryTok >> 8) & 0xff;

  // Scan for: reason_token(2) = (2) LOOKUP_type(2) index -> "Subject"
  // Then look backward for called_ally = U32(overlord) and country = U32(subject)
  for (let i = sectionStart; i <= sectionEnd - 10; i++) {
    // Match: reason = LOOKUP_xxx "Subject"
    if (data[i] !== reasonLo || data[i + 1] !== reasonHi) {
      continue;
    } else {
      /* reason token matched */
    }

    if (data[i + 2] !== 0x01 || data[i + 3] !== 0x00) {
      continue;
    } else {
      /* equals sign matched */
    }

    // Read the lookup value
    const lookupType = data[i + 4] | (data[i + 5] << 8);
    const strIdx = decodeLookupIndex(data, i, lookupType);

    if (strIdx < 0 || strIdx >= dynStrings.length) {
      continue;
    } else {
      /* valid string index */
    }

    if (dynStrings[strIdx] !== "Subject") {
      continue;
    } else {
      /* reason is "Subject" */
    }

    // Found reason=Subject! Now search backward (within 100 bytes) for
    // called_ally = U32(overlord_id)
    const overlordId = scanBackwardForU32Field(
      data, view, calledAllyLo, calledAllyHi,
      i - 2, Math.max(sectionStart, i - 100),
    );
    if (overlordId < 0) {
      continue;
    } else {
      /* found overlord */
    }

    // Search backward further for country = U32(subject_id)
    const subjectId = scanBackwardForU32Field(
      data, view, countryLo, countryHi,
      i - 2, Math.max(sectionStart, i - 200),
    );
    if (subjectId < 0) {
      continue;
    } else {
      /* found subject */
    }

    const overlordTag = countryTags[overlordId] ?? "";
    const subjectTag = countryTags[subjectId] ?? "";
    if (overlordTag !== "" && subjectTag !== "" &&
        overlordTag !== subjectTag && isValidSubjectTag(subjectTag)) {
      // Use the byte position as a proxy for recency — within the same
      // war entry, later joined records have later dates. Across wars,
      // we use the position of the reason=Subject match.
      const existing = latestOverlord.get(subjectTag);
      if (!existing || i > existing.datePos) {
        latestOverlord.set(subjectTag, { overlord: overlordTag, datePos: i });
      } else {
        /* existing record is newer — keep it */
      }
    } else {
      /* tags missing or same country — skip */
    }
  }

  // Apply: only the latest overlord per subject wins
  for (const [subjectTag, { overlord: overlordTag }] of latestOverlord) {
    if (!overlordSubjects[overlordTag]) {
      overlordSubjects[overlordTag] = new Set();
    } else {
      /* set already exists */
    }
    overlordSubjects[overlordTag].add(subjectTag);
  }
};
