import { describe, it, expect } from "vitest";
import { sortMilitary, buildMilitaryEntries, totalRegulars, totalLevies } from "../military-sort";
import type { MilitaryEntry } from "../military-sort";
import type { CountryEconomyStats } from "../types";

const mkStats = (overrides: Partial<CountryEconomyStats> = {}): CountryEconomyStats => ({
  gold: 0, monthlyIncome: 0, monthlyTradeValue: 0, population: 1000,
  infantry: 0, cavalry: 0, artillery: 0,
  infantryStr: 0, cavalryStr: 0, artilleryStr: 0,
  levyInfantry: 0, levyCavalry: 0,
  levyInfantryStr: 0, levyCavalryStr: 0,
  heavyShips: 0, lightShips: 0, galleys: 0, transports: 0,
  armyFrontage: 0, navyFrontage: 0,
  maxManpower: 0, maxSailors: 0, monthlyManpower: 0, monthlySailors: 0,
  armyMaintenance: 0, navyMaintenance: 0,
  expectedArmySize: 0, expectedNavySize: 0,
  courtLanguage: "", govType: "", score: 0, ...overrides,
});

const mkEntry = (tag: string, name: string, overrides: Partial<CountryEconomyStats> = {}): MilitaryEntry => ({
  tag, name, players: [], color: "#000", stats: mkStats(overrides),
});

describe("totalRegulars / totalLevies", () => {
  it("sums infantry + cavalry + artillery strength for regulars", () => {
    expect(totalRegulars(mkStats({ infantryStr: 1000, cavalryStr: 500, artilleryStr: 300 }))).toBe(1800);
  });

  it("sums levy strength for levies", () => {
    expect(totalLevies(mkStats({ levyInfantryStr: 2000, levyCavalryStr: 500 }))).toBe(2500);
  });
});

describe("sortMilitary", () => {
  it("sorts by regulars strength descending", () => {
    const entries = [
      mkEntry("A", "Alpha", { infantryStr: 500, cavalryStr: 500 }),
      mkEntry("B", "Bravo", { infantryStr: 3000, cavalryStr: 2000 }),
      mkEntry("C", "Charlie", { infantryStr: 2000, cavalryStr: 1000 }),
    ];
    const sorted = sortMilitary(entries, "regulars");
    expect(sorted.map(e => e.tag)).toEqual(["B", "C", "A"]);
  });

  it("sorts by infantry strength descending", () => {
    const entries = [
      mkEntry("A", "Alpha", { infantryStr: 100 }),
      mkEntry("B", "Bravo", { infantryStr: 500 }),
    ];
    const sorted = sortMilitary(entries, "infantry");
    expect(sorted[0].tag).toBe("B");
  });

  it("sorts by total navy descending", () => {
    const entries = [
      mkEntry("A", "Alpha", { heavyShips: 5 }),
      mkEntry("B", "Bravo", { heavyShips: 20 }),
    ];
    const sorted = sortMilitary(entries, "totalNavy");
    expect(sorted[0].tag).toBe("B");
  });

  it("sorts by max manpower descending", () => {
    const entries = [
      mkEntry("A", "Alpha", { maxManpower: 1000 }),
      mkEntry("B", "Bravo", { maxManpower: 5000 }),
    ];
    const sorted = sortMilitary(entries, "manpower");
    expect(sorted[0].tag).toBe("B");
  });

  it("sorts by country name alphabetically", () => {
    const entries = [mkEntry("B", "Zulu"), mkEntry("A", "Alpha")];
    const sorted = sortMilitary(entries, "country");
    expect(sorted.map(e => e.name)).toEqual(["Alpha", "Zulu"]);
  });

  it("breaks ties by name", () => {
    const entries = [
      mkEntry("B", "Bravo", { infantryStr: 1000 }),
      mkEntry("A", "Alpha", { infantryStr: 1000 }),
    ];
    const sorted = sortMilitary(entries, "regulars");
    expect(sorted.map(e => e.tag)).toEqual(["A", "B"]);
  });
});

describe("buildMilitaryEntries", () => {
  it("includes countries with army, navy, or manpower", () => {
    const entries = buildMilitaryEntries(
      {
        GBR: mkStats({ infantry: 10, infantryStr: 1000 }),
        FRA: mkStats({ maxManpower: 500 }),
        NUL: mkStats(),
      },
      { GBR: "Great Britain", FRA: "France" },
      {},
      { GBR: [255, 0, 0], FRA: [0, 0, 255] },
    );
    expect(entries).toHaveLength(2);
    expect(entries.map(e => e.tag).sort()).toEqual(["FRA", "GBR"]);
  });

  it("excludes countries with all zero military stats", () => {
    const entries = buildMilitaryEntries(
      { NUL: mkStats({ population: 1000 }) },
      {}, {}, {},
    );
    expect(entries).toHaveLength(0);
  });

  it("uses tag as fallback name", () => {
    const entries = buildMilitaryEntries(
      { XYZ: mkStats({ cavalry: 1, cavalryStr: 50 }) },
      {}, {}, {},
    );
    expect(entries[0].name).toBe("XYZ");
  });
});
