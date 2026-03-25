import { describe, it, expect } from "vitest";
import {
  sortTagsByLabel,
  fillMissingColors,
  nudgeColor,
  resolveUniqueHex,
  resolveLabel,
  buildGroups,
  defaultConfigValues,
  generateMapChartConfig,
} from "../mapchart-config";
import type { RGB } from "../types";

const locToProvince: Record<string, string> = {
  stockholm: "Uppland",
  paris: "Ile_de_France",
  london: "Middlesex",
};

// =============================================================================
// Pure helper tests
// =============================================================================

describe("sortTagsByLabel", () => {
  it("sorts alphabetically by label", () => {
    const result = sortTagsByLabel(["ZZZ", "AAA", "MMM"], {});
    expect(result).toEqual(["AAA", "MMM", "ZZZ"]);
  });

  it("uses tagLabels for sort key", () => {
    const result = sortTagsByLabel(["A", "B"], { A: "Zebra", B: "Apple" });
    expect(result).toEqual(["B", "A"]);
  });

  it("falls back to tag when no label", () => {
    const result = sortTagsByLabel(["B", "A"], { A: "Alpha" });
    expect(result).toEqual(["A", "B"]);
  });

  it("returns empty for empty input", () => {
    expect(sortTagsByLabel([], {})).toEqual([]);
  });
});

describe("fillMissingColors", () => {
  it("returns existing colors when all present", () => {
    const colors = { A: [255, 0, 0] as RGB };
    const result = fillMissingColors(["A"], colors);
    expect(result["A"]).toEqual([255, 0, 0]);
  });

  it("generates colors for missing tags", () => {
    const result = fillMissingColors(["A", "B"], {});
    expect(result["A"]).toBeDefined();
    expect(result["B"]).toBeDefined();
    expect(result["A"]).not.toEqual(result["B"]);
  });

  it("preserves existing and adds missing", () => {
    const existing = { A: [255, 0, 0] as RGB };
    const result = fillMissingColors(["A", "B"], existing);
    expect(result["A"]).toEqual([255, 0, 0]);
    expect(result["B"]).toBeDefined();
  });

  it("does not mutate input", () => {
    const existing = { A: [255, 0, 0] as RGB };
    fillMissingColors(["A", "B"], existing);
    expect(existing["B" as keyof typeof existing]).toBeUndefined();
  });
});

describe("nudgeColor", () => {
  it("adds 3 to red and 2 to green", () => {
    expect(nudgeColor([100, 100, 100])).toEqual([103, 102, 100]);
  });

  it("clamps red at 255", () => {
    expect(nudgeColor([254, 100, 100])).toEqual([255, 102, 100]);
  });

  it("clamps green at 255", () => {
    expect(nudgeColor([100, 254, 100])).toEqual([103, 255, 100]);
  });

  it("leaves blue unchanged", () => {
    expect(nudgeColor([0, 0, 200])[2]).toBe(200);
  });
});

describe("resolveUniqueHex", () => {
  it("returns hex directly when not used", () => {
    const result = resolveUniqueHex([255, 0, 0], "A", new Map());
    expect(result.hex).toBe("#ff0000");
  });

  it("returns same hex when used by same tag", () => {
    const used = new Map([["#ff0000", "A"]]);
    const result = resolveUniqueHex([255, 0, 0], "A", used);
    expect(result.hex).toBe("#ff0000");
  });

  it("nudges when hex is used by different tag", () => {
    const used = new Map([["#ff0000", "B"]]);
    const result = resolveUniqueHex([255, 0, 0], "A", used);
    expect(result.hex).not.toBe("#ff0000");
  });
});

describe("resolveLabel", () => {
  it("returns label from map", () => {
    expect(resolveLabel("A", { A: "Alpha" })).toBe("Alpha");
  });

  it("falls back to tag", () => {
    expect(resolveLabel("A", {})).toBe("A");
  });
});

describe("buildGroups", () => {
  it("builds groups with labels and paths", () => {
    const groups = buildGroups(
      ["SWE"],
      { SWE: [0, 0, 255] },
      { SWE: ["Uppland"] },
      { SWE: "Sweden" },
    );
    const entry = Object.values(groups)[0];
    expect(entry.label).toBe("Sweden");
    expect(entry.paths).toEqual(["Uppland"]);
  });

  it("deduplicates hex collisions", () => {
    const same: RGB = [100, 100, 100];
    const groups = buildGroups(
      ["A", "B"],
      { A: same, B: [...same] as RGB },
      { A: ["p1"], B: ["p2"] },
      {},
    );
    const hexes = Object.keys(groups);
    expect(hexes).toHaveLength(2);
    expect(hexes[0]).not.toBe(hexes[1]);
  });

  it("uses fallback color for missing tags", () => {
    const groups = buildGroups(["A"], {}, { A: ["p1"] }, {});
    const hex = Object.keys(groups)[0];
    expect(hex).toBe("#808080"); // [128,128,128] fallback
  });

  it("returns empty for empty tags", () => {
    expect(buildGroups([], {}, {}, {})).toEqual({});
  });
});

describe("defaultConfigValues", () => {
  it("returns expected static fields", () => {
    const defaults = defaultConfigValues();
    expect(defaults.page).toBe("eu-v-provinces");
    expect(defaults.v6).toBe(true);
    expect(defaults.areBordersShown).toBe(true);
    expect(defaults.defaultColor).toBe("#d1dbdd");
    expect(defaults.mapVersion).toBeNull();
  });
});

// =============================================================================
// Integration tests
// =============================================================================

describe("generateMapChartConfig", () => {
  it("produces valid config structure", () => {
    const config = generateMapChartConfig(
      { SWE: ["stockholm"], FRA: ["paris"] },
      { SWE: [0, 0, 255], FRA: [33, 33, 173] },
      locToProvince,
    );
    expect(config.page).toBe("eu-v-provinces");
    expect(config.v6).toBe(true);
    expect(config.hidden).toEqual([]);
  });

  it("uses provided colors", () => {
    const config = generateMapChartConfig(
      { SWE: ["stockholm"] },
      { SWE: [0, 0, 255] },
      locToProvince,
    );
    expect(config.groups["#0000ff"]).toBeDefined();
    expect(config.groups["#0000ff"].label).toBe("SWE");
  });

  it("generates colors for countries without provided colors", () => {
    const config = generateMapChartConfig(
      { SWE: ["stockholm"], FRA: ["paris"] },
      {},
      locToProvince,
    );
    const hexKeys = Object.keys(config.groups);
    expect(hexKeys).toHaveLength(2);
    for (const hex of hexKeys) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("deduplicates hex color collisions", () => {
    const sameColor: RGB = [100, 100, 100];
    const config = generateMapChartConfig(
      { AAA: ["stockholm"], BBB: ["paris"] },
      { AAA: sameColor, BBB: [...sameColor] },
      locToProvince,
    );
    const hexKeys = Object.keys(config.groups);
    expect(hexKeys).toHaveLength(2);
    expect(hexKeys[0]).not.toBe(hexKeys[1]);
  });

  it("applies tagLabels", () => {
    const config = generateMapChartConfig(
      { SWE: ["stockholm"] },
      { SWE: [0, 0, 255] },
      locToProvince,
      { tagLabels: { SWE: "SWE - Alice" } },
    );
    expect(config.groups["#0000ff"].label).toBe("SWE - Alice");
  });

  it("uses tag as label when no tagLabels provided", () => {
    const config = generateMapChartConfig(
      { SWE: ["stockholm"] },
      { SWE: [0, 0, 255] },
      locToProvince,
    );
    expect(config.groups["#0000ff"].label).toBe("SWE");
  });

  it("sets title from options", () => {
    const config = generateMapChartConfig({}, {}, locToProvince, { title: "My Map" });
    expect(config.title).toBe("My Map");
  });

  it("sorts groups alphabetically by label", () => {
    const config = generateMapChartConfig(
      { ZZZ: ["stockholm"], AAA: ["paris", "london"] },
      { ZZZ: [255, 0, 0], AAA: [0, 255, 0] },
      locToProvince,
    );
    const labels = Object.values(config.groups).map((g) => g.label);
    expect(labels[0]).toBe("AAA");
    expect(labels[1]).toBe("ZZZ");
  });

  it("returns config with no groups for empty input", () => {
    const config = generateMapChartConfig({}, {}, locToProvince);
    expect(Object.keys(config.groups)).toHaveLength(0);
  });
});
