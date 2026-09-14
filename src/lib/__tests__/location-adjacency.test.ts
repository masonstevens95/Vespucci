import { describe, it, expect } from "vitest";
// @ts-expect-error — the generator is a plain .mjs build script with no types.
import { buildAdjacency, toIndexForm } from "../../../scripts/generate-location-adjacency.mjs";
import { pathVertices } from "../svg-path";
import { loadAdjacency } from "../location-adjacency";
import adjacencyAsset from "../location-adjacency.json";
import locationIds from "../location-ids.json";

const ids = locationIds as readonly string[];
const adj = adjacencyAsset as readonly number[][];

/** Neighbour names of a canonical id, for readable assertions. */
const neighborsOf = (id: string): string[] => {
  const i = ids.indexOf(id);
  return i === -1 ? [] : adj[i].map((n) => ids[n]).sort();
};

/** A closed square as an SVG path, at the given origin and size. */
const square = (x: number, y: number, size: number): string =>
  `M${x} ${y}L${x + size} ${y}L${x + size} ${y + size}L${x} ${y + size}Z`;

const shape = (id: string, d: string) => ({ id, vertices: pathVertices(d) });

describe("buildAdjacency", () => {
  it("links two squares that share an edge", () => {
    const shapes = [shape("A", square(0, 0, 10)), shape("B", square(10, 0, 10))];
    expect(buildAdjacency(shapes, 0.15)).toEqual({ A: ["B"], B: ["A"] });
  });

  it("leaves squares separated by more than epsilon unlinked", () => {
    const shapes = [shape("A", square(0, 0, 10)), shape("B", square(11, 0, 10))];
    expect(buildAdjacency(shapes, 0.15)).toEqual({});
  });

  it("links squares separated by less than epsilon", () => {
    const shapes = [shape("A", square(0, 0, 10)), shape("B", square(10.1, 0, 10))];
    expect(buildAdjacency(shapes, 0.15)).toEqual({ A: ["B"], B: ["A"] });
  });

  it("never links a shape to itself", () => {
    expect(buildAdjacency([shape("A", square(0, 0, 10))], 0.15)).toEqual({});
  });

  it("records each neighbour once however many vertices touch", () => {
    const shapes = [shape("A", square(0, 0, 10)), shape("B", square(0, 0, 10))];
    expect(buildAdjacency(shapes, 0.15)).toEqual({ A: ["B"], B: ["A"] });
  });

  it("sorts neighbour lists so a regenerated asset diffs cleanly", () => {
    const shapes = [
      shape("M", square(10, 0, 10)),
      shape("Z", square(20, 0, 10)),
      shape("A", square(0, 0, 10)),
    ];
    expect(buildAdjacency(shapes, 0.15).M).toEqual(["A", "Z"]);
  });

  it("returns nothing for a shape with no vertices", () => {
    expect(buildAdjacency([{ id: "A", vertices: [] }], 0.15)).toEqual({});
  });
});

describe("toIndexForm", () => {
  it("re-keys names onto canonical-id positions", () => {
    expect(toIndexForm({ A: ["C"], C: ["A"] }, ["A", "B", "C"])).toEqual([[2], [], [0]]);
  });

  it("gives an isolated id an empty array rather than omitting it", () => {
    expect(toIndexForm({}, ["A", "B"])).toEqual([[], []]);
  });

  it("drops a neighbour that is not a canonical id", () => {
    expect(toIndexForm({ A: ["B", "Ghost"] }, ["A", "B"])).toEqual([[1], []]);
  });

  it("sorts indices ascending", () => {
    expect(toIndexForm({ A: ["C", "B"] }, ["A", "B", "C"])).toEqual([[1, 2], [], []]);
  });
});

describe("the committed adjacency asset", () => {
  it("is parallel to location-ids.json", () => {
    expect(adj.length).toBe(ids.length);
  });

  it("holds Uppsala's five real neighbours", () => {
    expect(neighborsOf("Uppsala")).toEqual([
      "Enkoping",
      "Heby",
      "Norrtalje",
      "Stockholm",
      "Tierp",
    ]);
  });

  it("surrounds Alaska_Range with its Alaskan neighbours", () => {
    const nb = neighborsOf("Alaska_Range");
    expect(nb).toContain("Denali");
    expect(nb).toContain("Cantwell");
    expect(nb.length).toBeGreaterThan(8);
  });

  it("leaves an island with no neighbours", () => {
    // Amrum is a genuine island: it shares no land border at any epsilon.
    expect(neighborsOf("Amrum_Island_Wasteland")).toEqual([]);
  });

  it("is symmetric", () => {
    const asymmetric: string[] = [];
    adj.forEach((neighbors, i) => {
      for (const n of neighbors) {
        if (!adj[n].includes(i)) {
          asymmetric.push(`${ids[i]} -> ${ids[n]}`);
        } else {
          /* edge is reciprocated */
        }
      }
    });
    expect(asymmetric).toEqual([]);
  });

  it("has no self-edges", () => {
    expect(adj.filter((neighbors, i) => neighbors.includes(i))).toEqual([]);
  });

  it("has no duplicate entries within a neighbour list", () => {
    expect(adj.filter((n) => new Set(n).size !== n.length)).toEqual([]);
  });

  it("indexes only positions that exist in the id list", () => {
    const outOfRange = adj
      .flat()
      .filter((n) => !Number.isInteger(n) || n < 0 || n >= ids.length);
    expect(outOfRange).toEqual([]);
  });

  it("leaves every location with a plausible neighbour count", () => {
    // A shape with an implausible degree is the signal that epsilon has
    // started bridging shapes that do not actually touch.
    expect(adj.filter((n) => n.length > 60)).toEqual([]);
  });
});

describe("loadAdjacency", () => {
  it("resolves to the committed graph", async () => {
    expect((await loadAdjacency()).length).toBe(ids.length);
  });

  it("reuses one request across concurrent callers", async () => {
    const [a, b] = await Promise.all([loadAdjacency(), loadAdjacency()]);
    expect(a).toBe(b);
  });
});
