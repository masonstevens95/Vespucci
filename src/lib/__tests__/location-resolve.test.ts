import { describe, it, expect } from "vitest";
import {
  UNRESOLVED,
  normalizeLocation,
  buildLocationIndex,
  resolveLocationId,
  resolveCountryLocations,
  LOCATION_INDEX,
} from "../location-resolve";

// Mirrors the real index's shape: lowercase save name -> canonical path ID.
const index = buildLocationIndex([
  "Stockholm",
  "Paris",
  "Bar_le_Duc",
  "Halle_an_der_Saale",
]);

describe("normalizeLocation", () => {
  it("lowercases a name", () => {
    expect(normalizeLocation("Stockholm")).toBe("stockholm");
  });

  it("leaves an already-lowercase name unchanged", () => {
    expect(normalizeLocation("stockholm")).toBe("stockholm");
  });

  it("preserves underscores", () => {
    expect(normalizeLocation("Bar_le_Duc")).toBe("bar_le_duc");
  });
});

describe("buildLocationIndex", () => {
  it("keys canonical IDs by their lowercased form", () => {
    expect(buildLocationIndex(["Stockholm"])).toEqual({ stockholm: "Stockholm" });
  });

  it("returns empty for empty input", () => {
    expect(buildLocationIndex([])).toEqual({});
  });
});

describe("resolveLocationId", () => {
  it("resolves a lowercase save name to the canonical ID", () => {
    expect(resolveLocationId("stockholm", index)).toBe("Stockholm");
  });

  it("resolves regardless of the input's case", () => {
    expect(resolveLocationId("STOCKHOLM", index)).toBe("Stockholm");
    expect(resolveLocationId("Stockholm", index)).toBe("Stockholm");
  });

  it("recovers lowercase particles that title-casing would break", () => {
    expect(resolveLocationId("bar_le_duc", index)).toBe("Bar_le_Duc");
    expect(resolveLocationId("halle_an_der_saale", index)).toBe("Halle_an_der_Saale");
  });

  it("returns the UNRESOLVED sentinel for a name with no shape", () => {
    expect(resolveLocationId("malaren", index)).toBe(UNRESOLVED);
    expect(UNRESOLVED).toBe("");
  });

  it("returns the sentinel for a loc_<id> placeholder", () => {
    expect(resolveLocationId("loc_9999", index)).toBe(UNRESOLVED);
  });
});

describe("resolveCountryLocations", () => {
  it("maps each tag's names to canonical IDs", () => {
    const result = resolveCountryLocations(
      { SWE: ["stockholm"], FRA: ["paris", "bar_le_duc"] },
      index,
    );
    expect(result.resolved).toEqual({
      SWE: ["Stockholm"],
      FRA: ["Paris", "Bar_le_Duc"],
    });
    expect(result.droppedCount).toBe(0);
  });

  it("drops unresolvable names and counts them", () => {
    const result = resolveCountryLocations(
      { SWE: ["stockholm", "malaren", "vanern"] },
      index,
    );
    expect(result.resolved).toEqual({ SWE: ["Stockholm"] });
    expect(result.droppedCount).toBe(2);
    expect(result.droppedSample).toEqual(["malaren", "vanern"]);
  });

  it("keeps a tag with an empty array when nothing resolves", () => {
    const result = resolveCountryLocations({ SWE: ["malaren"] }, index);
    expect(result.resolved).toEqual({ SWE: [] });
  });

  it("caps the dropped sample at 10 entries", () => {
    const names = Array.from({ length: 25 }, (_, i) => `lake_${i}`);
    const result = resolveCountryLocations({ SWE: names }, index);
    expect(result.droppedCount).toBe(25);
    expect(result.droppedSample).toHaveLength(10);
  });

  it("returns empty for empty input", () => {
    const result = resolveCountryLocations({}, index);
    expect(result.resolved).toEqual({});
    expect(result.droppedCount).toBe(0);
  });

  it("does not mutate its input", () => {
    const input = { SWE: ["stockholm", "malaren"] };
    resolveCountryLocations(input, index);
    expect(input).toEqual({ SWE: ["stockholm", "malaren"] });
  });
});

describe("LOCATION_INDEX (the committed asset's index)", () => {
  it("resolves real save names from the test save", () => {
    expect(resolveLocationId("stockholm", LOCATION_INDEX)).toBe("Stockholm");
    expect(resolveLocationId("uppsala", LOCATION_INDEX)).toBe("Uppsala");
    expect(resolveLocationId("edinburgh", LOCATION_INDEX)).toBe("Edinburgh");
  });

  it("resolves particle-cased names from the real asset", () => {
    expect(resolveLocationId("bar_le_duc", LOCATION_INDEX)).toBe("Bar_le_Duc");
    expect(resolveLocationId("zell_am_see", LOCATION_INDEX)).toBe("Zell_am_See");
  });

  it("does not resolve water bodies the land map omits", () => {
    expect(resolveLocationId("malaren", LOCATION_INDEX)).toBe(UNRESOLVED);
    expect(resolveLocationId("lake_onega", LOCATION_INDEX)).toBe(UNRESOLVED);
  });
});
