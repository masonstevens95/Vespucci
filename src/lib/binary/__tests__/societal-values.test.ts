import { describe, it, expect } from "vitest";
import { readSocietalValues, emptySocietalValues } from "../sections/country-identity";
import { TokenReader } from "../token-reader";
import { BinaryToken } from "../tokens";
import { u16, i32, eq, close, bytes } from "./helpers";

/**
 * Build a LOOKUP_U16 key token: 2-byte token + 2-byte index (LE).
 */
const lookupU16 = (index: number): number[] => [
  ...u16(BinaryToken.LOOKUP_U16),
  ...u16(index),
];

/**
 * Build an I32 value token: 2-byte token + 4-byte signed int (LE).
 */
const i32Val = (v: number): number[] => [
  ...u16(BinaryToken.I32),
  ...i32(v),
];

describe("readSocietalValues", () => {
  it("reads 3 key-value pairs and populates the first 3 societal keys", () => {
    // Structure: key0 = 5000, key1 = 7500, key2 = 2500, }
    // readSocietalValues divides by 100, so:
    //   5000 / 100 = 50.0 (centralization)
    //   7500 / 100 = 75.0 (innovative)
    //   2500 / 100 = 25.0 (humanist)
    const dynStrings = ["axis_centralization", "axis_innovative", "axis_humanist"];

    const data = bytes(
      lookupU16(0), eq(), i32Val(5000),
      lookupU16(1), eq(), i32Val(7500),
      lookupU16(2), eq(), i32Val(2500),
      close(),
    );

    const r = new TokenReader(data, dynStrings);
    const sv = readSocietalValues(r, data);

    expect(sv.centralization).toBeCloseTo(50.0, 1);
    expect(sv.innovative).toBeCloseTo(75.0, 1);
    expect(sv.humanist).toBeCloseTo(25.0, 1);
    // Remaining keys should be 0
    expect(sv.plutocracy).toBe(0);
    expect(sv.freeSubjects).toBe(0);
    expect(sv.freeTrade).toBe(0);
    expect(sv.quantity).toBe(0);
    expect(sv.defensive).toBe(0);
    expect(sv.naval).toBe(0);
    expect(sv.unsinicized).toBe(0);
  });

  it("returns all zeros for an empty block (just CLOSE)", () => {
    const data = bytes(close());
    const r = new TokenReader(data, []);
    const sv = readSocietalValues(r, data);

    const empty = emptySocietalValues();
    expect(sv).toEqual(empty);
  });

  it("divides raw values by 100 to produce 0-100 scale", () => {
    // Raw I32 value of 10000 should become 100.0 (max)
    // Raw I32 value of 0 should become 0.0 (min)
    const dynStrings = ["axis_a", "axis_b"];

    const data = bytes(
      lookupU16(0), eq(), i32Val(10000),
      lookupU16(1), eq(), i32Val(0),
      close(),
    );

    const r = new TokenReader(data, dynStrings);
    const sv = readSocietalValues(r, data);

    expect(sv.centralization).toBeCloseTo(100.0, 1);
    expect(sv.innovative).toBeCloseTo(0.0, 1);
  });

  it("caps at 16 values even if more are present", () => {
    const dynStrings = Array.from({ length: 20 }, (_, i) => `axis_${i}`);

    const entries: number[][] = [];
    for (let i = 0; i < 20; i++) {
      entries.push(lookupU16(i), eq(), i32Val((i + 1) * 100));
    }
    entries.push(close());

    const data = bytes(...entries);
    const r = new TokenReader(data, dynStrings);
    const sv = readSocietalValues(r, data);

    // First 16 values should be populated
    expect(sv.centralization).toBeCloseTo(1.0, 1);  // 100 / 100
    expect(sv.unsinicized).toBeCloseTo(16.0, 1);    // 1600 / 100
    // Values beyond 16 are ignored (only 16 SOCIETAL_KEYS exist)
  });
});

describe("emptySocietalValues", () => {
  it("returns all zeros", () => {
    const sv = emptySocietalValues();
    const values = Object.values(sv);
    expect(values.every(v => v === 0)).toBe(true);
    expect(values.length).toBe(16);
  });

  it("returns a new object each time", () => {
    expect(emptySocietalValues()).not.toBe(emptySocietalValues());
  });
});
