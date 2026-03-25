import { describe, it, expect } from "vitest";
import {
  normalizeLocation,
  buildLocationToProvince,
  lookupProvince,
  addVote,
  buildProvinceVotes,
  majorityOwner,
  groupByOwner,
  mapToProvinces,
} from "../province-mapping";

// =============================================================================
// Pure helper tests
// =============================================================================

describe("normalizeLocation", () => {
  it("lowercases a string", () => {
    expect(normalizeLocation("Stockholm")).toBe("stockholm");
  });

  it("handles already lowercase", () => {
    expect(normalizeLocation("paris")).toBe("paris");
  });

  it("handles mixed case with underscores", () => {
    expect(normalizeLocation("Mixed_Case")).toBe("mixed_case");
  });
});

describe("lookupProvince", () => {
  const locToProvince = { stockholm: "Uppland", paris: "Ile_de_France" };

  it("finds province for matching location", () => {
    expect(lookupProvince("stockholm", locToProvince)).toBe("Uppland");
  });

  it("matches case-insensitively", () => {
    expect(lookupProvince("Stockholm", locToProvince)).toBe("Uppland");
  });

  it("returns undefined for unmapped location", () => {
    expect(lookupProvince("nowhere", locToProvince)).toBeUndefined();
  });
});

describe("addVote", () => {
  it("adds a vote to empty map", () => {
    const result = addVote(new Map(), "Uppland", "SWE");
    expect(result.get("Uppland")?.get("SWE")).toBe(1);
  });

  it("increments existing vote", () => {
    const initial = new Map([["Uppland", new Map([["SWE", 2]])]]);
    const result = addVote(initial, "Uppland", "SWE");
    expect(result.get("Uppland")?.get("SWE")).toBe(3);
  });

  it("adds new tag to existing province", () => {
    const initial = new Map([["Uppland", new Map([["SWE", 1]])]]);
    const result = addVote(initial, "Uppland", "FRA");
    expect(result.get("Uppland")?.get("SWE")).toBe(1);
    expect(result.get("Uppland")?.get("FRA")).toBe(1);
  });

  it("does not mutate input", () => {
    const initial = new Map([["Uppland", new Map([["SWE", 1]])]]);
    addVote(initial, "Uppland", "SWE");
    expect(initial.get("Uppland")?.get("SWE")).toBe(1);
  });
});

describe("buildProvinceVotes", () => {
  const locToProvince = {
    stockholm: "Uppland",
    norrtalje: "Uppland",
    paris: "Ile_de_France",
  };

  it("tallies votes from country locations", () => {
    const votes = buildProvinceVotes(
      { SWE: ["stockholm", "norrtalje"], FRA: ["paris"] },
      locToProvince,
    );
    expect(votes.get("Uppland")?.get("SWE")).toBe(2);
    expect(votes.get("Ile_de_France")?.get("FRA")).toBe(1);
  });

  it("skips unmapped locations", () => {
    const votes = buildProvinceVotes(
      { SWE: ["stockholm", "nowhere"] },
      locToProvince,
    );
    expect(votes.get("Uppland")?.get("SWE")).toBe(1);
    expect(votes.size).toBe(1);
  });

  it("returns empty map for empty input", () => {
    expect(buildProvinceVotes({}, locToProvince).size).toBe(0);
  });
});

describe("majorityOwner", () => {
  it("returns tag with highest count", () => {
    const votes = new Map([["SWE", 3], ["FRA", 1]]);
    expect(majorityOwner(votes)).toBe("SWE");
  });

  it("returns first tag on tie", () => {
    const votes = new Map([["SWE", 2], ["FRA", 2]]);
    const result = majorityOwner(votes);
    expect(["SWE", "FRA"]).toContain(result);
  });

  it("returns empty string for empty votes", () => {
    expect(majorityOwner(new Map())).toBe("");
  });
});

describe("groupByOwner", () => {
  it("groups provinces by majority owner", () => {
    const votes = new Map([
      ["Uppland", new Map([["SWE", 2]])],
      ["Ile_de_France", new Map([["FRA", 1]])],
    ]);
    const result = groupByOwner(votes);
    expect(result["SWE"]).toEqual(["Uppland"]);
    expect(result["FRA"]).toEqual(["Ile_de_France"]);
  });

  it("assigns contested province to majority owner", () => {
    const votes = new Map([
      ["Uppland", new Map([["SWE", 3], ["FRA", 1]])],
    ]);
    const result = groupByOwner(votes);
    expect(result["SWE"]).toContain("Uppland");
    expect(result["FRA"]).toBeUndefined();
  });

  it("returns empty for empty input", () => {
    expect(groupByOwner(new Map())).toEqual({});
  });

  it("skips provinces with empty vote maps", () => {
    const votes = new Map<string, ReadonlyMap<string, number>>([
      ["Uppland", new Map([["SWE", 1]])],
      ["Ghost", new Map()], // no votes
    ]);
    const result = groupByOwner(votes);
    expect(result["SWE"]).toEqual(["Uppland"]);
    expect(Object.keys(result)).toHaveLength(1);
  });
});

// =============================================================================
// Integration tests
// =============================================================================

describe("buildLocationToProvince", () => {
  it("reverses province -> locations mapping", () => {
    const mapping = {
      Uppland: ["Stockholm", "Norrtalje", "Uppsala"],
      Ile_de_France: ["Paris", "Versailles"],
    };
    const result = buildLocationToProvince(mapping);
    expect(result["stockholm"]).toBe("Uppland");
    expect(result["norrtalje"]).toBe("Uppland");
    expect(result["paris"]).toBe("Ile_de_France");
  });

  it("lowercases all location keys", () => {
    const result = buildLocationToProvince({ Test: ["UPPER", "Mixed_Case"] });
    expect(result["upper"]).toBe("Test");
    expect(result["mixed_case"]).toBe("Test");
    expect(result["UPPER"]).toBeUndefined();
  });

  it("returns empty for empty mapping", () => {
    expect(buildLocationToProvince({})).toEqual({});
  });
});

describe("mapToProvinces", () => {
  const locToProvince: Record<string, string> = {
    stockholm: "Uppland",
    norrtalje: "Uppland",
    uppsala: "Uppland",
    paris: "Ile_de_France",
    versailles: "Ile_de_France",
    london: "Middlesex",
  };

  it("maps country locations to provinces", () => {
    const result = mapToProvinces(
      { SWE: ["stockholm", "norrtalje"], FRA: ["paris"] },
      locToProvince,
    );
    expect(result["SWE"]).toEqual(["Uppland"]);
    expect(result["FRA"]).toEqual(["Ile_de_France"]);
  });

  it("resolves majority owner for contested province", () => {
    const result = mapToProvinces(
      { SWE: ["stockholm", "norrtalje"], FRA: ["uppsala"] },
      locToProvince,
    );
    expect(result["SWE"]).toContain("Uppland");
    expect(result["FRA"]).toBeUndefined();
  });

  it("skips locations with no province mapping", () => {
    const result = mapToProvinces(
      { SWE: ["stockholm", "unmapped_location"] },
      locToProvince,
    );
    expect(result["SWE"]).toEqual(["Uppland"]);
  });

  it("returns empty for empty input", () => {
    expect(mapToProvinces({}, locToProvince)).toEqual({});
  });

  it("returns empty when no locations match", () => {
    expect(mapToProvinces({ SWE: ["nowhere"] }, locToProvince)).toEqual({});
  });
});
