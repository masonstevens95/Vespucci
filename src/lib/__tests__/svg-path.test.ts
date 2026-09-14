import { describe, it, expect } from "vitest";
import { pathVertices } from "../svg-path";

describe("pathVertices", () => {
  it("walks absolute commands into endpoints", () => {
    expect(pathVertices("M10 20L30 40")).toEqual([
      [10, 20],
      [30, 40],
    ]);
  });

  it("accumulates relative commands from the current point", () => {
    expect(pathVertices("m10 20l5 5l5 5")).toEqual([
      [10, 20],
      [15, 25],
      [20, 30],
    ]);
  });

  it("keeps only the endpoint of a cubic curve, not its control points", () => {
    // Control points sit off the border; including them would pull false
    // matches toward shapes the path does not touch.
    expect(pathVertices("M0 0c1 1 2 2 3 3")).toEqual([
      [0, 0],
      [3, 3],
    ]);
  });

  it("keeps only the endpoint of a smooth cubic", () => {
    expect(pathVertices("M0 0s1 1 3 3")).toEqual([
      [0, 0],
      [3, 3],
    ]);
  });

  it("keeps only the endpoint of a quadratic", () => {
    expect(pathVertices("M0 0q1 1 4 4")).toEqual([
      [0, 0],
      [4, 4],
    ]);
  });

  it("keeps only the endpoint of an arc", () => {
    expect(pathVertices("M0 0a5 5 0 0 1 10 10")).toEqual([
      [0, 0],
      [10, 10],
    ]);
  });

  it("treats h and v as single-axis moves", () => {
    expect(pathVertices("M0 0h5v5")).toEqual([
      [0, 0],
      [5, 0],
      [5, 5],
    ]);
  });

  it("closes a subpath back to its start", () => {
    expect(pathVertices("M1 1L5 1L5 5Z")).toEqual([
      [1, 1],
      [5, 1],
      [5, 5],
      [1, 1],
    ]);
  });

  it("parses a compact decimal run with no separators", () => {
    // "-.06.01" is two numbers, -0.06 and 0.01 — the asset's own encoding.
    // Compared approximately because relative commands accumulate float error,
    // which is harmless at an epsilon four orders of magnitude larger.
    const pts = pathVertices("m590.7 115.45-.06.01");
    expect(pts).toHaveLength(2);
    expect(pts[1][0]).toBeCloseTo(590.64, 6);
    expect(pts[1][1]).toBeCloseTo(115.46, 6);
  });

  it("treats trailing pairs of an m run as linetos without moving the subpath start", () => {
    // Only the first pair of an `m` run is a move; Z must return to that
    // point, not to the last implicit lineto.
    expect(pathVertices("m0 0 5 0 5 5Z")).toEqual([
      [0, 0],
      [5, 0],
      [10, 5],
      [0, 0],
    ]);
  });

  it("handles multiple subpaths, closing each to its own start", () => {
    expect(pathVertices("M0 0L2 0ZM10 10L12 10Z")).toEqual([
      [0, 0],
      [2, 0],
      [0, 0],
      [10, 10],
      [12, 10],
      [10, 10],
    ]);
  });

  it("accepts exponent notation", () => {
    expect(pathVertices("M1e2 2e1")).toEqual([[100, 20]]);
  });

  it("returns no vertices for empty path data", () => {
    expect(pathVertices("")).toEqual([]);
  });

  it("returns no vertices for data with no commands", () => {
    expect(pathVertices("   ")).toEqual([]);
  });

  it("ignores a command with too few arguments rather than throwing", () => {
    expect(() => pathVertices("M10")).not.toThrow();
  });

  it("ignores trailing arguments that do not fill a command", () => {
    // A stray number after a complete pair is not enough for another lineto.
    expect(pathVertices("M0 0L5 5 7")).toEqual([
      [0, 0],
      [5, 5],
    ]);
  });
});
