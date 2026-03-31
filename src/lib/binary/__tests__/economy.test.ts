import { describe, it, expect } from "vitest";
import { readFixed5, emptyEconomy } from "../sections/economy";

describe("readFixed5", () => {
  it("reads 3-byte unsigned FIXED5 (0x0d4a)", () => {
    // 0xf2 | (0xe0 << 8) | (0x1f << 16) = 2089202 → /1000 = 2089.202
    const data = new Uint8Array([0xf2, 0xe0, 0x1f]);
    expect(readFixed5(data, 0, 0x0d4a)).toBeCloseTo(2089.202, 2);
  });

  it("reads 4-byte unsigned FIXED5 (0x0d4b)", () => {
    const data = new Uint8Array([0x45, 0x5d, 0x1b, 0x1a]);
    const val = readFixed5(data, 0, 0x0d4b);
    expect(val).toBeCloseTo(438000.965, 0);
  });

  it("reads 1-byte unsigned FIXED5 (0x0d48)", () => {
    const data = new Uint8Array([100]);
    expect(readFixed5(data, 0, 0x0d48)).toBeCloseTo(0.1, 1);
  });

  it("reads 2-byte unsigned FIXED5 (0x0d49)", () => {
    const data = new Uint8Array([0xe8, 0x03]); // 1000 → 1.0
    expect(readFixed5(data, 0, 0x0d49)).toBeCloseTo(1.0, 2);
  });

  it("reads signed FIXED5 (0x0d50)", () => {
    const data = new Uint8Array([0xd0, 0x07]); // 2000 → 2.0
    expect(readFixed5(data, 0, 0x0d50)).toBeCloseTo(2.0, 2);
  });

  it("respects offset", () => {
    const data = new Uint8Array([0x00, 0x00, 0xe8, 0x03]);
    expect(readFixed5(data, 2, 0x0d49)).toBeCloseTo(1.0, 2);
  });
});

describe("emptyEconomy", () => {
  it("returns zero values", () => {
    const e = emptyEconomy();
    expect(e.gold).toBe(0);
    expect(e.manpower).toBe(0);
    expect(e.sailors).toBe(0);
    expect(e.stability).toBe(0);
    expect(e.prestige).toBe(0);
    expect(e.countryName).toBe("");
    expect(e.score).toBe(0);
    expect(e.level).toBe(-1);
    expect(e.govType).toBe("");
    expect(e.monthlyIncome).toBe(0);
    expect(e.monthlyTradeValue).toBe(0);
    expect(e.monthlyTaxIncome).toBe(0);
    expect(e.maxManpower).toBe(0);
    expect(e.maxSailors).toBe(0);
    expect(e.population).toBe(0);
    expect(e.armyMaintenance).toBe(0);
    expect(e.navyMaintenance).toBe(0);
    expect(e.expectedArmySize).toBe(0);
    expect(e.expectedNavySize).toBe(0);
    expect(e.courtLanguage).toBe("");
  });

  it("returns a new object each time", () => {
    expect(emptyEconomy()).not.toBe(emptyEconomy());
  });
});
