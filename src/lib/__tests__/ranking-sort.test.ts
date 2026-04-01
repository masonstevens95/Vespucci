import { describe, it, expect } from "vitest";
import {
  isGreatPower,
  sortRankings,
  filterPlayersOnly,
  buildRankingEntries,
  findTiedScores,
} from "../ranking-sort";
import type { RankingEntry } from "../ranking-sort";
import type { CountryEconomyStats } from "../types";

const mkStats = (overrides: Partial<CountryEconomyStats> = {}): CountryEconomyStats => ({
  gold: 0, monthlyIncome: 0, monthlyTradeValue: 0, population: 1000,
  infantry: 0, cavalry: 0, artillery: 0,
  infantryStr: 0, cavalryStr: 0, artilleryStr: 0,
  levyInfantry: 0, levyCavalry: 0,
  levyInfantryStr: 0, levyCavalryStr: 0,
  heavyShips: 0, lightShips: 0, galleys: 0, transports: 0,
  maxManpower: 0, maxSailors: 0, monthlyManpower: 0, monthlySailors: 0,
  armyMaintenance: 0, navyMaintenance: 0,
  expectedArmySize: 0, expectedNavySize: 0,
  courtLanguage: "", govType: "", score: 0, ...overrides,
});

const mkEntry = (tag: string, name: string, players: string[], score: number, pop: number = 1000): RankingEntry => ({
  tag, name, players, color: "#000",
  stats: mkStats({ score, population: pop }),
});

describe("isGreatPower", () => {
  it("returns true for ranks 1-8", () => {
    for (let i = 1; i <= 8; i++) expect(isGreatPower(i)).toBe(true);
  });

  it("returns false for rank 0", () => {
    expect(isGreatPower(0)).toBe(false);
  });

  it("returns false for rank > 8", () => {
    expect(isGreatPower(9)).toBe(false);
    expect(isGreatPower(100)).toBe(false);
  });
});

describe("sortRankings", () => {
  it("sorts by rank ascending", () => {
    const entries = [mkEntry("C", "C", [], 5), mkEntry("A", "A", [], 1), mkEntry("B", "B", [], 3)];
    const sorted = sortRankings(entries, "rank");
    expect(sorted.map(e => e.tag)).toEqual(["A", "B", "C"]);
  });

  it("puts unranked (score 0) at bottom", () => {
    const entries = [mkEntry("X", "X", [], 0), mkEntry("A", "A", [], 2)];
    const sorted = sortRankings(entries, "rank");
    expect(sorted[0].tag).toBe("A");
    expect(sorted[1].tag).toBe("X");
  });

  it("sorts by country name", () => {
    const entries = [mkEntry("C", "France", [], 1), mkEntry("A", "Austria", [], 2)];
    const sorted = sortRankings(entries, "country");
    expect(sorted.map(e => e.name)).toEqual(["Austria", "France"]);
  });

  it("sorts by player name, AI last", () => {
    const entries = [
      mkEntry("A", "A", [], 1),
      mkEntry("B", "B", ["Alice"], 2),
      mkEntry("C", "C", ["Bob"], 3),
    ];
    const sorted = sortRankings(entries, "player");
    expect(sorted.map(e => e.tag)).toEqual(["B", "C", "A"]);
  });

  it("sorts by population descending", () => {
    const entries = [mkEntry("A", "A", [], 1, 100), mkEntry("B", "B", [], 2, 500)];
    const sorted = sortRankings(entries, "population");
    expect(sorted[0].tag).toBe("B");
  });

  it("sorts by income descending", () => {
    const entries = [
      { ...mkEntry("A", "A", [], 1), stats: mkStats({ monthlyIncome: 50 }) },
      { ...mkEntry("B", "B", [], 2), stats: mkStats({ monthlyIncome: 200 }) },
    ];
    const sorted = sortRankings(entries, "income");
    expect(sorted[0].tag).toBe("B");
  });
});

describe("filterPlayersOnly", () => {
  it("filters to players when true", () => {
    const entries = [mkEntry("A", "A", ["Alice"], 1), mkEntry("B", "B", [], 2)];
    expect(filterPlayersOnly(entries, true)).toHaveLength(1);
    expect(filterPlayersOnly(entries, true)[0].tag).toBe("A");
  });

  it("returns all when false", () => {
    const entries = [mkEntry("A", "A", ["Alice"], 1), mkEntry("B", "B", [], 2)];
    expect(filterPlayersOnly(entries, false)).toHaveLength(2);
  });
});

describe("buildRankingEntries", () => {
  it("builds entries from parsed data", () => {
    const entries = buildRankingEntries(
      { GBR: mkStats({ population: 5000, score: 3 }) },
      { GBR: "Great Britain" },
      { GBR: ["Alice"] },
      { GBR: [255, 0, 0] },
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("Great Britain");
    expect(entries[0].players).toEqual(["Alice"]);
    expect(entries[0].color).toBe("rgb(255,0,0)");
  });

  it("filters out countries with zero population", () => {
    const entries = buildRankingEntries(
      { GBR: mkStats({ population: 0 }) },
      {}, {}, {},
    );
    expect(entries).toHaveLength(0);
  });
});

describe("findTiedScores", () => {
  it("returns scores that appear more than once", () => {
    const entries = [
      mkEntry("A", "A", [], 3),
      mkEntry("B", "B", [], 3),
      mkEntry("C", "C", [], 4),
      mkEntry("D", "D", [], 4),
      mkEntry("E", "E", [], 5),
    ];
    const tied = findTiedScores(entries);
    expect(tied.has(3)).toBe(true);
    expect(tied.has(4)).toBe(true);
    expect(tied.has(5)).toBe(false);
  });

  it("ignores score 0 (unranked)", () => {
    const entries = [mkEntry("A", "A", [], 0), mkEntry("B", "B", [], 0)];
    expect(findTiedScores(entries).has(0)).toBe(false);
  });

  it("returns empty set when no ties", () => {
    const entries = [mkEntry("A", "A", [], 1), mkEntry("B", "B", [], 2)];
    expect(findTiedScores(entries).size).toBe(0);
  });
});
