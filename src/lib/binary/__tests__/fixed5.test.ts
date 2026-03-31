import { describe, it, expect } from "vitest";
import { isFixed5, readFixed5, readFixed5AtOffset } from "../sections/fixed5";
import { BinaryToken } from "../tokens";

describe("isFixed5", () => {
  it("returns true for unsigned FIXED5 range (0x0d48-0x0d4e)", () => {
    for (let tok = 0x0d48; tok <= 0x0d4e; tok++) {
      expect(isFixed5(tok)).toBe(true);
    }
  });

  it("returns true for signed FIXED5 range (0x0d4f-0x0d55)", () => {
    for (let tok = 0x0d4f; tok <= 0x0d55; tok++) {
      expect(isFixed5(tok)).toBe(true);
    }
  });

  it("returns false for non-FIXED5 tokens", () => {
    expect(isFixed5(BinaryToken.I32)).toBe(false);
    expect(isFixed5(BinaryToken.U32)).toBe(false);
    expect(isFixed5(0x0d47)).toBe(false);
    expect(isFixed5(0x0d56)).toBe(false);
  });
});

describe("readFixed5", () => {
  it("reads 3-byte unsigned (0x0d4a)", () => {
    const data = new Uint8Array([0xf2, 0xe0, 0x1f]);
    expect(readFixed5(data, 0, 0x0d4a)).toBeCloseTo(2089.202, 2);
  });

  it("reads 4-byte unsigned (0x0d4b)", () => {
    const data = new Uint8Array([0x45, 0x5d, 0x1b, 0x1a]);
    expect(readFixed5(data, 0, 0x0d4b)).toBeCloseTo(438000.965, 0);
  });

  it("reads 1-byte unsigned (0x0d48)", () => {
    const data = new Uint8Array([100]);
    expect(readFixed5(data, 0, 0x0d48)).toBeCloseTo(0.1, 1);
  });

  it("reads 2-byte signed (0x0d50)", () => {
    const data = new Uint8Array([0xd0, 0x07]);
    expect(readFixed5(data, 0, 0x0d50)).toBeCloseTo(2.0, 2);
  });

  it("respects offset", () => {
    const data = new Uint8Array([0x00, 0x00, 0xe8, 0x03]);
    expect(readFixed5(data, 2, 0x0d49)).toBeCloseTo(1.0, 2);
  });

  it("handles large 4-byte values without signed overflow", () => {
    // Byte 3 has high bit set (0xBA >= 0x80) — previously overflowed
    // to negative via JS << operator treating as signed 32-bit
    const data = new Uint8Array([0x45, 0x5d, 0x1a, 0xba]);
    const val = readFixed5(data, 0, 0x0d4b);
    expect(val).toBeGreaterThan(0);
    // val = (0xba * 256^3 + 0x1a * 256^2 + 0x5d * 256 + 0x45) / 1000
    expect(val).toBeCloseTo(3122289.989, 0);
  });

  it("handles 5-byte values correctly", () => {
    const data = new Uint8Array([0x03, 0x64, 0xc4, 0x63, 0x02]);
    const val = readFixed5(data, 0, 0x0d4c);
    expect(val).toBeGreaterThan(0);
    expect(val).toBeCloseTo(10263749.635, 0);
  });
});

describe("readFixed5AtOffset", () => {
  it("returns 0 for negative offset", () => {
    const r = { pos: 0, readToken: () => 0, expectEqual: () => true };
    expect(readFixed5AtOffset(r, new Uint8Array(0), -1)).toBe(0);
  });
});
