import { describe, it, expect } from "vitest";
import {
  collectPlayerPaths,
  buildSubjectOverlords,
  buildTagLabel,
  buildAllTagLabels,
  filterToPlayers,
  collectVassalLocations,
  buildVassalOverlays,
  exportMapChartConfig,
} from "../export";
import { buildMinimalSave } from "./fixtures/minimal-save";
import type { RGB } from "../types";

// Lowercase save name -> canonical MapChart path ID.
const locationIndex: Record<string, string> = {
  stockholm: "Stockholm",
  paris: "Paris",
  london: "London",
  edinburgh: "Edinburgh",
};

// =============================================================================
// Pure helper tests
// =============================================================================

describe("buildTagLabel", () => {
  it("returns 'TAG - PlayerName' for player tags", () => {
    expect(buildTagLabel("SWE", { SWE: ["Alice"] })).toBe("SWE - Alice");
  });

  it("joins multiple player names with comma", () => {
    expect(buildTagLabel("FRA", { FRA: ["Alice", "Bob"] })).toBe("FRA - Alice, Bob");
  });

  it("returns bare tag for non-player countries", () => {
    expect(buildTagLabel("ENG", { SWE: ["Alice"] })).toBe("ENG");
  });

  it("returns bare tag when tagToPlayers is empty", () => {
    expect(buildTagLabel("SWE", {})).toBe("SWE");
  });
});

describe("buildAllTagLabels", () => {
  it("builds labels for all tags", () => {
    const labels = buildAllTagLabels(["SWE", "ENG"], { SWE: ["Alice"] });
    expect(labels).toEqual({ SWE: "SWE - Alice", ENG: "ENG" });
  });

  it("returns empty for empty tags", () => {
    expect(buildAllTagLabels([], {})).toEqual({});
  });
});

describe("filterToPlayers", () => {
  it("keeps only player-owned countries", () => {
    const locs = { SWE: ["stockholm"], ENG: ["london"], FRA: ["paris"] };
    const result = filterToPlayers(locs, { SWE: ["Alice"] });
    expect(Object.keys(result)).toEqual(["SWE"]);
  });

  it("returns all countries when no players", () => {
    const locs = { SWE: ["stockholm"], ENG: ["london"] };
    const result = filterToPlayers(locs, {});
    expect(result).toEqual(locs);
  });
});

describe("collectVassalLocations", () => {
  it("collects locations from vassal tags", () => {
    const allLocs = { SCO: ["edinburgh", "glasgow"], WLS: ["cardiff"] };
    const result = collectVassalLocations(new Set(["SCO", "WLS"]), allLocs);
    expect(result).toEqual(["edinburgh", "glasgow", "cardiff"]);
  });

  it("skips vassal tags with no locations", () => {
    const result = collectVassalLocations(new Set(["MISSING"]), { SWE: ["stockholm"] });
    expect(result).toEqual([]);
  });

  it("returns empty for empty vassal set", () => {
    expect(collectVassalLocations(new Set(), { SWE: ["stockholm"] })).toEqual([]);
  });
});

describe("buildVassalOverlays", () => {
  it("creates vassal entries with lightened colors", () => {
    const overlays = buildVassalOverlays(
      { ENG: ["Alice"] },
      { ENG: new Set(["SCO"]) },
      { ENG: ["london"], SCO: ["edinburgh"] },
      { ENG: [255, 0, 0] },
    );
    expect(overlays.locations["ENG_vassals"]).toEqual(["edinburgh"]);
    expect(overlays.labels["ENG_vassals"]).toBe("ENG - subjects");
    expect(overlays.colors["ENG_vassals"]).toEqual([255, 85, 85]);
  });

  it("skips overlords with no vassals", () => {
    const overlays = buildVassalOverlays(
      { ENG: ["Alice"] },
      {},
      { ENG: ["london"] },
      { ENG: [255, 0, 0] },
    );
    expect(overlays.locations).toEqual({});
  });

  it("skips when vassal locations are empty", () => {
    const overlays = buildVassalOverlays(
      { ENG: ["Alice"] },
      { ENG: new Set(["SCO"]) },
      { ENG: ["london"] }, // SCO has no locations
      { ENG: [255, 0, 0] },
    );
    expect(overlays.locations).toEqual({});
  });

  it("handles overlord with no color", () => {
    const overlays = buildVassalOverlays(
      { ENG: ["Alice"] },
      { ENG: new Set(["SCO"]) },
      { ENG: ["london"], SCO: ["edinburgh"] },
      {}, // no colors
    );
    expect(overlays.locations["ENG_vassals"]).toEqual(["edinburgh"]);
    expect(overlays.colors["ENG_vassals"]).toBeUndefined();
  });
});

// =============================================================================
// Integration tests
// =============================================================================

describe("exportMapChartConfig", () => {
  it("exports all countries by default", () => {
    const save = buildMinimalSave({
      locationNames: ["stockholm", "paris", "london"],
      tags: { 0: "SWE", 1: "FRA", 2: "ENG" },
      ownership: { 0: 0, 1: 1, 2: 2 },
      players: [{ name: "Alice", country: 0 }],
    });
    const config = exportMapChartConfig(save, { locationIndex }).config;
    const labels = Object.values(config.groups).map((g) => g.label);
    expect(labels).toContain("SWE - Alice");
    expect(labels).toContain("FRA");
    expect(labels).toContain("ENG");
  });

  it("filters to players only when playersOnly=true", () => {
    const save = buildMinimalSave({
      locationNames: ["stockholm", "paris", "london"],
      tags: { 0: "SWE", 1: "FRA", 2: "ENG" },
      ownership: { 0: 0, 1: 1, 2: 2 },
      players: [{ name: "Alice", country: 0 }],
    });
    const config = exportMapChartConfig(save, { locationIndex, playersOnly: true }).config;
    const labels = Object.values(config.groups).map((g) => g.label);
    expect(labels).toContain("SWE - Alice");
    expect(labels).not.toContain("FRA");
    expect(labels).not.toContain("ENG");
  });

  it("adds vassal territory with lightened colors", () => {
    const save = buildMinimalSave({
      locationNames: ["stockholm", "edinburgh"],
      tags: { 0: "ENG", 1: "SCO" },
      ownership: { 0: 0, 1: 1 },
      colors: { ENG: [255, 0, 0], SCO: [0, 0, 255] },
      ioVassals: [{ leader: 0, members: [0, 1] }],
      players: [{ name: "Alice", country: 0 }],
    });
    const config = exportMapChartConfig(save, { locationIndex, playersOnly: true }).config;
    const labels = Object.values(config.groups).map((g) => g.label);
    expect(labels).toContain("ENG - Alice");
    expect(labels).toContain("ENG - subjects");

    const vassalGroup = Object.entries(config.groups).find(
      ([, g]) => g.label === "ENG - subjects",
    );
    expect(vassalGroup).toBeDefined();
    expect(vassalGroup![0]).toBe("#ff5555");
  });

  it("includes player names in labels for multi-player countries", () => {
    const save = buildMinimalSave({
      locationNames: ["paris"],
      tags: { 0: "FRA" },
      ownership: { 0: 0 },
      players: [
        { name: "Alice", country: 0 },
        { name: "Bob", country: 0 },
      ],
    });
    const config = exportMapChartConfig(save, { locationIndex }).config;
    const labels = Object.values(config.groups).map((g) => g.label);
    expect(labels).toContain("FRA - Alice, Bob");
  });

  it("sets title from options", () => {
    const save = buildMinimalSave();
    const config = exportMapChartConfig(save, { locationIndex, title: "Test Map" }).config;
    expect(config.title).toBe("Test Map");
  });

  it("handles save with no players gracefully", () => {
    const save = buildMinimalSave({
      locationNames: ["stockholm"],
      tags: { 0: "SWE" },
      ownership: { 0: 0 },
      players: [],
    });
    const config = exportMapChartConfig(save, { locationIndex, playersOnly: true }).config;
    const labels = Object.values(config.groups).map((g) => g.label);
    expect(labels).toContain("SWE");
  });

  it("skips vassal entry when vassals have no locations", () => {
    const save = buildMinimalSave({
      locationNames: ["stockholm"],
      tags: { 0: "ENG", 1: "SCO" },
      ownership: { 0: 0 },
      ioVassals: [{ leader: 0, members: [0, 1] }],
      players: [{ name: "Alice", country: 0 }],
    });
    const config = exportMapChartConfig(save, { locationIndex, playersOnly: true }).config;
    const labels = Object.values(config.groups).map((g) => g.label);
    expect(labels).not.toContain("ENG - subjects");
  });

  it("accepts ParsedSave directly", () => {
    const parsed = {
      countryLocations: { SWE: ["stockholm"] },
      tagToPlayers: { SWE: ["Alice"] },
      countryColors: { SWE: [0, 0, 255] as RGB },
      overlordSubjects: {},
      countryNames: {}, countryStats: {}, locationRgos: {}, countryProduction: {}, countryLastMonthProduced: {}, goodsRankings: {}, producedGoodsRankings: {}, goodAvgPrices: {}, countryBuildings: {}, wars: [], pastWars: [], warReparations: [], annulledTreaties: [], royalMarriages: [], activeCBs: [], trade: { producedGoods: {}, marketNames: {}, marketOwners: {}, markets: [] },
    };
    const config = exportMapChartConfig(parsed, { locationIndex }).config;
    const labels = Object.values(config.groups).map((g) => g.label);
    expect(labels).toContain("SWE - Alice");
  });
});

// =============================================================================
// Subject -> root overlord mapping
// =============================================================================

const subjectSets = (pairs: Record<string, string[]>): Record<string, Set<string>> =>
  Object.fromEntries(Object.entries(pairs).map(([k, v]) => [k, new Set(v)]));

describe("buildSubjectOverlords", () => {
  it("maps a direct subject to its overlord", () => {
    const result = buildSubjectOverlords(subjectSets({ FRA: ["BUR"] }));
    expect(result).toEqual({ BUR: "FRA" });
  });

  it("flattens a chain to the root overlord", () => {
    // A -> B -> C: C is painted A's colour, and so is B.
    const result = buildSubjectOverlords(subjectSets({ A: ["B"], B: ["C"] }));
    expect(result).toEqual({ B: "A", C: "A" });
  });

  it("maps every subject type through the same path", () => {
    // overlordSubjects carries no type information, so vassal/fiefdom/march
    // are indistinguishable here by construction (R4).
    const result = buildSubjectOverlords(subjectSets({ FRA: ["BUR", "PRO", "BAR"] }));
    expect(result).toEqual({ BUR: "FRA", PRO: "FRA", BAR: "FRA" });
  });

  it("omits countries that are neither overlord nor subject", () => {
    const result = buildSubjectOverlords(subjectSets({ FRA: ["BUR"] }));
    expect(result.ENG).toBeUndefined();
    expect(result.FRA).toBeUndefined();
  });

  it("omits an overlord with no subjects", () => {
    expect(buildSubjectOverlords(subjectSets({ FRA: [] }))).toEqual({});
  });

  it("returns empty for empty input", () => {
    expect(buildSubjectOverlords({})).toEqual({});
  });

  it("terminates on a two-tag cycle rather than looping", () => {
    // Four independent writers populate overlordSubjects and none guarantees
    // acyclicity; a hang here would stop the app loading a save at all.
    const result = buildSubjectOverlords(subjectSets({ A: ["B"], B: ["A"] }));
    expect(Object.keys(result).sort()).toEqual(["A", "B"]);
  });

  it("terminates on a longer cycle", () => {
    const result = buildSubjectOverlords(subjectSets({ A: ["B"], B: ["C"], C: ["A"] }));
    expect(Object.keys(result).sort()).toEqual(["A", "B", "C"]);
  });

  it("resolves a tag listed under two overlords deterministically", () => {
    const first = buildSubjectOverlords(subjectSets({ FRA: ["BUR"], ENG: ["BUR"] }));
    const second = buildSubjectOverlords(subjectSets({ FRA: ["BUR"], ENG: ["BUR"] }));
    expect(first.BUR).toBe(second.BUR);
    expect(["FRA", "ENG"]).toContain(first.BUR);
  });

  it("does not mutate its input", () => {
    const input = subjectSets({ A: ["B"], B: ["C"] });
    buildSubjectOverlords(input);
    expect([...input.A]).toEqual(["B"]);
    expect([...input.B]).toEqual(["C"]);
  });
});

// =============================================================================
// Player paths
// =============================================================================

describe("collectPlayerPaths", () => {
  const groups = {
    "#ff0000": { label: "SWE - Alice", paths: ["Stockholm", "Uppsala"] },
    "#00ff00": { label: "FRA", paths: ["Paris"] },
    "#0000ff": { label: "SWE - subjects", paths: ["Edinburgh"] },
  };

  it("collects a player's own paths", () => {
    const paths = collectPlayerPaths(groups, { SWE: ["Alice"] });
    expect(paths).toContain("Stockholm");
    expect(paths).toContain("Uppsala");
  });

  it("includes the player's subject territory", () => {
    // A vassal overlay is labelled "<overlord> - subjects", so it belongs in
    // the frame alongside the overlord's own land.
    expect(collectPlayerPaths(groups, { SWE: ["Alice"] })).toContain("Edinburgh");
  });

  it("excludes a non-player country", () => {
    expect(collectPlayerPaths(groups, { SWE: ["Alice"] })).not.toContain("Paris");
  });

  it("collects every player when there are several", () => {
    const paths = collectPlayerPaths(groups, { SWE: ["Alice"], FRA: ["Bob"] });
    expect(paths).toContain("Stockholm");
    expect(paths).toContain("Paris");
  });

  it("returns nothing when the save has no players", () => {
    expect(collectPlayerPaths(groups, {})).toEqual([]);
  });

  it("returns nothing when the player tag owns no group", () => {
    expect(collectPlayerPaths(groups, { ZZZ: ["Nobody"] })).toEqual([]);
  });

  it("returns nothing for an empty group set", () => {
    expect(collectPlayerPaths({}, { SWE: ["Alice"] })).toEqual([]);
  });

  it("handles a player group with no paths", () => {
    expect(collectPlayerPaths({ "#fff": { label: "SWE - Alice", paths: [] } }, { SWE: ["Alice"] }))
      .toEqual([]);
  });
});

describe("exportMapChartConfig player paths", () => {
  const save = () =>
    buildMinimalSave({
      locationNames: ["stockholm", "paris", "london"],
      tags: { 0: "SWE", 1: "FRA", 2: "ENG" },
      ownership: { 0: 0, 1: 1, 2: 2 },
      players: [{ name: "Alice", country: 0 }],
    });

  it("returns only the player's resolved paths", () => {
    const out = exportMapChartConfig(save(), { locationIndex });
    expect(out.playerPaths).toContain("Stockholm");
    expect(out.playerPaths).not.toContain("Paris");
  });

  it("returns nothing for a save with no players", () => {
    const noPlayers = buildMinimalSave({
      locationNames: ["stockholm"],
      tags: { 0: "SWE" },
      ownership: { 0: 0 },
    });
    expect(exportMapChartConfig(noPlayers, { locationIndex }).playerPaths).toEqual([]);
  });

  it("matches the painted paths when playersOnly is on", () => {
    const out = exportMapChartConfig(save(), { locationIndex, playersOnly: true });
    const painted = Object.values(out.config.groups).flatMap((g) => g.paths);
    expect([...out.playerPaths].sort()).toEqual([...painted].sort());
  });

  it("returns only ids that are present in the config groups", () => {
    // Every returned id must exist in the rendered document, or the frame
    // would be computed from geometry that is not there.
    const out = exportMapChartConfig(save(), { locationIndex });
    const painted = new Set(Object.values(out.config.groups).flatMap((g) => g.paths));
    for (const id of out.playerPaths) {
      expect(painted.has(id)).toBe(true);
    }
  });
});
