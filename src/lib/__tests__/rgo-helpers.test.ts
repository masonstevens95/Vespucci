import { describe, it, expect } from "vitest";
import { buildCountryProduction, topGoodsForCountry, topProducersForGood } from "../rgo-helpers";
import type { RgoData } from "../types";

const mkRgo = (good: string, size: number, employment: number = 0): RgoData => ({
  good, size, employment, maxSize: 10, method: "farming", outputScale: 1,
});

describe("buildCountryProduction", () => {
  it("returns empty when no locations", () => {
    const result = buildCountryProduction({}, {});
    expect(result).toEqual({});
  });

  it("attributes RGO to owning country", () => {
    const result = buildCountryProduction(
      { 1: mkRgo("grain", 3, 3000) },
      { 1: "GBR" },
    );
    expect(result["GBR"]["grain"]).toEqual({ totalSize: 3, totalEmployment: 3000, locationCount: 1 });
  });

  it("skips locations with no owner", () => {
    const result = buildCountryProduction(
      { 1: mkRgo("grain", 2) },
      {},
    );
    expect(result).toEqual({});
  });

  it("accumulates multiple locations of the same good", () => {
    const result = buildCountryProduction(
      { 1: mkRgo("grain", 3, 3000), 2: mkRgo("grain", 2, 2000) },
      { 1: "FRA", 2: "FRA" },
    );
    expect(result["FRA"]["grain"]).toEqual({ totalSize: 5, totalEmployment: 5000, locationCount: 2 });
  });

  it("tracks multiple goods for the same country", () => {
    const result = buildCountryProduction(
      { 1: mkRgo("grain", 3), 2: mkRgo("iron", 2) },
      { 1: "GBR", 2: "GBR" },
    );
    expect(result["GBR"]["grain"].locationCount).toBe(1);
    expect(result["GBR"]["iron"].locationCount).toBe(1);
  });

  it("tracks production across multiple countries", () => {
    const result = buildCountryProduction(
      { 1: mkRgo("grain", 3), 2: mkRgo("grain", 4) },
      { 1: "GBR", 2: "FRA" },
    );
    expect(result["GBR"]["grain"].totalSize).toBe(3);
    expect(result["FRA"]["grain"].totalSize).toBe(4);
  });

  it("attributes each location to its owner independently", () => {
    const result = buildCountryProduction(
      { 1: mkRgo("silver", 1), 2: mkRgo("copper", 5) },
      { 1: "GBR", 2: "SWE" },
    );
    expect(Object.keys(result)).toHaveLength(2);
    expect(result["GBR"]["silver"]).toBeDefined();
    expect(result["SWE"]["copper"]).toBeDefined();
  });
});

describe("topGoodsForCountry", () => {
  it("returns goods sorted by totalSize descending", () => {
    const production = {
      grain: { totalSize: 2, totalEmployment: 2000, locationCount: 1 },
      iron: { totalSize: 5, totalEmployment: 5000, locationCount: 2 },
      fish: { totalSize: 3, totalEmployment: 3000, locationCount: 1 },
    };
    const top = topGoodsForCountry(production, 3);
    expect(top.map((t) => t.good)).toEqual(["iron", "fish", "grain"]);
  });

  it("respects the limit", () => {
    const production = {
      grain: { totalSize: 1, totalEmployment: 0, locationCount: 1 },
      iron: { totalSize: 5, totalEmployment: 0, locationCount: 1 },
      fish: { totalSize: 3, totalEmployment: 0, locationCount: 1 },
    };
    expect(topGoodsForCountry(production, 2)).toHaveLength(2);
  });

  it("returns empty for empty production", () => {
    expect(topGoodsForCountry({}, 3)).toHaveLength(0);
  });

  it("returns all goods when count is below limit", () => {
    const production = {
      grain: { totalSize: 2, totalEmployment: 0, locationCount: 1 },
    };
    expect(topGoodsForCountry(production, 5)).toHaveLength(1);
  });
});

describe("topProducersForGood", () => {
  const production = {
    GBR: { grain: { totalSize: 3, totalEmployment: 3000, locationCount: 2 }, iron: { totalSize: 1, totalEmployment: 1000, locationCount: 1 } },
    FRA: { grain: { totalSize: 5, totalEmployment: 5000, locationCount: 3 } },
    SWE: { copper: { totalSize: 4, totalEmployment: 4000, locationCount: 2 } },
  };

  it("returns producers sorted by totalSize descending", () => {
    const result = topProducersForGood("grain", production, 5);
    expect(result.map(p => p.tag)).toEqual(["FRA", "GBR"]);
  });

  it("excludes countries that don't produce the good", () => {
    const result = topProducersForGood("grain", production, 5);
    expect(result.find(p => p.tag === "SWE")).toBeUndefined();
  });

  it("respects the limit", () => {
    expect(topProducersForGood("grain", production, 1)).toHaveLength(1);
    expect(topProducersForGood("grain", production, 1)[0].tag).toBe("FRA");
  });

  it("returns empty when no country produces the good", () => {
    expect(topProducersForGood("silk", production, 5)).toHaveLength(0);
  });

  it("returns empty for empty production map", () => {
    expect(topProducersForGood("grain", {}, 5)).toHaveLength(0);
  });

  it("includes correct totalSize and locationCount", () => {
    const result = topProducersForGood("grain", production, 5);
    const fra = result.find(p => p.tag === "FRA")!;
    expect(fra.totalSize).toBe(5);
    expect(fra.locationCount).toBe(3);
  });
});
