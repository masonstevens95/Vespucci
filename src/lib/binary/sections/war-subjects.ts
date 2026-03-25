/**
 * Extract subject relationships from the war_manager section.
 *
 * When a country joins a war with `reason=Subject` and `called_ally=X`,
 * that country is a subject of X. This catches fiefdoms and vassals
 * that aren't tracked through IO structures or integration_owner.
 */

import { T } from "../game-tokens";

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
export function findWarSubjects(
  data: Uint8Array,
  sectionStart: number,
  sectionEnd: number,
  dynStrings: string[],
  countryTags: Record<number, string>,
  overlordSubjects: Record<string, Set<string>>,
): void {
  if (T.calledAlly === undefined || T.reason === undefined) return;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const calledAllyLo = T.calledAlly & 0xff;
  const calledAllyHi = (T.calledAlly >> 8) & 0xff;
  const reasonLo = T.reason & 0xff;
  const reasonHi = (T.reason >> 8) & 0xff;

  // Scan for: reason_token(2) = (2) LOOKUP_type(2) index -> "Subject"
  // Then look backward for called_ally = U32(overlord) and country = U32(subject)
  for (let i = sectionStart; i <= sectionEnd - 10; i++) {
    // Match: reason = LOOKUP_xxx "Subject"
    if (data[i] !== reasonLo || data[i + 1] !== reasonHi) continue;
    if (data[i + 2] !== 0x01 || data[i + 3] !== 0x00) continue; // =

    // Read the lookup value
    const lookupType = data[i + 4] | (data[i + 5] << 8);
    let strIdx = -1;
    if (lookupType === 0x0d3e) { // LOOKUP_U16
      strIdx = data[i + 6] | (data[i + 7] << 8);
    } else if (lookupType === 0x0d41) { // LOOKUP_U24
      strIdx = data[i + 6] | (data[i + 7] << 8) | (data[i + 8] << 16);
    } else if (lookupType === 0x0d40) { // LOOKUP_U8
      strIdx = data[i + 6];
    } else {
      continue;
    }

    if (strIdx < 0 || strIdx >= dynStrings.length) continue;
    if (dynStrings[strIdx] !== "Subject") continue;

    // Found reason=Subject! Now search backward (within 100 bytes) for
    // called_ally = U32(overlord_id)
    let overlordId = -1;
    for (let j = i - 2; j >= Math.max(sectionStart, i - 100); j--) {
      if (data[j] === calledAllyLo && data[j + 1] === calledAllyHi &&
          data[j + 2] === 0x01 && data[j + 3] === 0x00 &&  // =
          data[j + 4] === 0x14 && data[j + 5] === 0x00) {   // U32
        overlordId = view.getUint32(j + 6, true);
        break;
      }
    }
    if (overlordId < 0) continue;

    // Search backward further for country = U32(subject_id)
    const countryLo = T.country! & 0xff;
    const countryHi = (T.country! >> 8) & 0xff;
    let subjectId = -1;
    for (let j = i - 2; j >= Math.max(sectionStart, i - 200); j--) {
      if (data[j] === countryLo && data[j + 1] === countryHi &&
          data[j + 2] === 0x01 && data[j + 3] === 0x00 &&
          data[j + 4] === 0x14 && data[j + 5] === 0x00) {
        subjectId = view.getUint32(j + 6, true);
        break;
      }
    }
    if (subjectId < 0) continue;

    const overlordTag = countryTags[overlordId];
    const subjectTag = countryTags[subjectId];
    if (overlordTag && subjectTag && overlordTag !== subjectTag &&
        /^[A-Z]/.test(subjectTag)) { // filter out invalid tags like "---"
      if (!overlordSubjects[overlordTag]) overlordSubjects[overlordTag] = new Set();
      overlordSubjects[overlordTag].add(subjectTag);
    }
  }
}
