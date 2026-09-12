import { describe, it, expect } from "vitest";
import {
  extractTag,
  isSubjectEntry,
  subjectOverlordTag,
  sortLegendEntries,
} from "../legend-sort";
import type { LegendEntry } from "../legend-sort";

describe("extractTag", () => {
  it("extracts tag from label with player", () => {
    expect(extractTag("GBR - Alice")).toBe("GBR");
  });

  it("returns full label when no separator", () => {
    expect(extractTag("GBR")).toBe("GBR");
  });

  it("extracts tag from subject label", () => {
    expect(extractTag("GBR - subjects")).toBe("GBR");
  });
});

describe("isSubjectEntry", () => {
  it("returns true for subject labels", () => {
    expect(isSubjectEntry("GBR - subjects")).toBe(true);
  });

  it("returns false for player labels", () => {
    expect(isSubjectEntry("GBR - Alice")).toBe(false);
  });

  it("returns false for bare tags", () => {
    expect(isSubjectEntry("GBR")).toBe(false);
  });
});

describe("subjectOverlordTag", () => {
  it("returns overlord tag for subject entry", () => {
    expect(subjectOverlordTag("GBR - subjects")).toBe("GBR");
  });

  it("returns empty for non-subject", () => {
    expect(subjectOverlordTag("GBR - Alice")).toBe("");
  });
});

describe("sortLegendEntries", () => {
  const entry = (label: string, count: number): LegendEntry => ({
    hex: "#" + label.slice(0, 6).padEnd(6, "0"),
    group: { label, paths: Array(count).fill("p") },
  });

  it("sorts alphabetically", () => {
    const entries = [entry("FRA", 5), entry("BOH", 3), entry("GBR", 10)];
    const sorted = sortLegendEntries(entries, "alpha");
    expect(sorted.map((e) => e.group.label)).toEqual(["BOH", "FRA", "GBR"]);
  });

  it("sorts by location count descending", () => {
    const entries = [entry("FRA", 5), entry("BOH", 3), entry("GBR", 10)];
    const sorted = sortLegendEntries(entries, "locations");
    expect(sorted.map((e) => e.group.label)).toEqual(["GBR", "FRA", "BOH"]);
  });

  it("breaks location count ties alphabetically", () => {
    const entries = [entry("FRA", 5), entry("BOH", 5)];
    const sorted = sortLegendEntries(entries, "locations");
    expect(sorted.map((e) => e.group.label)).toEqual(["BOH", "FRA"]);
  });

  it("places subject after overlord in alpha mode", () => {
    const entries = [
      entry("GBR - subjects", 20),
      entry("BOH - Alice", 5),
      entry("GBR - Bob", 10),
    ];
    const sorted = sortLegendEntries(entries, "alpha");
    const labels = sorted.map((e) => e.group.label);
    expect(labels).toEqual(["BOH - Alice", "GBR - Bob", "GBR - subjects"]);
  });

  it("places subject after overlord in locations mode", () => {
    const entries = [
      entry("GBR - subjects", 50),  // subjects have most locations
      entry("BOH - Alice", 30),
      entry("GBR - Bob", 10),
    ];
    const sorted = sortLegendEntries(entries, "locations");
    const labels = sorted.map((e) => e.group.label);
    // BOH has 30, GBR has 10 — BOH first by count
    // But GBR's subjects (50) stay after GBR, not sorted to top
    expect(labels.indexOf("GBR - subjects")).toBe(labels.indexOf("GBR - Bob") + 1);
  });

  it("handles multiple overlords with subjects", () => {
    const entries = [
      entry("TUR - subjects", 40),
      entry("GBR - subjects", 20),
      entry("GBR - Bob", 10),
      entry("TUR - Ali", 30),
    ];
    const sorted = sortLegendEntries(entries, "locations");
    const labels = sorted.map((e) => e.group.label);
    expect(labels.indexOf("TUR - subjects")).toBe(labels.indexOf("TUR - Ali") + 1);
    expect(labels.indexOf("GBR - subjects")).toBe(labels.indexOf("GBR - Bob") + 1);
  });

  it("handles orphaned subjects (overlord not in list)", () => {
    const entries = [entry("GBR - subjects", 10), entry("FRA", 5)];
    const sorted = sortLegendEntries(entries, "alpha");
    expect(sorted).toHaveLength(2);
    expect(sorted.map((e) => e.group.label)).toContain("GBR - subjects");
  });

  it("sorts by total (direct + subjects) in total mode", () => {
    const entries = [
      entry("GBR - Bob", 5),
      entry("GBR - subjects", 30),
      entry("FRA - Alice", 20),
    ];
    const sorted = sortLegendEntries(entries, "total");
    const labels = sorted.map((e) => e.group.label);
    // GBR total = 5 + 30 = 35 > FRA 20
    expect(labels[0]).toBe("GBR - Bob");
    expect(labels[1]).toBe("GBR - subjects");
    expect(labels[2]).toBe("FRA - Alice");
  });

  it("total mode: country without subjects uses direct count", () => {
    const entries = [
      entry("FRA", 10),
      entry("BOH", 3),
      entry("BOH - subjects", 15),
    ];
    const sorted = sortLegendEntries(entries, "total");
    const labels = sorted.map((e) => e.group.label);
    // BOH total = 3 + 15 = 18 > FRA 10
    expect(labels[0]).toBe("BOH");
    expect(labels[1]).toBe("BOH - subjects");
    expect(labels[2]).toBe("FRA");
  });

  it("handles empty entries", () => {
    expect(sortLegendEntries([], "alpha")).toEqual([]);
  });
});
