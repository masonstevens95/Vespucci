import { describe, it, expect } from "vitest";
import {
  formatCountryName,
  findOverlord,
  getSubjects,
  buildCountryInfo,
  resolveDisplayName,
} from "../country-info";

describe("formatCountryName", () => {
  it("replaces underscores and title-cases", () => {
    expect(formatCountryName("red_sea_coast_province")).toBe("Red Sea Coast Province");
  });

  it("handles single word", () => {
    expect(formatCountryName("hadoti")).toBe("Hadoti");
  });

  it("handles already capitalized", () => {
    expect(formatCountryName("GBR")).toBe("GBR");
  });
});

describe("findOverlord", () => {
  it("finds overlord for a subject", () => {
    const subjects = { GBR: new Set(["SCO", "WLS"]), FRA: new Set(["BRI"]) };
    expect(findOverlord("SCO", subjects)).toBe("GBR");
  });

  it("returns empty string for independent country", () => {
    const subjects = { GBR: new Set(["SCO"]) };
    expect(findOverlord("FRA", subjects)).toBe("");
  });

  it("returns empty for empty subjects", () => {
    expect(findOverlord("GBR", {})).toBe("");
  });
});

describe("getSubjects", () => {
  it("returns subjects for overlord", () => {
    const subjects = { GBR: new Set(["SCO", "WLS"]) };
    expect(getSubjects("GBR", subjects)).toEqual(["SCO", "WLS"]);
  });

  it("returns empty for non-overlord", () => {
    const subjects = { GBR: new Set(["SCO"]) };
    expect(getSubjects("FRA", subjects)).toEqual([]);
  });
});

describe("buildCountryInfo", () => {
  it("builds info from parsed save", () => {
    const parsed = {
      countryLocations: { GBR: ["london", "york"] },
      tagToPlayers: { GBR: ["Alice"] },
      countryColors: { GBR: [255, 0, 0] as [number, number, number] },
      overlordSubjects: { GBR: new Set(["SCO"]) },
      countryNames: { GBR: "Kingdom of Great Britain" },
      countryStats: {}, locationRgos: {}, wars: [], pastWars: [], warReparations: [], annulledTreaties: [], royalMarriages: [], activeCBs: [], trade: { producedGoods: {}, marketNames: {}, marketOwners: {}, markets: [] },
    };
    const info = buildCountryInfo("GBR", parsed, 10);
    expect(info.tag).toBe("GBR");
    expect(info.displayName).toBe("Kingdom of Great Britain");
    expect(info.players).toEqual(["Alice"]);
    expect(info.color).toBe("#ff0000");
    expect(info.provinceCount).toBe(10);
    expect(info.overlord).toBe("");
    expect(info.subjects).toEqual(["SCO"]);
  });

  it("falls back to tag when no country name", () => {
    const parsed = {
      countryLocations: {},
      tagToPlayers: {},
      countryColors: {},
      overlordSubjects: {},
      countryNames: {}, countryStats: {}, locationRgos: {}, wars: [], pastWars: [], warReparations: [], annulledTreaties: [], royalMarriages: [], activeCBs: [], trade: { producedGoods: {}, marketNames: {}, marketOwners: {}, markets: [] },
    };
    const info = buildCountryInfo("FRA", parsed, 5);
    expect(info.displayName).toBe("FRA");
    expect(info.color).toBe("#808080");
  });

  it("finds overlord for subject", () => {
    const parsed = {
      countryLocations: {},
      tagToPlayers: {},
      countryColors: {},
      overlordSubjects: { GBR: new Set(["SCO"]) },
      countryNames: {}, countryStats: {}, locationRgos: {}, wars: [], pastWars: [], warReparations: [], annulledTreaties: [], royalMarriages: [], activeCBs: [], trade: { producedGoods: {}, marketNames: {}, marketOwners: {}, markets: [] },
    };
    const info = buildCountryInfo("SCO", parsed, 3);
    expect(info.overlord).toBe("GBR");
  });
});

describe("resolveDisplayName", () => {
  it("returns display name when available", () => {
    expect(resolveDisplayName("AAA62", { AAA62: "Duchy of Usolye" })).toBe("Duchy of Usolye");
  });

  it("falls back to tag", () => {
    expect(resolveDisplayName("GBR", {})).toBe("GBR");
  });
});
