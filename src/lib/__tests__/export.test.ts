import { describe, it, expect } from "vitest";
import {
  buildTagLabel,
  buildAllTagLabels,
  filterToPlayers,
  collectVassalLocations,
  buildVassalOverlays,
  exportMapChartConfig,
} from "../export";
import { buildMinimalSave } from "./fixtures/minimal-save";
import type { RGB } from "../types";

const provinceMapping: Record<string, string[]> = {
  Uppland: ["Stockholm"],
  Ile_de_France: ["Paris"],
  Middlesex: ["London"],
  Edinburgh: ["Edinburgh"],
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
    const config = exportMapChartConfig(save, provinceMapping);
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
    const config = exportMapChartConfig(save, provinceMapping, { playersOnly: true });
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
    const config = exportMapChartConfig(save, provinceMapping, { playersOnly: true });
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
    const config = exportMapChartConfig(save, provinceMapping);
    const labels = Object.values(config.groups).map((g) => g.label);
    expect(labels).toContain("FRA - Alice, Bob");
  });

  it("sets title from options", () => {
    const save = buildMinimalSave();
    const config = exportMapChartConfig(save, provinceMapping, { title: "Test Map" });
    expect(config.title).toBe("Test Map");
  });

  it("handles save with no players gracefully", () => {
    const save = buildMinimalSave({
      locationNames: ["stockholm"],
      tags: { 0: "SWE" },
      ownership: { 0: 0 },
      players: [],
    });
    const config = exportMapChartConfig(save, provinceMapping, { playersOnly: true });
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
    const config = exportMapChartConfig(save, provinceMapping, { playersOnly: true });
    const labels = Object.values(config.groups).map((g) => g.label);
    expect(labels).not.toContain("ENG - subjects");
  });

  it("accepts ParsedSave directly", () => {
    const parsed = {
      countryLocations: { SWE: ["stockholm"] },
      tagToPlayers: { SWE: ["Alice"] },
      countryColors: { SWE: [0, 0, 255] as RGB },
      overlordSubjects: {},
      countryNames: {}, countryStats: {}, wars: [], pastWars: [], warReparations: [], annulledTreaties: [], royalMarriages: [], activeCBs: [], trade: { producedGoods: {}, marketNames: {}, marketOwners: {}, markets: [] },
    };
    const config = exportMapChartConfig(parsed, provinceMapping);
    const labels = Object.values(config.groups).map((g) => g.label);
    expect(labels).toContain("SWE - Alice");
  });
});
