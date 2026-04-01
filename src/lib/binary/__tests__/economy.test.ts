import { describe, it, expect } from "vitest";
import { readFixed5, emptyEconomyStats } from "../sections/economy";
import { emptyMilitaryStats } from "../sections/military";
import { emptyCountryData } from "../sections/country-stats";

describe("readFixed5", () => {
  it("reads 3-byte unsigned FIXED5 (0x0d4a)", () => {
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
    const data = new Uint8Array([0xe8, 0x03]);
    expect(readFixed5(data, 0, 0x0d49)).toBeCloseTo(1.0, 2);
  });

  it("reads signed FIXED5 (0x0d50)", () => {
    const data = new Uint8Array([0xd0, 0x07]);
    expect(readFixed5(data, 0, 0x0d50)).toBeCloseTo(2.0, 2);
  });

  it("respects offset", () => {
    const data = new Uint8Array([0x00, 0x00, 0xe8, 0x03]);
    expect(readFixed5(data, 2, 0x0d49)).toBeCloseTo(1.0, 2);
  });
});

describe("emptyEconomyStats", () => {
  it("returns zero values", () => {
    const e = emptyEconomyStats();
    expect(e.gold).toBe(0);
    expect(e.manpower).toBe(0);
    expect(e.sailors).toBe(0);
    expect(e.stability).toBe(0);
    expect(e.prestige).toBe(0);
    expect(e.monthlyIncome).toBe(0);
    expect(e.monthlyTradeValue).toBe(0);
    expect(e.monthlyTaxIncome).toBe(0);
    expect(e.population).toBe(0);
  });

  it("returns a new object each time", () => {
    expect(emptyEconomyStats()).not.toBe(emptyEconomyStats());
  });
});

describe("emptyMilitaryStats", () => {
  it("returns zero values", () => {
    const m = emptyMilitaryStats();
    expect(m.maxManpower).toBe(0);
    expect(m.maxSailors).toBe(0);
    expect(m.armyMaintenance).toBe(0);
    expect(m.navyMaintenance).toBe(0);
    expect(m.expectedArmySize).toBe(0);
    expect(m.expectedNavySize).toBe(0);
  });
});

describe("emptyCountryData", () => {
  it("returns identity + economy + military defaults", () => {
    const cd = emptyCountryData();
    expect(cd.identity.countryName).toBe("");
    expect(cd.identity.score).toBe(0);
    expect(cd.identity.level).toBe(-1);
    expect(cd.economy.gold).toBe(0);
    expect(cd.economy.population).toBe(0);
    expect(cd.military.maxManpower).toBe(0);
    expect(cd.military.expectedArmySize).toBe(0);
  });

  it("returns a new object each time", () => {
    expect(emptyCountryData()).not.toBe(emptyCountryData());
  });
});
