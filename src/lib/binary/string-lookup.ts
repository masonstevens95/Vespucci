/** Check whether a string entry length is valid for the current position. */
const isValidStringEntry = (len: number, pos: number, dataLength: number): boolean =>
  len > 0 && len <= 50000 && pos + len <= dataLength;

/** Parse the string_lookup file from an EU5 save ZIP. */
export const parseStringLookup = (data: Uint8Array): string[] => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const decoder = new TextDecoder("utf-8");
  const strings: string[] = [];
  let pos = 5; // skip 5-byte header

  while (pos + 2 <= data.length) {
    const len = view.getUint16(pos, true);
    pos += 2;
    if (isValidStringEntry(len, pos, data.length)) {
      strings.push(decoder.decode(data.subarray(pos, pos + len)));
      pos += len;
    } else {
      break;
    }
  }

  return strings;
};
