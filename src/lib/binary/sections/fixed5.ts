/**
 * FIXED5 token helpers for reading fixed-point values from binary data.
 *
 * All functions are pure arrow expressions.
 * No null, no exceptions, every if has an else.
 */

import { valuePayloadSize } from "../tokens";

/** Check whether a token is a FIXED5 value type. */
export const isFixed5 = (tok: number): boolean =>
  (tok >= 0x0d48 && tok <= 0x0d4e) || (tok >= 0x0d4f && tok <= 0x0d55);

/** Read a FIXED5 value from the data buffer. Returns value / 1000.
 *  Uses multiplication instead of bit-shifting to avoid JavaScript's
 *  signed 32-bit integer overflow with the << operator on 4+ byte values. */
export const readFixed5 = (
  data: Uint8Array,
  pos: number,
  tok: number,
): number => {
  const size = tok >= 0x0d48 && tok <= 0x0d4e
    ? tok - 0x0d48 + 1
    : tok - 0x0d4f + 1;
  let val = 0;
  for (let i = size - 1; i >= 0; i--) {
    val = val * 256 + data[pos + i];
  }
  return val / 1000;
};

/**
 * Read a FIXED5 value at a field offset.
 * Navigates to the offset, reads the field token + equals + value.
 * Returns 0 if offset is -1 or value is not FIXED5.
 */
export const readFixed5AtOffset = (
  r: { pos: number; readToken: () => number; expectEqual: () => boolean },
  data: Uint8Array,
  offset: number,
): number => {
  if (offset < 0) {
    return 0;
  } else {
    r.pos = offset;
    r.readToken();
    r.expectEqual();
    const valTok = r.readToken();
    if (isFixed5(valTok)) {
      const size = valuePayloadSize(valTok, data, r.pos);
      const val = readFixed5(data, r.pos, valTok);
      r.pos += size;
      return val;
    } else {
      return 0;
    }
  }
};
